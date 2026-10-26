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
    'taoTests/runner/plugin',
    'tao/lockDownBrowser/lockDownBrowserService',
    'tao/lockDownBrowser/processBlockList',
    'css!taoTestRunnerPlugins/runner/plugins/security/css/lockDownBrowser'
], function (_, $, __, context, pluginFactory, lockDownBrowserModule, processBlockList) {
    'use strict';

    const ui = lockDownBrowserModule.uiProtocol;
    const FLUSH_DEBOUNCE_MS = 3000;
    const SIMULATE_VIOLATION_INTERVAL_MS = 30000;
    const SESSION_ARM_RETRY_MS = 2000;
    const SESSION_ARM_RETRY_TIMEOUT_MS = 60000;
    const LOAD_ITEM_CANCELLED = { cancel: true };

    function getLockDownBrowserClientConfig() {
        return (context && context.lockDownBrowser) || {};
    }

    function buildServiceConfig(clientConfig, pluginConfig, testRunner) {
        const merged = _.extend({}, clientConfig);
        const runnerPluginConfig =
            testRunner && typeof testRunner.getPluginConfig === 'function'
                ? testRunner.getPluginConfig('lockDownBrowser')
                : {};
        const pluginOptions = _.extend({}, pluginConfig, runnerPluginConfig);

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

    function blockedAppsSignature(blockedApps) {
        return JSON.stringify(blockedApps.map(app => String(app)).sort());
    }

    return pluginFactory({
        name: 'lockDownBrowser',

        install() {
            const testRunner = this.getTestRunner();
            const plugin = this;
            const proxy = testRunner.getProxy();
            const originalInit = proxy.init;

            proxy.init = function initWithLockDownBrowserDetection(initParamsFromRunner, params) {
                const initParams = _.extend({}, initParamsFromRunner, params);
                const ldbConfig = getLockDownBrowserClientConfig();
                const pluginConfig = plugin.getConfig() || {};
                const fullConfig = buildServiceConfig(ldbConfig, pluginConfig, testRunner);
                const ldb = lockDownBrowserModule.createLockDownBrowserService(fullConfig);

                return ldb.whenAvailable().then(available => {
                    if (isLockDownBrowserSession(available, ldb)) {
                        initParams.clientKioskApiOk = '1';
                    }

                    return originalInit.call(proxy, initParams);
                });
            };
        },

        init() {
            const testRunner = this.getTestRunner();
            const areaBroker = this.getAreaBroker();
            const pluginConfig = this.getConfig() || {};
            const ldbConfig = getLockDownBrowserClientConfig();
            const fullConfig = buildServiceConfig(ldbConfig, pluginConfig, testRunner);
            const ldb = lockDownBrowserModule.createLockDownBrowserService(fullConfig);
            const processCheckInterval = Number(ldbConfig.processCheckInterval);

            let pendingTrace = {};
            let breachSeq = 0;
            let flushTimer;
            let integrationStarted = false;
            let processBlockListSetup = false;
            let normalizedProcessBlockList;
            let processCheckPromise;
            let blockedProcessSignature;
            let processBlockListInitialized = false;
            let simulateViolationIntervalId;
            let processCheckIntervalId;
            let sessionArmRetryId;
            let sessionArmRetryDeadline = Date.now() + SESSION_ARM_RETRY_TIMEOUT_MS;

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
                if (!Object.keys(pendingTrace).length) {
                    return Promise.resolve();
                }

                const batch = pendingTrace;

                pendingTrace = {};

                return testRunner
                    .getProxy()
                    .sendVariables(batch)
                    .catch(err => {
                        _.merge(pendingTrace, batch);
                        testRunner.trigger('error', err);
                    });
            }

            function scheduleFlush() {
                if (flushTimer) {
                    clearTimeout(flushTimer);
                }

                flushTimer = setTimeout(() => {
                    flushTimer = null;
                    flushTrace();
                }, FLUSH_DEBOUNCE_MS);
            }

            function recordBreach(type, detail, callerItemIdentifier) {
                breachSeq += 1;
                const testContext = testRunner.getTestContext();
                const key = `${ui.BREACH_TRACE_KEY_PREFIX}${type}-${breachSeq}`;
                const entry = {
                    type,
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

            function reportProcessCheckError(err) {
                recordBreach('process-check-error', {
                    message: err && err.message ? err.message : String(err),
                    code: err && err.code ? err.code : undefined
                });
            }

            function ensureProcessBlockListModel() {
                if (processBlockListInitialized) {
                    return;
                }

                normalizedProcessBlockList = processBlockList.create(ldbConfig.processBlackList);
                processBlockListInitialized = true;
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
                            source,
                            blockedApplications: blockedApps
                        },
                        source === 'item-navigation' ? targetItemIdentifier : undefined
                    );
                }

                setItemBlocked(true);

                if (source === 'item-navigation' && loadItemEvent) {
                    testRunner.stopEvent('loaditem');
                }
            }

            function runDeniedProcessCheck(source, loadItemEvent, targetItemIdentifier) {
                if (!processCheckPromise) {
                    processCheckPromise = Promise.resolve()
                        .then(() => {
                            ensureProcessBlockListModel();
                            return ldb.checkDeniedProcesses(normalizedProcessBlockList);
                        })
                        .then(
                            apps => {
                                const blockedApps = Array.isArray(apps) ? apps : [];

                                handleDeniedProcesses(blockedApps, source, loadItemEvent, targetItemIdentifier);
                                return blockedApps;
                            },
                            err => {
                                reportProcessCheckError(err);
                                return [];
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
                    clearSessionArmRetry();
                    testRunner.off('.processBlockList');
                    testRunner.off('.processBlockListArm');
                });

                if (ldbConfig.processCheckOnTestNavigation) {
                    testRunner.before('loaditem.processBlockList', (event, itemRef) =>
                        runDeniedProcessCheck('item-navigation', event, itemRef)
                    );
                }

                if (processCheckInterval > 0) {
                    processCheckIntervalId = setInterval(() => {
                        runDeniedProcessCheck('interval').catch(() => {});
                    }, processCheckInterval);
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

                const simulateSecurityViolation = detail =>
                    ldb.simulateSecurityViolation(
                        _.extend(
                            {
                                simulated: true,
                                source: 'taoLockDownBrowserTest.simulateSecurityViolation',
                                processBlackList: ldbConfig.processBlackList
                            },
                            detail || {}
                        )
                    );

                mountWindow.taoLockDownBrowserTest = {
                    simulateSecurityViolation
                };

                if (simulateViolationIntervalId) {
                    clearInterval(simulateViolationIntervalId);
                }

                simulateViolationIntervalId = setInterval(() => {
                    simulateSecurityViolation({ reason: 'periodic-simulate-breach' });
                }, SIMULATE_VIOLATION_INTERVAL_MS);

                simulateSecurityViolation({ reason: 'harness-installed' });
            }

            function onTestFinish() {
                postToParent({ type: ui.MESSAGE_DEFER_FINISH });

                try {
                    sessionStorage.setItem(ui.PENDING_EXIT_STORAGE_KEY, '1');
                } catch (storageErr) {
                    // ponytail: ignore private mode
                }

                lockDownBrowserModule.mountExitBar({
                    mountDocument: getExitMountDocument(),
                    onExitClick() {
                        const doc = getExitMountDocument();

                        flushTrace().finally(() => {
                            postToParent({ type: ui.MESSAGE_EXIT });
                            lockDownBrowserModule.removeExitBar(doc);
                            ldb.exitApplication();
                        });
                    }
                });
            }

            function startLockDownBrowserIntegration() {
                if (integrationStarted) {
                    return;
                }

                integrationStarted = true;

                ldb.validateMinVersion().catch(err => {
                    testRunner.trigger('warning', err);
                });

                ldb.addSecurityViolationListener(detail => {
                    recordBreach('breach', detail);
                });

                testRunner
                    .before('unloaditem', () => flushTrace())
                    .on('leave finish', () => flushTrace())
                    .on('finish', onTestFinish)
                    .on('destroy', () => {
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

            function clearSessionArmRetry() {
                if (sessionArmRetryId) {
                    clearInterval(sessionArmRetryId);
                    sessionArmRetryId = null;
                }
            }

            function armLockDownBrowserSession() {
                return ldb.whenAvailable().then(available => {
                    if (!isLockDownBrowserSession(available, ldb)) {
                        return false;
                    }

                    setupProcessBlockListForSession();
                    startLockDownBrowserIntegration();

                    return runDeniedProcessCheck('session-start').then(() => true);
                });
            }

            function scheduleSessionArming() {
                armLockDownBrowserSession().then(armed => {
                    if (armed && processBlockListSetup) {
                        clearSessionArmRetry();
                    }
                });
            }

            scheduleSessionArming();

            sessionArmRetryId = setInterval(() => {
                if (processBlockListSetup || Date.now() >= sessionArmRetryDeadline) {
                    clearSessionArmRetry();
                    return;
                }

                scheduleSessionArming();
            }, SESSION_ARM_RETRY_MS);

            testRunner.on('destroy.processBlockListArm', clearSessionArmRetry);

            testRunner.on('finish', () => {
                ldb.whenAvailable().then(available => {
                    if (!isLockDownBrowserSession(available, ldb)) {
                        return;
                    }

                    const integrationWasStarted = integrationStarted;

                    startLockDownBrowserIntegration();

                    if (!integrationWasStarted) {
                        onTestFinish();
                    }
                });
            });
        }
    }, {
        hostName: 'testRunner'
    });
});
