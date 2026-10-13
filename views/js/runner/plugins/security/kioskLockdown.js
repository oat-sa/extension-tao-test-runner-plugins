/**
 * Kiosk{ed} lockdown: client detection, breach trace, exit after submit.
 */
define([
    'lodash',
    'i18n',
    'jquery',
    'taoTests/runner/plugin',
    'taoTestRunnerPlugins/runner/service/kiosk',
    'css!taoTestRunnerPlugins/runner/plugins/security/css/kioskLockdown'
], function (_, __, $, pluginFactory, kioskModule) {
    'use strict';

    var BREACH_KEY_PREFIX = 'kiosk-breach-';
    var FLUSH_DEBOUNCE_MS = 3000;
    var MSG_DEFER_FINISH = 'taoKioskLockdownDeferFinish';
    var MSG_EXIT = 'taoKioskLockdownExit';
    var EXIT_BAR_ID = 'kiosk-exit-bar';

    var exitBarStyles = {
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 10000,
        padding: '12px 16px',
        textAlign: 'center',
        background: 'rgba(0, 0, 0, 0.85)'
    };

    var exitButtonStyles = {
        minWidth: '240px'
    };

    return pluginFactory({
        name: 'kioskLockdown',

        install: function install() {
            var testRunner = this.getTestRunner();
            var config = this.getConfig() || {};
            var kiosk = kioskModule.createKioskService({ minVersion: config.minVersion });
            var proxy = testRunner.getProxy();
            var originalInit = proxy.init;

            proxy.init = function initWithKioskDetection(initConfig, params) {
                var initParams = _.extend({}, params);

                return kiosk.whenAvailable().then(function (available) {
                    if (available) {
                        initParams.clientKioskApiOk = '1';
                    }

                    return originalInit.call(proxy, initConfig, initParams);
                });
            };
        },

        init: function init() {
            var testRunner = this.getTestRunner();
            var config = this.getConfig() || {};
            var kiosk = kioskModule.createKioskService({ minVersion: config.minVersion });
            var pendingTrace = {};
            var breachSeq = 0;
            var flushTimer;
            var kioskActive = false;

            function postToParent(message) {
                if (window.parent === window) {
                    return;
                }

                try {
                    window.parent.postMessage(message, window.location.origin);
                } catch (err) {
                    // ponytail: ignore if parent is unreachable
                }
            }

            function getExitMountDocument() {
                try {
                    if (window.top && window.top.document && window.top.document.body) {
                        return window.top.document;
                    }
                } catch (err) {
                    // cross-origin top
                }

                return document;
            }

            function removeExitBar(mountDoc) {
                $(mountDoc.getElementById(EXIT_BAR_ID)).remove();
            }

            function flushTrace() {
                var keys = Object.keys(pendingTrace);

                if (!keys.length) {
                    return Promise.resolve();
                }

                var batch = pendingTrace;

                pendingTrace = {};

                return testRunner
                    .getProxy()
                    .sendVariables(batch)
                    .catch(function (err) {
                        _.merge(pendingTrace, batch);
                        testRunner.trigger('error', err);
                    });
            }

            function scheduleFlush() {
                if (flushTimer) {
                    clearTimeout(flushTimer);
                }

                flushTimer = setTimeout(function () {
                    flushTimer = null;
                    flushTrace();
                }, FLUSH_DEBOUNCE_MS);
            }

            function recordBreach(type, detail) {
                breachSeq += 1;
                var context = testRunner.getTestContext();
                var key = BREACH_KEY_PREFIX + type + '-' + breachSeq;

                pendingTrace[key] = {
                    type: type,
                    ts: Date.now(),
                    itemIdentifier: context && context.itemIdentifier,
                    detail: detail || {}
                };

                scheduleFlush();
            }

            function notifyDeferFinishRedirect() {
                postToParent({ type: MSG_DEFER_FINISH });
            }

            function showExitButton() {
                var mountDoc = getExitMountDocument();
                var $mountBody = $(mountDoc.body);

                if (mountDoc.getElementById(EXIT_BAR_ID)) {
                    return;
                }

                var $bar = $('<div id="' + EXIT_BAR_ID + '" class="kiosk-exit-bar">' +
                    '<button type="button" class="kiosk-exit-button btn btn-primary">' +
                    __('Esci dal browser di lockdown') +
                    '</button></div>');

                $bar.css(exitBarStyles);
                $bar.find('button').css(exitButtonStyles);

                $bar.find('button').on('click', function () {
                    var doc = getExitMountDocument();

                    flushTrace().finally(function () {
                        postToParent({ type: MSG_EXIT });
                        removeExitBar(doc);
                        kiosk.exit();
                    });
                });

                $mountBody.append($bar);
            }

            function onTestFinish() {
                notifyDeferFinishRedirect();

                try {
                    sessionStorage.setItem('taoKioskLockdownPendingExit', '1');
                } catch (storageErr) {
                    // ponytail: ignore private mode
                }

                showExitButton();
            }

            function startKioskIntegration() {
                kiosk.validateMinVersion().catch(function (err) {
                    testRunner.trigger('warning', err);
                });

                kiosk.addBreachListener(function (detail) {
                    recordBreach('breach', detail);
                });

                testRunner
                    .before('unloaditem', function () {
                        return flushTrace();
                    })
                    .on('leave finish', function () {
                        return flushTrace();
                    })
                    .on('finish', onTestFinish)
                    .on('destroy', function () {
                        if (flushTimer) {
                            clearTimeout(flushTimer);
                        }

                        kiosk.removeBreachListener();
                    });
            }

            kiosk.whenAvailable().then(function (available) {
                kioskActive = available;

                if (available) {
                    startKioskIntegration();
                }
            });

            testRunner.on('finish', function () {
                if (kioskActive) {
                    return;
                }

                kiosk.whenAvailable().then(function (available) {
                    if (!available) {
                        return;
                    }

                    kioskActive = true;
                    startKioskIntegration();
                    onTestFinish();
                });
            });
        }
    });
});
