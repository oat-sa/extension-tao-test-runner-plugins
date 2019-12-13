/**
 * This program is free software; you can redistribute it and/or
 * modify it under the terms of the GNU General Public License
 * as published by the Free Software Foundation; under version 2
 * of the License (non-upgradable).
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program; if not, write to the Free Software
 * Foundation, Inc., 51 Franklin Street, Fifth Floor, Boston, MA  02110-1301, USA.
 *
 * Copyright (c) 2019 (original work) Open Assessment Technologies SA ;
 */
/**
 * Plugin which allows a Test-Taker to download their unsynced test progress
 * as a file in the event of connection loss.
 *
 * This is built to work with taoQtiTest/views/js/runner/plugins/controls/connectivity/connectivity.js
 *
 * @author Martin Nicholson <martin@taotesting.com>
 */
define([
    'jquery',
    'lodash',
    'i18n',
    'core/promise',
    'core/logger',
    'core/polling',
    'util/download',
    'ui/waitingDialog/waitingDialog',
    'ui/feedback',
    'layout/loading-bar',
    'taoTests/runner/plugin',
    'taoQtiTest/runner/helpers/navigation'
], function (
    $,
    _,
    __,
    Promise,
    loggerFactory,
    polling,
    download,
    waitingDialogFactory,
    feedback,
    loadingBar,
    pluginFactory,
    navigationHelper
) {
    'use strict';

    var logger = loggerFactory('disconnectedTestSaver');

    /**
     * Creates the connectivity plugin.
     * Detects connectivity issues
     */
    return pluginFactory({

        name: 'disconnectedTestSaver',

        /**
         * Initializes the plugin (called during runner's init)
         */
        init: function init() {
        },

        /**
         * Installs the plugin (called when the runner bind the plugin)
         * We do it before init to catch even offline during the init sequence
         */
        install: function install() {
            var self = this;

            var waiting    = false;

            var testRunner = this.getTestRunner();
            var proxy      = testRunner.getProxy();

            /**
             * Display the waiting dialog, while waiting the connection to be back
             * @param {String} [message] - additional message for the dialog
             * @param {Boolean} [offerDownload] - should file download be offered as a secondary option?
             * @returns {Promise} resolves once the wait is over and the user click on 'proceed'
             */
            this.displayWaitingDialog = function displayWaitingDialog(message, offerDownload){
                var waitingDialog;
                var waitingConfig;
                var $secondaryButton;
                var secondaryButtonWait = 60; // seconds to wait until it enables
                var $countdownText;
                var countdownPolling;
                offerDownload = offerDownload || false;

                return new Promise(function(resolve) {
                    if (!waiting) {
                        waiting = true;

                        //if a pause event occurs while waiting,
                        //we also wait the connection to be back
                        testRunner.before('pause.waiting', function() {
                            return new Promise(function(pauseResolve) {
                                proxy.off('reconnect.pausing')
                                    .after('reconnect.pausing', pauseResolve);
                            });
                        });

                        if (offerDownload) {
                            // end-of-test variant
                            waitingConfig = {
                                message : __('You are encountering a prolonged connectivity loss.'),
                                waitContent : __('Please continue waiting while we try to restore the connection. Alternatively, you may end this test by downloading it as a file which you will have to submit manually.'),
                                proceedContent : __('The connection seems to be back, please proceed'),
                                showSecondary: true,
                                secondaryButtonText: __('Download & End Assessment'),
                                secondaryButtonIcon: 'download',
                                buttonSeparatorText: __('or'),
                                width: '600px'
                            };
                        }
                        else {
                            // normal mid-test variant
                            waitingConfig = {
                                message : __('You are encountering a prolonged connectivity loss. ') + message,
                                waitContent : __('Please wait while we try to restore the connection.'),
                                proceedContent : __('The connection seems to be back, please proceed')
                            };
                        }

                        //creates the waiting modal dialog
                        waitingDialog = waitingDialogFactory(waitingConfig)
                        .on('proceed', function(){
                            resolve();
                        })
                        .on('render', function(){
                            $secondaryButton = $('button[data-control="secondary"]');

                            proxy
                                .off('reconnect.waiting')
                                .after('reconnect.waiting', function(){
                                    testRunner.off('pause.waiting');
                                    waiting = false;
                                    waitingDialog.endWait();
                                });
                            // if render comes before beginWait:
                            if (waitingDialog.is('waiting')) {
                                waitingDialog.trigger('begincountdown');
                            }
                        })
                        .on('wait', function() {
                            // if beginWait comes before render:
                            if (waitingDialog.is('rendered')) {
                                waitingDialog.trigger('begincountdown');
                            }
                        })
                        .on('begincountdown', function() {
                            var delaySec = secondaryButtonWait;
                            if (offerDownload) {
                                // Set up secondary button time delay:
                                // it can only be clicked after 60 seconds have passed
                                $secondaryButton.prop('disabled', true);
                                $countdownText = $("<p>").addClass('button-subtext').insertAfter($secondaryButton);
                                countdownPolling = polling({
                                    action: function() {
                                        delaySec--;
                                        $countdownText.html(__('The download will be available in <strong>%d</strong> seconds', delaySec));
                                        if (delaySec < 1) {
                                            this.stop();
                                            $secondaryButton.prop('disabled', false);
                                            $countdownText.remove();
                                        }
                                    },
                                    interval: 1000,
                                    autoStart: true
                                });
                            }
                        })
                        .on('unwait', function() {
                            if (offerDownload) {
                                // Reset button:
                                countdownPolling.stop();
                                $secondaryButton.prop('disabled', true);
                                $countdownText.remove();
                                $('.between-buttons-text').addClass('hidden');
                            }
                        })
                        // Wire up secondary button - download functionality
                        .on('secondaryaction', function() {
                            // User chose to begin the download process
                            self.getActions()
                                .then(self.prepareDownload)
                                .then(function(data) {
                                    download(data.filename, data.content);
                                    // Clear original dialog:
                                    waitingDialog.destroy();
                                    loadingBar.stop();
                                    // Display feedback alert:
                                    feedback(null, {
                                        timeout: -1,
                                        popup: true
                                    }).info(__('Assessment ended. Please email the downloaded file to complete the process.'));
                                    // Resolve the waiting dialog and leave the test:
                                    resolve();
                                })
                                .catch(function(err) {
                                    if (err) {
                                        testRunner.trigger('error', err);
                                    }
                                });
                        });
                    }
                });
            };

            /**
             * Fetch actions from the actionStore
             * @returns {Promise}
             */
            this.getActions = function getActions() {
                return testRunner.getProxy().exportActions()
                    .then(function(actionsQueue) {
                        if (actionsQueue.length) {
                            return actionsQueue;
                        }
                        return Promise.reject(new Error('No actions in queue'));
                    });
            };

            /**
             * Retrieve/structure the data which will go into the downloadable file
             * @param {Object} actions - array of actions from the actionStore
             * @returns {Promise}
             */
            this.prepareDownload = function prepareDownload(actions) {
                const testConfig = testRunner.getConfig();
                const timestamp = Date.now();
                const dateTime = new Date(timestamp).toISOString();

                //@deprecated  this can be empty, all values will be available from the config
                const testData = testRunner.getTestData() || {};
                const testMap  = testRunner.getTestMap();
                const testTitle = testMap.title || testData.title;
                const filename = `Download of ${testTitle} at ${dateTime}.json`;

                return {
                    filename,
                    content: JSON.stringify({
                        timestamp,
                        testData,
                        testConfig,
                        actionQueue: actions
                    })
                };
            };

            // Intercept attempts to end the test when offline:
            testRunner.before('next skip', function(e, data){
                const testContext = testRunner.getTestContext();
                const isLast = navigationHelper.isLast(
                    testRunner.getTestMap(),
                    testContext.itemIdentifier
                );

                if (isLast && proxy.isOffline()) {
                    // Suppress usual offline error behaviour:
                    testRunner.off('error.connectivity');
                    testRunner.before('error.connectivity', function(err) {
                        logger.warn(err);
                        return false;
                    });

                    // Offer file download in the waiting dialog:
                    self.displayWaitingDialog(null, true)
                        .then(function(){
                            testRunner.trigger('leave', data);
                        })
                        .catch(function(generalErr){
                            testRunner.trigger('error', generalErr);
                        });

                    return false;
                }
            });
        }
    });
});
