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
define([
    "lodash"
], function (_) {
    'use strict';

    /**
     * Listeners already attached
     * @type {Object}
     */
    var listeners = {};

    var _isCoordInLiquidContainer = function (x, y) {
        return (x >= 130 && x <= 290 && y >= 100 && y <= 350);
    };

    var _getCoordinates = function (canvas, e) {
        var rect = canvas.getBoundingClientRect();
        var x = e.clientX - rect.left;
        var y = e.clientY - rect.top;
        return {x: x, y: y};
    };

    var _closestMultiple = function (numeric, multiple) {
        return multiple * Math.floor((numeric + multiple / 2) / multiple);
    };

    var _getResponse = function (canvas, e) {
        var coordinates = _getCoordinates(canvas, e);

        if (_isCoordInLiquidContainer(coordinates.x, coordinates.y)) {
            return Math.abs((_closestMultiple(coordinates.y, 25) - 350) / 25);
        }
    };

    var addLiquidsListener = function liquidsListener(interactionId, callback) {
        listeners[interactionId] = $("canvas.liquids").click(function (e) {
            var response = _getResponse($(this)[0], e);
            if (_.isNumber(response)) {
                callback();
            }
        });
    };

    var addUploadListener = function uploadListener(interactionId, callback) {
        listeners[interactionId] = $(`[data-serial="${interactionId}"] input[type='file']`).change(function () {
            callback();
        });
    };

    var addAudioRecordingListener = function liquidsListener(interactionId, callback) {
        listeners[interactionId] = $(`[data-serial="${interactionId}"] .audiorec-control`).change(function (e) {
            callback();
        });
    };

    var addLikertScaleListener = function likertScaleListener(interactionId, callback) {
        listeners[interactionId] = $(`[data-serial="${interactionId}"] ul.likert li input`).change(function () {
            callback();
        });
    };

    /**
     * Returns the listener helper
     */
    return {
        addNumpadWidget: function (callback) {
            if (!listeners.numpadWidget && _.isFunction(callback)) {
                var $widget = $(".test-runner-scope .widget-numpad");
                if ($widget.length) {
                    listeners.numpadWidget = $widget.click(function () {
                        callback();
                    });
                }
            }
        },
        addInteraction: function (interaction, callback) {
            if (listeners[interaction.serial] || !_.isFunction(callback)) {
                return;
            }

            if (interaction.qtiClass === "uploadInteraction") {
                addUploadListener(interaction.serial, callback);
            } else {
                if (interaction.qtiClass === "customInteraction") {
                    switch (interaction.typeIdentifier) {
                        case "likertScaleInteraction":
                            addLikertScaleListener(interaction.serial, callback);
                            break;
                        case "liquidsInteraction":
                            addLiquidsListener(interaction.serial, callback);
                            break;
                        case "audioRecordingInteraction":
                            addAudioRecordingListener(interaction.serial, callback);
                            break;
                    }
                }
            }
        }
    }
});

