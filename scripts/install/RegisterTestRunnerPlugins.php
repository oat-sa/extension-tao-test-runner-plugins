<?php

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
 * Copyright (c) 2016 (original work) Open Assessment Technologies SA;
 *
 */

namespace oat\taoTestRunnerPlugins\scripts\install;

use oat\oatbox\extension\InstallAction;
use common_report_Report as Report;
use oat\taoTests\models\runner\plugins\PluginRegistry;
use oat\taoTests\models\runner\plugins\TestPlugin;

/**
 * Install action that registers the test runner plugins
 *
 * @author Bertrand Chevrier <bertrand@taotesting.com>
 */
class RegisterTestRunnerPlugins extends InstallAction
{
    public static $plugins = [
        'probes' => [
            [
                'id' => 'latencyEvents',
                'name' => 'Latency Events',
                'module' => 'taoTestRunnerPlugins/runner/plugins/probes/latencyEvents',
                'bundle' => 'taoTestRunnerPlugins/loader/testPlugins.min',
                'description' => 'Register metrics',
                'category' => 'probes',
                'active' => true,
                'tags' => [ 'technical' ]
            ]
        ],
        'security' => [
            [
                'id' => 'sectionPause',
                'name' => 'Section Pause',
                'module' => 'taoTestRunnerPlugins/runner/plugins/security/sectionPause',
                'bundle' => 'taoTestRunnerPlugins/loader/testPlugins.min',
                'description' => 'Pause delivery execution when the section changed',
                'category' => 'tools',
                'active' => false,
                'tags' => [ ]
            ],
            [
                'id' => 'autoPause',
                'name' => 'Auto Pause',
                'module' => 'taoTestRunnerPlugins/runner/plugins/security/autoPause',
                'bundle' => 'taoTestRunnerPlugins/loader/testPlugins.min',
                'description' => 'Persist the pause state',
                'category' => 'security',
                'active' => false,
                'tags' => [ ]
            ],
            [
                'id' => 'blurPause',
                'name' => 'Blur Pause',
                'module' => 'taoTestRunnerPlugins/runner/plugins/security/blurPause',
                'bundle' => 'taoTestRunnerPlugins/loader/testPlugins.min',
                'description' => 'Pause the test when leaving the test window',
                'category' => 'security',
                'active' => true,
                'tags' => [ ]
            ],
            [
                'id' => 'preventScreenshot',
                'name' => 'Prevent Screenshot',
                'module' => 'taoTestRunnerPlugins/runner/plugins/security/preventScreenshot',
                'bundle' => 'taoTestRunnerPlugins/loader/testPlugins.min',
                'description' => 'Prevent screenshot from Cmd+Shift (mac) and PrtScn (win) shortcuts',
                'category' => 'security',
                'active' => true,
                'tags' => [ ]
            ],
            [
                'id' => 'disableCommands',
                'name' => 'Disable Commands',
                'module' => 'taoTestRunnerPlugins/runner/plugins/security/disableCommands',
                'bundle' => 'taoTestRunnerPlugins/loader/testPlugins.min',
                'description' => 'Disable and report some forbidden shortcuts',
                'category' => 'security',
                'active' => true,
                'tags' => [  ]
            ], [
                'id' => 'preventCopy',
                'name' => 'Prevent Copy',
                'module' => 'taoTestRunnerPlugins/runner/plugins/security/preventCopy',
                'bundle' => 'taoTestRunnerPlugins/loader/testPlugins.min',
                'description' => 'Prevent copying from CTRL-C/X/V shortcuts',
                'category' => 'security',
                'active' => true,
                'tags' => [  ]
            ], [
                'id' => 'fullscreen',
                'name' => 'Full Screen',
                'module' => 'taoTestRunnerPlugins/runner/plugins/security/fullScreen',
                'bundle' => 'taoTestRunnerPlugins/loader/testPlugins.min',
                'description' => 'Force the test in full screen mode',
                'category' => 'security',
                'active' => true,
                'tags' => [ ]
            ], [
                'id' => 'collapser',
                'name' => 'Collapser',
                'module' => 'taoQtiTest/runner/plugins/content/responsiveness/collapser',
                'bundle' => 'taoQtiTest/loader/testPlugins.min',
                'description' => 'Reduce the size of the tools when the available space is not enough',
                'category' => 'content',
                'active' => true,
                'tags' => [ ]
            ]
        ]
    ];

    /**
     * Run the install action
     */
    public function __invoke($params)
    {

        $registry = PluginRegistry::getRegistry();
        $count = 0;

        foreach(self::$plugins as $categoryPlugins) {
            foreach($categoryPlugins as $pluginData){
                if( $registry->register(TestPlugin::fromArray($pluginData)) ) {
                    $count++;
                }
            }
        }

        return new Report(Report::TYPE_SUCCESS, $count .  ' plugins registered.');
    }
}
