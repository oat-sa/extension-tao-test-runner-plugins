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


namespace oat\taoTestRunnerPlugins\scripts\tools;

use common_report_Report as Report;
use oat\generis\model\OntologyAwareTrait;
use oat\taoTests\models\runner\features\TestRunnerFeatureService;
use oat\oatbox\extension\script\ScriptAction;
use oat\taoTests\models\runner\plugins\TestPluginService;
use oat\taoTests\models\runner\plugins\TestPlugin;
use oat\taoTests\models\runner\features\ManageableFeature;
use common_exception_InconsistentData as InconsistentData;

/**
 * Class PluginManager
 * @package oat\taoTestRunnerPlugins\scripts\migrations
 */
class PluginManager extends ScriptAction
{
    use OntologyAwareTrait;

    /**
     * @return string
     */
    protected function provideDescription()
    {
        return __('');
    }

    protected function provideOptions()
    {
        return [
            'enablePlugins' => [
                'longPrefix' => 'enablePlugins',
                'required' => false,
                'description' => 'Expects --plugins option',
                'flag' => true,
            ],
            'disablePlugins' => [
                'longPrefix' => 'disablePlugins',
                'required' => false,
                'description' => 'Expects --plugins option',
                'flag' => true,
            ],
            'enableFeature' => [
                'longPrefix' => 'enableFeature',
                'required' => false,
                'description' => 'Expects --feature option',
                'flag' => true,
            ],
            'disableFeature' => [
                'longPrefix' => 'disableFeature',
                'required' => false,
                'description' => 'Expects --feature option',
                'flag' => true,
            ],
            'addFeature' => [
                'longPrefix' => 'addFeature',
                'required' => false,
                'description' => 'Expects --feature option with feature id',
                'flag' => true,
            ],
            'removeFeature' => [
                'longPrefix' => 'removeFeature',
                'required' => false,
                'description' => 'Expects --feature option with feature id',
                'flag' => true,
            ],
            'addPluginsToFeature' => [
                'longPrefix' => 'addPluginsToFeature',
                'required' => false,
                'description' => 'Expects --feature and --plugins options',
                'flag' => true,
            ],
            'removePluginsFromFeature' => [
                'longPrefix' => 'removePluginsFromFeature',
                'required' => false,
                'description' => 'Expects --feature and --plugins options',
                'flag' => true,
            ],
            'feature' => [
                'prefix' => 'f',
                'longPrefix' => 'feature',
                'required' => false,
                'description' => 'Feature identifier',
            ],
            'plugins' => [
                'prefix' => 'p',
                'longPrefix' => 'plugins',
                'required' => false,
                'description' => 'Comma separated plugin identifiers',
            ],
            'featureOptions' => [
                'prefix' => 'fo',
                'longPrefix' => 'featureOptions',
                'required' => false,
                'description' => 'Json encoded feature options',
            ],
        ];
    }

    public function run()
    {
        if ($this->hasOption('enablePlugins')) {
            $report = $this->enablePlugins();
        } else if ($this->hasOption('disablePlugins')) {
            $report = $this->disablePlugins();
        } else if ($this->hasOption('enableFeature')) {
            $report = $this->enableFeature();
        } else if ($this->hasOption('disableFeature')) {
            $report = $this->disableFeature();
        } else if ($this->hasOption('addFeature')) {
            $report = $this->addFeature();
        } else if ($this->hasOption('removeFeature')) {
            $report = $this->removeFeature();
        } else if ($this->hasOption('addPluginsToFeature')) {
            $report = $this->addPluginsToFeature();
        } else if ($this->hasOption('removePluginsFromFeature')) {
            $report = $this->removePluginsFromFeature();
        } else {
            throw new InconsistentData('No action specified.');
        }

        if ($report->getType() === Report::TYPE_SUCCESS) {
            $report->add(new Report(
                Report::TYPE_WARNING,
                'Features and plugins configuration stored in the config.' . PHP_EOL .
                '  Do not forget to sync configs in case of multi server configuration.'
            ));
        }

        return $report;
    }

    protected function provideUsage()
    {
        return [
            'prefix' => 'h',
            'longPrefix' => 'help',
            'description' => 'Prints a help statement'
        ];
    }

    /**
     * Enable plugins. --plugins option expected
     * @return Report
     * @throws \common_exception_InconsistentData
     */
    private function enablePlugins()
    {
        $service = $this->getServiceLocator()->get(TestPluginService::class);
        $plugins = $this->getPluginsFromOption();
        foreach ($plugins as $plugin) {
            $plugin->setActive(true);
        }
        $service->registerPlugins($plugins);
        return Report::createSuccess('The following plugins activated: ' . $this->getOption('plugins'));
    }

    /**
     * Enable plugins. --plugins option expected
     * @return Report
     * @throws \common_exception_InconsistentData
     */
    private function disablePlugins()
    {
        $service = $this->getServiceLocator()->get(TestPluginService::class);
        $plugins = $this->getPluginsFromOption();
        foreach ($plugins as $plugin) {
            $plugin->setActive(false);
        }
        $service->registerPlugins($plugins);
        return Report::createSuccess('The following plugins deactivated: ' . $this->getOption('plugins'));
    }

    /**
     * Add new feature (\oat\taoTests\models\runner\features\ManageableFeature)
     * Run example:
     * ```
     * sudo php index.php '\oat\taoTestRunnerPlugins\scripts\tools\PluginManager' --addFeature --featureOptions '{"identifier":"feature id","active":true,"description":"feature desc","enabledByDefault":true,"pluginIds":["foo","bar"],"label":"label"}'
     * ```
     * @return Report
     * @throws \common_exception_InconsistentData
     */
    private function addFeature()
    {
        if (!$this->hasOption('featureOptions')) {
            throw new InconsistentData('--featureOptions option is required');
        }
        $options = json_decode($this->getOption('featureOptions'), true);
        $pluginService = $this->getServiceLocator()->get(TestPluginService::class);
        foreach ($options[ManageableFeature::OPTION_PLUGIN_IDS] as $pluginId) {
            if (!$pluginService->getPlugin(trim($pluginId))) {
                throw new InconsistentData('plugin `' . $pluginId . '` is not registered');
            }
        }
        $feature = new ManageableFeature($options);
        $feature->setServiceLocator($this->getServiceLocator());
        $testRunnerFeatureService = $this->getServiceLocator()->get(TestRunnerFeatureService::class);
        $testRunnerFeatureService->register($feature);
        $this->getServiceLocator()->register(TestRunnerFeatureService::SERVICE_ID, $testRunnerFeatureService);

        return Report::createSuccess('Feature `' . $feature->getId() . '` successfully added');
    }

    /**
     * Remove feature by id. --feature option expected (feature identifier)
     *
     * @return Report
     * @throws \common_exception_InconsistentData
     */
    private function removeFeature()
    {
        $feature = $this->getFeatureFromOption();
        $testRunnerFeatureService = $this->getServiceLocator()->get(TestRunnerFeatureService::class);
        $testRunnerFeatureService->unregister($feature->getId());
        $this->getServiceLocator()->register(TestRunnerFeatureService::SERVICE_ID, $testRunnerFeatureService);

        return Report::createSuccess('Feature `' . $feature->getId() . '` successfully removed');
    }

    private function addPluginsToFeature()
    {
        $testRunnerFeatureService = $this->getServiceLocator()->get(TestRunnerFeatureService::class);
        $feature = $this->getFeatureFromOption();
        $plugins = $this->getPluginsFromOption();

        if (!$feature instanceof ManageableFeature) {
            throw new InconsistentData('feature `' . $feature->getId() . '` is not instance of ManageableFeature');
        }
        $featureOptions = [
            ManageableFeature::OPTION_ID => $feature->getId(),
            ManageableFeature::OPTION_DESCRIPTION => $feature->getDescription(),
            ManageableFeature::OPTION_LABEL => $feature->getLabel(),
            ManageableFeature::OPTION_ACTIVE => $feature->isActive(),
            ManageableFeature::OPTION_ENABLED_BY_DEFAULT => $feature->isEnabledByDefault(),
        ];

        $pluginIds = $feature->getPluginsIds();
        $addedPluginIds = [];
        foreach ($plugins as $plugin) {
            $addedPluginIds[] = $plugin->getId();
            $pluginIds[] = $plugin->getId();
        }
        array_unique($pluginIds);
        $featureOptions[ManageableFeature::OPTION_PLUGIN_IDS] = $pluginIds;
        $testRunnerFeatureService->unregister($feature->getId());
        $feature = new ManageableFeature($featureOptions);
        $feature->setServiceLocator($this->getServiceLocator());
        $testRunnerFeatureService->register($feature);
        $this->getServiceLocator()->register(TestRunnerFeatureService::SERVICE_ID, $testRunnerFeatureService);

        return Report::createSuccess('Plugins `' . implode(',', $addedPluginIds) . '` successfully registered');
    }

    private function removePluginsFromFeature()
    {
        $testRunnerFeatureService = $this->getServiceLocator()->get(TestRunnerFeatureService::class);
        $feature = $this->getFeatureFromOption();
        $plugins = $this->getPluginsFromOption();

        if (!$feature instanceof ManageableFeature) {
            throw new InconsistentData('feature `' . $feature->getId() . '` is not instance of ManageableFeature');
        }
        $featureOptions = [
            ManageableFeature::OPTION_ID => $feature->getId(),
            ManageableFeature::OPTION_DESCRIPTION => $feature->getDescription(),
            ManageableFeature::OPTION_LABEL => $feature->getLabel(),
            ManageableFeature::OPTION_ACTIVE => $feature->isActive(),
            ManageableFeature::OPTION_ENABLED_BY_DEFAULT => $feature->isEnabledByDefault(),
        ];

        $pluginIds = $feature->getPluginsIds();
        foreach ($plugins as $plugin) {
            if (in_array($plugin->getId(), $pluginIds)) {
                $index = array_search($plugin->getId(), $pluginIds);
                unset($pluginIds[$index]);
                $removedPluginIds[] = $plugin->getId();
            }
        }

        $featureOptions[ManageableFeature::OPTION_PLUGIN_IDS] = $pluginIds;
        $testRunnerFeatureService->unregister($feature->getId());
        $feature = new ManageableFeature($featureOptions);
        $feature->setServiceLocator($this->getServiceLocator());
        $testRunnerFeatureService->register($feature);
        $this->getServiceLocator()->register(TestRunnerFeatureService::SERVICE_ID, $testRunnerFeatureService);

        return Report::createSuccess('Plugins `' . implode(',', $removedPluginIds) . '` successfully registered');
    }

    private function enableFeature()
    {
        $testRunnerFeatureService = $this->getServiceLocator()->get(TestRunnerFeatureService::class);
        $feature = $this->getFeatureFromOption();
        $feature->setActive(true);
        $testRunnerFeatureService->unregister($feature->getId());
        $testRunnerFeatureService->register($feature);
        return Report::createSuccess('Feature `' . $feature->getId() . '` successfully enabled');
    }

    private function disableFeature()
    {
        $testRunnerFeatureService = $this->getServiceLocator()->get(TestRunnerFeatureService::class);
        $feature = $this->getFeatureFromOption();
        $feature->setActive(false);
        $testRunnerFeatureService->unregister($feature->getId());
        $testRunnerFeatureService->register($feature);
        return Report::createSuccess('Feature `' . $feature->getId() . '` successfully disabled');
    }

    /**
     * @return TestPlugin[]
     * @throws \common_exception_InconsistentData
     */
    private function getPluginsFromOption()
    {
        if (!$this->getOption('plugins')) {
            throw new \common_exception_InconsistentData('--plugins option is required');
        }
        $pluginIds = explode(',', $this->getOption('plugins'));
        $plugins = [];
        $service = $this->getServiceLocator()->get(TestPluginService::class);
        foreach ($pluginIds as $pluginId) {
            $plugin = $service->getPlugin(trim($pluginId));
            if (!$plugin) {
                throw new \common_exception_InconsistentData('plugin `' . $pluginId . '` is not registered');
            }
            $plugins[] = $plugin;
        }
        return $plugins;
    }

    /**
     * @return \oat\taoTests\models\runner\features\TestRunnerFeature
     * @throws \common_exception_InconsistentData
     */
    private function getFeatureFromOption()
    {
        if (!$this->hasOption('feature')) {
            throw new \common_exception_InconsistentData('--feature option is required');
        }
        $testRunnerFeatureService = $this->getServiceLocator()->get(TestRunnerFeatureService::class);
        $feature = $this->getOption('feature');
        if (!isset($testRunnerFeatureService->getAll(false)[$feature])) {
            throw new \common_exception_InconsistentData('feature `' . $feature . '` is not registered');
        }
        return $testRunnerFeatureService->getAll(false)[$feature];
    }
}
