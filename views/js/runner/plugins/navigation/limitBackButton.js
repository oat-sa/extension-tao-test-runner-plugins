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

/**
 * This is a plugin that limits the use of the back button only when there is no responses in the current item.
 * So, if the user has entered a response to any interaction then the back button will be disabled.
 *
 * We can check if an interaction is already answered by listening to `responsechange` on item runner,
 * but it only works with the following interactions:
 *      - choice
 *      - order
 *      - associate
 *      - match
 *      - hot text
 *      - gap Match
 *      - slider
 *      - extended text
 *      - media
 *      - inline choice
 *      - text entry
 *      - end attempt
 *      - hotspot
 *      - graphic order
 *      - graphic associate
 *      - graphic gap match
 *      - select point
 *      - math entry
 *
 * Custom listeners will be added to the remaining interactions:
 *      - upload
 *      - audio recording
 *      - likert scale
 *      - liquids
 *
 * Special listeners
 *      - number pad for text entry
 *
 * @author Ricardo Proença <ricardo@taotesting.com>
 */
define([
    'taoTests/runner/plugin',
    'taoTestRunnerPlugins/runner/plugins/navigation/customListener'
], function (pluginFactory, customListener) {
    'use strict';

    /**
     * Update the state of the plugin
     *  - set disableState flag
     *  - set item flag for the current item
     *  - disables previous button
     *
     * @param testRunner
     * @param {string} itemIdentifier - item runner identifier
     */
    var updateState = function update(testRunner, itemIdentifier) {
        var self = this;
        this.disableState = true;

        if (!self.isNavigationTriggered) {
            this.storage.setItem(getItemKey(itemIdentifier), this.disableState).then(function () {
                toggleBackButton(testRunner, self.disableState);
            });
        }
    };

    /**
     * Gets the unique item key identifier for this plugin
     *
     * @param {string} itemIdentifier - item runner identifier
     * @returns {string}
     */
    var getItemKey = function getItemKey(itemIdentifier) {
        return `${itemIdentifier}-limit-back-button`;
    };

    /**
     * Enable/disable the back button
     *
     * @param {Object} testRunner - testRunner plugin
     * @param {boolean} disable - disable back button flag
     */
    var toggleBackButton = function toggleBackButton(testRunner, disable) {
        var previous = testRunner.getPlugin("previous");

        disable ? previous.disable() : previous.enable();
    };

    /**
     * Returns the configured plugin
     */
    return pluginFactory({

        name: 'limitBackButton',

        /**
         * Initialize the plugin (called during runner's init)
         */
        init: function init() {
            var self = this;
            var testRunner = this.getTestRunner();

            /**
             * Callback passed to interactions listener
             */
            var customInteractionsHandler = function customInteractionsHandler(a, b, c) {
                testRunner.itemRunner.trigger("responsechange");
            };

            /**
             * Load the store and hook the behavior
             */
            return testRunner.getPluginStore(this.getName()).then(function (store) {
                self.storage = store;
                self.disableState = false;
                // Some PCI triggers responsechange at navigation events, and we don't want to change state when moving
                self.isNavigationTriggered = false;

                testRunner.before('move.' + self.getName(), function (e, direction) {
                    self.isNavigationTriggered = true;
                    if (direction === "previous" && self.disableState) {
                        return Promise.reject();
                    }
                });

                testRunner.after('enablenav.' + self.getName(), function () {
                    toggleBackButton(testRunner, self.disableState)
                });

                testRunner.after('disablenav.' + self.getName(), function () {
                    testRunner.trigger("enablenav");
                });

                //update plugin state based on changes
                testRunner
                    .after('renderitem', function (itemIdentifier, itemData) {
                        var itemRunner = testRunner.itemRunner;

                        itemRunner.before('statechange', updateState.bind(self, testRunner, itemIdentifier));

                        itemRunner.after('statechange', function () {
                            self.isNavigationTriggered = false;
                        });

                        // add custom interaction listeners
                        var interactions = itemData.content.data.body.elements;
                        for (const interactionName in interactions) {
                            var interaction = interactions[interactionName];
                            customListener.addInteraction(interaction, customInteractionsHandler)
                        }

                        // add special listener to number pad
                        customListener.addNumpadWidget(customInteractionsHandler);
                    })
                    .on('loaditem', function (itemIdentifier) {
                        self.storage
                            .getItem(getItemKey(itemIdentifier))
                            .then(function (val) {
                                self.disableState = val;
                                toggleBackButton(testRunner, val);
                            });
                    });
            });
        }
    });
});
