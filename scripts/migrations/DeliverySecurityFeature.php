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


namespace oat\taoTestRunnerPlugins\scripts\migrations;

use common_report_Report as Report;
use oat\generis\model\OntologyAwareTrait;
use oat\taoDeliveryRdf\model\DeliveryAssemblyService;
use oat\taoDeliveryRdf\model\DeliveryContainerService as RdfDeliveryContainerService;
use oat\taoTests\models\runner\features\SecurityFeature;
use oat\oatbox\extension\script\ScriptAction;

/**
 * Class DeliverySecurityFeature
 * @package oat\taoTestRunnerPlugins\scripts\migrations
 */
class DeliverySecurityFeature extends ScriptAction
{
    use OntologyAwareTrait;

    protected function provideDescription()
    {
        return __('Migrate to use delivery features to control security plugins');
    }

    protected function provideOptions()
    {
        return [
            'dryRun' => [
                'prefix' => 'd',
                'longPrefix' => 'dryRun',
                'defaultValue' => 0,
                'cast' => 'boolean',
                'required' => true,
                'description' => 'Run in dry run mode (0 or 1)'
            ],
        ];
    }

    public function run()
    {
        $dryRun = $this->getOption('dryRun');
        $class = $this->getClass(DeliveryAssemblyService::CLASS_URI);
        $secureProp = $this->getProperty('http://www.tao.lu/Ontologies/TAODelivery.rdf#DeliverySecurityPlugins');
        $featuresProp = $this->getProperty(RdfDeliveryContainerService::TEST_RUNNER_FEATURES_PROPERTY);
        $i = 0;
        foreach ($class->getInstances(true) as $delivery) {
            $secure = $delivery->getOnePropertyValue($secureProp);
            $val = null;
            if ($secure && $secure instanceof \core_kernel_classes_Resource) {
                $val = $secure->getUri();
            }
            if ($secure && $secure instanceof \core_kernel_classes_Literal) {
                $val = $secure->literal;
            }
            if ($val === 'http://www.tao.lu/Ontologies/TAODelivery.rdf#ComplyEnabled') {
                $i++;
                $activeTestRunnerFeaturesIds = explode(',', $delivery->getOnePropertyValue($featuresProp));
                $activeTestRunnerFeaturesIds[] = SecurityFeature::FEATURE_ID;
                if (!$dryRun) {
                    $delivery->editPropertyValues($featuresProp, implode(',', $activeTestRunnerFeaturesIds));
                }
            }
        }

        if ($dryRun) {
            return new Report(Report::TYPE_SUCCESS, __('%s deliveries will be updated', $i));
        } else {
            return new Report(Report::TYPE_SUCCESS, __('%s deliveries were updated', $i));
        }
    }
}
