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
 * Pause the test as soon as the current page is blured or hidden
 *
 * @author Bertrand Chevrier <bertrand@taotesting.com>
 */
define([
    'lodash',
    'i18n',
    'ui/pageStatus',
    'taoTests/runner/plugin'
], function (_, __, pageStatus, pluginFactory) {
    'use strict';

    var lostFocusPauseMessage = __('The assessment has been paused due to an attempt to navigate to another window or tab. Please contact your proctor or administrator to resume your assessment.');
    var lostFocusMessage = __('Attempt to navigate to another window or tab.');

    /**
     * Creates the blurPause plugin
     */
    return pluginFactory({

        name: 'blurPause',

        /**
         * Initializes the plugin (called during runner's init)
         *
         * @fires testRunner#pause
         * @fires testRunner#blur
         */
        init: function init() {
            var self = this;

            var testRunner = this.getTestRunner();

            //to know if the focus is given to inner element or the main window
            var mainFocus = true;
            var innerFocus = false;

            var bluring = false;
            var doPause = function doPause() {
                var context = testRunner.getTestContext();
                var states = testRunner.getTestData().states;
                if (!bluring && context.state <= states.interacting && !testRunner.getState('finish')) {
                    bluring = true;
                    testRunner.trigger('blur');
                    if (context.securePauseStateRequired) {
                        testRunner.trigger('pause', {
                            message: lostFocusPauseMessage,
                            reasons : {
                                category : __('examinee'),
                                subCategory : __('behaviour')
                            }
                        });
                    } else {
                        testRunner.trigger('traceLog', {
                            'Security log': lostFocusMessage
                        }).trigger('warning', lostFocusMessage);
                    }
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
                                    doPause();
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
                            doPause();
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
    });
});
