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
 * Copyright (c) 2025 (original work) Open Assessment Technologies SA ;
 */

define([
    'jquery',
    'lodash',
    'core/eventifier',
    'taoTests/runner/runner',
    'taoQtiTest/test/runner/mocks/providerMock',
    'context',
    'taoTestRunnerPlugins/runner/plugins/security/watermark'
], function ($, _, eventifier, runnerFactory, providerMock, context, pluginFactory) {
    'use strict';

    const providerName = 'mock';
    runnerFactory.registerProvider(providerName, providerMock());

    const sampleTestContext = {
        itemIdentifier: 'item-1'
    };
    const sampleTestMap = {
        parts: {
            p1: {
                sections: {
                    s1: {
                        items: {
                            'item-1': {
                                categories: ['x-tao-option-watermark']
                            },
                            'item-2': {
                                categories: ['x-tao-option-other']
                            },
                            'item-3': {
                                categories: ['x-tao-option-watermark-abc']
                            },
                            'item-4': {
                                categories: ['x-tao-option-watermark-def']
                            }
                        }
                    }
                }
            }
        },
        jumps: [
            {
                identifier: 'item-1',
                section: 's1',
                part: 'p1',
                position: 0
            },
            {
                identifier: 'item-2',
                section: 's1',
                part: 'p1',
                position: 1
            },
            {
                identifier: 'item-3',
                section: 's1',
                part: 'p1',
                position: 2
            },
            {
                identifier: 'item-4',
                section: 's1',
                part: 'p1',
                position: 3
            }
        ]
    };

    /**
     * Gets a configured instance of the Test Runner
     * @param {Object} [config] - Optional config to setup the test runner
     * @returns {Promise<runner>}
     */
    function getTestRunner(config) {
        const runner = runnerFactory(providerName, [], config);
        runner.getDataHolder();
        runner.setTestContext(sampleTestContext);
        runner.setTestMap(sampleTestMap);
        setupAreaBroker(runner);
        return Promise.resolve(runner);
    }

    function setupAreaBroker(runner) {
        $('#qunit-item').empty();
        $('#qunit-item').html($('#qunit-template').html());
        const $root = $('#qunit-item');

        const areaBroker = runner.getAreaBroker();
        areaBroker.getContainer = () => $root.find('.test-runner-sections');
        areaBroker.getContentArea = () => $root.find('.qti-content');
    }

    QUnit.module('pluginFactory');

    QUnit.test('module', assert => {
        const runner = runnerFactory(providerName);

        assert.equal(typeof pluginFactory, 'function', 'The pluginFactory module exposes a function');
        assert.equal(typeof pluginFactory(runner), 'object', 'The plugin factory produces an instance');
        assert.notStrictEqual(
            pluginFactory(runner),
            pluginFactory(runner),
            'The plugin factory provides a different instance on each call'
        );
    });

    QUnit.cases
        .init([{ title: 'install' }, { title: 'init' }, { title: 'destroy' }])
        .test('plugin API ', (data, assert) => {
            const runner = runnerFactory(providerName);
            const plugin = pluginFactory(runner);
            assert.equal(
                typeof plugin[data.title],
                'function',
                `The pluginFactory instances expose a "${data.title}" method`
            );
        });

    QUnit.module('behavior');

    QUnit.test('renders watermark if item has x-tao-option-watermake category', assert => {
        const ready = assert.async();
        assert.expect(3);

        getTestRunner()
            .then(runner => {
                runner.on('destroy', ready);

                const areaBroker = runner.getAreaBroker();
                const $root = areaBroker.getContainer();

                const plugin = pluginFactory(runner, areaBroker);

                return plugin
                    .install()
                    .then(() => plugin.init())
                    .then(
                        () =>
                            new Promise(resolve => {
                                //item with default watermark category
                                runner.setTestContext({
                                    itemIdentifier: 'item-1'
                                });
                                runner.trigger('renderitem');
                                setTimeout(() => {
                                    resolve();
                                }, 100);
                            })
                    )
                    .then(() => {
                        const $watermark = $root.find('.tao-wmark');
                        assert.equal(
                            $watermark.length,
                            1,
                            'For item with default watermark category, renders watermark'
                        );
                        return plugin.getText();
                    })
                    .then(
                        text =>
                            new Promise(resolve => {
                                // sha1 for "my-classmate" split by 10 chars with 3 spaces in-between
                                const expectedText = '7f8a30e7ea   07a1635552   3b00ddbaca   6e8f0ca60e';
                                assert.ok(text.includes(expectedText), 'Watermark text includes username hash');

                                runner.trigger('unloaditem');

                                //item without watermark category
                                runner.setTestContext({
                                    itemIdentifier: 'item-2'
                                });
                                runner.trigger('renderitem');
                                setTimeout(() => {
                                    resolve();
                                }, 100);
                            })
                    )
                    .then(() => {
                        const $watermark = $root.find('.tao-wmark');
                        assert.equal($watermark.length, 0, 'For item without watermark category, no watermark');
                        runner.trigger('unloaditem');

                        runner.destroy();
                    });
            })
            .catch(err => {
                assert.pushResult({
                    result: false,
                    message: err
                });
                ready();
            });
    });

    QUnit.test('renders watermark according to config, configsByCategory', assert => {
        const ready = assert.async();
        assert.expect(5);

        getTestRunner()
            .then(runner => {
                runner.on('destroy', ready);

                const areaBroker = runner.getAreaBroker();
                const $root = areaBroker.getContainer();

                const plugin = pluginFactory(runner, areaBroker);

                return plugin
                    .setConfig({
                        type: 'diagonal',
                        layer: 'foreground',
                        hashAlgorithm: 'SHA-512',
                        textPartLength: '5',
                        separatorsLength: '1',
                        configsByCategory: {
                            abc: {
                                type: 'circle'
                            },
                            def: {
                                type: 'horizontal',
                                layer: 'background',
                                style: 'color:red;opacity:0.5',
                                containerStyle: 'color:green'
                            }
                        }
                    })
                    .install()
                    .then(() => plugin.init())
                    .then(
                        () =>
                            new Promise(resolve => {
                                //item with default watermark category
                                runner.setTestContext({
                                    itemIdentifier: 'item-1'
                                });
                                runner.trigger('renderitem');
                                setTimeout(() => {
                                    resolve();
                                }, 100);
                            })
                    )
                    .then(() => {
                        const $watermark = $root.find('.tao-wmark.diagonal.foreground');
                        assert.equal(
                            $watermark.length,
                            1,
                            'For item with default watermark category, renders watermark with "layer" and "type" defined in config'
                        );
                        return plugin.getText();
                    })
                    .then(text => {
                        // part of sha-512 for "my-classmate" split by 5 chars with 1 space in-between
                        const expectedText = 'a4c4f cce03 edbbe 990df';
                        assert.ok(
                            text.includes(expectedText),
                            'Watermark text includes username hash, according to config'
                        );

                        runner.trigger('unloaditem');

                        //mock to no longer use timeouts in the unit test
                        plugin.getText = () => Promise.resolve('my-text');

                        //item with 'configsByCategory: abc'
                        runner.setTestContext({
                            itemIdentifier: 'item-3'
                        });
                        runner.trigger('renderitem');
                        return Promise.resolve();
                    })
                    .then(() => {
                        const $watermark = $root.find('.tao-wmark.circle.foreground');
                        assert.equal(
                            $watermark.length,
                            1,
                            'For item with category from "configsByCategory", renders watermark (a)'
                        );

                        runner.trigger('unloaditem');

                        //item with 'configsByCategory: def'
                        runner.setTestContext({
                            itemIdentifier: 'item-4'
                        });
                        runner.trigger('renderitem');
                        return Promise.resolve();
                    })
                    .then(() => {
                        const $watermark = $root.find('.tao-wmark.horizontal.background');
                        assert.equal(
                            $watermark.length,
                            1,
                            'For item with category from "configsByCategory", renders watermark (b)'
                        );
                        assert.ok(
                            $watermark.children('div').attr('style').includes('color:red;opacity:0.5'),
                            'Applies "style" from config to the watermark'
                        );

                        runner.trigger('unloaditem');

                        runner.destroy();
                    });
            })
            .catch(err => {
                assert.pushResult({
                    result: false,
                    message: err
                });
                ready();
            });
    });
});
