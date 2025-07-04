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
 * Copyright (c) 2016-2021 (original work) Open Assessment Technologies SA ;
 */
/**
 * @author Jean-Sébastien Conan <jean-sebastien.conan@vesperiagroup.com>
 * @author dieter <dieter@taotesting.com>
 */
define([
    'lodash',
    'i18n',
    'jquery',
    'taoTests/runner/plugin',
    'taoQtiTest/runner/config/states',
    'css!taoTestRunnerPlugins/runner/plugins/security/css/fullscreen'
], function (_, __, $, pluginFactory, states) {
    'use strict';

    var doc = document;
    var docElem = doc.documentElement;

    /**
     * CSS class name to adjust the full screen mode
     * @type {String}
     */
    var fullScreenCls = 'fullscreen';

    /**
     * Regular expression targeting the CSS class name to adjust the full screen mode
     * @type {RegExp}
     */
    var fullScreenRe = new RegExp('\\b' + fullScreenCls + '\\b');

    /**
     * Time interval to watch full screen change, for older browsers
     * @type {Number}
     */
    var changeInterval = 2000; // every 2 seconds

    /**
     * Flag that represents the current state of the full screen mode
     * @type {Boolean}
     */
    var isFullScreen = false;

    /**
     * Handler of the change observer, for older browsers
     */
    var changeObserverHandler;

    /**
     * The keyboard shortcut to active the full screen mode.
     * @type {String}
     */
    var shortcut = navigator.platform.toLowerCase().indexOf('mac') === 0 ? 'Ctrl+⌘+F' : 'F11';

    /**
     * The message displayed to explain the test must be taken in full screen mode.
     * @type {String}
     */
    var message = __('This test needs to be taken in full screen mode (%s).', shortcut);

    /**
     * The error message displayed when the test is not launched in full screen mode, or cannot be.
     * @type {String}
     */
    var launchError = __('Test could not be launched. Test must always be launched in a full screen mode.');

    /**
     * Name of the property to check in order to detect whether the full screen mode is active
     * @type {String}
     */
    var fullScreenProperty =
        (doc.exitFullscreen && 'fullscreenElement') ||
        (doc.msExitFullscreen && 'msFullscreenElement') ||
        (doc.mozCancelFullScreen && 'mozFullScreen') ||
        (doc.webkitExitFullscreen && 'webkitIsFullScreen');

    /**
     * Name of the event triggered when the full screen state is changed
     * @type {String}
     */
    var fullScreenEventName =
        ('onfullscreenchange' in doc && 'fullscreenchange') ||
        ('onmsfullscreenchange' in doc && 'MSFullscreenChange') ||
        ('onmozfullscreenchange' in doc && 'mozfullscreenchange') ||
        ('onwebkitfullscreenchange' in doc && 'webkitfullscreenchange') ||
        'myfullscreenchange';

    /**
     * Checks the full screen mode support
     * @type {Boolean}
     */
    var fullScreenSupported = !!fullScreenProperty;

    /**
     * Check for iOS platform
     * @type {Boolean}
     */
    var iOS =
        (!!navigator.platform && /iPad|iPhone|iPod/.test(navigator.platform)) ||
        (navigator.userAgent.includes('Mac') && 'ontouchend' in document); // iPad on iOS 13 detection

    /**
     * Checks if the page has been embedded inside a frame
     * @returns {Boolean}
     */
    function isFrameEmbedded() {
        return !!(window.parent && window.parent !== window);
    }

    /**
     * Checks if the full screen mode is already active
     * @returns {Boolean}
     */
    function checkFullScreen() {
        if (fullScreenProperty in doc) {
            // doc[fullscreenProperty] is only non-null when the fullscreen API was used to go fullscreen,
            // but null if the user made the window fullscreen at the OS level (e.g. F11)
            const isGenericFullScreen = !!doc[fullScreenProperty];
            if (isGenericFullScreen) {
                return true;
            }
            return checkWindowSizeFullScreen();
        } else {
            // when the browser does not implement the full screen API, arbitrary checks if the full screen mode is active
            return (screen.availHeight || screen.height - 30) <= window.innerHeight;
        }
    }

    /**
     * Checks if the browser window has the dimensions of the full screen (or close enough)
     * @returns {Boolean}
     */
    function checkWindowSizeFullScreen() {
        // 16px accounts for some browsers (Chrome, Edge) which when fullscreened report a window.outerHeight or outerWidth not quite up to the screen edges
        let screenWidthMaxGap = 16 / window.devicePixelRatio;
        let screenHeightMaxGap = 16 / window.devicePixelRatio;

        const getIsWindowWidthFullScreen = () => screen.width - window.outerWidth <= screenWidthMaxGap;
        let getIsWindowHeightFullScreen = () => screen.height - window.outerHeight <= screenHeightMaxGap;

        // Case: hidden taskbar on Windows, Chromebook
        if (screen.height === screen.availHeight) {
            // Switch to innerHeight calculation, so a maximised browser window is not mistaken for a fullscreen window.
            // Note that the browser console can reduce innerHeight, but always by more than the max gap, so not a problem.
            getIsWindowHeightFullScreen = () => screen.height - window.innerHeight <= screenHeightMaxGap;
        }
        return getIsWindowWidthFullScreen() && getIsWindowHeightFullScreen();
    }

    /**
     * Actives the full screen mode
     */
    function requestFullScreen() {
        if (docElem.requestFullscreen) {
            // HTML5 compliant browsers
            docElem.requestFullscreen().catch(function (e) {
                console.warn(e && e.message);
            });
        } else if (docElem.msRequestFullscreen) {
            // Internet Explorer 11
            docElem.msRequestFullscreen();
        } else if (docElem.mozRequestFullScreen) {
            // old Mozilla Firefox
            docElem.mozRequestFullScreen();
        } else if (docElem.webkitRequestFullscreen) {
            // old Chrome/Safari
            docElem.webkitRequestFullscreen(Element.ALLOW_KEYBOARD_INPUT);
        }
    }

    /**
     * Exit fullscreen mode
     */
    function exitFullScreen() {
        if (doc.exitFullscreen && doc.fullscreenElement) {
            doc.exitFullscreen();
        } else if (doc.mozCancelFullScreen) {
            /* Firefox */
            doc.mozCancelFullScreen();
        } else if (doc.webkitExitFullscreen) {
            /* Chrome, Safari and Opera */
            doc.webkitExitFullscreen();
        } else if (doc.msExitFullscreen) {
            /* IE/Edge */
            doc.msExitFullscreen();
        }
    }

    /**
     * Notifies that we have entered in full screen mode
     * @param {runner} testRunner
     */
    function enterFullScreen(testRunner) {
        docElem.className = docElem.className.replace(fullScreenRe, '') + ' ' + fullScreenCls;
        testRunner.trigger('enterfullscreen');
    }

    /**
     * Notifies that we have left the full screen mode
     * @param {runner} testRunner
     */
    function leaveFullScreen(testRunner) {
        docElem.className = docElem.className.replace(fullScreenRe, '');
        testRunner.trigger('leavefullscreen');
    }

    /**
     * On older browsers wait for a full screen change to happen and fire the change event manually
     */
    function startFullScreenChangeObserver() {
        stopFullScreenChangeObserver();

        // observe the size and request the full screen mode by triggering an event
        changeObserverHandler = setInterval(function () {
            var event;
            var isFS = checkFullScreen();

            if (!isFS || isFS !== isFullScreen) {
                event = doc.createEvent('Event');
                event.initEvent(fullScreenEventName, true, true);
                doc.dispatchEvent(event);
            }

            isFullScreen = isFS;
        }, changeInterval);
    }

    /**
     * On older browser, stop the full screen change observer
     */
    function stopFullScreenChangeObserver() {
        clearInterval(changeObserverHandler);
    }

    /**
     * Creates the fullScreen plugin.
     * Forces the test runner to be only used in full screen mode.
     */
    return pluginFactory({
        name: 'fullScreen',

        /**
         * Initializes the plugin (called during runner's init)
         */
        init: function init() {
            const testRunner = this.getTestRunner();
            const dialogParams = {};
            const config = this.getConfig();
            let waitingForUser = false;
            let fileUploadActivated = false;

            const debouncedFocusListener = _.debounce(() => {
                handleFullScreenChange();
            }, 50);

            if (config && config.focus) {
                dialogParams.focus = config.focus;
            }

            // Check if plugin can be allowed
            function isAllowed() {
                // Since iOS platform restrict keyboard usage in full screen mode,
                // do not allow plugin on iOS devices
                return !iOS;
            }

            function enableItem() {
                if (testRunner.itemRunner) {
                    testRunner.trigger('enablenav enabletools');
                }
            }

            function disableItem() {
                testRunner.trigger('disablenav disabletools');
            }

            function handleFullScreenChange() {
                // delay handler execution to process fullscreen state before calculate checkFullScreen()
                _.delay(function () {
                    isFullScreen = checkFullScreen();
                    if (isFullScreen) {
                        enterFullScreen(testRunner);
                        // force close popup: fullscreen actions are handled in alertUser()
                        testRunner.trigger('closedialog.fullscreen');
                    } else {
                        leaveFullScreen(testRunner);
                        //omit leave fullscreen message when leaving fullscreen mode initiated by file upload dialog
                        if (!fileUploadActivated) {
                            alertUser();
                        }
                    }
                }, 100);
            }

            const throttledHandleResizeToFullScreenChange = _.throttle(handleFullScreenChange, 50);

            function startWebkitF11FullScreenChangeObserver() {
                window.addEventListener('resize', throttledHandleResizeToFullScreenChange);
            }

            function stopWebkitF11FullScreenChangeObserver() {
                window.removeEventListener('resize', throttledHandleResizeToFullScreenChange);
            }

            function addFocusListener() {
                window.addEventListener('focus', debouncedFocusListener);
            }

            function removeFocusListener() {
                window.removeEventListener('focus', debouncedFocusListener);
            }

            function alertUser() {
                if (!waitingForUser) {
                    if (fullScreenSupported) {
                        waitingForUser = true;
                        stopFullScreenChangeObserver();
                        disableItem();

                        testRunner.trigger(
                            'alert.fullscreen',
                            message,
                            function (reason) {
                                // prevent the alert dialog from being permanently closed by 'Escape' key
                                // support 2 reason variants for compatibility with external or internal event triggers
                                if (reason === 'escape' || reason === 'esc') {
                                    waitingForUser = false;
                                    return alertUser();
                                }

                                requestFullScreen();

                                _.defer(function () {
                                    waitingForUser = false;
                                    enableItem();

                                    if (!fullScreenSupported) {
                                        startFullScreenChangeObserver();
                                    }
                                });
                            },
                            dialogParams
                        );
                    }
                }
            }

            function doPause() {
                var context = testRunner.getTestContext();
                if (context.state <= states.testSession.interacting && !testRunner.getState('finish')) {
                    testRunner.trigger('pause', { reason: launchError });
                }
            }

            if (isAllowed()) {
                // when the runner has just started and the full screen prompt is still displayed, disable the item
                testRunner.after('renderitem.fullscreen', function () {
                    testRunner.off('renderitem.fullscreen');

                    _.defer(function () {
                        if (waitingForUser) {
                            disableItem();
                        }
                    });
                });

                testRunner.on('finish leave exit', function () {
                    doc.removeEventListener(fullScreenEventName, handleFullScreenChange);
                    stopWebkitF11FullScreenChangeObserver();
                    removeFocusListener();
                    leaveFullScreen(testRunner);
                    exitFullScreen();
                });

                // checks for frame embedding
                if (isFrameEmbedded()) {
                    // breaks the init process here as the test must be paused
                    return testRunner.on('init', function () {
                        waitingForUser = true;
                        disableItem();
                        testRunner.trigger('unsecured-launch').trigger('alert.fullscreen', launchError, doPause);
                    });
                }

                // listen either to the native or the change event created in the observer above
                doc.addEventListener(fullScreenEventName, handleFullScreenChange);
                startWebkitF11FullScreenChangeObserver();
                addFocusListener();

                // first check should be done after 'renderitem' event
                // because current focused element will be blured, to reinitialize keyboard navigation
                // in testRunner in function initTestRunnerNavigation of keyNavigation
                testRunner.after('renderitem.fullscreen', function () {
                    isFullScreen = checkFullScreen();

                    if (!isFullScreen) {
                        leaveFullScreen(testRunner);
                        alertUser();
                    } else if (!fullScreenSupported) {
                        startFullScreenChangeObserver();
                    }
                    testRunner.off('renderitem.fullscreen');
                });

                const exitFromFileSelection = () => {
                    fileUploadActivated = false;
                    window.removeEventListener('focus', exitFromFileSelection);
                };
                const handleFileUploadClick = () => {
                    fileUploadActivated = true;
                    window.addEventListener('focus', exitFromFileSelection);
                };
                testRunner.after('renderitem.fileupload', function () {
                    $("input[type='file']").on('click', handleFileUploadClick);
                });
                testRunner.before('unloaditem.fileupload', function () {
                    $("input[type='file']").off('click', handleFileUploadClick);
                });
            } else {
                this.disable();
            }
        }
    });
});
