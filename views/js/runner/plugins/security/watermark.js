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
    'taoTests/runner/plugin',
    'context',
    'taoQtiTest/runner/helpers/map',
    'core/digest',
    'ui/dialog',
    'tpl!taoTestRunnerPlugins/runner/plugins/security/templates/watermarkCirclePath',
    'css!taoTestRunnerPlugins/runner/plugins/security/css/watermark'
], function ($, _, pluginFactory, context, mapHelper, digest, dialog, watermarkCirclePathTpl) {
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
         * Override default watermark content styles
         * @type {String}
         * @example `opacity: 0.1; font-size: 20px; letter-spacing: 5px`
         */
        style: '',
        /**
         * Override default watermark container styles
         * @type {String}
         * @example `padding: 50px`
         */
        containerStyle: '',
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
        separatorsLength: 3,

        /**
         * Enable/disable watermark in the runtime.
         * Click on free space in the item -> type `triggerWord` to open dialog ->
         *   in the dialog type keyword which matches configured `hash` & `algorithm`.
         */
        unlock: {
            enabled: false,
            triggerWord: 'WMK',
            algorithm: 'SHA-512',
            hash: ''
        },

        /**
         * Profiles to use if any of the settings above (except `unlock`)
         *   should depend on the specific test/item
         * @example
         * a) add category `x-tao-option-watermark-abc` for one test, and `x-tao-option-watermark-def` for another test
         * b) set `{
         *    configsByCategory : {
         *      abc: {type: 'circle', style: 'color:blue'},
         *      def: {type: 'foreground', style: 'color:red'}
         *   }`
         * c) first test will show blue circle, second test will show red foreground
         */
        configsByCategory: {}
    };

    const watermarkTypes = {
        foreground: 'foreground',
        background: 'background',
        circle: 'circle'
    };

    /**
     * Plugin shows watermark over the item content, to discourage test-takers from taking and sharing screenshots.
     * Plugin is activated by the item category "x-tao-option-watermark",
     *   or by the item category defined in config: `x-tao-option-watermark-abc` for `{configsByCategory: {abc: ...}}`
     */
    return pluginFactory({
        name: 'watermark',

        install: function install() {
            this.pluginConfig = {};
            this.$watermark = null;
            this.abortController = null;
            let isEnabled = true;

            /**
             * Checks if plugin is enabled, and also sets effective config
             * (config depends on item category)
             * @returns {Boolean}
             */
            this.isPluginEnabled = () => {
                const testRunner = this.getTestRunner();
                const testMap = testRunner.getTestMap();
                const itemIdentifier = testRunner.getTestContext().itemIdentifier;
                let isEnabledByCategory = false;

                if (this.getConfig() && this.getConfig().configsByCategory) {
                    for (const categorySuffix of Object.keys(this.getConfig().configsByCategory)) {
                        const category = `${this.getName()}-${categorySuffix}`;
                        if (mapHelper.hasItemCategory(testMap, itemIdentifier, category, true)) {
                            this.pluginConfig = Object.assign(
                                {},
                                defaultConfig,
                                this.getConfig(),
                                _.omit(this.getConfig().configsByCategory[categorySuffix], ['unlock'])
                            );
                            isEnabledByCategory = true;
                            break;
                        }
                    }
                }
                if (!isEnabledByCategory) {
                    const category = this.getName();
                    if (mapHelper.hasItemCategory(testMap, itemIdentifier, category, true)) {
                        this.pluginConfig = Object.assign({}, defaultConfig, this.getConfig());
                        isEnabledByCategory = true;
                    }
                }
                return isEnabledByCategory && isEnabled;
            };

            let textHash;
            let textHashAlgorithm;
            /**
             * @returns {Promise<string>}
             */
            this.getTextHash = () => {
                const text = context.currentUser.login;
                const algorithm = this.pluginConfig.hashAlgorithm;

                if (textHash && textHashAlgorithm === algorithm) {
                    return Promise.resolve(textHash);
                }

                return digest(text, algorithm).then(hash => {
                    textHash = hash;
                    textHashAlgorithm = algorithm;
                    return textHash;
                });
            };

            /**
             * @returns {Promise<string>}
             */
            this.getText = () =>
                this.getTextHash().then(userHash => {
                    const textPartLength = Math.min(this.pluginConfig.textPartLength, userHash.length);
                    const separatorsLength = this.pluginConfig.separatorsLength;
                    let str = '';
                    for (let idx = 0; idx < userHash.length - textPartLength + 1; idx = idx + textPartLength) {
                        str += userHash.slice(idx, idx + textPartLength);
                        str += ' '.repeat(separatorsLength);
                    }
                    if (!separatorsLength) {
                        str += ' ';
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

                const contentEl = $watermarkContent.get(0);
                const boxSize = Math.trunc(Math.min(contentEl.offsetWidth, contentEl.offsetHeight));
                const fontSizePropVal = getComputedStyle(contentEl).getPropertyValue('font-size');

                const halfOfBoxSize = Math.trunc(boxSize / 2);
                const fontSize = parseInt(fontSizePropVal) || 10;
                const radius = halfOfBoxSize - fontSize;

                const repeatedText = text.repeat(Math.trunc((3.15 * 2 * radius) / text.length / (fontSize / 4)));

                $watermarkContent.html(
                    watermarkCirclePathTpl({
                        boxSize,
                        repeatedText,
                        s: halfOfBoxSize,
                        f: fontSize,
                        r: radius,
                        sr: halfOfBoxSize + radius
                    })
                );
            };

            /**
             * @param {string} val
             * @returns {Promise<string>}
             */
            let validateUnlock = val =>
                digest(val, this.pluginConfig.unlock.algorithm).then(hash => hash === this.pluginConfig.unlock.hash);

            let doUnlock = () => {
                isEnabled = !isEnabled;
                if (this.isPluginEnabled()) {
                    this.show();
                } else {
                    this.hide();
                }
            };

            this.showUnlockDialog = () => {
                const appendToEl = this.getAreaBroker().getContainer().find('.content-wrapper').get(0);
                const dialogTpl = '<input type="password" autocomplete="off" class="tao-wmark-input" />';
                const dlg = dialog({
                    autoRender: true,
                    autoDestroy: true,
                    content: dialogTpl,
                    width: 300,
                    buttons: [],
                    renderTo: appendToEl
                });

                this.isShowingUnlockDialog = true;
                dlg.on('closed.modal', () => {
                    this.isShowingUnlockDialog = false;
                });

                const submit = val =>
                    validateUnlock(val).then(valid => {
                        if (valid) {
                            doUnlock();
                        }
                    });
                const $input = dlg.getDom().find('.tao-wmark-input');
                $input
                    .on('keydown', e => {
                        e.stopPropagation(); // stop shortcut detector
                        if (e.key === 'Enter') {
                            $input.off('change');
                            submit(e.target.value);
                            dlg.hide();
                        } else if (e.key === 'Escape') {
                            dlg.hide();
                        }
                    })
                    .on('change', e => {
                        submit(e.target.value);
                        dlg.hide();
                    })
                    .focus();
            };

            this.addUnlockListener = () => {
                //NB! Conflict with shortcuts. 'r' toggles review panel. But with shift - 'R' - doesn't.
                const triggerWord = this.pluginConfig.unlock.triggerWord;
                const maxTimeBetweenKeys = 3 * 1000;
                const freeSpaceTragets = [
                    document.body,
                    this.getAreaBroker().getContainer().find('.content-wrapper').get(0)
                ];

                let typedWord = '';
                let prevTimestamp = Date.now();
                const handleKeyup = e => {
                    if (!this.isShowingUnlockDialog && freeSpaceTragets.includes(e.target)) {
                        const isLetterKey = !e.ctrlKey && !e.altKey && !e.metaKey && e.key.length === 1; //skip 'Shift' if it was pressed
                        if (isLetterKey) {
                            const timestamp = Date.now();
                            if (timestamp - prevTimestamp > maxTimeBetweenKeys) {
                                typedWord = '';
                            }
                            prevTimestamp = timestamp;
                            typedWord = typedWord + e.key;
                            if (typedWord.length > triggerWord.length) {
                                typedWord = typedWord.substring(1);
                            }
                            if (typedWord === triggerWord) {
                                typedWord = '';
                                this.showUnlockDialog();
                            }
                        }
                    }
                };
                this.abortController = new AbortController();
                freeSpaceTragets[0].addEventListener('keyup', handleKeyup, { signal: this.abortController.signal });
            };

            this.removeUnlockListener = () => {
                if (this.abortController) {
                    this.abortController.abort();
                }
            };
        },

        init: function init() {
            const testRunner = this.getTestRunner();
            this.pluginConfig = Object.assign({}, defaultConfig, this.getConfig());

            testRunner.on(`loaditem.${this.getName()}`, () => {
                if (this.isPluginEnabled()) {
                    this.show();
                }
            });
            testRunner.on(`unloaditem.${this.getName()}`, () => {
                this.hide();
            });

            if (
                this.pluginConfig.unlock &&
                this.pluginConfig.unlock.enabled &&
                this.pluginConfig.unlock.triggerWord &&
                this.pluginConfig.unlock.hash
            ) {
                this.addUnlockListener();
            }
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
                            let style = ['left', 'top', 'width', 'height']
                                .map(prop => `${prop}: ${Math.round(containerBox[prop])}px`)
                                .join(';');
                            if (this.pluginConfig.containerStyle) {
                                style += `;${this.pluginConfig.containerStyle}`;
                            }
                            this.$watermark.attr('style', style);

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
            this.removeUnlockListener();
            this.getTestRunner().off(this.getName());
            this.hide();
        }
    });
});
