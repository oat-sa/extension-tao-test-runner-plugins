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
 * Copyright (c) 2016 (original work) Open Assessment Technologies SA ;
 */

/**
 * Register some probes in the test runner.
 * This has to be wrapped in a proper test runner plugin with a per-instance configuration.
 * Configuration should be in a Json file and look something like:
 *
 [{
   "name": "leave-fullscreen-prohibited",
   "events": "leavefullscreen",
   "capture": "captureAll"
 },
 {
   "name": "session-latency",
   "latency": true,
   "startEvents": "init",
   "stopEvents": [
     "endsession"
   ],
   "capture": "captureTest"
 },
 {
   "name": "item-latency",
   "latency": true,
   "startEvents": [
     "renderitem",
     "resumeitem"
   ],
   "stopEvents": [
     "move",
     "skip",
     "timeout",
     "plugin-exitend.exit",
     "pause"
   ],
   "capture": "captureAll"
 }]
 *
 *
 * @author Bertrand Chevrier <bertrand@taotesting.com>
 */
define([
    'lodash'
], function (_){
    'use strict';

    var timers = {};

    function captureTest(testRunner){
        var data = testRunner.getTestData();
        return {
            testId : data.identifier
        };
    }

    function captureAll(testRunner){
        var data = testRunner.getTestData();
        var context = testRunner.getTestContext();
        var sectionTimer = typeof timers["assessmentSection"] === "object" ?
            parseInt(timers["assessmentSection"].val(), 10) : null;

        return {
            testId : data.identifier,
            testPartId : context.testPartId,
            sectionId : context.sectionId,
            itemId : context.itemIdentifier,
            itemUri : context.itemUri,
            sectionTimer : sectionTimer,
            attempt : context.attempt
        };
    }

    function captureShortcut(testRunner, eventName, shortcut){
        var data = testRunner.getTestData();
        var context = testRunner.getTestContext();
        return {
            testId : data.identifier,
            testPartId : context.testPartId,
            sectionId : context.sectionId,
            itemId : context.itemIdentifier,
            itemUri : context.itemUri,
            attempt : context.attempt,
            shortcut : shortcut
        };
    }


    return {
        /**
         * @param {Object} testRunner - a testRunner instance
         * @param {Object} probesConfig - the probes to register in a Json format
         * Register the probes and add test runner listeners
         */
        init : function init(testRunner, probesConfig){
            var probeOverseer = testRunner.getProbeOverseer();

            /**
             * Send latency data
             */
            function sendVariables() {
                probeOverseer.flush().then(function(data){
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
                        return testRunner.getProxy()
                            .sendVariables(traceData);
                    }
                });
            }

            //register the probes
            probesConfig.forEach(function(probe) {
                var captureFn;

                switch(probe.capture) {
                    case 'captureAll':      captureFn = captureAll;         break;
                    case 'captureShortcut': captureFn = captureShortcut;    break;
                    case 'captureTest':     captureFn = captureTest;        break;
                }
                probeOverseer.add({
                    name: probe.name,
                    events: probe.events,
                    latency: probe.latency,
                    startEvents: probe.startEvents,
                    stopEvents: probe.stopEvents,
                    capture: captureFn
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
                testRunner.trigger('endsession');
                return sendVariables();
            });
        }
    };
});
