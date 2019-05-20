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
 * Copyright (c) 2019  (original work) Open Assessment Technologies SA;
 *
 * @author Oleksandr Zagovorychev <zagovorichev@gmail.com>
 */

/**
 * Test Runner Tool Plugin : Prevent spellchecker in inputs
 */
define([
    'jquery',
    'lodash',
    'taoTests/runner/plugin',
], function ($, _, pluginFactory) {
    'use strict';

    /**
     * Default options
     * @type {Object}
     * @private
     */
    var _defaults = {
        selector: 'input, textarea',
    };

    /**
     * Creates the preventSpellchecker plugin
     */
    return pluginFactory({

        name: 'preventSpellchecker',

        /**
         * Initialize the plugin, called during the test runner's initialization
         */
        init: function init() {
            var config = _.defaults((this.getConfig() || {}), _defaults);
            var testRunner = this.getTestRunner();

            testRunner
                .after('renderitem', function () {
                    var $items = testRunner.getAreaBroker().getContentArea().find(config.selector);
                    $items.attr('spellcheck', 'false');
                    $items.attr('autocorrect', 'off');
                }).on('destroy', function() {
                    var $items = testRunner.getAreaBroker().getContentArea().find(config.selector);
                    $items.removeAttr('spellcheck');
                    $items.removeAttr('autocorrect');
                });
        },
    });
});
