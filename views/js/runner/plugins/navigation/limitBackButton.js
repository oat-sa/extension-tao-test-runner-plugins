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
 * Copyright (c) 2019-2020 (original work) Open Assessment Technologies SA ;
 */

/**
 * Plugin that limits the use of the back button only when there is no responses in the current item.
 * So, once a user has entered a response to any interaction, the back button will be disabled.
 * We can check if an interaction is already answered by listening to `responsechange` on item runner.
 *
 * @author Ricardo Proença <ricardo@taotesting.com>
 */
define([
    'jquery',
    'lodash',
    'taoTests/runner/plugin',
    'taoQtiTest/runner/helpers/currentItem'
], function ($, _, pluginFactory, currentItemHelper) {
    'use strict';

    const pluginName = 'limitBackButton';

    /**
     * The name of the "back button" plugin
     */
    const backButtonPluginName = 'previous';

    /**
     * Which events are listened and considered as changes
     */
    const customListeners = [{
        selector: '.widget-numpad',
        eventName: 'click'
    }, {
        selector: '.qti-interaction',
        eventName: 'change'
    }];


    /**
     * Returns the configured plugin
     */
    return pluginFactory({

        name: pluginName,

        /**
         * Install new methods to the plugin instance for internal usage
         */
        install() {

            /**
             * Install the event listener that trigger changes
             * @fires runner#plugin-responsechange.limitBackButton
             */
            this.addCustomListeners = function addCustomListeners() {
                if (Array.isArray(customListeners)) {
                    const $container = this.getTestRunner().getAreaBroker().getContainer();
                    customListeners.forEach( ({selector, eventName }) => {
                        $(selector, $container).on(
                            `${eventName}.${pluginName}`,
                            () => this.trigger('responsechange')
                        );
                    });
                }
            };

            /**
             * Removes the event listeners
             */
            this.removeCustomListeners = function removeCustomListeners() {
                if (Array.isArray(customListeners)) {
                    const $container = this.getTestRunner().getAreaBroker().getContainer();
                    customListeners.forEach( ({selector, eventName }) => {
                        $(selector, $container).off(`${eventName}.${pluginName}`);
                    });
                }
            };
        },

        /**
         * Initialize the plugin (called during runner's init)
         * @returns {Promise} once the initialization is done
         */
        init() {
            const testRunner = this.getTestRunner();
            const backButtonPlugin = testRunner.getPlugin(backButtonPluginName);

            //works only when a
            if ( !backButtonPlugin ) {
                return;
            }

            return testRunner.getPluginStore(this.getName()).then( store => {

                //double security, keep the state to prevents actual events to to be handled
                //in addition to the DOM disabling
                let disableState = false;

                //do not update during a navigation
                let processingMoveAction = false;
                let currentItemIdentifier;

                /**
                 * Save the current state in the store and toggle the button state
                 * @returns {Promise} once saved and toggled
                 */
                const updatePreviousPlugin = () => {
                    if (!processingMoveAction && currentItemIdentifier) {
                        return store.getItem(currentItemIdentifier)
                            .then( answered => {
                                if (answered === true) {
                                    disableState = true;
                                    backButtonPlugin.disable();
                                } else {
                                    backButtonPlugin.enable();
                                }
                            })
                            .catch( err => testRunner.trigger('error', err));
                    }
                    return Promise.resolve();
                };

                testRunner
                    .before('nav-previous', () => {
                        if (disableState) {
                            return Promise.reject();
                        }
                    })
                    .before('move', (e, direction)  => {
                        processingMoveAction = true;
                        if (direction === 'previous' && disableState) {
                            return Promise.reject();
                        }
                    })
                    .after('enablenav', () => {
                        processingMoveAction = false;

                        updatePreviousPlugin();
                    })
                    .on('loaditem', itemIdentifier => {
                        disableState = false;
                        currentItemIdentifier = itemIdentifier;
                    })
                    .before('renderitem', () => {
                        if (currentItemHelper.isAnswered(testRunner)) {
                            return store.setItem(currentItemIdentifier, true);
                        }
                    })
                    .after('renderitem', () => {

                        updatePreviousPlugin();

                        testRunner.itemRunner.on('responsechange', () => this.trigger('responsechange') );

                        this.addCustomListeners();
                    })
                    .on(`plugin-responsechange.${pluginName}`, () => {
                        if (currentItemIdentifier && !processingMoveAction)  {
                            return store.setItem(currentItemIdentifier, true)
                                .then(updatePreviousPlugin);
                        }
                    })
                    .on('beforeunloaditem', () => this.removeCustomListeners());
            });
        },

        /**
         * Clean up the place
         */
        destroy () {
            this.removeCustomListeners();
        }
    });
});
