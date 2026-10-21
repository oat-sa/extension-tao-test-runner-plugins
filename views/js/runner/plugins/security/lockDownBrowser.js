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
    'i18n',
    'context',
    'ui/dialog/alert',
    'layout/loading-bar',
    'taoTests/runner/plugin',
    'tao/lockDownBrowser/lockDownBrowserService',
    'tao/lockDownBrowser/processBlockList',
    'css!taoTestRunnerPlugins/runner/plugins/security/css/lockDownBrowser'
], function (_, $, __, context, dialogAlert, loadingBar, pluginFactory, lockDownBrowserModule, processBlockList) {
    'use strict';

    const ui = lockDownBrowserModule.uiProtocol;
    const FLUSH_DEBOUNCE_MS = 3000;
    const SIMULATE_VIOLATION_INTERVAL_MS = 30000;
    const LOAD_ITEM_CANCELLED = { cancel: true };

    function getLockDownBrowserClientConfig() {
        return (context && context.lockDownBrowser) || {};
    }

    function createService(config) {
        return lockDownBrowserModule.createLockDownBrowserService(config);
    }

    function buildServiceConfig(clientConfig, pluginConfig, testRunner) {
        const merged = _.extend({}, clientConfig);
        const runnerPluginConfig =
            testRunner && typeof testRunner.getPluginConfig === 'function'
                ? testRunner.getPluginConfig('lockDownBrowser')
                : {};
        const pluginOptions = _.extend({}, runnerPluginConfig, pluginConfig);

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

    function normalizeAppList(apps) {
        return Array.isArray(apps) ? apps : [];
    }

    function blockedAppsSignature(blockedApps) {
        return JSON.stringify(
            blockedApps
                .map(app => String(app))
                .sort()
        );
    }

    return pluginFactory({
        name: 'lockDownBrowser',

        install: function install() {
            const testRunner = this.getTestRunner();
            const plugin = this;
            const proxy = testRunner.getProxy();
            const originalInit = proxy.init;

            proxy.init = function initWithLockDownBrowserDetection(initParamsFromRunner, params) {
                const initParams = _.extend({}, initParamsFromRunner, params);
                const ldbConfig = getLockDownBrowserClientConfig();
                const pluginConfig = plugin.getConfig() || {};
                const fullConfig = buildServiceConfig(ldbConfig, pluginConfig, testRunner);
                const ldb = createService(fullConfig);

                return ldb.whenAvailable().then(function (available) {
                    if (isLockDownBrowserSession(available, ldb)) {
                        initParams.clientKioskApiOk = '1';
                    }

                    return originalInit.call(proxy, initParams);
                });
            };
        },

        init: function init() {
            const testRunner = this.getTestRunner();
            const areaBroker = this.getAreaBroker();
            const pluginConfig = this.getConfig() || {};
            const ldbConfig = getLockDownBrowserClientConfig();
            const fullConfig = buildServiceConfig(ldbConfig, pluginConfig, testRunner);
            const ldb = createService(fullConfig);
            const availabilityPromise = ldb.whenAvailable();
            const processCheckInterval = Number(ldbConfig.processCheckInterval);

            let pendingTrace = {};
            let breachSeq = 0;
            let flushTimer;
            let integrationStarted = false;
            let processBlockListSetup = false;
            let normalizedProcessBlockList;
            let processCheckPromise;
            let processCheckFailure;
            let blockedProcessSignature;
            let processBlockListInitialized = false;
            let simulateViolationIntervalId;
            let processCheckIntervalId;

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
                const keys = Object.keys(pendingTrace);

                if (!keys.length) {
                    return Promise.resolve();
                }

                const batch = pendingTrace;

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

            function recordBreach(type, detail, callerItemIdentifier) {
                breachSeq += 1;
                const testContext = testRunner.getTestContext();
                const key = `${ui.BREACH_TRACE_KEY_PREFIX}${type}-${breachSeq}`;
                const entry = {
                    type: type,
                    ts: Date.now(),
                    itemIdentifier: testContext && testContext.itemIdentifier,
                    detail: detail || {}
                };

                if (callerItemIdentifier) {
                    entry.callerItemIdentifier = callerItemIdentifier;
                }

                pendingTrace[key] = entry;

                scheduleFlush();
            }

            function setItemBlocked(blocked) {
                if (!areaBroker || typeof areaBroker.getContentArea !== 'function') {
                    return;
                }

                const contentArea = areaBroker.getContentArea();

                if (contentArea) {
                    $(contentArea).toggleClass('lockdown-browser-item-blocked', blocked);
                }
            }

            function dismissBlockingLoadUi() {
                loadingBar.stop();
                testRunner.trigger('enablenav');
            }

            function notifyBlockedApplications(blockedApps) {
                const message =
                    blockedApps.length === 1
                        ? __('Please close "%s" before continuing the test.', blockedApps[0])
                        : __(
                              'Please close the following applications before continuing the test: %s',
                              blockedApps.join(', ')
                          );

                dialogAlert(message, () => window.location.reload());
            }

            function failProcessCheck(err) {
                if (processCheckFailure) {
                    return;
                }

                processCheckFailure = err;
                clearInterval(processCheckIntervalId);
                processCheckIntervalId = null;
                dismissBlockingLoadUi();
                setItemBlocked(true);
                dialogAlert(
                    __('The prohibited application check could not be completed. Refresh the page to try again.'),
                    () => window.location.reload()
                );
            }

            function ensureProcessBlockListModel() {
                if (processBlockListInitialized) {
                    return;
                }

                processBlockListInitialized = true;

                if (
                    ldbConfig.processCheckInterval !== null &&
                    typeof ldbConfig.processCheckInterval !== 'undefined' &&
                    (!isFinite(processCheckInterval) || processCheckInterval <= 0)
                ) {
                    throw processBlockList.createError(
                        processBlockList.ERROR_INVALID_CONFIG,
                        'The process check interval must be a positive number'
                    );
                }

                normalizedProcessBlockList = processBlockList.create(ldbConfig.processBlackList);
            }

            function handleDeniedProcesses(blockedApps, source, loadItemEvent, targetItemIdentifier) {
                if (!blockedApps.length) {
                    if (blockedProcessSignature) {
                        setItemBlocked(false);
                        blockedProcessSignature = null;
                    }

                    return;
                }

                const signature = blockedAppsSignature(blockedApps);

                if (signature !== blockedProcessSignature) {
                    blockedProcessSignature = signature;
                    recordBreach(
                        'process-blocklist',
                        {
                            source: source,
                            blockedApplications: blockedApps
                        },
                        source === 'item-navigation' ? targetItemIdentifier : undefined
                    );
                    notifyBlockedApplications(blockedApps);
                }

                setItemBlocked(true);
                dismissBlockingLoadUi();

                if (source === 'item-navigation' && loadItemEvent) {
                    testRunner.stopEvent('loaditem');
                }
            }

            function runDeniedProcessCheck(source, loadItemEvent, targetItemIdentifier) {
                if (processCheckFailure) {
                    return Promise.reject(processCheckFailure);
                }

                if (!processCheckPromise) {
                    processCheckPromise = Promise.resolve()
                        .then(() => {
                            ensureProcessBlockListModel();
                            return ldb.checkDeniedProcesses(normalizedProcessBlockList);
                        })
                        .then(
                            apps => {
                                const blockedApps = normalizeAppList(apps);

                                handleDeniedProcesses(blockedApps, source, loadItemEvent, targetItemIdentifier);
                                return blockedApps;
                            },
                            err => {
                                failProcessCheck(err);
                                throw err;
                            }
                        )
                        .finally(() => {
                            processCheckPromise = null;
                        });
                }

                return processCheckPromise.then(blockedApps => {
                    if (blockedApps.length && source === 'item-navigation') {
                        return Promise.reject(LOAD_ITEM_CANCELLED);
                    }

                    return blockedApps;
                });
            }

            function setupProcessBlockListForSession() {
                if (processBlockListSetup) {
                    return;
                }

                const hasBlockListConfig =
                    Object.prototype.hasOwnProperty.call(ldbConfig, 'processBlackList') ||
                    Object.prototype.hasOwnProperty.call(ldbConfig, 'processCheckOnTestNavigation') ||
                    Object.prototype.hasOwnProperty.call(ldbConfig, 'processCheckInterval');

                if (!hasBlockListConfig) {
                    return;
                }

                processBlockListSetup = true;

                testRunner.on('destroy.processBlockList', () => {
                    clearInterval(processCheckIntervalId);
                    processCheckIntervalId = null;
                    testRunner.off('.processBlockList');
                });

                if (ldbConfig.processCheckOnTestNavigation) {
                    testRunner.before('loaditem.processBlockList', (event, itemRef) =>
                        runDeniedProcessCheck('item-navigation', event, itemRef)
                    );
                }

                if (processCheckInterval > 0) {
                    try {
                        ensureProcessBlockListModel();
                        processCheckIntervalId = setInterval(() => {
                            if (!processCheckFailure) {
                                runDeniedProcessCheck('interval').catch(() => {});
                            }
                        }, processCheckInterval);
                    } catch (err) {
                        failProcessCheck(err);
                    }
                }
            }

            function installSimulateBreachHarness() {
                if (!ldbConfig.simulateBreach) {
                    return;
                }

                let mountWindow = window;

                try {
                    if (window.top && window.top.document) {
                        mountWindow = window.top;
                    }
                } catch (err) {
                    // ponytail: stay on current window if top is cross-origin
                }

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
                const mountDoc = getExitMountDocument();

                lockDownBrowserModule.mountExitBar({
                    mountDocument: mountDoc,
                    onExitClick: function () {
                        const doc = getExitMountDocument();

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

                        ldb.removeSecurityViolationListener();
                    });

                installSimulateBreachHarness();
            }

            availabilityPromise.then(available => {
                if (!isLockDownBrowserSession(available, ldb)) {
                    return;
                }

                setupProcessBlockListForSession();
                startLockDownBrowserIntegration();
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
        driver: lockDownBrowserModule.DRIVER_KIOSKED_MOCK
    });
});
