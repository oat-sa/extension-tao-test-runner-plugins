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
    'taoTests/runner/proxy',
    'taoTests/runner/plugin',
    'taoTestRunnerPlugins/runner/plugins/controls/sessionHeartbeat'
], function (
    $,
    _,
    eventifier,
    runnerFactory,
    proxyFactory,
    pluginFactory,
    sessionHeartbeatPluginFactory
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
     * Mocks an item runner
     * @param {Object} initialState
     * @returns {itemRunner}
     */
    function getItemRunnerMock(initialState) {
        let state = initialState;
        return eventifier({
            getResponses() {
                return {};
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

        assert.equal(typeof sessionHeartbeatPluginFactory, 'function', 'The pluginFactory module exposes a function');
        assert.equal(typeof sessionHeartbeatPluginFactory(runner), 'object', 'The plugin factory produces an instance');
        assert.notStrictEqual(sessionHeartbeatPluginFactory(runner), sessionHeartbeatPluginFactory(runner), 'The plugin factory provides a different instance on each call');
    });

    QUnit
        .cases.init([
            {title: 'install'},
            {title: 'init'},
            {title: 'destroy'}
        ])
        .test('plugin API ', (data, assert) => {
            const runner = runnerFactory(providerName);
            const plugin = sessionHeartbeatPluginFactory(runner);
            assert.equal(typeof plugin[data.title], 'function', `The pluginFactory instances expose a "${data.title}" method`);
        });

    QUnit.module('behavior');

    QUnit.test('Send signal', assert => {
        const done = assert.async();
        const localProviderName = 'sessionHeartbeatMock';
        const itemIdentifier = 'item-1';
        const expectedCount = 3;
        let count = 0;

        assert.expect(1 + expectedCount * 2);

        runnerFactory.registerProvider(localProviderName, {
            name: localProviderName,
            loadAreaBroker() {},
            loadProxy() {
                const self = this;

                proxyFactory.registerProvider(localProviderName, {
                    install() {},
                    init() {},
                    telemetry(itemId, action) {
                        assert.ok(itemId, itemIdentifier, 'The heartbeat signal has been sent');
                        assert.ok(action, 'foo', 'The right endpoint is called');
                        if (++count >= expectedCount) {
                            self.destroy();
                        }
                    }
                });
                return proxyFactory(localProviderName, {});
            },
            loadTestStore() {},
            init() {
                const plugins = this.getPlugins() || {};
                const pluginsConfig = this.getPluginsConfig() || {};
                this.setTestContext({itemIdentifier});

                _.forEach(pluginsConfig, (config, pluginName) => {
                    plugins[pluginName].setConfig(config);
                });

                return this.getProxy().init();
            },
            renderItem() {
                this.itemRunner = getItemRunnerMock({});
            }
        });

        const runner = runnerFactory(localProviderName, [sessionHeartbeatPluginFactory], {
            options: {
                plugins: {
                    sessionHeartbeat: {
                        interval: 0.1,
                        action: 'foo'
                    }
                }
            }
        });

        runner
            .on('init', () => {
                assert.ok(true, 'Runner has been initialized');
                window.setTimeout(() => {
                    if (count < expectedCount) {
                        runner.destroy();
                    }
                }, 1000);
            })
            .on('destroy', done)
            .on('error', err => {
                assert.ok(false, err.message);
                done();
            })
            .init();
    });
});
