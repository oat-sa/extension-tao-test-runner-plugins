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
    const platform = navigator.platform.indexOf('Mac') < 0 ? 'win' : 'mac';

    //do not remove these comments, this is used to generate the translation in .po file
    // __('The assessment has been paused due to an attempt to print screen. Please contact your proctor or administrator to resume your assessment.');
    const printScreenPauseMessage = 'The assessment has been paused due to an attempt to print screen. Please contact your proctor or administrator to resume your assessment.';

    /**
     * Sniff Internet Explorer which is the only browser to implement window.clipboardData
     * @type {Boolean}
     */
    const isIe = typeof window.clipboardData !== 'undefined';

    /**
     * On windows, this is what we will attempt to put in the clipboard on a copy event
     * @type {String}
     */
    const overrideContent = ' ';

    const $body = $('body');
    const blur = () => $body.css('filter', 'blur(20px)');
    const unBlur = () => $body.css('filter', '');

    const triggerCopyEvent = () => {
        if (isIe) {
            document.designMode = 'on'; // IE won't actually trigger the 'copy' event without this
        }
        if (document.execCommand && document.queryCommandSupported('copy')) {
            document.execCommand('copy');
        }
        if (isIe) {
            document.designMode = 'off';
        }
    }

    const focusOnFakeInput = () => {
        const input = document.createElement('input');
        input.setAttribute('value', overrideContent);
        input.classList.add('allow-copy');
        document.body.appendChild(input);
        input.select();
        triggerCopyEvent();
        document.body.removeChild(input);
    }

    const isPauseForced = testRunner => {
        //@deprecated securePauseStateRequired, use options.sectionPause or options.proctored
        const {securePauseStateRequired} = testRunner.getTestContext();
        const {sectionPause, proctored} = testRunner.getOptions();

        return typeof sectionPause === 'boolean'
            ? sectionPause
            : (proctored || securePauseStateRequired);
    }

    const preventScreenshot = testRunner => {
        focusOnFakeInput();

        if (isPauseForced(testRunner)) {
            testRunner.trigger('pause', {
                message: __(printScreenPauseMessage),
                reasons: {
                    category: 'examinee',
                    subCategory: 'behaviour'
                },
                originalMessage: printScreenPauseMessage
            });
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
        },

        /**
         * Called when the host is installing the plugins
         * @returns {Promise} to resolve async delegation
         */
        install: function install() {
            const testRunner = this.getTestRunner();

            // For mac - blur on Cmd+Shift
            if (platform === 'mac') {
                $(window)
                .on(`keydown.${this.getName()}`, e => {
                    if (e.metaKey && e.shiftKey) {
                        blur();
                    }
                })
                // Note - When user hits Cmd+Shift+4, they must press any key
                // to remove blur (that is not Cmd+Shift)
                .on(`keyup.${this.getName()}`, e => {
                    if (!e.metaKey || !e.shiftKey) {
                        unBlur();
                    }
                })
                .on('focus', unBlur)
                .on('click', unBlur);
            }

            // Windows - pause on PrtScn
            else if (platform === 'win') {
                $(window).on(`keyup.${this.getName()}`, e => {
                    if (e.key === 'PrintScreen') {
                        testRunner.trigger('prohibited-key', 'PrintScreen');
                        preventScreenshot(testRunner);
                    }
                });
            }
        },

        destroy: function destroy() {
            $(window).off('.' + this.getName());
        }
    });
});
