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
 * Copyright (c) 2018  (original work) Open Assessment Technologies SA;
 *
 * @author Alexander Zagovorichev <zagovorichev@1pt.com>
 */

/**
 * Test Runner Tool Plugin : Prevent drop images to inputs
 */
define([
    'lodash',
    'taoTests/runner/plugin',
    'util/namespace'
], function (_, pluginFactory, namespaceHelper) {
    'use strict';

    /**
     * Default options
     * @type {Object}
     * @private
     */
    var _defaults = {
        selector: 'input.qti-textEntryInteraction, .qti-extendedTextInteraction textarea'
    };

    /**
     * Lower case only
     * @type {string[]}
     */
    var restrictedTags = [
        'img'
    ];

    /**
     * Creates the preventDragDrop plugin
     */
    return pluginFactory({

        name: 'preventDropToInput',

        /**
         * Initialize the plugin, called during the test runner's initialization
         */
        init: function init() {
            var self = this;
            var testRunner = self.getTestRunner();

            this.getTestRunner()
                .after('renderitem', function () {
                    var config = _.defaults((self.getConfig() || {}), _defaults);
                    var $items = testRunner.getAreaBroker().getContentArea().find(config.selector);
                    var dropped, disabled;

                    $('img')
                        .off('.preventdropimg')
                        .on(namespaceHelper.namespaceAll('dragstart', 'preventdropimg'), function (event) {
                            dropped = event.target;
                        })
                        .on(namespaceHelper.namespaceAll('dragend', 'preventdropimg'), function (event) {
                            dropped = null;
                            if (_.isObject(disabled)) {
                                disabled.prop('disabled', false);
                            }
                        });

                    $items
                        .off('.preventdropimg')
                        // Drop event doesn't work in case that ExtendedTextInteraction is included
                        // so for the prevent dropping - just make element as disabled, the restore its state
                        .on(namespaceHelper.namespaceAll('dragover', 'preventdropimg'), function (event) {
                            // if img then I don't want to do drop
                            if (_.isObject(dropped) && _.contains(restrictedTags, dropped.tagName.toLowerCase())) {
                                disabled = $(event.target);
                                if (disabled.length) {
                                    disabled.prop('disabled', true);
                                }
                            }
                        });
                }).on('destroy', function() {
                    var config = _.defaults((self.getConfig() || {}), _defaults);
                    var $items = testRunner.getAreaBroker().getContentArea().find(config.selector);
                    $items.off('.preventdropimg');
                });
        }
    });
});
