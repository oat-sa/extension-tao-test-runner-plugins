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
 * Copyright (c) 2016-2017 (original work) Open Assessment Technologies SA ;
 */

/**
 * Register some probes in the test runner.
 * This has to be wrapped in a proper test runner plugin with a per-instance configuration.
 * Configuration should be in a Json file and look something like:
 *
 * ```
 * [{
 *   "name": "leave-fullscreen-prohibited",
 *   "events": "leavefullscreen",
 *   "capture": "captureAll"
 * },
 * {
 *   "name": "session-latency",
 *   "latency": true,
 *   "startEvents": "init",
 *   "stopEvents": [
 *     "endsession"
 *   ],
 *   "capture": "captureTest"
 * },
 * {
 *   "name": "item-latency",
 *   "latency": true,
 *   "startEvents": [
 *     "renderitem",
 *     "resumeitem"
 *   ],
 *   "stopEvents": [
 *     "move",
 *     "skip",
 *     "timeout",
 *     "plugin-exitend.exit",
 *     "pause"
 *   ],
 *   "capture": "captureAll"
 * }]
 * ```
 *
 * Some capture processors are already defined:
 * - captureTest: capture only info about the current test
 * - captureAll: general purpose processor, capture all context info
 * - captureShortcut: capture info about a shortcut event (will also contains the same info as captureAll)
 *
 * You may want to add custom capture processors, using the dedicated API:
 * - registerCaptureProcessor(name, processor)
 * - hasCaptureProcessor(name)
 * - applyCaptureProcessor(name)
 * - removeCaptureProcessor(name)
 *
 * Each capture processors will receive the following parameters:
 * - testRunner: the testRunner instance
 * - eventName: the name of the event that triggered the probe
 * - *: any other event parameters
 *
 * @author Bertrand Chevrier <bertrand@taotesting.com>
 */
define([
    'lodash'
], function (_){
    'use strict';

    var latencyProbes;

    var timers = {};

    /**
     * Default probe capture processors.
     * @type {Object}
     */
    var captureProcessors = {
        /**
         * Will capture info for a test-wide event.
         * @param {Object} testRunner
         * @returns {Object}
         */
        captureTest: function captureTest(testRunner){
            const testMap = testRunner.getTestMap();
            return {
                testId : testMap.identifier
            };
        },

        /**
         * General purpose capture processor, will capture all info from the current context.
         * @param {Object} testRunner
         * @returns {Object}
         */
        captureAll: function captureAll(testRunner){
            const context = testRunner.getTestContext();
            const testMap = testRunner.getTestMap();
            return {
                testId : testMap.identifier,
                testPartId : context.testPartId,
                sectionId : context.sectionId,
                itemId : context.itemIdentifier,
                sectionTimer : latencyProbes.getTimerValue('assessmentSection'),
                attempt : context.attempt
            };
        },

        /**
         * Will capture info for a shortcut event (will also contains the same info as captureAll).
         * @param {Object} testRunner
         * @param {String} eventName
         * @param {String} shortcut
         * @returns {Object}
         */
        captureShortcut: function captureShortcut(testRunner, eventName, shortcut){
            return _.assign(latencyProbes.applyCaptureProcessor('captureAll', testRunner), {
                shortcut : shortcut
            });
        }
    };

    latencyProbes = {
        /**
         * Registers the probes and add test runner listeners
         * @param {Object} testRunner - a testRunner instance
         * @param {Object} probesConfig - the probes to register in a Json format
         * @returns {latencyProbes}
         */
        init : function init(testRunner, probesConfig){
            var probeOverseer = testRunner.getProbeOverseer();

            /**
             * Increase stability
             * @param traceData
             * @param numTry
             */
            function insistentSender(traceData, numTry = 0) {
                if (numTry > 5) {
                    // stop tries
                    return;
                }
                testRunner.getProxy()
                  .sendVariables(traceData, true)
                  .catch(function () {
                      setTimeout(function () {
                          insistentSender(traceData, ++numTry);
                      }, 300);
                  });
            }

            /**
             * Send latency data
             */
            function sendVariables() {
                return probeOverseer.flush().then(function(data){
                    var traceData = {};
                    //we reformat the time set into a trace variables
                    if(data && data.length){
                        _.forEach(data, function(entry){
                            var id = entry.type + '-' + entry.id;

                            if(entry.marker){
                                id = entry.marker + '-' + id;
                            }
                            traceData[id] = entry;
                        });
                        //and send them
                        insistentSender(traceData);
                    }
                    return data;
                });
            }

            //register the probes
            probesConfig.forEach(function(probe) {
                probeOverseer.add({
                    name: probe.name,
                    events: probe.events,
                    latency: probe.latency,
                    startEvents: probe.startEvents,
                    stopEvents: probe.stopEvents,
                    capture: captureProcessors[probe.capture]
                });
            });

            testRunner.on('plugin-addtimer.timer', function(timerPlugin, type, timer) {
                timers[type] = timer;
            });
            testRunner.on('plugin-removetimer.timer', function(timerPlugin, type) {
                timers[type] = false;
            });
            testRunner.before('unloaditem', function() {
                return sendVariables();
            });
            testRunner.before('exit', function() {
                return sendVariables();
            });
            return this;
        },

        /**
         * Gets the current value of a timer. If it does not exist, null will be returned.
         * @param {String} name
         * @returns {Number|null}
         */
        getTimerValue: function getTimerValue(name) {
            if(typeof timers[name] === 'object'){
                if(_.isNumber(timers[name].remainingTime)){
                    return timers[name].remainingTime;
                }

                //backward compatilbe format for timers
                if(_.isFunction(timers[name].val)){
                    return  parseInt(timers[name].val(), 10);
                }
            }
            return null;
        },

        /**
         * Checks if a capture processors already exists
         * @param {String} name
         * @returns {Boolean}
         */
        hasCaptureProcessor: function hasCaptureProcessor(name) {
            return !!captureProcessors[name];
        },

        /**
         * Adds a capture processor.
         *
         * Each capture processors will receive the following parameters:
         * - testRunner: the testRunner instance
         * - eventName: the name of the event that triggered the probe
         * - *: any other event parameters
         *
         * @param {String} name
         * @param {Function} processor
         * @returns {latencyProbes}
         */
        registerCaptureProcessor: function registerCaptureProcessor(name, processor) {
            if (_.isEmpty(name) || !_.isString(name)) {
                throw new TypeError('A capture processor should have a valid name');
            }
            if (!_.isFunction(processor)) {
                throw new TypeError('The processor must be a function');
            }
            captureProcessors[name] = processor;
            return this;
        },

        /**
         * Applies a capture processor using the provided arguments.
         * @param {String} name
         * @param * capture processor arguments
         * @returns {Object}
         */
        applyCaptureProcessor: function applyCaptureProcessor(name) {
            var capture;
            if (_.isEmpty(name) || !_.isString(name)) {
                throw new TypeError('A capture processor have a valid name');
            }
            capture = captureProcessors[name];
            if (_.isFunction(capture)) {
                return capture.apply(captureProcessors, [].slice.call(arguments, 1));
            }
            return null;
        },

        /**
         * Removes a capture processor.
         * @param {String} name
         * @returns {latencyProbes}
         */
        removeCaptureProcessor: function removeCaptureProcessor(name) {
            if (_.isEmpty(name) || !_.isString(name)) {
                throw new TypeError('A capture processor have a valid name');
            }
            captureProcessors = _.omit(captureProcessors, name);
            return this;
        }
    };

    return latencyProbes;
});
