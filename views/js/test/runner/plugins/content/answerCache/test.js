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
    'core/eventifier',
    'taoTests/runner/runner',
    'taoTests/runner/plugin',
    'taoTestRunnerPlugins/runner/plugins/content/answerCache'
], function (
    $,
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

    QUnit.test('Reload answers', assert => {
        const done = assert.async();
        const localProviderName = 'answerCacheMock';
        const store = {};
        const emptyState = {
            base: {
                string: ''
            }
        };
        const changedState = {
            base: {
                string: 'abcd'
            }
        };
        let state = emptyState;

        assert.expect(5);

        runnerFactory.registerProvider(localProviderName, {
            name: localProviderName,
            loadAreaBroker() {},
            loadProxy() {},
            loadTestStore() {
                return {
                    getStore() {
                        return Promise.resolve({
                            getItem(key) {
                                return Promise.resolve(store[key]);
                            },
                            setItem(key, value) {
                                store[key] = value;
                                return Promise.resolve(true);
                            }
                        });
                    }
                };
            },
            init() {},
            renderItem() {
                this.itemRunner = eventifier({
                    _item: {
                        responses: {
                            responsedeclaration_5df3b12bb96b9184208345: {
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
        });

        const runner = runnerFactory(localProviderName, [answerCachePluginFactory]);

        runner
            .on('init', () => {
                assert.ok(true, 'Runner has been initialized');
                runner.setTestContext({
                    itemIdentifier: 'item-1',
                    attempt: 1
                });
                runner.renderItem('item-1', {});
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
                            assert.deepEqual(store['item-1'], changedState, 'The item state has changed');
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
});
