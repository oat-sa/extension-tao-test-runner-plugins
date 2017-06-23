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
    'taoTests/runner/plugin',
    'taoQtiTest/runner/helpers/map'
], function(_, __, pluginFactory, mapHelper) {
    'use strict';

    var pauseMessage = __('Awaiting for the proctor authorization.');

    return pluginFactory({

        name: 'sectionPause',

        /**
         * Initializes the plugin (called during runner's init)
         */
        init: function init() {
            var testRunner = this.getTestRunner();
            var prevSection = null;

            testRunner.before('renderitem', function () {

                var context = testRunner.getTestContext();
                var map     = testRunner.getTestMap();
                var section = mapHelper.getSection(map, context.sectionId);

                if (prevSection && section && prevSection.id !== section.id && context.sectionPause) {
                    testRunner.getAreaBroker().getContainer().hide();
                    testRunner
                        .trigger('beforesectionpause')
                        .trigger('pause', {
                            reasons : {
                                category : __('condition'),
                                subCategory : __('pausedSection')
                            },
                            message: pauseMessage
                        });
                }
                prevSection = section;
            });
        }
    });
});
