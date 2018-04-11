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

use oat\oatbox\extension\AbstractAction;
use common_report_Report as Report;
use oat\generis\model\OntologyAwareTrait;
use oat\taoDeliveryRdf\model\DeliveryAssemblyService;
use oat\taoDeliveryRdf\model\DeliveryContainerService as RdfDeliveryContainerService;
use oat\taoTests\models\runner\features\SecurityFeature;

/**
 * Class DeliverySecurityFeature
 * @package oat\taoTestRunnerPlugins\scripts\migrations
 */
class DeliverySecurityFeature extends AbstractAction
{
    use OntologyAwareTrait;

    public function __invoke($params)
    {
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
                $delivery->editPropertyValues($featuresProp, implode(',', $activeTestRunnerFeaturesIds));
            }
        }

        return new Report(Report::TYPE_SUCCESS, __('%s deliveries were updated', $i));
    }
}
