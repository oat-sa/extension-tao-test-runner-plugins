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
 * Copyright (c) 2017 (original work) Open Assessment Technologies SA ;
 */
/**
 * @author Jean-Sébastien Conan <jean-sebastien@taotesting.com>
 */
define([
    'lodash',
    'core/eventifier',
    'core/promise',
    'taoTestRunnerPlugins/runner/plugins/probes/latency'
], function(_, eventifier, Promise, latency) {
    'use strict';

    QUnit.module('API');

    QUnit.test('module', function(assert) {
        assert.expect(1);
        assert.equal(typeof latency, 'object', 'The module exposes an object');
    });

    QUnit.cases.init([
        {title: 'init'},
        {title: 'getTimerValue'},
        {title: 'hasCaptureProcessor'},
        {title: 'registerCaptureProcessor'},
        {title: 'applyCaptureProcessor'},
        {title: 'removeCaptureProcessor'}
    ]).test('module has ', function(data, assert) {
        assert.expect(1);
        assert.equal(typeof latency[data.title], 'function', 'The probes latency object exposes a "' + data.title + '" function');
    });

    QUnit.module('Method');

    QUnit.test('init', function(assert) {
        var ready = assert.async();
        var probes = [{
            name: 'init',
            events: 'init',
            capture: 'captureTest'
        }, {
            name: 'item',
            startEvents: 'loaditem',
            stopEvents: 'unloaditem',
            capture: 'captureAll'
        }, {
            name: 'shortcut',
            events: 'shortcut',
            capture: 'captureShortcut'
        }, {
            name: 'custom',
            events: 'custom',
            capture: 'captureCustom'
        }];
        var idx = 1;
        var probeData = [];
        var testMap = {
            identifier: 'fooBar'
        };
        var testContext = {
            testPartId: 'testPart-1',
            sectionId: 'testSection-1',
            itemIdentifier: 'item-1',
            attempt: 1
        };
        var expectedData = {
            init: {
                id: 1,
                type: 'init',
                marker: null,
                context: {
                    testId: testMap.identifier
                }
            },
            shortcut: {
                id: 2,
                type: 'shortcut',
                marker: null,
                context: {
                    testId: testMap.identifier,
                    testPartId: testContext.testPartId,
                    sectionId: testContext.sectionId,
                    itemId: testContext.itemIdentifier,
                    sectionTimer: 10,
                    attempt: testContext.attempt,
                    shortcut: 'Ctrl+C'
                }
            },
            item: {
                id: 3,
                type: 'item',
                marker: 'stop',
                context: {
                    testId: testMap.identifier,
                    testPartId: testContext.testPartId,
                    sectionId: testContext.sectionId,
                    itemId: testContext.itemIdentifier,
                    sectionTimer: null,
                    attempt: testContext.attempt
                }
            },
            custom: {
                id: 4,
                type: 'custom',
                marker: null,
                context: {
                    capture: 'custom',
                    param1: 'foo',
                    param2: 'bar'
                }
            }
        };
        var testRunner = eventifier({
            getProxy: function() {
                return {
                    sendVariables: function(trace) {
                        return new Promise(function(resolve) {
                            var traceData = _.indexBy(probeData, function(entry) {
                                return (entry.marker ? entry.marker + '-' : '') + entry.type + '-' + entry.id;
                            });
                            assert.deepEqual(trace, traceData, 'The trace data should have been provided');
                            resolve();
                        });
                    }
                };
            },
            getTestMap() {
                return testMap;
            },
            getTestContext: function() {
                return testContext;
            },
            getProbeOverseer: function() {
                return {
                    add: function(probe) {
                        assert.equal(typeof probe.capture, 'function', 'Check value of probe.capture for ' + probe.name);

                        testRunner.on(probe.events || probe.stopEvents, function() {
                            var trace = {
                                id: idx++,
                                type: probe.name,
                                marker: probe.stopEvents ? 'stop' : null
                            };
                            if (probe.capture) {
                                trace.context = probe.capture.apply(probe, [testRunner, probe.name].concat([].slice.call(arguments)));
                            }

                            assert.deepEqual(trace, expectedData[probe.name], 'Check captured data for ' + probe.name);

                            probeData.push(trace);
                        });
                    },
                    flush: function() {
                        assert.ok(true, 'Flushing the probes data');
                        return Promise.resolve(probeData);
                    }
                };
            }
        });

        assert.expect(18);

        testRunner.after('exit', function() {
            assert.ok(true, 'Test runner exited');
            ready();
        });

        latency.registerCaptureProcessor('captureCustom', function(runner, eventName, param1, param2) {
            assert.equal(runner, testRunner, 'The test runner should be provided to the custom capture processor');
            assert.equal(eventName, 'custom', 'The right event name should be provided to the custom capture processor');
            assert.equal(param1, 'foo', 'The right parameter 1 should be provided to the custom capture processor');
            assert.equal(param2, 'bar', 'The right parameter 2 should be provided to the custom capture processor');

            return {
                capture: eventName,
                param1: param1,
                param2: param2
            };
        });

        assert.equal(latency.init(testRunner, probes), latency, 'Initializing the probes');

        testRunner.trigger('init');
        _.delay(function() {
            testRunner.trigger('plugin-addtimer.timer', latency, 'assessmentSection', {
                val: function() {
                    return 10;
                }
            });
            testRunner.trigger('plugin-addtimer.timer', latency, 'test', {});
            testRunner.trigger('loaditem');

            _.delay(function() {
                testRunner.trigger('shortcut', 'Ctrl+C');
            }, 50);

            _.delay(function() {
                testRunner.trigger('plugin-removetimer.timer', latency, 'assessmentSection');
                testRunner.trigger('plugin-removetimer.timer', latency, 'test');
                testRunner.trigger('unloaditem');

                _.delay(function() {
                    testRunner.trigger('custom', 'foo', 'bar');
                }, 50);

                _.delay(function() {
                    testRunner.trigger('exit');
                }, 250);
            }, 250);
        }, 250);
    });

    QUnit.test('getTimerValue', function(assert) {
        var ready = assert.async();
        var testTimer = 20;
        var sectionTimer = 10;
        var testRunner = eventifier({
            getProxy: function() {
                return {
                    sendVariables: function() {
                        return new Promise(function (resolve) {
                            resolve();
                        });
                    }
                };
            },
            getTestMap() {
                return testMap;
            },
            getTestContext: function() {
                return testContext;
            },
            getProbeOverseer: function() {
                return {
                    add: function(probe) {},
                    flush: function() {
                        assert.ok(true, 'Flushing the probes data');
                        return Promise.resolve([]);
                    }
                };
            }
        });

        assert.expect(9);

        testRunner.after('exit', function() {
            assert.ok(true, 'Test runner exited');
            ready();
        });

        assert.equal(latency.init(testRunner, []), latency, 'Initializing the probes');

        assert.equal(latency.getTimerValue('testTimer'), null, 'Should not get any value for the test timer');
        assert.equal(latency.getTimerValue('sectionTimer'), null, 'Should not get any value for the assessmentSection timer');

        testRunner.trigger('plugin-addtimer.timer', latency, 'testTimer', {
            val: function() {
                return testTimer;
            }
        });
        testRunner.trigger('plugin-addtimer.timer', latency, 'sectionTimer', {
            val: function() {
                return sectionTimer;
            }
        });

        _.delay(function() {
            assert.equal(latency.getTimerValue('testTimer'), testTimer, 'Should get the right test timer value');
            assert.equal(latency.getTimerValue('sectionTimer'), sectionTimer, 'Should get the right assessmentSection timer value');

            testRunner.trigger('plugin-removetimer.timer', latency, 'testTimer');
            testRunner.trigger('plugin-removetimer.timer', latency, 'sectionTimer');

            _.delay(function() {
                assert.equal(latency.getTimerValue('testTimer'), null, 'Should not get any value for the test timer');
                assert.equal(latency.getTimerValue('sectionTimer'), null, 'Should not get any value for the assessmentSection timer');

                testRunner.trigger('exit');
            }, 250);
        }, 250);
    });

    QUnit.test('insistentSender', function (assert) {
        var ready = assert.async();
        var rejectedCount = 0;
        var testRunner = eventifier({
            getProxy: function() {
                return {
                    sendVariables: function() {
                        return new Promise(function (resolve, reject) {
                            var timer;
                            rejectedCount++;
                            if (rejectedCount === 5) {
                                assert.ok(true, 'Rejected 5 times');
                                timer = setTimeout(function() { ready(); }, 400);
                            }
                            if (rejectedCount > 5) {
                                clearTimeout(timer);
                                assert.ok(false, 'Rejected more than 5 times');
                                ready();
                            }
                            reject();
                        });
                    }
                };
            },
            getTestMap() {
                return testMap;
            },
            getTestContext: function() {
                return testContext;
            },
            getProbeOverseer: function() {
                return {
                    add: function(probe) {},
                    flush: function() {
                        assert.ok(true, 'Flushing the probes data');
                        return Promise.resolve(['qunit_data']);
                    }
                };
            }
        });

        assert.expect(4);

        testRunner.after('exit', function() {
            assert.ok(true, 'Test runner exited');
        });
        assert.equal(latency.init(testRunner, []), latency, 'Initializing the probes');
        _.delay(function() {
            testRunner.trigger('exit');
        }, 250);
    });

    QUnit.cases.init([
        {title: 'captureTest', has: true},
        {title: 'captureAll', has: true},
        {title: 'captureShortcut', has: true},
        {title: 'captureFoo', has: false}
    ]).test('hasCaptureProcessor ', function(data, assert) {
        assert.expect(1);
        assert.equal(latency.hasCaptureProcessor(data.title), data.has, 'Check the capture processor "' + data.title + '"');
    });

    QUnit.test('registerCaptureProcessor', function(assert) {
        var name = 'captureFoo';
        var processor = function() {};

        assert.expect(7);

        assert.equal(latency.hasCaptureProcessor(name), false, 'The capture processor is not yet registered');
        assert.equal(latency.registerCaptureProcessor(name, processor), latency, 'Registering the processor');
        assert.equal(latency.hasCaptureProcessor(name), true, 'The capture processor is now registered');

        assert.throws(function() {
            latency.registerCaptureProcessor({}, processor);
        }, 'Should throw an error if the name is invalid');

        assert.throws(function() {
            latency.registerCaptureProcessor('', processor);
        }, 'Should throw an error if the name is empty');

        assert.throws(function() {
            latency.registerCaptureProcessor(name);
        }, 'Should throw an error if the processor is not provided');

        assert.throws(function() {
            latency.registerCaptureProcessor(name, {});
        }, 'Should throw an error if the processor is not a function');
    });

    QUnit.test('applyCaptureProcessor', function(assert) {
        var testRunner = {};
        var eventName = 'foo';
        var param = 'bar';
        var expected = {
            id: 123,
            name: eventName,
            param: param
        };

        assert.expect(6);

        latency.registerCaptureProcessor('captureOne', function(tr, ev, other) {
            assert.equal(tr, testRunner, 'The test runner is provided');
            assert.equal(ev, eventName, 'The eventName is provided');
            assert.equal(other, param, 'The additional parameter is provided');

            return {
                id: 123,
                name: ev,
                param: other
            };
        });

        assert.deepEqual(latency.applyCaptureProcessor('captureOne', testRunner, eventName, param), expected, 'The capture processor is properly called');

        assert.throws(function() {
            latency.applyCaptureProcessor({});
        }, 'Should throw an error if the name is invalid');

        assert.throws(function() {
            latency.applyCaptureProcessor('');
        }, 'Should throw an error if the name is empty');
    });

    QUnit.test('removeCaptureProcessor', function(assert) {
        var name = 'captureBar';
        var processor = function() {};

        assert.expect(7);

        assert.equal(latency.hasCaptureProcessor(name), false, 'The capture processor is not yet registered');
        assert.equal(latency.registerCaptureProcessor(name, processor), latency, 'Registering the processor');
        assert.equal(latency.hasCaptureProcessor(name), true, 'The capture processor is now registered');
        assert.equal(latency.removeCaptureProcessor(name), latency, 'Removing the processor');
        assert.equal(latency.hasCaptureProcessor(name), false, 'The capture processor has been removed');

        assert.throws(function() {
            latency.removeCaptureProcessor({});
        }, 'Should throw an error if the name is invalid');

        assert.throws(function() {
            latency.removeCaptureProcessor('');
        }, 'Should throw an error if the name is empty');
    });

});
