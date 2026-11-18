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

    /**
     * @typedef {Object} LockDownBrowserPlugin
     * @property {string|null} [deliveryExecutionId] Delivery execution id from runner config.
     * @property {string|null} [resumeTracedSessionKey] Session storage key for resume trace dedup.
     * @property {Object} [lastInitResponse] Last proxy init response (includes lastStoreId).
     */

    /**
     * @typedef {Object} LockDownBrowserClientConfig
     * @property {string[]} [processBlackList]
     * @property {boolean} [processCheckOnTestNavigation]
     * @property {number|null} [processCheckInterval]
     * @property {boolean} [simulateBreach]
     * @property {boolean} [displayExitButtonTestRunner]
     */

    /**
     * @typedef {Object} TestRunner
     * @property {function(): Object} getProxy
     * @property {function(): Object} getTestContext
     * @property {function(string, ...*): TestRunner} on
     * @property {function(string, ...*): TestRunner} before
     * @property {function(string, ...*): TestRunner} off
     * @property {function(string, ...*): void} trigger
     * @property {function(string): void} stopEvent
     */

    /**
     * @typedef {Object} LockDownBrowserService
     * @property {function(): Promise<boolean>} whenAvailable
     * @property {function(): boolean} isMockDriver
     * @property {function(): Promise<void>} validateMinVersion
     * @property {function(string[], function(Object): void): void} addEventListeners
     * @property {function(): void} removeEventListeners
     * @property {function(Object): Promise<string[]>} checkDeniedProcesses
     * @property {function(Object): void} simulateSecurityViolation
     * @property {function(): void} exitApplication
     */

    const ui = lockDownBrowserModule.uiProtocol;
    const FLUSH_DEBOUNCE_MS = 3000;
    const SIMULATE_VIOLATION_INTERVAL_MS = 30000;
    const SESSION_ARM_RETRY_MS = 2000;
    const SESSION_ARM_RETRY_TIMEOUT_MS = 60000;
    const LOAD_ITEM_CANCELLED = { cancel: true };
    const RESUME_TRACED_STORAGE_PREFIX = 'ldb.resumeTraced:';

    /**
     * Reads sessionStorage; returns null when missing or storage throws.
     *
     * @param {string} key Storage key.
     * @returns {string|null} Stored value or null.
     */
    function getSessionStorageItem(key) {
        try {
            return sessionStorage.getItem(key);
        } catch (err) {
            // treat unavailable storage as missing
            return null;
        }
    }

    /**
     * Writes sessionStorage.
     *
     * @param {string} key Storage key.
     * @param {string} value Value to store.
     * @returns {boolean} True on success, false when storage throws.
     */
    function setSessionStorageItem(key, value) {
        try {
            sessionStorage.setItem(key, value);

            return true;
        } catch (err) {
            // ignore private mode or quota
            return false;
        }
    }

    /**
     * Removes a sessionStorage entry.
     *
     * @param {string} key Storage key.
     * @returns {boolean} True on success, false when storage throws.
     */
    function removeSessionStorageItem(key) {
        try {
            sessionStorage.removeItem(key);

            return true;
        } catch (err) {
            // ignore private mode
            return false;
        }
    }

    /**
     * @returns {LockDownBrowserClientConfig} Client config from context.lockDownBrowser.
     */
    function getLockDownBrowserClientConfig() {
        return (context && context.lockDownBrowser) || {};
    }

    /**
     * Merges client, plugin, and runner plugin options for the LDB service factory.
     *
     * @param {Object} clientConfig From {@link getLockDownBrowserClientConfig}.
     * @param {Object} pluginConfig Plugin instance config.
     * @param {TestRunner} testRunner Active test runner.
     * @returns {Object} Config passed to createLockDownBrowserService.
     */
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

        if (Array.isArray(pluginOptions.eventTypes)) {
            merged.eventTypes = pluginOptions.eventTypes;
        }

        return merged;
    }

    /**
     * Whether kiosk / mock / LDB context is active enough to arm integration.
     *
     * @param {boolean} available Result of ldb.whenAvailable().
     * @param {LockDownBrowserService} ldb Lock down browser service instance.
     * @returns {boolean}
     */
    function isLockDownBrowserSession(available, ldb) {
        return (
            available ||
            ldb.isMockDriver() ||
            lockDownBrowserModule.isLockDownBrowserContext(ldb)
        );
    }

    /**
     * Stable signature for a blocked process list (for deduped traces).
     *
     * @param {Array<string|number>} blockedApps Process names from the kiosk check.
     * @returns {string} JSON string of sorted app names.
     */
    function blockedAppsSignature(blockedApps) {
        return JSON.stringify(blockedApps.map(app => String(app)).sort());
    }

    /**
     * Clears resume-trace session dedup when the learner leaves the runner (e.g. back to login).
     * Next entry into the same execution can record one resume trace again.
     *
     * @param {LockDownBrowserPlugin} plugin Plugin instance (resumeTracedSessionKey).
     * @param {TestRunner} testRunner Runner used to unregister on destroy.
     * @returns {void}
     */
    function bindResumeTraceDedupClearOnPageHide(plugin, testRunner) {
        if (!plugin.resumeTracedSessionKey) {
            return;
        }

        const resumeTracedSessionKey = plugin.resumeTracedSessionKey;
        const onPageHide = event => {
            if (!event.persisted) {
                removeSessionStorageItem(resumeTracedSessionKey);
            }
        };

        window.addEventListener('pagehide', onPageHide);
        testRunner.on('destroy.resumeTrace', () => {
            window.removeEventListener('pagehide', onPageHide);
        });
    }

    return pluginFactory({
        name: 'lockDownBrowser',

        /**
         * Wraps proxy.init to set clientKioskApiOk and stash lastInitResponse on the plugin.
         *
         * @returns {void}
         */
        install() {
            const testRunner = this.getTestRunner();
            const self = this;
            const proxy = testRunner.getProxy();
            const originalInit = proxy.init;

            /**
             * @param {Object} initParamsFromRunner Runner-supplied init params.
             * @param {Object} [params] Extra init params from the caller.
             * @returns {Promise<Object>} Proxy init response.
             */
            proxy.init = function initWithLockDownBrowserDetection(initParamsFromRunner, params) {
                const initParams = _.extend({}, initParamsFromRunner, params);
                const ldbConfig = getLockDownBrowserClientConfig();
                const pluginConfig = self.getConfig() || {};
                const fullConfig = buildServiceConfig(ldbConfig, pluginConfig, testRunner);
                const ldb = lockDownBrowserModule.createLockDownBrowserService(fullConfig);

                if (lockDownBrowserModule.isLockDownBrowserContext(ldb)) {
                    initParams.clientKioskApiOk = '1';
                }

                return Promise.resolve(originalInit.call(proxy, initParams)).then(response => {
                    self.lastInitResponse = response || {};

                    return response;
                });
            };
        },

        /**
         * Arms LDB integration, process blocklist, tracing, and exit menu for the delivery session.
         *
         * @returns {void}
         */
        init() {
            const plugin = this;
            const testRunner = this.getTestRunner();
            const runnerConfig =
                testRunner && typeof testRunner.getConfig === 'function' ? testRunner.getConfig() : {};

            plugin.deliveryExecutionId = runnerConfig.serviceCallId ? String(runnerConfig.serviceCallId) : null;
            plugin.resumeTracedSessionKey = plugin.deliveryExecutionId
                ? `${RESUME_TRACED_STORAGE_PREFIX}${plugin.deliveryExecutionId}`
                : null;

            bindResumeTraceDedupClearOnPageHide(plugin, testRunner);

            const areaBroker = this.getAreaBroker();
            const pluginConfig = this.getConfig() || {};
            const ldbConfig = getLockDownBrowserClientConfig();
            const fullConfig = buildServiceConfig(ldbConfig, pluginConfig, testRunner);
            const ldb = lockDownBrowserModule.createLockDownBrowserService(fullConfig);
            const processCheckInterval = Number(ldbConfig.processCheckInterval);
            const eventTypes = _.uniq(
                lockDownBrowserModule.EVENT_TYPES.concat(Array.isArray(fullConfig.eventTypes) ? fullConfig.eventTypes : [])
            );

            let pendingTrace = {};
            let eventSeq = 0;
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

            /**
             * Posts an iframe protocol message to the parent when embedded.
             *
             * @param {Object} message Message payload (ui protocol type).
             * @returns {void}
             */
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

            /**
             * Document used to mount the LDB exit control (top when same-origin).
             *
             * @returns {Document}
             */
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

            /**
             * Sends pending lock-down trace entries via proxy.sendVariables.
             *
             * @returns {Promise<void>} Resolves when the batch is sent or there was nothing to flush.
             */
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

            /**
             * Debounces {@link flushTrace} by {@link FLUSH_DEBOUNCE_MS}.
             *
             * @returns {void}
             */
            function scheduleFlush() {
                if (flushTimer) {
                    clearTimeout(flushTimer);
                }

                flushTimer = setTimeout(() => {
                    flushTimer = null;
                    flushTrace();
                }, FLUSH_DEBOUNCE_MS);
            }

            /**
             * Queues a lock-down trace event for variables_storage.
             *
             * @param {string} type Event type (e.g. resume, started, breach types).
             * @param {Object} [detail] Extra payload.
             * @param {string} [callerItemIdentifier] Item id when the event is tied to navigation.
             * @returns {void}
             */
            function recordEvent(type, detail, callerItemIdentifier) {
                const occurredAt = detail && detail.occurredAt ? detail.occurredAt : new Date().toISOString();
                const timestamp = Date.parse(occurredAt);

                eventSeq += 1;
                const testContext = testRunner.getTestContext();
                const key = `${ui.EVENT_TRACE_KEY_PREFIX}${type}-${eventSeq}`;
                const entry = {
                    type,
                    occurredAt,
                    ts: Number.isNaN(timestamp) ? Date.now() : timestamp,
                    itemIdentifier: testContext && testContext.itemIdentifier,
                    detail: detail || {}
                };

                if (callerItemIdentifier) {
                    entry.callerItemIdentifier = callerItemIdentifier;
                }

                pendingTrace[key] = entry;
                scheduleFlush();
            }

            /**
             * Toggles runner content-area styling when item render is blocked by process list.
             *
             * @param {boolean} blocked True when denied processes are running.
             * @returns {void}
             */
            function setItemBlocked(blocked) {
                if (!areaBroker || typeof areaBroker.getContentArea !== 'function') {
                    return;
                }

                const contentArea = areaBroker.getContentArea();

                if (contentArea) {
                    $(contentArea).toggleClass('lockdown-browser-item-blocked', blocked);
                }
            }

            /**
             * Records a process-check failure as a trace event.
             *
             * @param {Error|Object} err Error from the kiosk process check.
             * @returns {void}
             */
            function reportProcessCheckError(err) {
                const detail = {
                    message: err && err.message ? err.message : String(err)
                };

                if (err && err.code) {
                    detail.code = err.code;
                }

                recordEvent('process-check-error', detail);
            }

            /**
             * Lazily builds the normalized process blocklist model once per init.
             *
             * @returns {void}
             */
            function ensureProcessBlockListModel() {
                if (processBlockListInitialized) {
                    return;
                }

                normalizedProcessBlockList = processBlockList.create(ldbConfig.processBlackList);
                processBlockListInitialized = true;
            }

            /**
             * Updates UI and trace when denied processes are detected or cleared.
             *
             * @param {string[]} blockedApps Running apps matching the blocklist.
             * @param {'session-start'|'item-navigation'|'interval'} source Check trigger.
             * @param {Object} [loadItemEvent] loaditem before-hook event (item-navigation only).
             * @param {string} [targetItemIdentifier] Target item id (item-navigation only).
             * @returns {void}
             */
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
                    recordEvent(
                        'process-blocklist',
                        {
                            source,
                            blockedApplications: blockedApps
                        },
                        source === 'item-navigation' ? targetItemIdentifier : null
                    );
                }

                setItemBlocked(true);

                if (source === 'item-navigation' && loadItemEvent) {
                    testRunner.stopEvent('loaditem');
                }
            }

            /**
             * Runs a single serialized denied-process check via the LDB driver.
             *
             * @param {'session-start'|'item-navigation'|'interval'} source Check trigger.
             * @param {Object} [loadItemEvent] loaditem before-hook event.
             * @param {string} [targetItemIdentifier] Target item id.
             * @returns {Promise<string[]|{cancel: true}>} Blocked apps, or rejects with LOAD_ITEM_CANCELLED on item nav.
             */
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

            /**
             * Wires interval and loaditem hooks for process blocklist checks when configured.
             *
             * @returns {void}
             */
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

            /**
             * Exposes window.taoLockDownBrowserTest when simulateBreach is enabled in config.
             *
             * @returns {void}
             */
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

            /**
             * Mounts the in-test exit control for Kiosk sessions when configured.
             *
             * @returns {void}
             */
            function showExitMenu() {
                lockDownBrowserModule.mountExitMenu({
                    mountDocument: getExitMountDocument(),
                    onExitClick() {
                        flushTrace().finally(() => {
                            postToParent({ type: ui.MESSAGE_EXIT });
                            ldb.exitApplication();
                        });
                    }
                });
            }

            /**
             * Defers parent finish and marks pending exit in sessionStorage after submit.
             *
             * @returns {void}
             */
            function onTestFinish() {
                postToParent({ type: ui.MESSAGE_DEFER_FINISH });

                setSessionStorageItem(ui.PENDING_EXIT_STORAGE_KEY, '1');
            }

            /**
             * Records one resume trace per tab visit when re-entering an in-progress execution.
             *
             * @returns {void}
             */
            function recordDeliveryExecutionResumeTrace() {
                if (!lockDownBrowserModule.isLockDownBrowserContext(ldb)) {
                    return;
                }

                const initResponse = plugin.lastInitResponse || {};
                const lastStoreId = initResponse.lastStoreId;
                const navigationEntry = performance.getEntriesByType('navigation')[0];
                const navigationType =
                    navigationEntry && navigationEntry.type ? navigationEntry.type : null;

                // Cannot record resume trace if session key is not set
                if (!plugin.resumeTracedSessionKey) {
                    return;
                }

                // If lastStoreId is not a string or is an empty string, it is not a resume, but a new launch
                if (typeof lastStoreId !== 'string' || lastStoreId === '') {
                    return;
                }

                // Only record "resume" if URL was accessed directly or redirected
                if (navigationType !== 'navigate') {
                    return;
                }

                if (getSessionStorageItem(plugin.resumeTracedSessionKey) === '1') {
                    return;
                }

                setSessionStorageItem(plugin.resumeTracedSessionKey, '1');
                recordEvent('resume');
            }

            /**
             * Starts listeners, tracing, and version validation once per runner session.
             *
             * @returns {void}
             */
            function startLockDownBrowserIntegration() {
                if (integrationStarted) {
                    return;
                }

                integrationStarted = true;
                recordEvent('started');
                recordDeliveryExecutionResumeTrace();

                ldb.validateMinVersion().catch(err => {
                    recordEvent('version-check-error', {
                        message: err && err.message ? err.message : String(err)
                    });
                });

                ldb.addEventListeners(eventTypes, event => {
                    recordEvent(event.type, event);
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

                        ldb.removeEventListeners();
                    });

                installSimulateBreachHarness();
            }

            /**
             * Clears the session-arm polling interval.
             *
             * @returns {void}
             */
            function clearSessionArmRetry() {
                if (sessionArmRetryId) {
                    clearInterval(sessionArmRetryId);
                    sessionArmRetryId = null;
                }
            }

            /**
             * Waits for kiosk availability and arms blocklist + integration.
             *
             * @returns {Promise<boolean>} True when the session was armed.
             */
            function armLockDownBrowserSession() {
                return ldb.whenAvailable().then(available => {
                    if (!isLockDownBrowserSession(available, ldb)) {
                        return false;
                    }

                    setupProcessBlockListForSession();
                    startLockDownBrowserIntegration();
                    if (!processBlockListSetup) {
                        return true;
                    }

                    return runDeniedProcessCheck('session-start').then(() => true);
                });
            }

            /**
             * Attempts {@link armLockDownBrowserSession} and stops polling when armed.
             *
             * @returns {void}
             */
            function scheduleSessionArming() {
                armLockDownBrowserSession().then(armed => {
                    if (armed) {
                        clearSessionArmRetry();
                    }
                });
            }

            if (
                ldbConfig.displayExitButtonTestRunner === true &&
                lockDownBrowserModule.isLockDownBrowserContext(ldb)
            ) {
                showExitMenu();
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
