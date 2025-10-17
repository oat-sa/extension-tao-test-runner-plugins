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
 * Copyright (c) 2025 (original work) Open Assessment Technologies SA ;
 */

define([
    'jquery',
    'lodash',
    'i18n',
    'taoTests/runner/plugin',
    'context',
    'taoQtiTest/runner/helpers/map',
    'core/digest',
    'css!taoTestRunnerPlugins/runner/plugins/security/css/watermark'
], function ($, _, __, pluginFactory, context, mapHelper, digest) {
    'use strict';

    const defaultConfig = {
        /**
         * "SHA-1" or "SHA-256" - hashing algorithm
         * Here we don't use this hash for security checks, so simplest algorithm is fine?
         *  @type {String}
         */
        hashAlgorithm: 'SHA-1',
        /**
         * 'background' | 'foreground' | 'circle'
         * @type {String}
         */
        type: 'background',
        /**
         * Override default watermark styles
         * @type {String}
         * @example `opacity: 0.1; font-size: 20px; letter-spacing: 5px`
         */
        style: '',
        /**
         * Long hash string will be visually split into the shorter text parts with N chars each.
         * (sha-1 is 40 chars, so 4 parts by 10 chars. sha-256 is 64 chars, so 6 parts by 10 chars and ignore lefotver 4)
         *  @type {Number}
         */
        textPartLength: 10,
        /**
         * Visually, these text parts will be separated by sequence of N spaces.
         * Recommended: `15` if 'foreground', `3` if 'background', `1` if 'circle.
         *  @type {Number}
         */
        separatorsLength: 3
    };

    const watermarkTypes = {
        foreground: 'foreground',
        background: 'background',
        circle: 'circle'
    };

    /**
     * Plugin shows watermark over the item content, to discourge test-takers from taking and sharing screenshots.
     * Plugin is activated by the item category "x-tao-option-watermark"
     */
    return pluginFactory({
        name: 'watermark',

        install: function install() {
            this.$watermark = null;

            /**
             * @returns {Boolean}
             */
            this.isPluginEnabled = () => {
                const testRunner = this.getTestRunner();
                return mapHelper.hasItemCategory(
                    testRunner.getTestMap(),
                    testRunner.getTestContext().itemIdentifier,
                    this.getName(),
                    true
                );
            };

            let textHash;
            /**
             * @returns {Promise<string>}
             */
            this.getHash = () => {
                if (textHash) {
                    return Promise.resolve(textHash);
                }
                const text = context.currentUser.login;
                const hashAlgorithm = this.pluginConfig.hashAlgorithm;

                return digest(text, hashAlgorithm).then(hash => {
                    textHash = hash;
                    return textHash;
                });
            };

            /**
             * @returns {Promise<string>}
             */
            this.getText = () =>
                this.getHash().then(userHash => {
                    const textPartLength = this.pluginConfig.textPartLength;
                    const separatorsLength = this.pluginConfig.separatorsLength;
                    let str = '';
                    for (let idx = 0; idx < userHash.length - textPartLength + 1; idx = idx + textPartLength) {
                        str += userHash.slice(idx, idx + textPartLength);
                        str += ' '.repeat(separatorsLength);
                    }
                    return str;
                });

            /**
             * Render a text long enough to cover the expected area
             * @param {jQuery} $watermarkContent
             */
            this.renderText = ($watermarkContent, text) => {
                for (let i = 0; i < 10; i++) {
                    const actualHeight = $watermarkContent.get(0).offsetHeight;
                    const expectedHeight = window.innerWidth + window.innerHeight; //enough to cover any degree of rotate
                    if (actualHeight < expectedHeight) {
                        const repeatedText = text.repeat(200);
                        $watermarkContent.get(0).textContent += repeatedText;
                    } else {
                        break;
                    }
                }
            };

            /**
             * Render text on a circular path
             * @param {jQuery} $watermarkContent
             */
            this.renderCircle = ($watermarkContent, text) => {
                $watermarkContent.html('');

                const repeatedText = text.repeat(100); //TODO: enough to cover

                const contentEl = $watermarkContent.get(0);
                const boxSize = Math.trunc(Math.min(contentEl.offsetWidth, contentEl.offsetHeight));
                const fontSizePropVal = getComputedStyle(contentEl).getPropertyValue('font-size');

                const s = Math.trunc(boxSize / 2); // half of box size
                const f = parseInt(fontSizePropVal) || 10; //font size
                const r = s - f; // radius
                const circlePath = `M ${s},${f} A ${r},${r} 0 1,1 ${s},${s + r} A ${r},${r} 0 1,1 ${s},${f}`;

                const $svg = $(
                    `<svg width="${boxSize}" height="${boxSize}" viewBox="0 0 ${boxSize} ${boxSize}" xmlns="http://www.w3.org/2000/svg">` +
                        `<!-- <defs> --><path id="circlePath" fill="none" stroke="none" d="${circlePath}" /><!-- </defs> -->` +
                        `<text><textPath href="#circlePath"></textPath></text>` +
                        '</svg>'
                );
                $svg.find('textPath').get(0).textContent = repeatedText;
                $watermarkContent.append($svg);
            };
        },

        init: function init() {
            this.pluginConfig = Object.assign({}, defaultConfig, this.getConfig());

            const testRunner = this.getTestRunner();

            testRunner.on(`loaditem.${this.getName()}`, () => {
                if (this.isPluginEnabled()) {
                    this.show();
                }
            });
            testRunner.on(`unloaditem.${this.getName()}`, () => {
                this.hide();
            });
        },

        show: function show() {
            const $appendTo = this.getAreaBroker().getContainer().find('.content-wrapper');

            this.$watermark = $(`<div class="tao-wmark ${this.pluginConfig.type}"><div></div></div>`);
            const $watermarkContent = this.$watermark.children().first();

            if (this.pluginConfig.style) {
                $watermarkContent.attr('style', this.pluginConfig.style);
            }

            this.getText().then(text => {
                this.throttledResizeCallback = _.throttle(
                    () =>
                        requestAnimationFrame(() => {
                            //position the element to cover the expected area
                            const containerBox = $appendTo.get(0).getBoundingClientRect();
                            this.$watermark.attr(
                                'style',
                                ['left', 'top', 'width', 'height']
                                    .map(prop => `${prop}: ${Math.round(containerBox[prop])}px`)
                                    .join(';')
                            );

                            if (this.pluginConfig.type === watermarkTypes.circle) {
                                this.renderCircle($watermarkContent, text);
                            } else {
                                this.renderText($watermarkContent, text);
                            }
                        }),
                    100
                );
                $appendTo.append(this.$watermark);
                this.resizeObserver = new ResizeObserver(this.throttledResizeCallback);
                this.resizeObserver.observe($appendTo.get(0));
            });
        },

        hide: function hide() {
            if (this.throttledResizeCallback) {
                this.throttledResizeCallback.cancel();
                this.throttledResizeCallback = null;
            }
            if (this.resizeObserver) {
                this.resizeObserver.disconnect();
                this.resizeObserver = null;
            }
            if (this.$watermark) {
                this.$watermark.remove();
                this.$watermark = null;
            }
        },

        destroy: function destroy() {
            this.hide();
            this.getTestRunner().off(this.getName());
        }
    });
});
