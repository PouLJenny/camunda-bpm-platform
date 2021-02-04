/*
 * Copyright Camunda Services GmbH and/or licensed to Camunda Services GmbH
 * under one or more contributor license agreements. See the NOTICE file
 * distributed with this work for additional information regarding copyright
 * ownership. Camunda licenses this file to you under the Apache License,
 * Version 2.0; you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

// /* eslint-disable */
'use strict';
const createForm = require('camunda-forms').createForm;

console.log('foo');

var angular = require('../../../../../../camunda-commons-ui/vendor/angular');

module.exports = [
  'CamForm',
  'camAPI',
  '$timeout',
  '$translate',
  'Notifications',
  'Uri',
  'unfixDate',
  function(
    CamForm,
    camAPI,
    $timeout,
    $translate,
    Notifications,
    Uri,
    unfixDate
  ) {
    return {
      restrict: 'A',

      require: '^camTasklistForm',

      scope: true,

      template: '',

      link: function($scope, $element, attrs, formController) {
        let result;
        const Task = camAPI.resource('task');
        const ProcessDefinition = camAPI.resource('process-definition');

        const options = formController.getOptions();
        options.hideCompleteButton = true;
        options.hideStartButton = true;

        $scope.variables = [];

        const loadVariables = function() {
          if (!formController.getParams().taskId) {
            console.log(formController.getParams());
            return;
          }

          return Task.formVariables({
            id: formController.getParams().taskId,
            deserializeValues: false
          })
            .then(result => {
              angular.forEach(result, function(value, name) {
                var parsedValue = value.value;

                if (value.type === 'Date') {
                  parsedValue = unfixDate(parsedValue);
                }
                $scope.variables.push({
                  name: name,
                  value: parsedValue,
                  type: value.type,
                  fixedName: true
                });
              });
            })
            .catch(err => {
              $scope.variablesLoaded = false;
              return $translate('LOAD_VARIABLES_FAILURE')
                .then(function(translated) {
                  Notifications.addError({
                    status: translated,
                    message: err.message,
                    scope: $scope
                  });
                })
                .catch(angular.noop);
            });
        };

        function renderForm(schema) {
          const data = $scope.variables.reduce((res, variable) => {
            res[variable.name] = variable.value;
            return res;
          }, {});

          const form = createForm({
            container: $element[0],
            schema,
            data
          });
          formController.notifyFormInitialized();

          form.on('submit', event => {
            if (Object.keys(event.errors).length) {
              return;
            }
            const variablePayload = Object.entries(event.data).reduce(
              (res, [key, value]) => {
                res[key] = {value};
                return res;
              },
              {}
            );

            console.log(variablePayload);

            if (formController.getParams().taskId) {
              console.log('submit it');
              Task.submitForm({
                id: formController.getParams().taskId,
                variables: variablePayload
              })
                .then(() => {
                  formController.attemptComplete();
                })
                .catch(err => {
                  console.error(err);
                });
            } else {
              ProcessDefinition.submitForm({
                id: formController.getParams().processDefinitionId,
                variables: variablePayload
              })
                .then(res => {
                  console.log(res);
                  result = res;
                  formController.attemptComplete(res);
                })
                .catch(err => {
                  console.error(err);
                });
            }
          });
        }

        function handleAsynchronousFormKey(formInfo) {
          fetch(formInfo.key).then(async res => {
            const json = await res.json();

            await loadVariables();
            renderForm(json);
          });
        }

        formController.registerCompletionHandler(cb => {
          cb(null, result);
        });

        $scope.$watch('asynchronousFormKey', handleAsynchronousFormKey, true);
      }
    };
  }
];
