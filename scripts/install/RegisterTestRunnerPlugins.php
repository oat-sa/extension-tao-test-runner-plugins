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
    protected $plugins = [
        'content' => [
            [
                'id' => 'answerCache',
                'name' => 'Answers cache',
                'module' => 'taoTestRunnerPlugins/runner/plugins/content/answerCache',
                'bundle' => 'taoTestRunnerPlugins/loader/testPlugins.min',
                'description' => 'Cache the answers to restore them after refresh',
                'category' => 'content',
                'active' => false,
                'tags' => []
            ]
        ],
        'controls' => [
            [
                'id' => 'sessionHeartbeat',
                'name' => 'Session Heartbeat',
                'module' => 'taoTestRunnerPlugins/runner/plugins/controls/sessionHeartbeat',
                'bundle' => 'taoTestRunnerPlugins/loader/testPlugins.min',
                'description' => 'Send a regular signal to keep the session alive',
                'category' => 'controls',
                'active' => false,
                'tags' => []
            ]
        ],
        'navigation' => [
            [
                'id' => 'limitBackButton',
                'name' => 'Limit Back Button',
                'module' => 'taoTestRunnerPlugins/runner/plugins/navigation/limitBackButton',
                'bundle' => 'taoTestRunnerPlugins/loader/testPlugins.min',
                'description' => 'Limit back button to items with responses',
                'category' => 'navigation',
                'active' => false,
                'tags' => []
            ]
        ],
        'probes' => [
            [
                'id' => 'latencyEvents',
                'name' => 'Latency Events',
                'module' => 'taoTestRunnerPlugins/runner/plugins/probes/latencyEvents',
                'bundle' => 'taoTestRunnerPlugins/loader/testPlugins.min',
                'description' => 'Register metrics',
                'category' => 'probes',
                'active' => false,
                'tags' => ['technical']
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
                'tags' => []
            ],
            [
                'id' => 'autoPause',
                'name' => 'Auto Pause',
                'module' => 'taoTestRunnerPlugins/runner/plugins/security/autoPause',
                'bundle' => 'taoTestRunnerPlugins/loader/testPlugins.min',
                'description' => 'Persist the pause state',
                'category' => 'security',
                'active' => false,
                'tags' => []
            ],
            [
                'id' => 'blurPause',
                'name' => 'Blur Pause',
                'module' => 'taoTestRunnerPlugins/runner/plugins/security/blurPause',
                'bundle' => 'taoTestRunnerPlugins/loader/testPlugins.min',
                'description' => 'Pause the test when leaving the test window',
                'category' => 'security',
                'active' => false,
                'tags' => []
            ],
            [
                'id' => 'preventScreenshot',
                'name' => 'Prevent Screenshot',
                'module' => 'taoTestRunnerPlugins/runner/plugins/security/preventScreenshot',
                'bundle' => 'taoTestRunnerPlugins/loader/testPlugins.min',
                'description' => 'Prevent screenshot from Cmd+Shift (mac) and PrtScn (win) shortcuts',
                'category' => 'security',
                'active' => false,
                'tags' => []
            ],
            [
                'id' => 'disableCommands',
                'name' => 'Disable Commands',
                'module' => 'taoTestRunnerPlugins/runner/plugins/security/disableCommands',
                'bundle' => 'taoTestRunnerPlugins/loader/testPlugins.min',
                'description' => 'Disable and report some forbidden shortcuts',
                'category' => 'security',
                'active' => false,
                'tags' => []
            ],
            [
                'id' => 'preventCopy',
                'name' => 'Prevent Copy',
                'module' => 'taoTestRunnerPlugins/runner/plugins/security/preventCopy',
                'bundle' => 'taoTestRunnerPlugins/loader/testPlugins.min',
                'description' => 'Prevent copying from CTRL-C/X/V shortcuts',
                'category' => 'security',
                'active' => false,
                'tags' => []
            ],
            [
                'id' => 'fullscreen',
                'name' => 'Full Screen',
                'module' => 'taoTestRunnerPlugins/runner/plugins/security/fullScreen',
                'bundle' => 'taoTestRunnerPlugins/loader/testPlugins.min',
                'description' => 'Force the test in full screen mode',
                'category' => 'security',
                'active' => false,
                'tags' => []
            ]
        ],
        'accessibility' => [
            [
                'id' => 'defaultHeading',
                'name' => 'Default Heading',
                'module' => 'taoTestRunnerPlugins/runner/plugins/accessibility/defaultHeading',
                'bundle' => 'taoTestRunnerPlugins/loader/testPlugins.min',
                // phpcs:ignore
                'description' => 'Added h1 tag with default text in case if there is no h1 tags in test item. The tag will be visible only for screenreader devices',
                'category' => 'accessibility',
                'active' => false,
                'tags' => []
            ]
        ],
        'watermark' => [
            [
                'id' => 'watermark',
                'name' => 'Watermark',
                'module' => 'taoTestRunnerPlugins/runner/plugins/security/watermark',
                'bundle' => 'taoTestRunnerPlugins/loader/testPlugins.min',
                'description' => 'Show watermark over the item content',
                'category' => 'tools',
                'active' => false,
                'tags' => []
            ]
        ]
    ];

    protected $configs = [
        'answerCache' => [
            'config' => [
                'allAttempts' => false
            ]
        ],
        'sessionHeartbeat' => [
            'config' => [
                'interval' => '900',
                'action' => 'up'
            ]
        ]
    ];

    /**
     * @return Report
     * @throws \common_exception_InconsistentData
     */
    protected function registerPlugins()
    {
        $registry = PluginRegistry::getRegistry();
        $count = 0;

        foreach ($this->plugins as $categoryPlugins) {
            foreach ($categoryPlugins as $pluginData) {
                if ($registry->register(TestPlugin::fromArray($pluginData))) {
                    $count++;
                }
            }
        }

        return new Report(Report::TYPE_SUCCESS, $count . ' plugins registered.');
    }

    /**
     * @return Report
     */
    protected function configurePlugins()
    {
        $extManager = $this->getServiceLocator()->get(\common_ext_ExtensionsManager::SERVICE_ID);
        $extension = $extManager->getExtensionById('taoQtiTest');
        $config = $extension->getConfig('testRunner');
        $count = 0;

        foreach ($this->configs as $pluginName => $pluginConfig) {
            $configured = false;

            if (isset($pluginConfig['id'])) {
                $pluginName = $pluginConfig['id'];
            }

            if (isset($pluginConfig['shortcuts']) && count($pluginConfig['shortcuts'])) {
                $config['shortcuts'][$pluginName] = $pluginConfig['shortcuts'];
                $configured = true;
            }

            if (isset($pluginConfig['config']) && count($pluginConfig['config'])) {
                $config['plugins'][$pluginName] = $pluginConfig['config'];
                $configured = true;
            }

            if ($configured) {
                $count++;
            }
        }

        $extension->setConfig('testRunner', $config);

        return new Report(Report::TYPE_SUCCESS, $count . ' plugins configured.');
    }

    /**
     * Run the install action
     * @param $params
     * @return Report
     * @throws \common_exception_Error
     * @throws \common_exception_InconsistentData
     */
    public function __invoke($params)
    {
        $registered = $this->registerPlugins();
        $configured = $this->configurePlugins();

        $overall = new Report(Report::TYPE_SUCCESS, 'Plugins registration done!');
        $overall->add($registered);
        $overall->add($configured);
        if ($overall->containsError()) {
            $overall->setType(Report::TYPE_ERROR);
        }

        return $overall;
    }
}
