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
 * Copyright (c) 2026 (original work) Open Assessment Technologies SA ;
 *
 * Lock down browser: client session, security violations, exit after submit.
 */
define([
    'lodash',
    'jquery',
    'context',
    'taoTests/runner/plugin',
    'tao/lockDownBrowser/lockDownBrowserService',
    'css!taoTestRunnerPlugins/runner/plugins/security/css/lockDownBrowser'
], function (_, $, context, pluginFactory, lockDownBrowserModule) {
    'use strict';

    var ui = lockDownBrowserModule.uiProtocol;
    var FLUSH_DEBOUNCE_MS = 3000;
    var SIMULATE_VIOLATION_INTERVAL_MS = 30000;

    function getLockDownBrowserClientConfig() {
        return (context && context.lockDownBrowser) || {};
    }

    function createService(config) {
        return lockDownBrowserModule.createLockDownBrowserService(config);
    }

    function buildServiceConfig(clientConfig, pluginConfig, testRunner) {
        var merged = _.extend({}, clientConfig);
        var runnerPluginConfig =
            testRunner && typeof testRunner.getPluginConfig === 'function'
                ? testRunner.getPluginConfig('lockDownBrowser')
                : {};
        var pluginOptions = _.extend({}, runnerPluginConfig, pluginConfig);

        if (pluginOptions.driver) {
            merged.driver = pluginOptions.driver;
        }

        if (pluginOptions.minVersion) {
            merged.minVersion = pluginOptions.minVersion;
        }

        return merged;
    }

    function isLockDownBrowserSession(available, ldb) {
        return available || ldb.isMockDriver();
    }

    return pluginFactory({
        name: 'lockDownBrowser',

        install: function install() {
            var testRunner = this.getTestRunner();
            var plugin = this;
            var proxy = testRunner.getProxy();
            var originalInit = proxy.init;

            proxy.init = function initWithLockDownBrowserDetection(initParamsFromRunner, params) {
                var initParams = _.extend({}, initParamsFromRunner, params);
                var ldbConfig = getLockDownBrowserClientConfig();
                var pluginConfig = plugin.getConfig() || {};
                var fullConfig = buildServiceConfig(ldbConfig, pluginConfig, testRunner);
                var ldb = createService(fullConfig);

                // Single path: mock driver → whenAvailable is always true; real kiosked → only when native API ok.
                // isMockDriver() guards mock QA if whenAvailable and selected driver ever disagree (stale bundle, etc.).
                return ldb.whenAvailable().then(function (available) {
                    if (isLockDownBrowserSession(available, ldb)) {
                        initParams.clientKioskApiOk = '1';
                    }

                    // taoTests/runner/proxy.init(params) — one arg only; do not pass (config, params) like qtiServiceProxy.init
                    return originalInit.call(proxy, initParams);
                });
            };
        },

        init: function init() {
            var testRunner = this.getTestRunner();
            var pluginConfig = this.getConfig() || {};
            var ldbConfig = getLockDownBrowserClientConfig();
            var fullConfig = buildServiceConfig(ldbConfig, pluginConfig, testRunner);
            var ldb = createService(fullConfig);
            var pendingTrace = {};
            var breachSeq = 0;
            var flushTimer;
            var integrationStarted = false;

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
                var testContext = testRunner.getTestContext();
                var key = ui.BREACH_TRACE_KEY_PREFIX + type + '-' + breachSeq;

                pendingTrace[key] = {
                    type: type,
                    ts: Date.now(),
                    itemIdentifier: testContext && testContext.itemIdentifier,
                    detail: detail || {}
                };

                scheduleFlush();
            }

            var simulateViolationIntervalId;
            var processCheckIntervalId;

            function runDeniedProcessCheck(source) {
                return ldb.checkDeniedProcesses(ldbConfig.processBlackList).then(function (apps) {
                    if (!apps.length) {
                        return;
                    }

                    recordBreach('process-blocklist', {
                        source: source,
                        blockedApplications: apps
                    });
                });
            }

            function installSimulateBreachHarness() {
                if (!ldbConfig.simulateBreach) {
                    return;
                }

                var mountWindow = window;

                try {
                    if (window.top && window.top.document) {
                        mountWindow = window.top;
                    }
                } catch (err) {
                    // ponytail: stay on current window if top is cross-origin
                }

                // @TODO Disable simulateBreach in client config before production release.
                function simulateSecurityViolation(detail) {
                    return ldb.simulateSecurityViolation(_.extend({
                        simulated: true,
                        source: 'taoLockDownBrowserTest.simulateSecurityViolation',
                        processBlackList: ldbConfig.processBlackList
                    }, detail || {}));
                }

                mountWindow.taoLockDownBrowserTest = {
                    simulateSecurityViolation: simulateSecurityViolation
                };

                if (simulateViolationIntervalId) {
                    clearInterval(simulateViolationIntervalId);
                }

                simulateViolationIntervalId = setInterval(function () {
                    simulateSecurityViolation({ reason: 'periodic-simulate-breach' });
                }, SIMULATE_VIOLATION_INTERVAL_MS);

                simulateSecurityViolation({ reason: 'harness-installed' });
            }

            function notifyDeferFinishRedirect() {
                postToParent({ type: ui.MESSAGE_DEFER_FINISH });
            }

            function showExitButton() {
                var mountDoc = getExitMountDocument();

                lockDownBrowserModule.mountExitBar({
                    mountDocument: mountDoc,
                    onExitClick: function () {
                        var doc = getExitMountDocument();

                        flushTrace().finally(function () {
                            postToParent({ type: ui.MESSAGE_EXIT });
                            lockDownBrowserModule.removeExitBar(doc);
                            ldb.exitApplication();
                        });
                    }
                });
            }

            function onTestFinish() {
                notifyDeferFinishRedirect();

                try {
                    sessionStorage.setItem(ui.PENDING_EXIT_STORAGE_KEY, '1');
                } catch (storageErr) {
                    // ponytail: ignore private mode
                }

                showExitButton();
            }

            function startLockDownBrowserIntegration() {
                if (integrationStarted) {
                    return;
                }

                integrationStarted = true;

                ldb.validateMinVersion().catch(function (err) {
                    testRunner.trigger('warning', err);
                });

                ldb.addSecurityViolationListener(function (detail) {
                    recordBreach('breach', detail);
                });

                if (ldbConfig.processCheckInterval) {
                    processCheckIntervalId = setInterval(function () {
                        runDeniedProcessCheck('interval');
                    }, ldbConfig.processCheckInterval);
                }

                if (ldbConfig.processCheckOnTestNavigation) {
                    testRunner.on('renderitem', function () {
                        runDeniedProcessCheck('item-navigation');
                    });
                }

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

                        if (simulateViolationIntervalId) {
                            clearInterval(simulateViolationIntervalId);
                            simulateViolationIntervalId = null;
                        }

                        if (processCheckIntervalId) {
                            clearInterval(processCheckIntervalId);
                            processCheckIntervalId = null;
                        }

                        ldb.removeSecurityViolationListener();
                    });

                installSimulateBreachHarness();
            }

            ldb.whenAvailable().then(function (available) {
                if (isLockDownBrowserSession(available, ldb)) {
                    startLockDownBrowserIntegration();
                }
            });

            testRunner.on('finish', function () {
                ldb.whenAvailable().then(function (available) {
                    if (!isLockDownBrowserSession(available, ldb)) {
                        return;
                    }

                    startLockDownBrowserIntegration();
                    onTestFinish();
                });
            });
        }
    }, {
        hostName: 'testRunner',
        // Keep in sync with config/taoTests/test_runner_plugin_registry.conf.php → lockDownBrowser.driver
        driver: lockDownBrowserModule.DRIVER_KIOSKED_MOCK
    });
});
