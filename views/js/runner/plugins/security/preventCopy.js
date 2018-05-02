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
    'util/shortcut',
    'taoTests/runner/plugin'
], function (_, shortcutHelper, pluginFactory) {
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
     * The number of milliseconds to delay for debounce
     * @type {number}
     */
    var debounceDelay = 250;

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
        var listenerFn = _.debounce(listener, debounceDelay);
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

            function prevent(event) {
                event.stopPropagation();
                event.preventDefault();
                testRunner.trigger('prohibited-key', event.type);
            }

            registerEvent(window, 'copy', prevent);
            registerEvent(window, 'paste', prevent);

            _.forEach(shortcuts, function(shortcut) {
                shortcutHelper.add(shortcut.key, function() {
                    testRunner.trigger('prohibited-key', shortcut.label);
                });
            });

            testRunner.on('destroy', function() {
                unregisterEvent(window, 'copy', prevent);
                unregisterEvent(window, 'paste', prevent);

                _.forEach(shortcuts, function(shortcut) {
                    shortcutHelper.remove(shortcut.key);
                });
            })
        }
    });
});
