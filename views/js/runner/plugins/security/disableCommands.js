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
    'jquery',
    'lodash',
    'module',
    'util/shortcut',
    'json!taoTestRunnerPlugins/runner/plugins/security/commands.json',
    'taoTests/runner/plugin'
], function ($, _, module, shortcutHelper, allShortcuts, pluginFactory) {
    'use strict';

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
     * A translation map to present the right name of the key regarding the current platform
     * @type {Object}
     */
    var specialKeys = {
        mac: {
            '<Shift>' : 'Shift',
            '<Ctrl>' : 'Ctrl',
            '<Meta>' : 'Cmd',
            '<Alt>' : 'Option'
        },
        win: {
            '<Shift>' : 'Shift',
            '<Ctrl>' : 'Ctrl',
            '<Meta>' : 'Win',
            '<Alt>' : 'Alt'
        }
    };

    /**
     * A list of shortcuts to enabled inside input fields.
     * @type {Array}
     */
    var enabledInInput = ['backspace'];

    /**
     * The default configuration if nothing
     * is found on the module config
     */
    var defaultConfig = {
        debounceDelay: 250
    };

    var config = _.defaults(module.config() || {}, defaultConfig);

    /**
     * Format a shortcut to be displayed with the right key names
     * @param {String} label
     * @returns {String}
     */
    function formatShortcut(label) {
        _.forEach(specialKeys[platform], function(spec, code) {
            label = label.replace(code, spec);
        });
        return label;
    }

    /**
     * Registers an event handler on a particular element
     * @param {Element|Window|Document} target
     * @param {String} eventName
     * @param {Function} listener
     */
    function registerEvent(target, eventName, listener) {
        var listenerFn = _.debounce(listener, config.debounceDelay);
        if (target.addEventListener) {
            target.addEventListener(eventName, listenerFn, false);
        } else if (target.attachEvent) {
            target.attachEvent('on' + eventName, listenerFn);
        } else {
            target['on' + eventName] = listenerFn;
        }
    }

    /**
     * Removes an event handler from a particular element
     * @param {Element|Window|Document} target
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

    /** Refine the list of shortcuts to only get those that are relevant with the current platform **/
    _.forEach(allShortcuts, function(shortcut) {
        if (shortcut.platform.indexOf(platform) >= 0) {
            shortcut.label = formatShortcut(shortcut.label);
            shortcuts.push(shortcut);
        }
    });

    /**
     * Creates the disableCommands plugin.
     * Prevents the user to run some commands.
     */
    return pluginFactory({

        name: 'disableCommands',

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

            function preventContextMenu(event) {
                event.stopPropagation();
                event.preventDefault();
                testRunner.trigger('prohibited-key', 'contextmenu');
            }

            registerEvent(window, 'contextmenu', preventContextMenu);

            _.forEach(shortcuts, function(shortcut) {
                var inputEnabled = _.indexOf(enabledInInput, shortcut.shortcut) >= 0;
                shortcutHelper.add(shortcut.shortcut, function(event) {
                    if (!inputEnabled || !$(event.target).closest(':input').length) {
                        event.preventDefault();
                        testRunner.trigger('prohibited-key', shortcut.label);
                    }
                }, {prevent: false});
            });

            testRunner.on('destroy', function() {
                unregisterEvent(window, 'contextmenu', preventContextMenu);

                _.forEach(shortcuts, function(shortcut) {
                    shortcutHelper.remove(shortcut.shortcut);
                });
            });
        }
    });
});
