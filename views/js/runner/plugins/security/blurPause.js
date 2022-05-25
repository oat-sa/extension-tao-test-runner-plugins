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
    'taoTests/runner/plugin',
    'taoQtiTest/runner/config/states'
], function (_, __, pageStatusFactory, pluginFactory, states) {
    'use strict';

    var pageStatus = pageStatusFactory();

    //do not remove these comments, this is used to generate the translation in .po file
    // __('The assessment has been paused due to an attempt to navigate to another window or tab. Please contact your proctor or administrator to resume your assessment.');
    var lostFocusPauseMessage = 'The assessment has been paused due to an attempt to navigate to another window or tab. Please contact your proctor or administrator to resume your assessment.';
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
            var ckEditorFocus = false;

            var bluring = false;

            // Fix for TAO-4419 (Edge compatibility)
            // We slightly delay the actual blur to give the focus a chance to come back very quickly.
            // This allow the test taker to close the annoying full screen confirmation message displayed by Edge.
            // Also this handle the case when there is a delay while focus moved to ckeditor
            var focusBackTimeoutDelayMs = 200;
            var focusBackTimeout = function focusBackTimeout() {
                return new Promise(function(resolve, reject) {
                    pageStatus.on('focus.focusBack', function() {
                        pageStatus.off('.focusBack');
                        reject(); // focus is back!
                    });
                    _.delay(function() {
                        pageStatus.off('.focusBack');

                        // check that the inner focus is not back as well
                        innerFocus || ckEditorFocus ? reject() : resolve();

                    }, focusBackTimeoutDelayMs);
                });
            };

            var doPause = function doPause() {
                const context = testRunner.getTestContext();
                const options = testRunner.getOptions();
                const getDefined = (...list) => list.find(value => 'undefined' !== typeof value);
                const sectionPause = getDefined(options.sectionPause, context.options && context.options.sectionPause);
                //@deprecated securePauseStateRequired, use options.sectionPause or options.proctored
                const forcePause =
                    typeof sectionPause === 'boolean'
                        ? sectionPause
                        : options.proctored || context.securePauseStateRequired;

                if (!bluring && context.state <= states.testSession.interacting && !testRunner.getState('finish')) {
                    bluring = true;
                    focusBackTimeout()
                        .then(function resolve() {
                            if ( forcePause ) {
                                testRunner.trigger('blur').trigger('pause', {
                                    message: __(lostFocusPauseMessage),
                                    reasons : {
                                        category : 'examinee',
                                        subCategory : 'behaviour'
                                    },
                                    originalMessage: lostFocusPauseMessage
                                });
                            } else {
                                testRunner.trigger('blur').trigger('warning', lostFocusMessage);
                                bluring = false;
                            }
                        })
                        .catch(function() {
                            bluring = false;
                        });
                }
            };

            //simple function to check if iframe belongs to ckeditor instance
            var isCkEditorIframe = function isCkEditorIframe(elt) {
                return elt.className.indexOf('cke_') !== -1;
            };

            var handleInnerWindowFocus = function handleInnerWindowFocus(e, ckEditor){
                if (ckEditor) {
                    ckEditorFocus = true;
                } else {
                    innerFocus = true;
                }
            };

            var handleCkEditorFocus = handleInnerWindowFocus.bind(null, null, true);

            var handleInnerWindowFocusLoose = function handleInnerWindowFocusLoose(e, ckEditor){
                if (ckEditor) {
                    ckEditorFocus = false;
                } else {
                    innerFocus = false;
                }

                _.defer(function(){
                    if(!mainFocus && !innerFocus && !ckEditorFocus){
                        doPause();
                    }
                });
            };

            var handleCkEditorFocusLoose = handleInnerWindowFocusLoose.bind(null, null, true);

            var handleIframesFocus = function handleIframesFocus(){

                //all iframe that could be within the item
                self.getAreaBroker().getContainer().find('iframe').each(function(){
                    try {
                        if (isCkEditorIframe(this)) {
                            var instanceIdentifier = this.title.substr(this.title.indexOf('editor'));
                            var editor = window.CKEDITOR.instances[instanceIdentifier];

                            editor.on('focus', handleCkEditorFocus);

                            editor.on('blur', handleCkEditorFocusLoose);
                        }

                        this.contentWindow.addEventListener('focus', handleInnerWindowFocus);

                        this.contentWindow.addEventListener('blur', handleInnerWindowFocusLoose);
                    } catch(permissionError) {
                        //in case of iframe with a different origin we can't access the contentWindow
                    }
                });
            };

            /**
             * Handles focus loose of page
             */
            const handleWindowFocusLoose = () => {
                mainFocus = false;

                _.defer(() => {
                    if (!innerFocus && !ckEditorFocus) {
                        //the main window has lost the focus and the focus isn't on an inner window
                        doPause();
                    }
                });
            };

            let isWindowResizing = false;
            const resizeEndListener = _.debounce(() => {
                isWindowResizing = false;
            }, 50);
            const resizeStartListener = _.debounce(() => {
                isWindowResizing = true;
            }, 50, { leading: true, trailing: false });

            function addResizeListeners() {
                window.addEventListener('resize', resizeStartListener);
                window.addEventListener('resize', resizeEndListener);
            }

            function removeResizeListeners() {
                window.removeEventListener('resize', resizeStartListener);
                window.removeEventListener('resize', resizeEndListener);
            }

            // look for status changes on the main window
            pageStatus
                .on('blur', () => {
                    if (!isWindowResizing) {
                        handleWindowFocusLoose();
                    }
                })
                .on('focus', () => {
                    mainFocus = true;
                });


            testRunner
                //needs to detect when the scratchpad creates it's iframe
                .on('plugin-loaded.scratchpad', handleIframesFocus)
                .on('renderitem', handleIframesFocus)
                .after('renderitem', addResizeListeners)
                .on('unloaditem', function(){
                    removeResizeListeners();
                    innerFocus = false;
                    ckEditorFocus = false;
                });
        }
    });
});
