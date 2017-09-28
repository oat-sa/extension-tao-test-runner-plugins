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
 * Plugin that puts in cache the current item's state upon move.
 * After a page refresh, the cached state is loaded to restore the previously set state.
 * However if the item has already been responded no change is made.
 * The cache is cleared when the item attempt is finished.
 * @author Jean-Sébastien Conan <jean-sebastien@taotesting.com>
 */
define([
    'core/store',
    'util/namespace',
    'taoTests/runner/plugin',
    'taoQtiTest/runner/helpers/currentItem'
], function (storeFactory, namespaceHelper, pluginFactory, currentItem) {
    'use strict';

    /**
     * Returns the configured plugin
     */
    return pluginFactory({

        name: 'answerCache',

        /**
         * Initialize the plugin (called during runner's init)
         */
        init: function init() {
            var self = this;
            var testRunner = this.getTestRunner();

            return storeFactory(this.getName() + '-' + testRunner.getConfig().serviceCallId).then(function (store) {
                self.storage = store;

                testRunner
                    .after('renderitem', function () {
                        var itemRunner = testRunner.itemRunner;
                        var testContext = testRunner.getTestContext();
                        var key = testContext.itemIdentifier;

                        if (itemRunner && !currentItem.isAnswered(testRunner)) {
                            itemRunner.on('responsechange', function () {
                                self.storage.setItem(key, itemRunner.getState());
                            });
                            return self.storage.getItem(key)
                                .then(function (state) {
                                    if (state) {
                                        itemRunner.setState(state);
                                    }
                                });
                        }
                    })
                    .on('unloaditem', function () {
                        // the store should not be cleared after a pause
                        // otherwise the response won't be restored after resume
                        if (!testRunner.getState('closedOrSuspended')) {
                            return self.storage.clear();
                        }
                    });
            });
        },

        /**
         * Called during the runner's destroy phase
         */
        destroy: function destroy() {
            if (this.storage && !this.getTestRunner().getState('closedOrSuspended')) {
                return this.storage.removeStore();
            }
        }
    });
});
