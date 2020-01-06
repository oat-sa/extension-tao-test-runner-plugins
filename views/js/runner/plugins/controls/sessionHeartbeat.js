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
 * Copyright (c) 2017-2019 (original work) Open Assessment Technologies SA ;
 */
/**
 * Plugin that sends a heartbeat signal to maintain the session alive.
 * The ideal interval should between half and full duration of the session.
 * @author Jean-Sébastien Conan <jean-sebastien@taotesting.com>
 */
define([
    'lodash',
    'util/namespace',
    'taoTests/runner/plugin',
    'core/polling'
], function (_, namespaceHelper, pluginFactory, pollingFactory) {
    'use strict';

    /**
     * Some default values
     * @type {Object}
     */
    const defaultConfig = {
        interval: 900,  // The interval between two heartbeat signals, in seconds
        action: 'up'
    };

    /**
     * The number of milliseconds in one interval unit
     * @type {Number}
     */
    const intervalUnit = 1000;

    /**
     * Returns the configured plugin
     */
    return pluginFactory({

        name: 'sessionHeartbeat',

        /**
         * Initializes the plugin (called during runner's init)
         */
        init() {
            const testRunner = this.getTestRunner();
            const {interval, action} = _.defaults(this.getConfig() || {}, defaultConfig);

            this.polling = pollingFactory({
                action() {
                    const testContext = testRunner.getTestContext();
                    testRunner.getProxy().telemetry(testContext.itemIdentifier, action);
                },
                interval: interval * intervalUnit,
                autoStart: true
            });
        },

        /**
         * Called during the runner's destroy phase
         */
        destroy() {
            if (this.polling) {
                this.polling.stop();
            }
            this.polling = null;
        },

        /**
         * Enables the button
         */
        enable() {
            if (this.polling) {
                this.polling.start();
            }
        },

        /**
         * Disables the button
         */
        disable() {
            if (this.polling) {
                this.polling.stop();
            }
        }
    });
});
