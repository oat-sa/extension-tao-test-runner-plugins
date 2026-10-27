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

    function settle(ms = 0) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    function captureIntervals() {
        const originalSetInterval = window.setInterval;
        const originalClearInterval = window.clearInterval;
        const intervals = [];

        window.setInterval = (callback, delay) => {
            const interval = { callback, delay, cleared: false };

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

        if (options && options.pluginConfig) {
            plugin.setConfig(options.pluginConfig);
        } else if (options && options.driver) {
            plugin.setConfig({ driver: options.driver });
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

    QUnit.test('mounts the header exit menu in a lock down browser session', assert =>
        createEnvironment({}, { results: [[]] }).then(environment => {
            assert.ok(mockControl.exitMenuMounts.length, 'the exit menu is mounted');

            environment.cleanup();
        })
    );

    QUnit.test('captures every documented Kiosked event with its metadata', assert =>
        createEnvironment({}, { results: [[]] }).then(environment => {
            const eventTypes = ['breach', 'lost-focus', 'display-added', 'offline', 'online'];

            assert.deepEqual(mockControl.eventTypes, eventTypes, 'all documented events are subscribed');

            eventTypes.forEach(type => {
                mockControl.emitEvent(type, { reason: `${type}-reason` });
            });

            return environment.runner
                .runBefore('unloaditem')
                .then(() => {
                    const entries = getTraceEntries(environment).filter(entry => eventTypes.indexOf(entry.type) !== -1);

                    assert.deepEqual(
                        entries.map(entry => entry.type),
                        eventTypes,
                        'each event is stored separately'
                    );
                    entries.forEach(entry => {
                        assert.ok(entry.occurredAt, `${entry.type} contains its occurrence time`);
                        assert.equal(entry.itemIdentifier, 'item-1', `${entry.type} contains the item context`);
                        assert.equal(entry.detail.reason, `${entry.type}-reason`, `${entry.type} keeps its reason`);
                    });
                })
                .finally(environment.cleanup);
        })
    );

    QUnit.test('captures a future event supplied through configuration', assert =>
        createEnvironment({}, { results: [[]], pluginConfig: { eventTypes: ['future-security-event'] } }).then(
            environment => {
                assert.ok(mockControl.eventTypes.indexOf('breach') !== -1, 'documented events remain subscribed');
                assert.ok(
                    mockControl.eventTypes.indexOf('future-security-event') !== -1,
                    'the future event is subscribed'
                );

                mockControl.emitEvent('future-security-event', { reason: 'future-reason' });

                return environment.runner
                    .runBefore('unloaditem')
                    .then(() => {
                        const entries = getTraceEntries(environment);

                        assert.equal(entries.length, 1, 'the configured event is stored');
                        assert.equal(entries[0].type, 'future-security-event');
                        assert.equal(entries[0].detail.reason, 'future-reason');
                    })
                    .finally(environment.cleanup);
            }
        )
    );

    QUnit.test('clear results allow item navigation', assert =>
        createEnvironment({}, { results: [[], []] }).then(environment =>
            environment.runner
                .runBefore('loaditem')
                .then(() => {
                    assert.notOk(
                        environment.$content.hasClass('lockdown-browser-item-blocked'),
                        'the item content remains visible'
                    );
                    assert.equal(mockControl.checkCalls.length, 2, 'session start and loaditem each perform a check');
                })
                .finally(environment.cleanup)
        )
    );

    QUnit.test('prohibited result on navigation blocks the item', assert =>
        createEnvironment({}, { results: [[], ['forbidden-app']] }).then(environment => {
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
                    assert.ok(
                        environment.$content.hasClass('lockdown-browser-item-blocked'),
                        'the content area is marked blocked while navigation is denied'
                    );
                })
                .finally(environment.cleanup);
        })
    );

    QUnit.test('prohibited results block navigation and clear results restore loading', assert =>
        createEnvironment(
            {},
            {
                results: [[], ['next-app'], [], ['previous-app']]
            }
        ).then(environment => {
            environment.runner.setItemIdentifier('item-2');

            return rejectAsBlocked(assert, environment.runner.runBefore('loaditem'), 'next-item loading is rejected')
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

    QUnit.test('periodic prohibited results block the current item', assert =>
        createEnvironment(
            { processCheckInterval: 1000 },
            { captureIntervals: true, results: [[], ['periodic-app']] }
        ).then(environment => {
            const processIntervals = environment.timerCapture.intervals.filter(interval => interval.delay === 1000);

            assert.equal(processIntervals.length, 1, 'one process interval is installed');
            processIntervals[0].callback();

            return settle()
                .then(() => assertBlocked(assert, environment, 'the current item'))
                .finally(environment.cleanup);
        })
    );

    QUnit.test('process checks are skipped outside a lock down browser session', assert =>
        createEnvironment({}, { available: false, driver: 'kiosked' }).then(environment =>
            environment.runner
                .runBefore('loaditem')
                .then(() => {
                    assert.notOk(
                        environment.$content.hasClass('lockdown-browser-item-blocked'),
                        'the item is not blocked outside an ldb session'
                    );
                    assert.equal(mockControl.checkCalls.length, 0, 'no native checks are performed');
                })
                .finally(environment.cleanup)
        )
    );

    QUnit.test('simultaneous navigation and interval checks share one in-flight call', assert => {
        let resolveCheck;
        const pendingCheck = new Promise(resolve => {
            resolveCheck = resolve;
        });

        return createEnvironment(
            { processCheckInterval: 1000 },
            { captureIntervals: true, results: [[], () => pendingCheck] }
        ).then(environment => {
            environment.timerCapture.intervals[0].callback();
            const navigationPromise = environment.runner.runBefore('loaditem');

            return Promise.resolve()
                .then(() => {
                    assert.equal(mockControl.checkCalls.length, 1, 'only one native check is in flight');
                    resolveCheck([]);
                    return navigationPromise;
                })
                .finally(environment.cleanup);
        });
    });

    QUnit.test('detected applications are logged with source and item identifier', assert =>
        createEnvironment({}, { results: [[], ['editor', 'messenger']] }).then(environment => {
            environment.runner.setItemIdentifier('item-42');

            return environment.runner
                .runBefore('loaditem', 'item-target')
                .catch(() => {})
                .then(() => environment.runner.runBefore('unloaditem'))
                .then(() => {
                    const entries = getTraceEntries(environment).filter(entry => entry.type === 'process-blocklist');

                    assert.equal(entries.length, 1, 'one blocklist trace entry is sent');
                    assert.deepEqual(entries[0].detail.blockedApplications, ['editor', 'messenger']);
                    assert.equal(entries[0].detail.source, 'item-navigation');
                    assert.equal(entries[0].itemIdentifier, 'item-42');
                    assert.equal(entries[0].callerItemIdentifier, 'item-target');
                })
                .finally(environment.cleanup);
        })
    );
});
