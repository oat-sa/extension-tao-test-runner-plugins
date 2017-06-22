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

define([
    'jquery',
    'i18n',
    'taoTests/runner/plugin'
], function ($, __, pluginFactory) {
    'use strict';

    /**
     * Identify the current platform
     * @type {String}
     */
    var platform = navigator.platform.indexOf('Mac') < 0 ? 'win' : 'mac';

    /**
     * Sniff Internet Explorer which is the only browser to implement window.clipboardData
     * @type {boolean}
     */
    var isIe = typeof window.clipboardData !== 'undefined';

    /**
     * On windows, this is what we will attempt to put in the clipboard on a PrintScreen event
     */
    var overrideContent = ' ';

    function triggerCopyEvent() {
        console.log('about to trigger copy event');
        if (isIe) {
            console.log('setting design mode');
            document.designMode = 'on'; // required by IE to actually trigger the 'copy' event
        }
        if (document.queryCommandSupported('copy')) {
            console.log('triggering copy event');
            document.execCommand('copy');
        }
        if (isIe) {
            document.designMode = 'off';
        }
    }

    function handleCopyEvent(event) {
        console.log('handling copy event');
        overrideClipboard(event.clipboardData);
        event.preventDefault();
    }

    function overrideClipboard(clipboardData) {
        // var now = new Date(),
        //     formattedDate = now.getHours() + ':' + now.getMinutes() + ':' + now.getSeconds();
        console.log('overidding clipboard');
        // IE specific
        if (isIe) {
            console.log('overriding in IE');
            window.clipboardData.setData('Text', overrideContent);

        // Normal browsers behavior
        } else {
            console.log('overriding in a normal browser');

            clipboardData.setData('text/plain', overrideContent);
            // clipboardData.setData('text/html', 'overriden html at ' + formattedDate); // todo: remove me?
            // console.log(clipboardData.getData('text/plain'));
        }
    }

    /**
     * Creates the plugin.
     * Prevents screenshots (mac) and pauses assessment on print screen (win)
     */
    return pluginFactory({

        name: 'preventScreenshot',

        /**
         * Initializes the plugin (called during runner's init)
         */
        init: function init() {
            // this function is mandatory
            var testRunner = this.getTestRunner(),
                areaBroker = testRunner.getAreaBroker(),
                $toolbox = areaBroker.getToolboxArea(),
                $trigger = $('<div>', {
                    text: 'trigger for cut/paste'
                });

            // $toolbox.append($trigger);

            // $trigger.on('click', function() {
            //     fireCopy();
            // });


        },

        /**
         * Called when the host is installing the plugins
         * @returns {Promise} to resolve async delegation
         */
        install: function install() {
            var testRunner = this.getTestRunner();

            // For mac - blur on Cmd+Shift
            if (platform === 'mac') {
                $(window)
                .on('keydown' + '.' + this.getName(), function (e) {
                    if (e.metaKey && e.shiftKey) {
                        $('body').css('filter', 'blur(20px)');
                    }
                })
                // Note - When user hits Cmd+Shift+4, they must press any key
                // to remove blur (that is not Cmd+Shift)
                .on('keyup' + '.' + this.getName(), function (e) {
                    if (!e.metaKey || !e.shiftKey) {
                        $('body').css('filter', '');
                    }
                });
            }

            // Windows - pause on PrtScn
            else if (platform === 'win') {
                // try overriding any successful screenshot
                console.log('listening to copy event');
                // document.addEventListener('copy', handleCopyEvent);
                document.addEventListener('copy', function(e) {
                    console.log('COPY TRIGGERED !');
                    e.preventDefault();
                });

                $(window)
                .on('keyup' + '.' + this.getName(), function (e) {
                    if (e.key === 'PrintScreen') {
                        triggerCopyEvent();
                        console.log('PrintScreen');

                        // testRunner
                        // .trigger('prohibited-key', 'PrintScreen')
                        // .trigger('pause', {
                        //     message: __('The assessment has been paused due to an attempt to print screen. Please contact your proctor or administrator to resume your assessment.'),
                        //     reasons: {
                        //         category: __('examinee'),
                        //         subCategory: __('behaviour')
                        //     }
                        // });
                    }
                });
            }
        },

        destroy: function destroy() {
            $(window).off('.' + this.getName());
            document.removeEventListener('copy', handleCopyEvent);
        }
    });
});
