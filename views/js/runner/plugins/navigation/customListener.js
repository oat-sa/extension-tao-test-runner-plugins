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
 * Helper that add custom listeners to the interactions.
 *
 * @author Ricardo Proença <ricardo@taotesting.com>
 */
define([], function () {
    'use strict';

    /**
     * Listeners already attached
     * @type {Object}
     */
    var listeners = {};

    var uploadListener = function uploadListener(interactionId, callback) {
        return $(`[data-serial="${interactionId}"] input[type='file']`).change(function () {
            callback();
        });
    };

    /**
     * Returns the listener helper
     */
    return {
        addNumpadWidget: function (callback) {
            if (!listeners.numpadWidget) {
                var $widget = $(".test-runner-scope .widget-numpad");
                if ($widget.length) {
                    listeners.numpadWidget = $widget.click(function () {
                        callback();
                    });
                }
            }
        },
        addInteraction: function (interaction, callback) {
            if (interaction.qtiClass === "uploadInteraction" && !listeners[interaction.serial]) {
                listeners[interaction.serial] = uploadListener(interaction.serial, callback);
            }
        }
    }
});
