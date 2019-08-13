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
 * @author Ricardo Proença <ricardo@taotesting.com>
 */

define([
    'taoTests/runner/runner',
    'taoTestRunnerPlugins/runner/plugins/navigation/limitBackButton'
], function(runnerFactory, pluginFactory) {
    'use strict';

    var pluginApi;
    var providerName = 'mock';
    runnerFactory.registerProvider(providerName, {
        name: providerName,
        loadAreaBroker(){ },
        loadProxy(){ },
        init(){ }
    });

    /**
     * The following tests applies to all plugins
     */
    QUnit.module('pluginFactory');

    QUnit.test('module', function(assert) {
        var runner = runnerFactory(providerName);

        assert.equal(typeof pluginFactory, 'function', 'The pluginFactory module exposes a function');
        assert.equal(typeof pluginFactory(runner), 'object', 'The plugin factory produces an instance');
        assert.notStrictEqual(pluginFactory(runner), pluginFactory(runner), 'The plugin factory provides a different instance on each call');
    });

    pluginApi = [
        {
            name: 'init',
            title: 'init'
        },
        {
            name: 'destroy',
            title: 'destroy'
        }
    ];

    QUnit
        .cases.init(pluginApi)
        .test('plugin API ', function(data, assert) {
            var runner = runnerFactory(providerName);
            var plugin = pluginFactory(runner);
            assert.equal(typeof plugin[data.name], 'function', 'The pluginFactory instances expose a "' + data.name + '" function');
        });
});
