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
 * @author Jean-Sébastien Conan <jean-sebastien@taotesting.com>
 */

define([
    'jquery',
    'lodash',
    'core/eventifier',
    'taoTests/runner/runner',
    'taoTests/runner/plugin',
    'taoTestRunnerPlugins/runner/plugins/content/answerCache'
], function (
    $,
    _,
    eventifier,
    runnerFactory,
    pluginFactory,
    answerCachePluginFactory
) {
    'use strict';

    const providerName = 'mock';
    runnerFactory.registerProvider(providerName, {
        name: providerName,
        loadAreaBroker() {},
        loadProxy() {},
        init() {}
    });

    /**
     * Builds a state object from the provided value
     * @param {String} value
     * @returns {Object}
     */
    function buildState(value = '') {
        return {
            base: {
                string: value
            }
        };
    }

    /**
     * Mocks a store
     * @param {Object} store
     * @returns Object}
     */
    function getStoreMock(store = {}) {
        return {
            getStore() {
                return Promise.resolve({
                    getItem(key) {
                        return Promise.resolve(store[key]);
                    },
                    setItem(key, value) {
                        store[key] = value;
                        return Promise.resolve(true);
                    },
                    clear() {
                        _.forEach(store, (v, key) => delete store[key]);
                    }
                });
            }
        };
    }

    /**
     * Mocks an item runner
     * @param {Object} initialState
     * @returns {itemRunner}
     */
    function getItemRunnerMock(initialState) {
        let state = initialState;
        return eventifier({
            _item: {
                responses: {
                    responseDeclaration1: {
                        attributes: {
                            identifier: 'RESPONSE',
                            cardinality: 'single',
                            baseType: 'string'
                        },
                        defaultValue: []
                    }
                }
            },
            getResponses() {
                return {
                    RESPONSE: state
                };
            },
            setResponses(response) {
                this.setState(response);
                this.trigger('responsechange');
            },
            getState() {
                return state;
            },
            setState(newState) {
                state = newState;
            }
        });
    }

    QUnit.module('pluginFactory');

    QUnit.test('module', assert => {
        const runner = runnerFactory(providerName);

        assert.equal(typeof answerCachePluginFactory, 'function', 'The pluginFactory module exposes a function');
        assert.equal(typeof answerCachePluginFactory(runner), 'object', 'The plugin factory produces an instance');
        assert.notStrictEqual(answerCachePluginFactory(runner), answerCachePluginFactory(runner), 'The plugin factory provides a different instance on each call');
    });

    QUnit
        .cases.init([
            {title: 'install'},
            {title: 'init'},
            {title: 'destroy'}
        ])
        .test('plugin API ', (data, assert) => {
            const runner = runnerFactory(providerName);
            const plugin = answerCachePluginFactory(runner);
            assert.equal(typeof plugin[data.title], 'function', `The pluginFactory instances expose a "${data.title}" method`);
        });

    QUnit.module('behavior');

    QUnit.test('Cache answers', assert => {
        const done = assert.async();
        const localProviderName = 'answerCacheMock';
        const store = {};
        const emptyState = buildState('');
        const changedState = buildState('abcd');
        const attempt = 1;
        const itemIdentifier = 'item-1';
        const storeIdentifier = `${itemIdentifier}#${attempt}`;

        assert.expect(5);

        runnerFactory.registerProvider(localProviderName, {
            name: localProviderName,
            loadAreaBroker() {},
            loadProxy() {},
            loadTestStore() {
                return getStoreMock(store);
            },
            init() {},
            renderItem() {
                this.itemRunner = getItemRunnerMock(emptyState);
            }
        });

        const runner = runnerFactory(localProviderName, [answerCachePluginFactory]);

        runner
            .on('init', () => {
                assert.ok(true, 'Runner has been initialized');
                runner.setTestContext({itemIdentifier, attempt});
                runner.renderItem(itemIdentifier, {});
            })
            .on('renderitem', () => {
                Promise.resolve()
                    .then(() => new Promise(resolve => {
                        window.setTimeout(() => {
                            assert.equal(typeof runner.itemRunner, 'object', 'The item runner is set');
                            assert.deepEqual(runner.itemRunner.getState(), emptyState, 'The item state is empty');
                            resolve();
                        }, 100);
                    }))
                    .then(() => new Promise(resolve => {
                        runner.itemRunner.setResponses(changedState);
                        window.setTimeout(() => {
                            assert.deepEqual(runner.itemRunner.getState(), changedState, 'The item state has changed');
                            assert.deepEqual(store[storeIdentifier], changedState, 'The item state has changed');
                            resolve();
                        }, 100);
                    }))
                    .then(() => {
                        runner.destroy();
                    });
            })
            .on('destroy', done)
            .on('error', err => {
                assert.ok(false, err.message);
                done();
            })
            .init();
    });

    QUnit.test('Reload cached answers', assert => {
        const done = assert.async();
        const localProviderName = 'answerCacheMock';
        const emptyState = buildState('');
        const changedState = buildState('abcd');
        const attempt = 1;
        const itemIdentifier = 'item-1';
        const storeIdentifier = `${itemIdentifier}#${attempt}`;
        const store = {
            [storeIdentifier]: changedState
        };

        assert.expect(3);

        runnerFactory.registerProvider(localProviderName, {
            name: localProviderName,
            loadAreaBroker() {},
            loadProxy() {},
            loadTestStore() {
                return getStoreMock(store);
            },
            init() {},
            renderItem() {
                this.itemRunner = getItemRunnerMock(emptyState);
            }
        });

        const runner = runnerFactory(localProviderName, [answerCachePluginFactory]);

        runner
            .on('init', () => {
                assert.ok(true, 'Runner has been initialized');
                runner.setTestContext({itemIdentifier, attempt});
                runner.renderItem(itemIdentifier, {});
            })
            .on('renderitem', () => {
                Promise.resolve()
                    .then(() => new Promise(resolve => {
                        window.setTimeout(() => {
                            assert.equal(typeof runner.itemRunner, 'object', 'The item runner is set');
                            assert.deepEqual(runner.itemRunner.getState(), changedState, 'The item state has been restored from the cache');
                            resolve();
                        }, 100);
                    }))
                    .then(() => {
                        runner.destroy();
                    });
            })
            .on('destroy', done)
            .on('error', err => {
                assert.ok(false, err.message);
                done();
            })
            .init();
    });

    QUnit.test('No reload for responded item', assert => {
        const done = assert.async();
        const localProviderName = 'answerCacheMock';
        const initialState = buildState('abcd');
        const changedState = buildState('foo');
        const attempt = 1;
        const itemIdentifier = 'item-1';
        const storeIdentifier = `${itemIdentifier}#${attempt}`;
        const store = {
            [storeIdentifier]: changedState
        };

        assert.expect(3);

        runnerFactory.registerProvider(localProviderName, {
            name: localProviderName,
            loadAreaBroker() {},
            loadProxy() {},
            loadTestStore() {
                return getStoreMock(store);
            },
            init() {},
            renderItem() {
                this.itemRunner = getItemRunnerMock(initialState);
            }
        });

        const runner = runnerFactory(localProviderName, [answerCachePluginFactory]);

        runner
            .on('init', () => {
                assert.ok(true, 'Runner has been initialized');
                runner.setTestContext({itemIdentifier, attempt});
                runner.renderItem(itemIdentifier, {});
            })
            .on('renderitem', () => {
                Promise.resolve()
                    .then(() => new Promise(resolve => {
                        window.setTimeout(() => {
                            assert.equal(typeof runner.itemRunner, 'object', 'The item runner is set');
                            assert.deepEqual(runner.itemRunner.getState(), initialState, 'The item state has not been restored from the cache');
                            resolve();
                        }, 100);
                    }))
                    .then(() => {
                        runner.destroy();
                    });
            })
            .on('destroy', done)
            .on('error', err => {
                assert.ok(false, err.message);
                done();
            })
            .init();
    });

    QUnit.test('Reload for responded item when option enabled', assert => {
        const done = assert.async();
        const localProviderName = 'answerCacheMock';
        const initialState = buildState('abcd');
        const changedState = buildState('foo');
        const attempt = 1;
        const itemIdentifier = 'item-1';
        const storeIdentifier = `${itemIdentifier}#${attempt}`;
        const store = {
            [storeIdentifier]: changedState
        };

        assert.expect(3);

        runnerFactory.registerProvider(localProviderName, {
            name: localProviderName,
            loadAreaBroker() {},
            loadProxy() {},
            loadTestStore() {
                return getStoreMock(store);
            },
            init() {
                const plugins = this.getPlugins() || {};
                const pluginsConfig = this.getPluginsConfig() || {};

                _.forEach(pluginsConfig, (config, pluginName) => {
                    plugins[pluginName].setConfig(config);
                });
            },
            renderItem() {
                this.itemRunner = getItemRunnerMock(initialState);
            }
        });

        const runner = runnerFactory(localProviderName, [answerCachePluginFactory], {
            options: {
                plugins: {
                    answerCache: {
                        allAttempts: true
                    }
                }
            }
        });

        runner
            .on('init', () => {
                assert.ok(true, 'Runner has been initialized');
                runner.setTestContext({itemIdentifier, attempt});
                runner.renderItem(itemIdentifier, {});
            })
            .after('renderitem', () => {
                Promise.resolve()
                    .then(() => new Promise(resolve => {
                        window.setTimeout(() => {
                            assert.equal(typeof runner.itemRunner, 'object', 'The item runner is set');
                            assert.deepEqual(runner.itemRunner.getState(), changedState, 'The item state has been restored from the cache');
                            resolve();
                        }, 100);
                    }))
                    .then(() => {
                        runner.destroy();
                    });
            })
            .on('destroy', done)
            .on('error', err => {
                assert.ok(false, err.message);
                done();
            })
            .init();
    });

    QUnit.test('No reload for different attempt', assert => {
        const done = assert.async();
        const localProviderName = 'answerCacheMock';
        const emptyState = buildState('');
        const changedState = buildState('abcd');
        const attempt = 1;
        const itemIdentifier = 'item-1';
        const storeIdentifier = `${itemIdentifier}#${attempt}`;
        const store = {
            [storeIdentifier]: changedState
        };

        assert.expect(4);

        runnerFactory.registerProvider(localProviderName, {
            name: localProviderName,
            loadAreaBroker() {},
            loadProxy() {},
            loadTestStore() {
                return getStoreMock(store);
            },
            init() {
                const plugins = this.getPlugins() || {};
                const pluginsConfig = this.getPluginsConfig() || {};

                _.forEach(pluginsConfig, (config, pluginName) => {
                    plugins[pluginName].setConfig(config);
                });
            },
            renderItem() {
                this.itemRunner = getItemRunnerMock(emptyState);
            }
        });

        const runner = runnerFactory(localProviderName, [answerCachePluginFactory], {
            options: {
                plugins: {
                    answerCache: {
                        allAttempts: true
                    }
                }
            }
        });

        runner
            .on('init', () => {
                assert.ok(true, 'Runner has been initialized');
                runner.setTestContext({itemIdentifier, attempt});
                runner.renderItem(itemIdentifier, {});
            })
            .on('renderitem.first', () => {
                runner.off('renderitem.first');
                Promise.resolve()
                    .then(() => new Promise(resolve => {
                        window.setTimeout(() => {
                            assert.equal(typeof runner.itemRunner, 'object', 'The item runner is set');
                            assert.deepEqual(runner.itemRunner.getState(), changedState, 'The item state has been restored from the cache');
                            resolve();
                        }, 100);
                    }))
                    .then(() => new Promise(resolve => {
                        store[storeIdentifier] = buildState('foo');
                        runner
                            .on('renderitem', () => {
                                window.setTimeout(() => {
                                    assert.deepEqual(runner.itemRunner.getState(), emptyState, 'The item state has not been loaded from cache');
                                    resolve();
                                }, 100);
                            })
                            .setTestContext({itemIdentifier, attempt: 2})
                            .loadItem(itemIdentifier);
                    }))
                    .then(() => {
                        runner.destroy();
                    });
            })
            .on('destroy', done)
            .on('error', err => {
                assert.ok(false, err.message);
                done();
            })
            .init();
    });

    QUnit
        .cases.init([
            {title: 'on move', event: 'loaditem'},
            {title: 'on finish', event: 'finish'}
        ])
        .test('Clear cached answers ', (data, assert) => {
            const done = assert.async();
            const localProviderName = 'answerCacheMock';
            const emptyState = buildState('');
            const changedState = buildState('abcd');
            const attempt = 1;
            const itemIdentifier = 'item-1';
            const storeIdentifier = `${itemIdentifier}#${attempt}`;
            const store = {
                [storeIdentifier]: changedState
            };

            assert.expect(4);

            runnerFactory.registerProvider(localProviderName, {
                name: localProviderName,
                loadAreaBroker() {},
                loadProxy() {},
                loadTestStore() {
                    return getStoreMock(store);
                },
                init() {},
                renderItem() {
                    this.itemRunner = getItemRunnerMock(emptyState);
                }
            });

            const runner = runnerFactory(localProviderName, [answerCachePluginFactory]);

            runner
                .on('init', () => {
                    assert.ok(true, 'Runner has been initialized');
                    runner.setTestContext({itemIdentifier, attempt});
                    runner.renderItem(itemIdentifier, {});
                })
                .on('renderitem.first', () => {
                    runner.off('renderitem.first');
                    Promise.resolve()
                        .then(() => new Promise(resolve => {
                            window.setTimeout(() => {
                                assert.equal(typeof runner.itemRunner, 'object', 'The item runner is set');
                                assert.deepEqual(runner.itemRunner.getState(), changedState, 'The item state has been restored from the cache');
                                resolve();
                            }, 100);
                        }))
                        .then(() => new Promise(resolve => {
                            runner
                                .after(data.event, () => {
                                    window.setTimeout(() => {
                                        assert.equal(typeof store[storeIdentifier], 'undefined', 'The store has been cleared');
                                        resolve();
                                    }, 100);
                                })
                                .trigger(data.event);
                        }))
                        .then(() => {
                            runner.destroy();
                        });
                })
                .on('destroy', done)
                .on('error', err => {
                    assert.ok(false, err.message);
                    done();
                })
                .init();
        });
});
