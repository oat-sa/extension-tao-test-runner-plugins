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
use oat\generis\model\OntologyAwareTrait;
use oat\tao\model\ClientLibConfigRegistry;
use oat\tao\scripts\update\OntologyUpdater;
use oat\taoTestRunnerPlugins\model\delivery\DeliveryContainerService;
use oat\taoTests\models\runner\plugins\PluginRegistry;
use oat\taoTests\models\runner\plugins\TestPlugin;
use oat\taoTests\models\runner\features\SecurityFeature;
use oat\taoTests\models\runner\features\TestRunnerFeatureService;
use common_report_Report as Report;

/**
 * Class Updater
 * @package oat\taoEventLog\scripts\update
 */
class Updater extends common_ext_ExtensionUpdater
{
    use OntologyAwareTrait;

    /**
     * @param $initialVersion
     * @return string|void
     * @throws \common_Exception
     * @throws \common_exception_InconsistentData
     */
    public function update($initialVersion)
    {
        $this->skip('0.1.0', '1.0.0');

        if ($this->isVersion('1.0.0')) {
            $registry = PluginRegistry::getRegistry();
            foreach ($registry->getMap() as $module => $plugin) {
                if (preg_match("/^taoTestRunnerPlugins/", $module) && is_null($plugin['bundle'])) {
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
                        'tags' => []
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
                        'tags' => []
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
                        'tags' => []
                    ]
                ]
            ];

            $registry = PluginRegistry::getRegistry();

            foreach ($plugins as $categoryPlugins) {
                foreach ($categoryPlugins as $pluginData) {
                    $registry->register(TestPlugin::fromArray($pluginData));
                }
            }

            $this->setVersion('1.5.0');
        }
        $this->skip('1.5.0', '1.7.0');

        if ($this->isVersion('1.7.0')) {
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

        $this->skip('1.8.0', '1.11.1');

        if ($this->isVersion('1.11.1')) {
//            $class = $this->getClass(DeliveryAssemblyService::CLASS_URI);
//            $secureProp = $this->getProperty('http://www.tao.lu/Ontologies/TAODelivery.rdf#DeliverySecurityPlugins');
//            $featuresProp = $this->getProperty(RdfDeliveryContainerService::TEST_RUNNER_FEATURES_PROPERTY);
//            foreach ($class->getInstances(true) as $delivery) {
//                $secure = $delivery->getOnePropertyValue($secureProp);
//                $val = null;
//                if ($secure && $secure instanceof \core_kernel_classes_Resource) {
//                    $val = $secure->getUri();
//                }
//                if ($secure && $secure instanceof \core_kernel_classes_Literal) {
//                    $val = $secure->literal;
//                }
//                if ($val === 'http://www.tao.lu/Ontologies/TAODelivery.rdf#ComplyEnabled') {
//                    $activeTestRunnerFeaturesIds = explode(',', $delivery->getOnePropertyValue($featuresProp));
//                    $activeTestRunnerFeaturesIds[] = SecurityFeature::FEATURE_ID;
//                    $delivery->editPropertyValues($featuresProp, implode(',', $activeTestRunnerFeaturesIds));
//                }
//            }
            OntologyUpdater::syncModels();
            $this->setVersion('1.12.0');
        }
        $this->skip('1.12.0', '1.12.1');

        if ($this->isVersion('1.12.1')) {
            $featureService = $this->getServiceManager()->get(TestRunnerFeatureService::class);
            $registeredFeatures = $featureService->getOption(TestRunnerFeatureService::OPTION_AVAILABLE);
            $testRunnerFeature = new SecurityFeature();
            // if other extension has already installed this feature
            if (!array_key_exists($testRunnerFeature->getId(), $registeredFeatures)) {
                $featureService->register($testRunnerFeature);
                $this->getServiceManager()->register(TestRunnerFeatureService::SERVICE_ID, $featureService);
                $this->addReport(new Report(Report::TYPE_WARNING,
                    'Run ' . \oat\taoTestRunnerPlugins\scripts\migrations\DeliverySecurityFeature::class . ' script'));
            }
            $this->setVersion('1.13.0');
        }

        if ($this->isVersion('1.13.0')) {
            ClientLibConfigRegistry::getRegistry()->register(
                'taoTestRunnerPlugins/runner/plugins/security/preventCopy', ['debounceDelay' => 250]
            );
            ClientLibConfigRegistry::getRegistry()->register(
                'taoTestRunnerPlugins/runner/plugins/security/disableCommands', ['debounceDelay' => 250]
            );
            $this->setVersion('1.14.0');
        }

        if ($this->isVersion('1.14.0')) {
            ClientLibConfigRegistry::getRegistry()->register(
                'taoTestRunnerPlugins/runner/plugins/security/preventCopy', ['debounceDelay' => 750]
            );
            ClientLibConfigRegistry::getRegistry()->register(
                'taoTestRunnerPlugins/runner/plugins/security/disableCommands', ['debounceDelay' => 750]
            );
            $this->setVersion('1.15.0');
        }

        $this->skip('1.15.0', '2.2.0');

        if ($this->isVersion('2.2.0')) {
            $registry = PluginRegistry::getRegistry();

            $registry->register(TestPlugin::fromArray([
                'id' => 'limitBackButton',
                'name' => 'Limit Back Button',
                'module' => 'taoTestRunnerPlugins/runner/plugins/navigation/limitBackButton',
                'bundle' => 'taoTestRunnerPlugins/loader/testPlugins.min',
                'description' => 'Limit back button to items with responses',
                'category' => 'navigation',
                'active' => false,
                'tags' => []
            ]));

            $this->setVersion('2.3.0');
        }

        $this->skip('2.3.0', '2.5.0');

        if ($this->isVersion('2.5.0')) {
            $registry = PluginRegistry::getRegistry();

            $registry->register(TestPlugin::fromArray([
                'id' => 'defaultHeading',
                'name' => 'Default Heading',
                'module' => 'taoTestRunnerPlugins/runner/plugins/accessibility/defaultHeading',
                'bundle' => 'taoTestRunnerPlugins/loader/testPlugins.min',
                'description' => 'Added h1 tag with default text in case if there is no h1 tags in test item. The tag will be visible only for screenreader devices',
                'category' => 'accessibility',
                'active' => false,
                'tags' => [ ]
            ]));

            $this->setVersion('2.6.0');
        }

        $this->skip('2.6.0', '2.10.0.5');
    }
}
