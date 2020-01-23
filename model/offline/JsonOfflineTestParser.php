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

use common_Exception;
use http\Exception\InvalidArgumentException;
use oat\generis\model\kernel\uri\UriProvider;
use oat\oatbox\filesystem\File;
use tao_helpers_Uri as Uri;
use Zend\ServiceManager\ServiceLocatorAwareInterface;
use Zend\ServiceManager\ServiceLocatorAwareTrait;

/**
 * Class JsonOfflineTestParser
 * @package oat\taoTestRunnerPlugins\model\offline
 */
class JsonOfflineTestParser implements OfflineTestParserInterface, ServiceLocatorAwareInterface
{
    use ServiceLocatorAwareTrait;

    const KEY_IS_EXIT_TEST = 'isExitTest';

    const PROTECTED_FIELDS = [
        'testDefinition', 'testCompilation', 'serviceCallId', 'exitUrl', 'testServiceCallId'
    ];

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
    protected function getBody()
    {
        if (!$this->body || !is_array($this->body)) {
            $this->body = json_decode($this->getContent(), true);
        }

        return $this->body;
    }

    /**
     * @return File
     */
    protected function getFile()
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
     * It checks if URI belongs the instance
     *
     * @param $uri
     *
     * @return bool
     */
    public function checkUri($uri)
    {
        /** @var UriProvider $uriProvider */
        $uriProvider = $this->getUriProviderService();
        $validInstanceLink = $uriProvider->provide();

//        print_r($uri);
//        echo '    ';
//        print_r($validInstanceLink);
//        echo PHP_EOL;

        return Uri::getDomain($uri) === Uri::getDomain($validInstanceLink);
    }

    /**
     * Validates body content to avoid unexpected behavior
     */
    public function validateUris()
    {
        $body = $this->getBody();

        $validateUriFunction = [$this, 'checkUri'];

        $invalid = 0;

        array_walk_recursive($body, static function ($item, $key) use ($validateUriFunction, &$invalid) {
            if (in_array($key, self::PROTECTED_FIELDS, true) && !$validateUriFunction($item)) {
                $invalid++;
            }
        });

        return !$invalid;
    }

    /**
     * Validates body content to avoid unexpected behavior
     * Runs various validation rules
     */
    public function validate()
    {
        if (!$this->validateUris()) {
            throw new common_Exception(__('Several resources URIs do not belong to the instance where the test was passed'));
        }
    }

    /**
     * @return array
     */
    public function getActionsQueue()
    {
        $body = $this->getBody();
        return $body['actionQueue'] ?? [];
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

    /**
     * @return bool
     */
    public function isInterrupted(): bool
    {
        $body = $this->getBody();

        if (isset($body[self::KEY_IS_EXIT_TEST])) {
            return filter_var($body[self::KEY_IS_EXIT_TEST], FILTER_VALIDATE_BOOLEAN);
        }

        return false;
    }

    protected function getUriProviderService()
    {
        return $this->getServiceLocator()->get(UriProvider::SERVICE_ID);
    }
}
