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
 * Copyright (c) 2018 (original work) Open Assessment Technologies SA;
 *
 *
 */


namespace oat\taoTestRunnerPlugins\test\scripts\tools;

use oat\tao\test\TaoPhpUnitTestRunner;
use oat\taoTestRunnerPlugins\scripts\tools\PluginManager;
use oat\taoTests\models\runner\plugins\TestPluginService;
use oat\oatbox\service\ServiceManager;
use oat\taoTests\models\runner\features\TestRunnerFeatureService;
use common_report_Report as Report;
use oat\taoTests\models\runner\features\ManageableFeature;

/**
 * Class PluginManagerTest
 * @package oat\taoTestRunnerPlugins\test\scripts\migrations
 */
class PluginManagerTest extends TaoPhpUnitTestRunner
{
    public function testEnablePlugins()
    {
        $serviceLocator = $this->getServiceManager();
        $testPluginService = $serviceLocator->get(TestPluginService::SERVICE_ID);
        $activePlugins = array_filter($testPluginService->getAllPlugins(), function ($plugin) {
            return $plugin->isActive();
        });
        $this->assertEquals(2, count($activePlugins));

        $script = new PluginManager();
        $script->setServiceLocator($serviceLocator);
        $report = $script([
            '--enablePlugins',
            '--plugins', 'overlay,rubricBlock'
        ]);
        $activePlugins = array_filter($testPluginService->getAllPlugins(), function ($plugin) {
            return $plugin->isActive();
        });
        $this->assertEquals(3, count($activePlugins));
        $this->assertTrue($report instanceof Report && $report->getType() === Report::TYPE_SUCCESS);
    }

    public function testDisablePlugins()
    {
        $serviceLocator = $this->getServiceManager();
        $testPluginService = $serviceLocator->get(TestPluginService::SERVICE_ID);
        $inactivePlugins = array_filter($testPluginService->getAllPlugins(), function ($plugin) {
            return $plugin->isActive() === false;
        });
        $this->assertEquals(1, count($inactivePlugins));

        $script = new PluginManager();
        $script->setServiceLocator($serviceLocator);
        $report = $script([
            '--disablePlugins',
            '--plugins', 'overlay,rubricBlock'
        ]);
        $inactivePlugins = array_filter($testPluginService->getAllPlugins(), function ($plugin) {
            return $plugin->isActive() === false;
        });
        $this->assertEquals(2, count($inactivePlugins));
        $this->assertTrue($report instanceof Report && $report->getType() === Report::TYPE_SUCCESS);
    }

    public function testEnableFeature()
    {
        $serviceLocator = $this->getServiceManager();
        /** @var TestRunnerFeatureService $testRunnerFeatureService */
        $testRunnerFeatureService = $serviceLocator->get(TestRunnerFeatureService::SERVICE_ID);
        $this->assertEquals(1, count($testRunnerFeatureService->getAll()));
        $script = new PluginManager();
        $script->setServiceLocator($serviceLocator);
        $report = $script([
            '--enableFeature',
            '--feature', 'feature2'
        ]);
        $this->assertEquals(2, count($testRunnerFeatureService->getAll()));
        $this->assertTrue($report instanceof Report && $report->getType() === Report::TYPE_SUCCESS);
    }

    public function testDisableFeature()
    {
        $serviceLocator = $this->getServiceManager();
        /** @var TestRunnerFeatureService $testRunnerFeatureService */
        $testRunnerFeatureService = $serviceLocator->get(TestRunnerFeatureService::SERVICE_ID);
        $this->assertEquals(1, count($testRunnerFeatureService->getAll()));
        $script = new PluginManager();
        $script->setServiceLocator($serviceLocator);
        $report = $script([
            '--disableFeature',
            '--feature', 'feature1'
        ]);
        $this->assertEquals(0, count($testRunnerFeatureService->getAll()));
        $this->assertTrue($report instanceof Report && $report->getType() === Report::TYPE_SUCCESS);
    }

    public function testAddFeature()
    {
        $serviceLocator = $this->getServiceManager();
        /** @var TestRunnerFeatureService $testRunnerFeatureService */
        $testRunnerFeatureService = $serviceLocator->get(TestRunnerFeatureService::SERVICE_ID);
        $this->assertEquals(1, count($testRunnerFeatureService->getAll()));
        $script = new PluginManager();
        $script->setServiceLocator($serviceLocator);
        $report = $script([
            '--addFeature',
            '--featureOptions', json_encode([
                ManageableFeature::OPTION_ID => 'feature3',
                ManageableFeature::OPTION_DESCRIPTION => 'feature3_desc',
                ManageableFeature::OPTION_LABEL => 'feature3_label',
                ManageableFeature::OPTION_ACTIVE => true,
                ManageableFeature::OPTION_ENABLED_BY_DEFAULT => true,
                ManageableFeature::OPTION_PLUGIN_IDS => ['rubricBlock', 'overlay'],
            ])
        ]);
        $this->assertEquals(2, count($testRunnerFeatureService->getAll()));
        $this->assertEquals('feature3', $testRunnerFeatureService->getAll()['feature3']->getId());
        $this->assertTrue($report instanceof Report && $report->getType() === Report::TYPE_SUCCESS);
    }

    public function testRemoveFeature()
    {
        $serviceLocator = $this->getServiceManager();
        /** @var TestRunnerFeatureService $testRunnerFeatureService */
        $testRunnerFeatureService = $serviceLocator->get(TestRunnerFeatureService::SERVICE_ID);
        $this->assertEquals(1, count($testRunnerFeatureService->getAll()));
        $script = new PluginManager();
        $script->setServiceLocator($serviceLocator);
        $report = $script([
            '--removeFeature',
            '--feature', 'feature1'
        ]);
        $this->assertEquals(0, count($testRunnerFeatureService->getAll()));
        $this->assertTrue($report instanceof Report && $report->getType() === Report::TYPE_SUCCESS);
    }

    public function testAddPluginsToFeature()
    {
        $serviceLocator = $this->getServiceManager();
        /** @var TestRunnerFeatureService $testRunnerFeatureService */
        $testRunnerFeatureService = $serviceLocator->get(TestRunnerFeatureService::SERVICE_ID);
        $this->assertEquals(['rubricBlock'], $testRunnerFeatureService->getAll()['feature1']->getPluginsIds());
        $script = new PluginManager();
        $script->setServiceLocator($serviceLocator);
        $report = $script([
            '--addPluginsToFeature',
            '--feature', 'feature1',
            '--plugins', 'overlay, dialog'
        ]);
        $this->assertEquals(['rubricBlock', 'overlay', 'dialog'], ($testRunnerFeatureService->getAll()['feature1']->getPluginsIds()));
        $this->assertTrue($report instanceof Report && $report->getType() === Report::TYPE_SUCCESS);
    }

    public function testRemovePluginsFromFeature()
    {
        $serviceLocator = $this->getServiceManager();
        /** @var TestRunnerFeatureService $testRunnerFeatureService */
        $testRunnerFeatureService = $serviceLocator->get(TestRunnerFeatureService::SERVICE_ID);
        $this->assertEquals(['rubricBlock', 'overlay'], $testRunnerFeatureService->getAll(false)['feature2']->getPluginsIds());
        $script = new PluginManager();
        $script->setServiceLocator($serviceLocator);
        $report = $script([
            '--removePluginsFromFeature',
            '--feature', 'feature2',
            '--plugins', 'overlay'
        ]);
        $this->assertEquals(['rubricBlock'], ($testRunnerFeatureService->getAll(false)['feature2']->getPluginsIds()));
        $this->assertTrue($report instanceof Report && $report->getType() === Report::TYPE_SUCCESS);
    }

    private function getServiceManager()
    {
        $config = new \common_persistence_KeyValuePersistence([], new \common_persistence_InMemoryKvDriver());
        $config->set(TestPluginService::SERVICE_ID, new TestPluginService([]));
        $config->set('generis/log', new \oat\oatbox\log\LoggerService([]));
        $config->set(TestRunnerFeatureService::SERVICE_ID, new TestRunnerFeatureService([
            TestRunnerFeatureService::OPTION_AVAILABLE => [
                'feature1' => new ManageableFeature([
                    ManageableFeature::OPTION_ID => 'feature1',
                    ManageableFeature::OPTION_DESCRIPTION => 'feature1_desc',
                    ManageableFeature::OPTION_LABEL => 'feature1_label',
                    ManageableFeature::OPTION_ACTIVE => true,
                    ManageableFeature::OPTION_ENABLED_BY_DEFAULT => true,
                    ManageableFeature::OPTION_PLUGIN_IDS => ['rubricBlock'],
                ]),
                'feature2' => new ManageableFeature([
                    ManageableFeature::OPTION_ID => 'feature2',
                    ManageableFeature::OPTION_DESCRIPTION => 'feature2_desc',
                    ManageableFeature::OPTION_LABEL => 'feature2_label',
                    ManageableFeature::OPTION_ACTIVE => false,
                    ManageableFeature::OPTION_ENABLED_BY_DEFAULT => true,
                    ManageableFeature::OPTION_PLUGIN_IDS => ['rubricBlock', 'overlay'],
                ]),
            ],
        ]));
        $config->set('PluginManagerTest/test_runner_plugin_registry', new \oat\oatbox\config\ConfigurationService([
            'config' => [
                'taoQtiTest/runner/plugins/content/rubricBlock/rubricBlock' => [
                    'id' => 'rubricBlock',
                    'module' => 'taoQtiTest/runner/plugins/content/rubricBlock/rubricBlock',
                    'bundle' => 'taoQtiTest/loader/testPlugins.min',
                    'position' => null,
                    'name' => 'Rubric Block',
                    'description' => 'Display test rubric blocks',
                    'category' => 'content',
                    'active' => true,
                    'tags' => [
                        'core',
                        'qti'
                    ]
                ],
                'taoQtiTest/runner/plugins/content/overlay/overlay' => [
                    'id' => 'overlay',
                    'module' => 'taoQtiTest/runner/plugins/content/overlay/overlay',
                    'bundle' => 'taoQtiTest/loader/testPlugins.min',
                    'position' => null,
                    'name' => 'Overlay',
                    'description' => 'Add an overlay over items when disabled',
                    'category' => 'content',
                    'active' => false,
                    'tags' => [
                        'core',
                        'technical',
                        'required'
                    ]
                ],
                'taoQtiTest/runner/plugins/content/dialog/dialog' => array(
                    'id' => 'dialog',
                    'module' => 'taoQtiTest/runner/plugins/content/dialog/dialog',
                    'bundle' => 'taoQtiTest/loader/testPlugins.min',
                    'position' => null,
                    'name' => 'Dialog',
                    'description' => 'Display popups that require user interactions',
                    'category' => 'content',
                    'active' => true,
                    'tags' => array(
                        'core',
                        'technical',
                        'required'
                    )
                ),
            ],
        ]));
        $serviceManager = new ServiceManager($config);
        $extension = new \common_ext_Extension('PluginManagerTest');
        $extension->setServiceLocator($serviceManager);
        $pluginRegistry = new PluginRegistry();
        $pluginRegistry::$extension = $extension;

        $serviceManager->get(TestPluginService::SERVICE_ID)->setRegistry($pluginRegistry);
        return $serviceManager;
    }
}

class PluginRegistry extends \oat\taoTests\models\runner\plugins\PluginRegistry
{
    public static $extension;

    public function __construct()
    {
    }

    protected function getExtension()
    {
        return static::$extension;
    }
}
