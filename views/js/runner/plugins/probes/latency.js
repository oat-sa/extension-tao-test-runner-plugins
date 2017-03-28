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
 * Test Runner Probes Plugin : latency
 *
 *
 *
 * @author Bertrand Chevrier <bertrand@taotesting.com>
 */
define([
    'lodash',
    'taoTests/runner/plugin'
], function (_, pluginFactory){
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

    /**
     * Returns the configured plugin
     */
    return pluginFactory({
        name : 'latency',

        /**
         * Initialize the plugin (called during runner's init)
         */
        init : function init(){
            var testRunner = this.getTestRunner(),
                probeOverseer = testRunner.getProbeOverseer();

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
            probeOverseer
                .add({
                    name : 'leave-fullscreen-prohibited',
                    events : 'leavefullscreen',
                    capture : captureAll
                })
                .add({
                    name : 'unsecured-launch-prohibited',
                    events : 'unsecured-launch',
                    capture : captureAll
                })
                .add({
                    name : 'focus-loss-prohibited',
                    events : 'blur',
                    capture : captureAll
                })
                .add({
                    name : 'shortcut-prohibited',
                    events : 'prohibited-key',
                    capture : captureShortcut
                })
                .add({
                    name : 'pause-on-disconnect',
                    events : 'disconnectpause',
                    capture : captureAll
                })
                .add({
                    name : 'pause',
                    events : 'pause',
                    capture : captureAll
                })
                .add({
                    name : 'session-latency',
                    latency : true,
                    startEvents : 'init',
                    stopEvents : ['endsession'],
                    capture : captureTest
                })
                .add({
                    name : 'item-latency',
                    latency : true,
                    startEvents : ['renderitem', 'resumeitem'],
                    stopEvents : ['move', 'skip', 'timeout', 'plugin-exitend.exit', 'pause'],
                    capture : captureAll
                })
                .add({
                    name : 'help-panel-latency',
                    latency : true,
                    startEvents : 'plugin-panelshow.help',
                    stopEvents : 'plugin-panelhide.help',
                    capture : captureAll
                })
                .add({
                    name : 'formula-panel-latency',
                    latency : true,
                    startEvents : 'plugin-panelshow.formula',
                    stopEvents : 'plugin-panelhide.formula',
                    capture : captureAll
                })
                .add({
                    name : 'exit-dialog-latency',
                    latency : true,
                    startEvents : 'plugin-exitstart.exit',
                    stopEvents : 'plugin-exitend.exit',
                    capture : captureAll
                })
                .add({
                    name : 'scratchpad-latency',
                    latency : true,
                    startEvents : 'plugin-open.scratchpad',
                    stopEvents : 'plugin-close.scratchpad',
                    capture : captureAll
                })
                .add({
                    name : 'calculator-latency',
                    latency : true,
                    startEvents : 'plugin-open.calculator',
                    stopEvents : 'plugin-close.calculator',
                    capture : captureAll
                })
                .add({
                    name : 'highlighter-latency',
                    latency : true,
                    startEvents : 'plugin-start.highlighter',
                    stopEvents : 'plugin-end.highlighter',
                    capture : captureAll
                })
                .add({
                    name : 'lineReader-latency',
                    latency : true,
                    startEvents : 'plugin-start.line-reader',
                    stopEvents : 'plugin-end.line-reader',
                    capture : captureAll
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
    });
});
