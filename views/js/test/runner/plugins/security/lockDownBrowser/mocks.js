define(['lodash'], _ => {
    'use strict';

    const control = {
        reset() {
            this.available = true;
            this.availabilityError = null;
            this.results = [];
            this.checkCalls = [];
            this.serviceConfigs = [];
            this.eventTypes = [];
            this.eventListener = null;
            this.exitMenuMounts = [];
        },

        emitEvent(type, detail) {
            if (this.eventTypes.indexOf(type) !== -1 && typeof this.eventListener === 'function') {
                this.eventListener(
                    _.extend(
                        {
                            type,
                            occurredAt: new Date().toISOString()
                        },
                        detail
                    )
                );
            }
        },

        nextResult() {
            const result = this.results.length ? this.results.shift() : [];

            if (typeof result === 'function') {
                return result();
            }

            if (result instanceof Error) {
                return Promise.reject(result);
            }

            return Promise.resolve(result);
        }
    };

    control.reset();

    define('tao/lockDownBrowser/processBlockList', [], () => {
        const api = {
            ERROR_API_UNAVAILABLE: 'api-unavailable',
            ERROR_INVALID_CONFIG: 'invalid-config',

            createError(code, message) {
                const error = new Error(message);

                error.code = code;
                return error;
            },

            create(config) {
                if (!Array.isArray(config)) {
                    throw api.createError(api.ERROR_INVALID_CONFIG, 'Invalid process block list');
                }

                return config.slice();
            }
        };

        return api;
    });

    define('tao/lockDownBrowser/lockDownBrowserService', [], () => {
        const module = {
            DRIVER_KIOSKED: 'kiosked',
            DRIVER_KIOSKED_MOCK: 'kioskedMock',
            EVENT_TYPES: ['breach', 'lost-focus', 'display-added', 'offline', 'online'],
            uiProtocol: {
                EVENT_TRACE_KEY_PREFIX: 'lockdown-event-',
                BREACH_TRACE_KEY_PREFIX: 'lockdown-browser-',
                MESSAGE_DEFER_FINISH: 'defer-finish',
                MESSAGE_EXIT: 'exit',
                PENDING_EXIT_STORAGE_KEY: 'pending-exit'
            },

            createLockDownBrowserService(config) {
                const driver = (config && config.driver) || module.DRIVER_KIOSKED_MOCK;

                control.serviceConfigs.push(config);

                return {
                    whenAvailable() {
                        if (control.availabilityError) {
                            return Promise.reject(control.availabilityError);
                        }

                        return Promise.resolve(control.available);
                    },

                    isMockDriver() {
                        return driver === module.DRIVER_KIOSKED_MOCK;
                    },

                    validateMinVersion() {
                        return Promise.resolve();
                    },

                    addEventListeners(eventTypes, callback) {
                        control.eventTypes = eventTypes.slice();
                        control.eventListener = callback;
                    },

                    removeEventListeners() {
                        control.eventTypes = [];
                        control.eventListener = null;
                    },

                    addSecurityViolationListener() {},
                    removeSecurityViolationListener() {},
                    exitApplication() {},

                    checkDeniedProcesses(blockList) {
                        control.checkCalls.push(blockList);
                        return control.nextResult();
                    },

                    simulateSecurityViolation() {
                        return Promise.resolve();
                    }
                };
            },

            isLockDownBrowserContext(service) {
                return service.isMockDriver();
            },

            mountExitMenu(options) {
                control.exitMenuMounts.push(options);
            }
        };

        return module;
    });

    define(
        'taoTests/runner/plugin',
        [],
        () => (definition, defaults) => (testRunner, areaBroker) => {
            let config = _.extend({}, defaults);
            const plugin = {
                getTestRunner() {
                    return testRunner;
                },

                getAreaBroker() {
                    return areaBroker;
                },

                getConfig() {
                    return config;
                },

                setConfig(nextConfig) {
                    config = _.extend({}, config, nextConfig);
                    return plugin;
                }
            };

            _.forEach(definition, (method, name) => {
                plugin[name] = typeof method === 'function' ? method.bind(plugin) : method;
            });

            return plugin;
        }
    );

    define('taoTestRunnerPlugins/test/runner/plugins/security/lockDownBrowser/mockControl', [], () => control);

    return control;
});
