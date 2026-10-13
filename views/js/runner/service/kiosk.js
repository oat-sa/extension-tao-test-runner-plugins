/**
 * Kiosk{ed} lockdown browser adapter (CG test runner).
 * Supports modern window.kiosked (2026 API) and legacy window.kiosk (Developers Guide §4).
 */
define([], function () {
    'use strict';

    var DEFAULT_MIN_VERSION = '0.0.0';
    var API_TIMEOUT_MS = 5000;
    var API_WAIT_MS = 2500;
    var API_POLL_MS = 50;

    function wait(ms) {
        return new Promise(function (resolve) {
            setTimeout(resolve, ms);
        });
    }

    function semverCompare(a, b) {
        var pa = String(a).split('.').map(function (n) {
            return parseInt(n, 10) || 0;
        });
        var pb = String(b).split('.').map(function (n) {
            return parseInt(n, 10) || 0;
        });
        var i;
        var len = Math.max(pa.length, pb.length);

        for (i = 0; i < len; i++) {
            var na = pa[i] || 0;
            var nb = pb[i] || 0;

            if (na > nb) {
                return 1;
            }
            if (na < nb) {
                return -1;
            }
        }

        return 0;
    }

    function readKioskedFromWindow(win) {
        if (!win) {
            return null;
        }

        try {
            if (win.kiosked) {
                return { kind: 'kiosked', api: win.kiosked };
            }
        } catch (err) {
            // cross-origin
        }

        return null;
    }

    function readLegacyKioskFromWindow(win) {
        if (!win) {
            return null;
        }

        try {
            if (win.kiosk && typeof win.kiosk.isLocked === 'function') {
                return { kind: 'kiosk', api: win.kiosk };
            }
        } catch (err) {
            // cross-origin
        }

        return null;
    }

    function resolveApiHandle() {
        var candidates = [window, window.parent, window.top];
        var i;
        var handle;

        for (i = 0; i < candidates.length; i++) {
            handle = readKioskedFromWindow(candidates[i]);

            if (handle) {
                return handle;
            }
        }

        for (i = 0; i < candidates.length; i++) {
            handle = readLegacyKioskFromWindow(candidates[i]);

            if (handle) {
                return handle;
            }
        }

        return null;
    }

    function isLockedSync(handle) {
        if (!handle) {
            return false;
        }

        if (handle.kind === 'kiosked' && typeof handle.api.isLocked === 'function') {
            return true;
        }

        return handle.kind === 'kiosk';
    }

    function isLockedAsync(handle) {
        if (!handle) {
            return Promise.resolve(false);
        }

        if (handle.kind === 'kiosked' && typeof handle.api.isLocked === 'function') {
            return Promise.race([handle.api.isLocked(), wait(API_TIMEOUT_MS)]).then(function (locked) {
                return !!locked;
            }).catch(function () {
                return true;
            });
        }

        if (handle.kind === 'kiosk' && typeof handle.api.isLocked === 'function') {
            return new Promise(function (resolve) {
                var settled = false;

                function finish(value) {
                    if (settled) {
                        return;
                    }

                    settled = true;
                    resolve(!!value);
                }

                try {
                    handle.api.isLocked(function (state) {
                        finish(state && state.isLocked);
                    });
                } catch (err) {
                    finish(true);
                }

                wait(API_TIMEOUT_MS).then(function () {
                    finish(true);
                });
            });
        }

        return Promise.resolve(true);
    }

    function getDeviceInfoAsync(handle) {
        if (!handle) {
            return Promise.reject(new Error('Kiosk API not available'));
        }

        if (handle.kind === 'kiosked' && typeof handle.api.getDeviceInfo === 'function') {
            return Promise.race([handle.api.getDeviceInfo(), wait(API_TIMEOUT_MS)]);
        }

        if (handle.kind === 'kiosk' && typeof handle.api.getDeviceInfo === 'function') {
            return new Promise(function (resolve, reject) {
                try {
                    handle.api.getDeviceInfo(function (info) {
                        resolve(info);
                    });
                } catch (err) {
                    reject(err);
                }
            });
        }

        return Promise.reject(new Error('Kiosk API not available'));
    }

    /**
     * @param {{ minVersion?: string }} [config]
     */
    function createKioskService(config) {
        var minVersion = (config && config.minVersion) || DEFAULT_MIN_VERSION;
        var breachListener;
        var breachHandler;
        var cachedHandle;

        function getHandle() {
            if (!cachedHandle) {
                cachedHandle = resolveApiHandle();
            }

            return cachedHandle;
        }

        return {
            isRunningInKiosk: function isRunningInKiosk() {
                return isLockedSync(getHandle());
            },

            whenAvailable: function whenAvailable() {
                var deadline = Date.now() + API_WAIT_MS;

                function poll() {
                    cachedHandle = null;
                    var handle = getHandle();

                    if (handle) {
                        return isLockedAsync(handle).then(function (locked) {
                            return locked || isLockedSync(handle);
                        });
                    }

                    if (Date.now() >= deadline) {
                        return Promise.resolve(false);
                    }

                    return wait(API_POLL_MS).then(poll);
                }

                return poll();
            },

            validateMinVersion: function validateMinVersion() {
                var handle = getHandle();

                return getDeviceInfoAsync(handle).then(function (deviceInfo) {
                    var version = deviceInfo && deviceInfo.app && deviceInfo.app.version;

                    if (!version || semverCompare(version, minVersion) < 0) {
                        return Promise.reject(new Error('Kiosk browser version not supported'));
                    }
                });
            },

            addBreachListener: function addBreachListener(callback) {
                var handle = getHandle();

                if (!handle) {
                    return;
                }

                if (handle.kind === 'kiosked' && typeof handle.api.addEventListener === 'function') {
                    breachHandler = function (e) {
                        if (e && typeof e.preventDefault === 'function') {
                            e.preventDefault();
                        }

                        Promise.race([
                            Promise.all([
                                typeof handle.api.getDeviceInfo === 'function' ? handle.api.getDeviceInfo() : null,
                                typeof handle.api.getProcessList === 'function' ? handle.api.getProcessList() : null
                            ]),
                            wait(API_TIMEOUT_MS)
                        ]).then(function (details) {
                            callback({
                                deviceInfo: details && details[0],
                                processList: details && details[1]
                            });
                        });
                    };

                    breachListener = breachHandler;
                    handle.api.addEventListener('breach', breachHandler);

                    return;
                }

                if (handle.kind === 'kiosk' && typeof handle.api.onBreach === 'function') {
                    breachHandler = function (detail) {
                        callback({ detail: detail || {} });
                    };

                    breachListener = breachHandler;
                    handle.api.onBreach(breachHandler);
                }
            },

            removeBreachListener: function removeBreachListener() {
                var handle = getHandle();

                if (handle && handle.kind === 'kiosked' && breachListener &&
                    typeof handle.api.removeEventListener === 'function') {
                    handle.api.removeEventListener('breach', breachListener);
                }

                breachListener = null;
                breachHandler = null;
            },

            exit: function exit() {
                var handle = getHandle();

                if (!handle) {
                    return;
                }

                if (handle.kind === 'kiosked' && typeof handle.api.exit === 'function') {
                    handle.api.exit();

                    return;
                }

                if (handle.kind === 'kiosk' && typeof handle.api.exit === 'function') {
                    handle.api.exit(false);
                }
            }
        };
    }

    return {
        createKioskService: createKioskService,
        resolveApiHandle: resolveApiHandle,
        isKioskEnvironment: function isKioskEnvironment() {
            return !!resolveApiHandle();
        }
    };
});
