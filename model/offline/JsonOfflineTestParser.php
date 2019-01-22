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
 * Class JsonOfflineTestParser
 * @package oat\taoTestRunnerPlugins\model\offline
 */
class JsonOfflineTestParser implements OfflineTestParser
{
    /** @var string */
    private $content;

    /** @var array */
    private $body;

    /** @var File  */
    private $file;

    /**
     * JsonOfflineParser constructor.
     * @param File $file
     */
    public function __construct(File $file)
    {
        $this->file = $file;
    }

    /**
     * @return array
     */
    public function getBody()
    {
        if (!$this->body || !is_array($this->body)) {
            $this->body = json_decode($this->getContent(), true);
        }
        return $this->body;
    }

    /**
     * @return File
     */
    public function getFile()
    {
        return $this->file;
    }

    /**
     * @return string
     */
    protected function getContent()
    {
        if (!$this->content) {
            $this->content = $this->getFile()->read();
        }
        return $this->content;

    }

    /**
     * @return array
     */
    public function getActionsQueue()
    {
        $body = $this->getBody();
        $actionQueue = isset($body['actionQueue']) ? $body['actionQueue'] : [];
        return $actionQueue;
    }

    /**
     * Gets the identifier of the test session
     * @return string
     */
    public function getSessionId()
    {
        $body = $this->getBody();
        $testConfig = $body['testConfig'];
        if (isset($testConfig['testServiceCallId']) && $testConfig['testServiceCallId']) {
            return $testConfig['testServiceCallId'];
        } else {
            return $testConfig['serviceCallId'];
        }
    }

    /**
     * @param string $key
     * @return mixed|null
     */
    public function getTestConfig($key)
    {
        $body = $this->getBody();
        $testConfig = $body['testConfig'];
        return (isset($testConfig[$key]) && $testConfig[$key]) ? $testConfig[$key] : null;
    }
}