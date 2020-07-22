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
 * @author Jean-Sébastien Conan <jean-sebastien.conan@vesperiagroup.com>
 */
define([
    'lodash',
    'module',
    'util/shortcut',
    'taoTests/runner/plugin'
], function (_, module, shortcutHelper, pluginFactory) {
    'use strict';

    /**
     * The list of all known shortcuts, any platforms
     * @type {Array}
     */
    var allShortcuts = [{
        platform: 'mac',
        key: 'Meta+X',
        label: 'Cmd+X'
    }, {
        platform: 'mac',
        key: 'Meta+C',
        label: 'Cmd+C'
    }, {
        platform: 'mac',
        key: 'Meta+V',
        label: 'Cmd+V'
    }, {
        platform: 'win',
        key: 'Ctrl+X',
        label: 'Ctrl+X'
    }, {
        platform: 'win',
        key: 'Ctrl+C',
        label: 'Ctrl+C'
    }, {
        platform: 'win',
        key: 'Ctrl+V',
        label: 'Ctrl+V'
    }];

    /**
     * The list of shortcuts to intercept, based on current platform
     * @type {Array}
     */
    var shortcuts = [];

    /**
     * Identify the current platform
     * @type {String}
     */
    var platform = navigator.platform.indexOf('Mac') < 0 ? 'win' : 'mac';

    /**
     * The default configuration if nothing
     * is found on the module config
     */
    var defaultConfig = {
        debounceDelay: 500
    };

    var config = _.defaults(module.config() || {}, defaultConfig);

    /** Refine the list of shortcuts to only get those that are relevant with the current platform **/
    _.forEach(allShortcuts, function(shortcut) {
        if (shortcut.platform.indexOf(platform) >= 0) {
            shortcuts.push(shortcut);
        }
    });

    /**
     * Registers an event handler on a particular element
     * @param {Element} target
     * @param {String} eventName
     * @param {Function} listener
     */
    function registerEvent(target, eventName, listener) {
        if (target.addEventListener) {
            target.addEventListener(eventName, listener, false);
        } else if (target.attachEvent) {
            target.attachEvent('on' + eventName, listener);
        } else {
            target['on' + eventName] = listener;
        }
    }

    /**
     * Removes an event handler from a particular element
     * @param {Element} target
     * @param {String} eventName
     * @param {Function} listener
     */
    function unregisterEvent(target, eventName, listener) {
        if (target.removeEventListener) {
            target.removeEventListener(eventName, listener, false);
        } else if (target.detachEvent) {
            target.detachEvent('on' + eventName, listener);
        } else {
            target['on' + eventName] = null;
        }
    }

    function toKeyCode(combination) {
        var keys = combination.split('+');
        var keyCode = 0;

        _.forEach(keys, function (key) {
            switch (key) {
                case 'Ctrl':
                case 'Meta':
                    keyCode += CKEDITOR.CTRL;
                    break;
                default:
                   if (key.length === 1) {
                       keyCode += key.toUpperCase().charCodeAt(0);
                   }
            }
        });

        return keyCode;
    }

    /**
     * Creates the preventCopy plugin.
     * Prevents the user to copy any content.
     */
    return pluginFactory({

        name: 'preventCopy',

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
            var testRunner = this.getTestRunner();
            var prohibitedKeyFunc;
            var prohibitedKeyDebounce;
            const isIe = typeof window.clipboardData !== 'undefined';

            function setUpIframeEvents(){
                var editors = window.CKEDITOR && window.CKEDITOR.instances || [];

                _.forEach(editors, function (editor) {
                    editor.on('key', function (e) {
                        _.forEach(shortcuts, function (shortcut) {
                            if (e.data.keyCode === toKeyCode(shortcut.key)) {
                                return e.cancel();
                            }
                        });
                    });
                });
            }

            function replaceSelection(target, newValue) {
                const oldValue = target.value.toString().substring(target.selectionStart, target.selectionEnd);
                const caretPosition = target.selectionStart;
                const textBegin = target.value.substring(0, caretPosition);
                const textEnd = target.value.substring(caretPosition + oldValue.length, target.value.length);
                target.value = textBegin + newValue + textEnd;
                target.selectionStart = caretPosition + newValue.length;
                target.selectionEnd = caretPosition + newValue.length;
                target.focus();
            }
            function onCopyCut(event) {
                event.preventDefault();
                const target = $(event.target).closest('textarea, input, [contenteditable]')[0];
                if (target) {
                    const text = target.value.toString().substring(target.selectionStart, target.selectionEnd);
                    if (isIe) {
                        window.clipboardData.setData('Text', '');
                    } else {
                        event.clipboardData.setData('text/plain', '');
                    }
                    if (event.type === 'cut') {
                        replaceSelection(target, '');
                    }
                    $(target).attr('data-clipboard', text);
                } else {
                    event.stopPropagation();
                    testRunner.trigger('prohibited-key', event.type);
                }
            }
            function onPaste(event) {
                event.preventDefault();
                const target = $(event.target).closest('textarea, input, [contenteditable]')[0];
                if (target) {
                    const text = $(target).attr('data-clipboard') || '';
                    replaceSelection(target, text);
                } else {
                    event.stopPropagation();
                    testRunner.trigger('prohibited-key', event.type);
                }
            }

            registerEvent(window, 'copy', onCopyCut);
            registerEvent(window, 'cut', onCopyCut);
            registerEvent(window, 'paste', onPaste);

            _.forEach(shortcuts, function(shortcut) {
                prohibitedKeyFunc = function(event) {
                    if (!$(event.target).closest(':input').length) {
                        testRunner.trigger('prohibited-key', shortcut.label);
                    }
                };
                prohibitedKeyDebounce = _.debounce(prohibitedKeyFunc, config.debounceDelay, { leading : true, trailing : false});
                shortcutHelper.add(shortcut.key, prohibitedKeyDebounce, {avoidInput: true});
            });

            testRunner
                .on('renderitem', function () {
                    setUpIframeEvents();
                    testRunner
                        .getAreaBroker()
                        .getContentArea()
                        .find('textarea, input, [contenteditable]')
                        .attr('data-clipboard', '');
                })
                .on('destroy', function() {
                    unregisterEvent(window, 'copy', onCopyCut);
                    unregisterEvent(window, 'cut', onCopyCut);
                    unregisterEvent(window, 'paste', onPaste);

                    _.forEach(shortcuts, function(shortcut) {
                        shortcutHelper.remove(shortcut.key);
                    });
                });
        }
    });
});
