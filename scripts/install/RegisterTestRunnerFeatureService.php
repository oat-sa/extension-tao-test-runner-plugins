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
 *
 */

namespace oat\taoTestRunnerPlugins\scripts\install;

use oat\oatbox\extension\InstallAction;
use oat\taoTests\models\runner\features\TestRunnerFeatureService;
use common_report_Report as Report;
use oat\taoTestRunnerPlugins\scripts\tools\PluginManager;
use oat\taoTests\models\runner\features\ManageableFeature;
use oat\taoTests\models\runner\plugins\PluginRegistry;

/**
 * Installation action that registers the TestPluginService
 *
 * @author Aleh Hutnikau, <hutnikau@1pt.com>
 */
class RegisterTestRunnerFeatureService extends InstallAction
{
    /**
     * @param $params
     * @throws \common_Exception
     * @return Report
     */
    public function __invoke($params)
    {
        $serviceManager = $this->getServiceManager();
        $testRunnerFeatureService = new TestRunnerFeatureService();
        $serviceManager->register(TestRunnerFeatureService::SERVICE_ID, $testRunnerFeatureService);
        $pluginRegistry = PluginRegistry::getRegistry();
        $securityPluginIds = array_reduce(
            $pluginRegistry->getMap(),
            function ($ids, $plugin) {
                if ($ids === null) {
                    $ids = [];
                }
                if ($plugin['category'] === 'security') {
                    $ids[] = $plugin['id'];
                }
                return $ids;
            }
        );
        $pluginManager = new PluginManager();
        $pluginManager->setServiceLocator($this->getServiceLocator());
        $pluginManager([
            '--addFeature',
            '--featureOptions', json_encode([
                ManageableFeature::OPTION_ID => 'security',
                ManageableFeature::OPTION_DESCRIPTION => 'Security plugins',
                ManageableFeature::OPTION_LABEL => 'Security plugins',
                ManageableFeature::OPTION_ACTIVE => true,
                ManageableFeature::OPTION_ENABLED_BY_DEFAULT => true,
                ManageableFeature::OPTION_PLUGIN_IDS => $securityPluginIds,
            ])
        ]);
        return new Report(Report::TYPE_SUCCESS, 'TestRunnerFeatureService registered');
    }
}
