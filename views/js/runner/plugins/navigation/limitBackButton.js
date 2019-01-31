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
 * Copyright (c) 2019 (original work) Open Assessment Technologies SA ;
 */

/**
 * Plugin that limits the use of the back button only when there is no responses in the current item.
 * So, once a user has entered a response to any interaction, the back button will be disabled.
 * We can check if an interaction is already answered by listening to `responsechange` on item runner.
 *
 * @author Ricardo Proença <ricardo@taotesting.com>
 */
define([
    "jquery",
    "lodash",
    'taoTests/runner/plugin'
], function ($, _, pluginFactory) {
    'use strict';

    var pluginName = "limitBackButton";

    var defaultEventName = "change";

    var itemInteractions = {};

    var customListeners = [
        {
            selector: ".widget-numpad",
            eventName: "click"
        }
    ];

    /**
     * Gets the unique item key identifier for this plugin
     *
     * @param {string} itemIdentifier - item runner identifier
     * @returns {string}
     */
    var getItemKey = function getItemKey(itemIdentifier) {
        return itemIdentifier + "-limit-back-button";
    };

    /**
     * Remove all listeners from an item
     *
     * @param {Object} testRunner - test runner, needed to find interactions elements
     */
    var removeAllListeners = function removeAllListeners(testRunner) {
        _.forEach(customListeners, function (plugin) {
            var $element = testRunner.getAreaBroker().getContainer().find(plugin.selector);

            $element.off("." + pluginName);
        });

        _.forEach(itemInteractions, function (interaction) {
            var selector = "[data-serial='" + interaction.serial + "']";
            var $element = testRunner.getAreaBroker().getContentArea().find(selector);

            $element.off("." + pluginName);
        });
    };

    /**
     * Returns the configured plugin
     */
    return pluginFactory({

        name: pluginName,

        /**
         * Initialize the plugin (called during runner's init)
         */
        init: function init() {
            var testRunner = this.getTestRunner();

            return testRunner.getPluginStore(this.getName()).then(function (store) {
                var disableState = false;
                var processingMoveAction = false;

                var toggleBackButton = function toggleBackButton() {
                    var previous = testRunner.getPlugin("previous");

                    disableState ? previous.disable() : previous.enable();
                };

                var createListener = function createListener(element, eventName) {
                    var event = eventName
                        ? eventName + "." + pluginName
                        : defaultEventName + "." + pluginName;

                    element.on(event, function () {
                        testRunner.itemRunner.trigger("responsechange." + pluginName);
                    });
                };

                testRunner.before("move." + pluginName, function (e, direction) {
                    processingMoveAction = true;
                    if (direction === "previous" && disableState) {
                        return Promise.reject();
                    }
                });

                testRunner.after("enablenav." + pluginName, function () {
                    toggleBackButton(disableState);
                });

                testRunner.after("disablenav." + pluginName, function () {
                    if (disableState) {
                        testRunner.trigger("enablenav");
                    }
                });

                testRunner
                    .after("renderitem", function (itemIdentifier, itemData) {
                        var self = this;
                        var itemRunner = testRunner.itemRunner;

                        processingMoveAction = false;

                        itemRunner.on("responsechange." + pluginName, function () {
                            if (!processingMoveAction) {
                                disableState = true;
                                store
                                    .setItem(getItemKey(itemIdentifier))
                                    .then(toggleBackButton);
                            }
                        });

                        _.forEach(customListeners, function (plugin) {
                            var $element = self.getAreaBroker().getContainer().find(plugin.selector);

                            createListener($element, plugin.eventName);
                        });

                        itemInteractions = itemData.content.data.body.elements;
                        _.forEach(itemInteractions, function (interaction) {
                            var selector = "[data-serial='" + interaction.serial + "']";
                            var $element = self.getAreaBroker().getContentArea().find(selector);

                            createListener($element);
                        });
                    })
                    .on("loaditem", function (itemIdentifier) {
                        store
                            .getItem(getItemKey(itemIdentifier))
                            .then(function (val) {
                                disableState = val;
                                toggleBackButton();
                            });
                    })
                    .on("beforeunloaditem", function () {
                        removeAllListeners(testRunner);
                    });
            });
        },

        destroy: function () {
            removeAllListeners(this.getTestRunner());
        }
    });
});
