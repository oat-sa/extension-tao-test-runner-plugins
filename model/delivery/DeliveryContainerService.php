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
 * Copyright (c) 2017 (original work) Open Assessment Technologies SA;
 */

namespace oat\taoTestRunnerPlugins\model\delivery;

use core_kernel_classes_Resource;
use oat\generis\model\OntologyAwareTrait;
use oat\tao\model\plugins\PluginModule;
use oat\taoDeliveryRdf\model\DeliveryContainerService as DeliveryRdfContainerService;
use oat\taoDelivery\model\execution\DeliveryExecution;

/**
 * Override the DeliveryContainerService in order to filter the plugin list based on the security flag.
 *
 * @author Aleksej Tikhanovich <aleksej@taotesting.com>
 */
class DeliveryContainerService extends DeliveryRdfContainerService
{
    use OntologyAwareTrait;

    const DELIVERY_SECURITY_PLUGINS_PROPERTY = 'http://www.tao.lu/Ontologies/TAODelivery.rdf#DeliverySecurityPlugins';
    const CHECK_MODE_ENABLED = 'http://www.tao.lu/Ontologies/TAODelivery.rdf#ComplyEnabled';

    /**
     * Get the execution plugins, and filter the plugins that belongs to the security category
     * if the execution has been configured accordingly.
     *
     * @param DeliveryExecution $deliveryExecution
     * @return array the list of plugins
     */
    public function getPlugins(DeliveryExecution $deliveryExecution)
    {
        $plugins = parent::getPlugins($deliveryExecution);

        $delivery = $deliveryExecution->getDelivery();

        if ($this->isSecureDelivery($delivery)) {
            return $plugins;
        }

        //otherwise filter the security plugins
        return array_filter($plugins, function(PluginModule $plugin) {
            return $plugin->getCategory() != 'security';
        });
    }

    /**
     * Check whether secure plugins must be used.
     * @param core_kernel_classes_Resource $delivery
     * @return bool
     */
    private function isSecureDelivery(\core_kernel_classes_Resource $delivery)
    {
        $hasSecurityPlugins = $delivery->getOnePropertyValue($this->getProperty(self::DELIVERY_SECURITY_PLUGINS_PROPERTY));
        return $hasSecurityPlugins instanceof core_kernel_classes_Resource &&
                  $hasSecurityPlugins->getUri() == self::CHECK_MODE_ENABLED;
    }

}
