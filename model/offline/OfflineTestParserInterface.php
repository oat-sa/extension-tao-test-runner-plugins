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
 * Copyright (c) 2019 (original work) Open Assessment Technologies SA;
 *
 *
 */

namespace oat\taoTestRunnerPlugins\model\offline;

use oat\oatbox\filesystem\File;

/**
 * Interface OfflineTestParserInterface
 * @package oat\taoTestRunnerPlugins\model\offline
 */
interface OfflineTestParserInterface
{
    const IS_OFFLINE_VARIABLE = 'WasCompletedOffline';

    /**
     * OfflineParser constructor.
     * @param File $file
     */
    public function __construct(File $file);

    /**
     * @return array
     */
    public function getActionsQueue();

    /**
     * @return string
     */
    public function getSessionId();

    /**
     * @param string $key
     * @return mixed
     */
    public function getTestConfig($key);

    /**
     * Returns true if test was interrupted by user
     * @return bool
     */
    public function isInterrupted();
}
