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
 * Test Runner Navigation Plugin : Paused Section
 *
 * @author Alexander Zagovorychev <zagovorichev@1pt.com>
 */
define([
    'lodash',
    'i18n',
    'core/promise',
    'taoTests/runner/plugin',
    'taoQtiTest/runner/helpers/map'
], function(_, __, Promise, pluginFactory, mapHelper) {
    'use strict';

    /**
     * The first time we try to load an item with this category, we trigger the section pause.
     */
    var sectionPauseCategory = 'x-tao-proctored-auto-pause';

    /**
     * The message is displayed just before the pause to explain why.
     */
    var pauseMessage = __('All students will begin the next section at the same time. Please relax quietly until the room supervisor starts the next section.');

    return pluginFactory({

        name: 'sectionPause',

        /**
         * Initializes the plugin (called during runner's init)
         */
        init: function init() {
            var previousSection;
            var testRunner = this.getTestRunner();

            testRunner.before('loaditem', function () {

                var context = testRunner.getTestContext();
                var map     = testRunner.getTestMap();
                var section = mapHelper.getSection(map, context.sectionId);
                var item    = mapHelper.getItem(map, context.itemIdentifier);

                return new Promise(function(resolve, reject){
                    if(context.options.sectionPause &&
                        previousSection && section && section.id !== previousSection.id &&
                        item && _.contains(item.categories, sectionPauseCategory) ) {

                        testRunner
                            .trigger('disableitem')
                            .trigger('pause', {
                                reasons : {
                                    category : __('condition'),
                                    subCategory : __('pausedSection')
                                },
                                message: pauseMessage
                            });
                        return reject();
                    }

                    previousSection = section;
                    return resolve();
                } );
            });
        }
    });
});
