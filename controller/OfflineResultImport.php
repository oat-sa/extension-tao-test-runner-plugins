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
 * Copyright (c) 2019 (original work) Public Research Centre Henri Tudor (under the project TAO-SUSTAIN & TAO-DEV);
 *
 *
 */
namespace oat\taoTestRunnerPlugins\controller;

use oat\taoTestRunnerPlugins\model\offline\JsonOfflineTestImporter;

/**
 * Class OfflineResultImport
 * @package oat\taoTestRunnerPlugins\controller
 */
class OfflineResultImport extends \tao_actions_Import
{
    /** @var \tao_models_classes_import_ImportHandler[] */
    private $importHandlers;

    /**
     * Overwrites the parent index to add the import handlers
     *
     * @see tao_actions_Import::index()
     */
    public function index()
    {
        $this->setAvailableImportHandlers();
        parent::index();
        $this->setData('formTitle', __('Upload offline test'));
    }

    /**
     * @return \tao_models_classes_import_ImportHandler[]
     */
    protected function getAvailableImportHandlers()
    {
        return $this->importHandlers;
    }

    /**
     * Set import handlers
     * @return $this
     */
    protected function setAvailableImportHandlers()
    {
        $this->importHandlers = [
            new JsonOfflineTestImporter()
        ];

        return $this;
    }

    /**
     * Helper to get the selected class, needs to be passed as hidden field in the form
     * @return \core_kernel_classes_Class
     */
    protected function getCurrentClass()
    {
        return $this->getClass('Results');
    }
}