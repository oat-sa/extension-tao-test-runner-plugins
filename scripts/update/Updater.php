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

        $this->skip('1.1.0', '1.3.0');
    }
}
