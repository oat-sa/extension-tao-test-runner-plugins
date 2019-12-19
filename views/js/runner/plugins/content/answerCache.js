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
 * Plugin that puts in cache the current item's state upon move.
 * After a page refresh, the cached state is loaded to restore the previously set state.
 * However if the item has already been responded no change is made.
 * The cache is cleared when the item attempt is finished.
 * @author Jean-Sébastien Conan <jean-sebastien@taotesting.com>
 */
define([
    'util/namespace',
    'taoTests/runner/plugin',
    'taoQtiTest/runner/helpers/currentItem'
], function (namespaceHelper, pluginFactory, currentItem) {
    'use strict';

    /**
     * Returns the configured plugin
     */
    return pluginFactory({

        name: 'answerCache',

        /**
         * Initialize the plugin (called during runner's init)
         */
        init() {
            const testRunner = this.getTestRunner();

            return testRunner.getPluginStore(this.getName()).then(store => {
                this.storage = store;

                testRunner
                    .after('renderitem', () => {
                        const itemRunner = testRunner.itemRunner;
                        const testContext = testRunner.getTestContext();
                        const key = `${testContext.itemIdentifier}#${testContext.attempt}`;
                        const {allAttempts} = this.getConfig();

                        // clear the cache when we have reached safely the next step in the navigation
                        testRunner.on(namespaceHelper.namespaceAll('loaditem finish', this.getName()), () => {
                            testRunner.off(`.${this.getName()}`);
                            return this.storage.clear();
                        });

                        if (itemRunner && (allAttempts || !currentItem.isAnswered(testRunner))) {
                            // cache answers on each response change
                            itemRunner
                                .off(`.${this.getName()}`)
                                .on(`responsechange.${this.getName()}`, () => {
                                    this.storage.setItem(key, itemRunner.getState());
                                });

                            // load the cached answers if any
                            return this.storage.getItem(key)
                                .then(state => {
                                    if (state) {
                                        itemRunner.setState(state);
                                    }
                                });
                        }
                    });
            });
        }
    });
});
