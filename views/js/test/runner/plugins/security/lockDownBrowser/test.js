define([
    'jquery',
    'lodash',
    'context',
    'taoTestRunnerPlugins/test/runner/plugins/security/lockDownBrowser/mockControl',
    'taoTestRunnerPlugins/runner/plugins/security/lockDownBrowser'
], ($, _, context, mockControl, pluginFactory) => {
    'use strict';

    function parseEvent(name) {
        const parts = name.split('.');

        return {
            event: parts.shift(),
            namespace: parts.join('.')
        };
    }

    function addHandlers(registry, names, handler) {
        names.split(/\s+/).forEach(name => {
            const parsed = parseEvent(name);

            registry.push({
                event: parsed.event,
                namespace: parsed.namespace,
                handler
            });
        });
    }

    function removeHandlers(registry, names) {
        names.split(/\s+/).forEach(name => {
            const parsed = parseEvent(name);

            for (let index = registry.length - 1; index >= 0; index--) {
                if (
                    (!parsed.event || registry[index].event === parsed.event) &&
                    (!parsed.namespace || registry[index].namespace === parsed.namespace)
                ) {
                    registry.splice(index, 1);
                }
            }
        });
    }

    function createRunner(itemIdentifier) {
        const beforeHandlers = [];
        const eventHandlers = [];
        let contextValue = {
            itemIdentifier: itemIdentifier || 'item-1'
        };
        const runner = {
            triggered: [],
            sentVariables: [],

            before(names, handler) {
                addHandlers(beforeHandlers, names, handler);
                return runner;
            },

            on(names, handler) {
                addHandlers(eventHandlers, names, handler);
                return runner;
            },

            off(names) {
                removeHandlers(beforeHandlers, names);
                removeHandlers(eventHandlers, names);
                return runner;
            },

            trigger(name, ...args) {
                runner.triggered.push(name);
                eventHandlers
                    .filter(entry => entry.event === name)
                    .slice()
                    .forEach(entry => {
                        entry.handler.apply(runner, args);
                    });

                return runner;
            },

            runBefore(name, ...args) {
                const handlers = beforeHandlers.filter(entry => entry.event === name);
                const event = {
                    name: name.split('.')[0],
                    namespace: name.indexOf('.') === -1 ? '' : name.slice(name.indexOf('.'))
                };

                return handlers.reduce(
                    (promise, entry) =>
                        promise.then(() => entry.handler.apply(runner, [event].concat(args))),
                    Promise.resolve()
                );
            },

            stopEvent() {
                return runner;
            },

            getProxy() {
                return {
                    init() {
                        return Promise.resolve();
                    },

                    sendVariables(variables) {
                        runner.sentVariables.push(variables);
                        return Promise.resolve();
                    }
                };
            },

            getPluginConfig() {
                return {};
            },

            getTestContext() {
                return contextValue;
            },

            setItemIdentifier(identifier) {
                contextValue = {
                    itemIdentifier: identifier
                };
            }
        };

        return runner;
    }

    function settle() {
        return new Promise(resolve => setTimeout(resolve, 0));
    }

    function captureIntervals() {
        const originalSetInterval = window.setInterval;
        const originalClearInterval = window.clearInterval;
        const intervals = [];

        window.setInterval = (callback, delay) => {
            const interval = {
                callback,
                delay,
                cleared: false
            };

            intervals.push(interval);
            return interval;
        };
        window.clearInterval = interval => {
            if (interval) {
                interval.cleared = true;
            }
        };

        return {
            intervals,
            restore() {
                window.setInterval = originalSetInterval;
                window.clearInterval = originalClearInterval;
            }
        };
    }

    function createEnvironment(config, options) {
        const runner = createRunner();
        const $content = $('#item-content').show();
        const timerCapture = options && options.captureIntervals ? captureIntervals() : null;

        mockControl.reset();
        context.lockDownBrowser = _.extend(
            {
                processCheckInterval: null,
                processCheckOnTestNavigation: true,
                processBlackList: ['forbidden-app'],
                simulateBreach: false
            },
            config
        );

        if (options && Object.prototype.hasOwnProperty.call(options, 'available')) {
            mockControl.available = options.available;
        }
        if (options && options.availabilityError) {
            mockControl.availabilityError = options.availabilityError;
        }
        if (options && options.results) {
            mockControl.results = options.results.slice();
        }

        const plugin = pluginFactory(runner, {
            getContentArea() {
                return $content;
            }
        });

        if (options && options.driver) {
            plugin.setConfig({
                driver: options.driver
            });
        }

        plugin.init();

        return settle().then(() => ({
            runner,
            plugin,
            $content,
            timerCapture,
            cleanup() {
                runner.trigger('destroy');
                if (timerCapture) {
                    timerCapture.restore();
                }
            }
        }));
    }

    function assertBlocked(assert, environment, message) {
        assert.ok(environment.$content.hasClass('lockdown-browser-item-blocked'), `${message} is hidden`);
    }

    function rejectAsBlocked(assert, promise, message) {
        return promise.then(
            () => assert.ok(false, message),
            () => assert.ok(true, message)
        );
    }

    function getTraceEntries(environment) {
        return environment.runner.sentVariables.reduce(
            (entries, batch) => entries.concat(Object.keys(batch).map(key => batch[key])),
            []
        );
    }

    QUnit.module('lockDownBrowser process block list');

    QUnit.test('clear result before the first item allows rendering', assert =>
        createEnvironment({}, { results: [[]] }).then(environment => {
            let rendered = false;

            return environment.runner
                .runBefore('loaditem')
                .then(() => {
                    rendered = true;
                    assert.ok(rendered, 'the loaditem hook completes');
                    assert.notOk(
                        environment.$content.hasClass('lockdown-browser-item-blocked'),
                        'the item content remains visible'
                    );
                    assert.notOk(
                        environment.runner.triggered.indexOf('disableitem') !== -1,
                        'the item is not disabled'
                    );
                    assert.equal(mockControl.checkCalls.length, 1, 'the native check is called once');
                })
                .finally(environment.cleanup);
        })
    );

    QUnit.test('prohibited result before the first item prevents rendering and interaction', assert =>
        createEnvironment({}, { results: [['forbidden-app']] }).then(environment => {
            let rendered = false;

            return rejectAsBlocked(
                assert,
                environment.runner.runBefore('loaditem').then(() => {
                    rendered = true;
                }),
                'the loaditem hook is rejected'
            )
                .then(() => {
                    assert.notOk(rendered, 'the item is not rendered');
                    assert.equal(mockControl.alerts.length, 1, 'a blocked-apps prompt is displayed');
                    assert.ok(
                        /close/i.test(mockControl.alerts[0].message),
                        'the prompt asks to close prohibited applications'
                    );
                    assert.ok(
                        environment.$content.hasClass('lockdown-browser-item-blocked'),
                        'the content area is marked blocked while navigation is denied'
                    );
                })
                .finally(environment.cleanup);
        })
    );

    QUnit.test('prohibited results prevent next and previous destinations from rendering', assert =>
        createEnvironment(
            {},
            {
                results: [['next-app'], [], ['previous-app']]
            }
        ).then(environment => {
            environment.runner.setItemIdentifier('item-2');

            return rejectAsBlocked(
                assert,
                environment.runner.runBefore('loaditem'),
                'next-item loading is rejected'
            )
                .then(() => {
                    environment.runner.setItemIdentifier('item-1');
                    return environment.runner.runBefore('loaditem');
                })
                .then(() => {
                    assert.notOk(
                        environment.$content.hasClass('lockdown-browser-item-blocked'),
                        'a clear check restores normal loading'
                    );
                    environment.runner.setItemIdentifier('item-0');
                    return rejectAsBlocked(
                        assert,
                        environment.runner.runBefore('loaditem'),
                        'previous-item loading is rejected'
                    );
                })
                .finally(environment.cleanup);
        })
    );

    QUnit.test('the periodic check uses the configured interval', assert =>
        createEnvironment(
            {
                processCheckInterval: 4321
            },
            {
                captureIntervals: true
            }
        ).then(environment => {
            assert.equal(environment.timerCapture.intervals.length, 1, 'one process interval is installed');
            assert.equal(environment.timerCapture.intervals[0].delay, 4321, 'the configured value is used');
            environment.cleanup();
        })
    );

    QUnit.test('a periodic prohibited result blocks the current item', assert =>
        createEnvironment(
            {
                processCheckInterval: 1000
            },
            {
                captureIntervals: true,
                results: [['periodic-app']]
            }
        ).then(environment => {
            environment.timerCapture.intervals[0].callback();

            return settle()
                .then(() => assertBlocked(assert, environment, 'the current item'))
                .finally(environment.cleanup);
        })
    );

    QUnit.test('invalid configuration fails closed and offers refresh', assert =>
        createEnvironment({
            processBlackList: null
        }).then(environment =>
            environment.runner
                .runBefore('loaditem')
                .catch(() => {})
                .then(() => {
                    assertBlocked(assert, environment, 'the item');
                    assert.equal(mockControl.alerts.length, 1, 'one refresh prompt is displayed');
                    assert.ok(/Refresh/.test(mockControl.alerts[0].message), 'the prompt asks the user to refresh');
                    assert.equal(typeof mockControl.alerts[0].callback, 'function', 'the prompt offers a refresh action');
                })
                .finally(environment.cleanup)
        )
    );

    QUnit.test('unavailable, rejected, and timed-out API checks fail closed', assert => {
        const timeoutError = new Error('Native process check timed out');
        const scenarios = [
            {
                title: 'rejected API check',
                options: {
                    results: [new Error('Native process check rejected')]
                },
                runCheck: true
            },
            {
                title: 'timed-out API check',
                options: {
                    results: [timeoutError]
                },
                runCheck: true
            }
        ];

        return scenarios.reduce(
            (promise, scenario) =>
                promise.then(() =>
                    createEnvironment({}, scenario.options).then(environment => {
                        const checkPromise = scenario.runCheck
                            ? environment.runner.runBefore('loaditem').catch(() => {})
                            : Promise.resolve();

                        return checkPromise
                            .then(settle)
                            .then(() => {
                                assertBlocked(assert, environment, scenario.title);
                                assert.equal(mockControl.alerts.length, 1, `${scenario.title} displays one prompt`);
                                assert.equal(
                                    typeof mockControl.alerts[0].callback,
                                    'function',
                                    `${scenario.title} offers refresh`
                                );
                            })
                            .finally(environment.cleanup);
                    })
                ),
            Promise.resolve()
        );
    });

    QUnit.test('process checks are skipped outside a lock down browser session', assert =>
        createEnvironment(
            {},
            {
                available: false,
                driver: 'kiosked'
            }
        ).then(environment =>
            environment.runner.runBefore('loaditem').then(() => {
                assert.notOk(
                    environment.runner.triggered.indexOf('disableitem') !== -1,
                    'the item is not blocked outside an ldb session'
                );
                assert.equal(mockControl.alerts.length, 0, 'no refresh prompt is shown');
            }).finally(environment.cleanup)
        )
    );

    QUnit.test('simultaneous navigation and interval checks share one in-flight call', assert => {
        let resolveCheck;
        const pendingCheck = new Promise(resolve => {
            resolveCheck = resolve;
        });

        return createEnvironment(
            {
                processCheckInterval: 1000
            },
            {
                captureIntervals: true,
                results: [() => pendingCheck]
            }
        ).then(environment => {
            environment.timerCapture.intervals[0].callback();
            const navigationPromise = environment.runner.runBefore('loaditem');

            return Promise.resolve()
                .then(() => {
                    assert.equal(mockControl.checkCalls.length, 1, 'only one native check is in flight');
                    resolveCheck([]);
                    return navigationPromise;
                })
                .then(() => {
                    assert.equal(mockControl.checkCalls.length, 1, 'navigation reused the interval check');
                })
                .finally(environment.cleanup);
        });
    });

    QUnit.test('detected applications are logged with source and item identifier', assert =>
        createEnvironment({}, { results: [['editor', 'messenger']] }).then(environment => {
            environment.runner.setItemIdentifier('item-42');

            return environment.runner
                .runBefore('loaditem', 'item-target')
                .catch(() => {})
                .then(() => environment.runner.runBefore('unloaditem'))
                .then(() => {
                    const entries = getTraceEntries(environment);

                    assert.equal(entries.length, 1, 'one trace entry is sent');
                    assert.equal(entries[0].type, 'process-blocklist', 'the event type is preserved');
                    assert.deepEqual(
                        entries[0].detail.blockedApplications,
                        ['editor', 'messenger'],
                        'the applications are captured'
                    );
                    assert.equal(entries[0].detail.source, 'item-navigation', 'the source is captured');
                    assert.equal(entries[0].itemIdentifier, 'item-42', 'the current context item is captured');
                    assert.equal(
                        entries[0].callerItemIdentifier,
                        'item-target',
                        'the item being loaded is captured'
                    );
                    assert.equal(typeof entries[0].ts, 'number', 'the timestamp is captured');
                })
                .finally(environment.cleanup);
        })
    );

    QUnit.test('unchanged periodic blocked results do not produce trace spam', assert =>
        createEnvironment(
            {
                processCheckInterval: 1000
            },
            {
                captureIntervals: true,
                results: [['editor'], ['editor'], ['messenger']]
            }
        ).then(environment => {
            const interval = environment.timerCapture.intervals[0];

            interval.callback();
            return settle()
                .then(() => {
                    interval.callback();
                    return settle();
                })
                .then(() => {
                    interval.callback();
                    return settle();
                })
                .then(() => environment.runner.runBefore('unloaditem'))
                .then(() => {
                    const entries = getTraceEntries(environment);

                    assert.equal(entries.length, 2, 'the unchanged result is not recorded twice');
                    assert.deepEqual(entries[0].detail.blockedApplications, ['editor'], 'the first set is logged');
                    assert.deepEqual(entries[1].detail.blockedApplications, ['messenger'], 'a changed set is logged');
                })
                .finally(environment.cleanup);
        })
    );

    QUnit.test('real and mock drivers use the same plugin-level blocking flow', assert =>
        ['kiosked', 'kioskedMock'].reduce(
            (promise, driver) =>
                promise.then(() =>
                    createEnvironment(
                        {},
                        {
                            driver,
                            results: [[`${driver}-app`]]
                        }
                    ).then(environment =>
                        environment.runner
                            .runBefore('loaditem')
                            .catch(() => {})
                            .then(() => {
                                assertBlocked(assert, environment, `${driver} item`);
                                assert.equal(mockControl.checkCalls.length, 1, `${driver} performs the service check`);
                            })
                            .finally(environment.cleanup)
                    )
                ),
            Promise.resolve()
        )
    );
});
