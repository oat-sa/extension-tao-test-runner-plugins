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
 */

namespace oat\taoTestRunnerPlugins\scripts\update;

use common_ext_ExtensionUpdater;
use oat\tao\scripts\update\OntologyUpdater;
use oat\taoTestRunnerPlugins\model\delivery\DeliveryContainerService;
use oat\taoTests\models\runner\plugins\PluginRegistry;
use oat\taoTests\models\runner\plugins\TestPlugin;

/**
 * Class Updater
 * @package oat\taoEventLog\scripts\update
 */
class Updater extends common_ext_ExtensionUpdater
{
    /**
     * @param $initialVersion
     * @return string $versionUpdatedTo
     */
    public function update($initialVersion)
    {
        $this->skip('0.1.0', '1.0.0');

        if($this->isVersion('1.0.0')){
            $registry = PluginRegistry::getRegistry();
            foreach($registry->getMap() as $module => $plugin){
                if(preg_match("/^taoTestRunnerPlugins/", $module) && is_null($plugin['bundle'])){
                    $plugin['bundle'] = 'taoTestRunnerPlugins/loader/testPlugins.min';
                    $registry->register(TestPlugin::fromArray($plugin));
                }
            }
            $this->setVersion('1.1.0');
        }

        $this->skip('1.1.0', '1.4.2');

        if ($this->isVersion('1.4.2')) {

            OntologyUpdater::syncModels();

            $serviceManager = $this->getServiceManager();

            $deliveryContainerService = new DeliveryContainerService();
            $deliveryContainerService->setServiceManager($serviceManager);

            $serviceManager->register(DeliveryContainerService::SERVICE_ID, $deliveryContainerService);

            $plugins = [
                'probes' => [
                    [
                        'id' => 'latencyEvents',
                        'name' => 'Latency Events',
                        'module' => 'taoTestRunnerPlugins/runner/plugins/probes/latencyEvents',
                        'bundle' => 'taoTestRunnerPlugins/loader/testPlugins.min',
                        'description' => 'Register metrics',
                        'category' => 'probes',
                        'active' => true,
                        'tags' => [  ]
                    ]
                ],
                'security' => [
                    [
                        'id' => 'blurPause',
                        'name' => 'Blur Pause',
                        'module' => 'taoTestRunnerPlugins/runner/plugins/security/blurPause',
                        'bundle' => 'taoTestRunnerPlugins/loader/testPlugins.min',
                        'description' => 'Pause the test when leaving the test window',
                        'category' => 'security',
                        'active' => true,
                        'tags' => []
                    ],
                    [
                        'id' => 'preventScreenshot',
                        'name' => 'Prevent Screenshot',
                        'module' => 'taoTestRunnerPlugins/runner/plugins/security/preventScreenshot',
                        'bundle' => 'taoTestRunnerPlugins/loader/testPlugins.min',
                        'description' => 'Prevent screenshot from Cmd+Shift (mac) and PrtScn (win) shortcuts',
                        'category' => 'security',
                        'active' => true,
                        'tags' => [  ]
                    ],
                    [
                        'id' => 'disableCommands',
                        'name' => 'Disable Commands',
                        'module' => 'taoTestRunnerPlugins/runner/plugins/security/disableCommands',
                        'bundle' => 'taoTestRunnerPlugins/loader/testPlugins.min',
                        'description' => 'Disable and report some forbidden shortcuts',
                        'category' => 'security',
                        'active' => true,
                        'tags' => []
                    ], [
                        'id' => 'preventCopy',
                        'name' => 'Prevent Copy',
                        'module' => 'taoTestRunnerPlugins/runner/plugins/security/preventCopy',
                        'bundle' => 'taoTestRunnerPlugins/loader/testPlugins.min',
                        'description' => 'Prevent copying from CTRL-C/X/V shortcuts',
                        'category' => 'security',
                        'active' => true,
                        'tags' => []
                    ], [
                        'id' => 'fullscreen',
                        'name' => 'Full Screen',
                        'module' => 'taoTestRunnerPlugins/runner/plugins/security/fullScreen',
                        'bundle' => 'taoTestRunnerPlugins/loader/testPlugins.min',
                        'description' => 'Force the test in full screen mode',
                        'category' => 'security',
                        'active' => true,
                        'tags' => [  ]
                    ]
                ]
            ];

            $registry = PluginRegistry::getRegistry();

            foreach($plugins as $categoryPlugins) {
                foreach($categoryPlugins as $pluginData){
                    $registry->register(TestPlugin::fromArray($pluginData));
                }
            }

            $this->setVersion('1.5.0');
        }
        $this->skip('1.5.0', '1.7.0');

        if($this->isVersion('1.7.0')){
            $registry = PluginRegistry::getRegistry();

            $registry->register(TestPlugin::fromArray([
                'id' => 'answerCache',
                'name' => 'Answers cache',
                'module' => 'taoTestRunnerPlugins/runner/plugins/content/answerCache',
                'bundle' => 'taoTestRunnerPlugins/loader/testPlugins.min',
                'description' => 'Cache the answers to restore them after refresh',
                'category' => 'content',
                'active' => false,
                'tags' => []
            ]));

            $this->setVersion('1.8.0');
        }

        $this->skip('1.8.0', '1.8.2');
    }
}
