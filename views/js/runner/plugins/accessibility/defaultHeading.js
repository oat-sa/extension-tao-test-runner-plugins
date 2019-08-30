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
 * @author Anton Tsymuk <anton@taotesting.com>
 */
define([
    'jquery',
    'i18n',
    'taoTests/runner/plugin'
], function ($, __, pluginFactory) {
    'use strict';

    var defaultHeadingText = __('Assessment Item');
    // Styles for heading to make it visible only for screenreader devices
    var headingCss = {
        border: 0,
        clip: 'rect(0 0 0 0)',
        height: '1px',
        margin: '-1px',
        overflow: 'hidden',
        padding: '0',
        position: 'absolute',
        width: '1px',
    };

    /**
     * Creates the defaultHeading plugin.
     * Add h1 tag with default text in case if there is no h1 tags in test item
     * The tag will be visible only for screenreader devices
     */
    return pluginFactory({

        name: 'defaultHeading',

        /**
         * Initializes the plugin (called during runner's init)
         */
        init: function init() {
            const testRunner = this.getTestRunner();
            const config = this.getConfig();
            const headingText = config.heading || defaultHeadingText;
            let headingTag;

            // Add if necessary default h1 tag after every item render
            testRunner
                .on('renderitem', function () {
                    var headingTagsCount = $('.content-wrap h1').length;

                    if (headingTagsCount) {
                        if (headingTag) {
                            headingTag.remove();
                            headingTag = undefined;
                        }

                        return;
                    } else if (headingTag) {
                        return;
                    }

                    headingTag = $('<h1>' + headingText + '</h1>')
                        .css(headingCss)
                        .attr('id', 'defaultHeading');

                    $('body').prepend(headingTag);
                });
        },

        destroy: function () {
            $('#defaultHeading').remove();
        }
    });
});
