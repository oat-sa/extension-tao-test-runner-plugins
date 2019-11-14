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
 * @author Ricardo Proença <ricardo@taotesting.com>
 */

define([
    'jquery',
    'core/eventifier',
    'taoTests/runner/runner',
    'taoTests/runner/plugin',
    'taoTestRunnerPlugins/runner/plugins/navigation/limitBackButton'
], function($, eventifier, runnerFactory, pluginFactory, limitBackButtonPluginFactory) {
    'use strict';

    var providerName = 'mock';
    runnerFactory.registerProvider(providerName, {
        name: providerName,
        loadAreaBroker(){ },
        loadProxy(){ },
        init(){ }
    });


    QUnit.module('pluginFactory');

    QUnit.test('module', function(assert) {
        var runner = runnerFactory(providerName);

        assert.equal(typeof limitBackButtonPluginFactory, 'function', 'The pluginFactory module exposes a function');
        assert.equal(typeof limitBackButtonPluginFactory(runner), 'object', 'The plugin factory produces an instance');
        assert.notStrictEqual(limitBackButtonPluginFactory(runner), limitBackButtonPluginFactory(runner), 'The plugin factory provides a different instance on each call');
    });

    QUnit
        .cases.init(['install', 'init', 'destroy'])
        .test('plugin API ', (method, assert) => {
            var runner = runnerFactory(providerName);
            var plugin = limitBackButtonPluginFactory(runner);
            assert.equal(typeof plugin[method], 'function', `The pluginFactory instances expose a "${method}" method`);
        });


    QUnit.module('behavior');

    QUnit.test('disable on change', assert => {
        const store = {};
        let previousButtonEnabled = true;
        const done = assert.async();

        assert.expect(8);

        runnerFactory.registerProvider('limitBackMock', {
            name: 'limitBackMock',
            loadAreaBroker(){
                return {
                    getContainer(){
                        return $('#qunit-fixtures');
                    }
                };
            },
            loadProxy(){ },
            loadTestStore(){
                return {
                    getStore() {
                        return Promise.resolve({
                            getItem(key){
                                return Promise.resolve(store[key]);
                            },
                            setItem(key, value){
                                store[key] = value;
                                return Promise.resolve(true);
                            }
                        });
                    }
                };
            },
            init(){ }
        });

        const runner = runnerFactory('limitBackMock', [
            pluginFactory({
                name : 'previous',
                init(){},
                enable(){
                    previousButtonEnabled = true;
                },
                disable(){
                    previousButtonEnabled = false;
                }
            }),
            limitBackButtonPluginFactory
        ]);

        runner.itemRunner = eventifier();

        runner.on('init', () => {
            const previous = runner.getPlugin('previous');
            const limitBackButton = runner.getPlugin('limitBackButton');

            assert.equal(typeof previous, 'object');
            assert.equal(typeof limitBackButton, 'object');

            assert.equal(previousButtonEnabled, true, 'The back button is enabled');
            assert.equal(typeof store['item1'], 'undefined', 'The item value is not yet stored');

            runner.on('renderitem', () => {

                assert.equal(previousButtonEnabled, true, 'The back button remains enabled');
                assert.equal(typeof store['item1'], 'undefined', 'The item value is not yet stored');

                runner.trigger('plugin-responsechange.limitBackButton');

                setTimeout(function(){

                    assert.equal(previousButtonEnabled, false, 'The back button is disabled');
                    assert.equal(store['item1'], true, 'The item has been flagged as answered');

                    done();
                }, 5);
            })
            .trigger('loaditem', 'item1')
            .trigger('renderitem', 'item1');
        })
        .on('error', err => {
            assert.ok(false, err.message);
            done();
        })
        .init();
    });


    QUnit.test('enabled back after navigation to a new item', assert => {
        const store = {};
        let previousButtonEnabled = true;
        const done = assert.async();

        assert.expect(14);

        runnerFactory.registerProvider('limitBackMock', {
            name: 'limitBackMock',
            loadAreaBroker(){
                return {
                    getContainer(){
                        return $('#qunit-fixtures');
                    }
                };
            },
            loadProxy(){ },
            loadTestStore(){
                return {
                    getStore() {
                        return Promise.resolve({
                            getItem(key){
                                return Promise.resolve(store[key]);
                            },
                            setItem(key, value){
                                store[key] = value;
                                return Promise.resolve(true);
                            }
                        });
                    }
                };
            },
            init(){ }
        });

        const runner = runnerFactory('limitBackMock', [
            pluginFactory({
                name : 'previous',
                init(){},
                enable(){
                    previousButtonEnabled = true;
                },
                disable(){
                    previousButtonEnabled = false;
                }
            }),
            limitBackButtonPluginFactory
        ]);

        runner.itemRunner = eventifier();

        runner.on('init', () => {
            const previous = runner.getPlugin('previous');
            const limitBackButton = runner.getPlugin('limitBackButton');

            assert.equal(typeof previous, 'object');
            assert.equal(typeof limitBackButton, 'object');

            assert.equal(previousButtonEnabled, true, 'The back button is enabled');
            assert.equal(typeof store['item1'], 'undefined', 'The item value is not yet stored');
            assert.equal(typeof store['item2'], 'undefined', 'The item value is not yet stored');

            runner.on('renderitem.item1', () => {
                runner.off('renderitem.item1');

                assert.equal(previousButtonEnabled, true, 'The back button remains enabled');
                assert.equal(typeof store['item1'], 'undefined', 'The item value is not yet stored');
                assert.equal(typeof store['item2'], 'undefined', 'The item value is not yet stored');

                runner.trigger('plugin-responsechange.limitBackButton');

                setTimeout(() => {

                    assert.equal(previousButtonEnabled, false, 'The back button is disabled');
                    assert.equal(store['item1'], true, 'The item has been flagged as answered');
                    assert.equal(typeof store['item2'], 'undefined', 'The item value is not yet stored');

                    runner.trigger('unloaditem')
                          .trigger('disablenav')
                          .trigger('loaditem', 'item2')
                          .trigger('renderitem.item2', 'item2')
                          .trigger('enablenav');
                }, 5);
            })
            .on('renderitem.item2', () => {

                setTimeout(() => {
                    assert.equal(previousButtonEnabled, true, 'The back button is enabled again');
                    assert.equal(store['item1'], true, 'The item has been flagged as answered');
                    assert.equal(typeof store['item2'], 'undefined', 'The item value is still not stored');
                    done();

                }, 5);
            })
            .trigger('loaditem', 'item1')
            .trigger('renderitem.item1', 'item1');

        })
        .on('error', err => {
            assert.ok(false, err.message);
            done();
        })
        .init();
    });
});
