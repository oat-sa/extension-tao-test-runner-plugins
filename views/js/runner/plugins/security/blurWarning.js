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
 * Warning message as soon as the current page is blured or hidden
 *
 * @author Aleskej Tikhanovich <aleksej@taotesting.com>
 */
define([
    'lodash',
    'i18n',
    'ui/pageStatus',
    'taoTests/runner/plugin'
], function (_, __, pageStatus, pluginFactory) {
    'use strict';

    var lostFocusMessage = __('Attempt to navigate to another window or tab. Please contact your proctor or administrator to resume your assessment.');

    /**
     * Creates the blurWarning plugin
     */
    return pluginFactory({

        name: 'blurWarning',

        /**
         * Initializes the plugin (called during runner's init)
         *
         * @fires testRunner#log
         * @fires testRunner#blur
         */
        init: function init() {
            var self = this;

            var testRunner = this.getTestRunner();

            if (!('blurPause' in testRunner.getPlugins())) {
                //to know if the focus is given to inner element or the main window
                var mainFocus = true;
                var innerFocus = false;

                var bluring = false;
                var doLog = function doPause() {
                    var context = testRunner.getTestContext();
                    var states = testRunner.getTestData().states;
                    if (!bluring && context.state <= states.interacting && !testRunner.getState('finish')) {
                        bluring = true;
                        testRunner.trigger('blur')
                            .trigger('log', lostFocusMessage);
                    }
                };

                var handleIframesFocus = function handleIframesFocus(){

                    //all iframe that could be within the item
                    self.getAreaBroker().getContainer().find('iframe').each(function(){
                        try {
                            this.contentWindow.addEventListener('focus', function handleInnerWindowFocus(){
                                innerFocus = true;
                            });

                            this.contentWindow.addEventListener('blur', function handleInnerWindowFocusLoose(){
                                innerFocus = false;
                                _.defer(function(){
                                    if(!mainFocus && !innerFocus){
                                        //the inner window has lost the focus and no one else has it
                                        doLog();
                                    }
                                });
                            });
                        } catch(permissionError) {
                            //in case of iframe with a different origin we can't access the contentWindow
                        }
                    });
                };

                //look for status changes on the main window
                pageStatus()
                    .on('blur hide', function handleWindowFocusLoose(){
                        mainFocus = false;

                        _.defer(function(){
                            if(!innerFocus){
                                //the main window has lost the focus and the focus isn't on an inner window
                                doLog();
                            }
                        });
                    })
                    .on('focus', function handleWindowFocus(){
                        mainFocus = true;
                    });


                testRunner
                //needs to detect when the scratchpad creates it's iframe
                    .on('plugin-loaded.scratchpad', handleIframesFocus)
                    .on('renderitem', handleIframesFocus)
                    .on('unloaditem', function(){
                        innerFocus = false;
                    });
            }

        }
    });
});
