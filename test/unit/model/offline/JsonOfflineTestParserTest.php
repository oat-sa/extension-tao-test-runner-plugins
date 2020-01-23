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
 * Copyright (c) 2020 (original work) Open Assessment Technologies SA;
 */

namespace oat\taoTestRunnerPlugins\test\unit\model\offline;

use common_Exception;
use oat\generis\model\kernel\uri\UriProvider;
use oat\generis\test\TestCase;
use oat\oatbox\filesystem\File;
use oat\taoTestRunnerPlugins\model\offline\JsonOfflineTestParser;
use PHPUnit_Framework_MockObject_MockObject;

class JsonOfflineTestParserTest extends TestCase
{
    /** @var PHPUnit_Framework_MockObject_MockObject|File */
    private $fileMock;

    public function setUp()
    {
        parent::setUp();

        $this->fileMock = $this->getMockBuilder(File::class)
            ->disableOriginalConstructor()
            ->getMock();
    }

    /**
     * @dataProvider isInterruptedDataProvider
     *
     * @param $json
     * @param $expected
     */
    public function testIsInterrupted($json, $expected)
    {
        $this->fileMock->method('read')
            ->willReturn($json);

        $parser = new JsonOfflineTestParser($this->fileMock);

        $this->assertEquals($parser->isInterrupted(), $expected);
    }

    public function testCheckUri()
    {
        $this->fileMock->method('read')
            ->willReturn('{}');

        $parser = new JsonOfflineTestParser($this->fileMock);
        $parser->setServiceLocator($this->getMockServiceLocator());

        $this->assertTrue($parser->checkUri('http://local.domain/first.rdf#i1544535042652725'));
        $this->assertNotTrue($parser->checkUri('http://local/first.rdf#i1544535042652725'));
    }

    public function testValidateUrisAllCorrect()
    {
        $json = '{
          "testConfig": {
            "exitUrl": "http://local.domain/taoDelivery/DeliveryServer/index",
            "testDefinition": "http://local.domain/first.rdf#i1544535042652725",
            "testCompilation": "http://local.domain/first.rdf#i1544535107181528-|http://sample/first.rdf#i1544535107965629+",
            "serviceCallId": "http://local.domain/first.rdf#i154661273822140"
          },
          "actionQueue": [
            {
              "parameters": {
                "testDefinition": "http://local.domain/first.rdf#i1544535042652725",
                "testCompilation": "http://local.domain/first.rdf#i1544535107181528-|http://sample/first.rdf#i1544535107965629+",
                "serviceCallId": "http://local.domain/first.rdf#i154661273822140"
              }
            }
          ]
        }';

        $this->fileMock->method('read')
            ->willReturn($json);

        $parser = new JsonOfflineTestParser($this->fileMock);
        $parser->setServiceLocator($this->getMockServiceLocator());

        $this->assertTrue($parser->validateUris());

    }

    public function testValidateUrisSeveralIncorrect()
    {
        $json = '{
          "testConfig": {
            "exitUrl": "http://sample.local/taoDelivery/DeliveryServer/index",
            "testDefinition": "http://sample.local/first.rdf#i1544535042652725",
            "testCompilation": "http://sample.local/first.rdf#i1544535107181528-|http://sample/first.rdf#i1544535107965629+",
            "serviceCallId": "http://sample.local/first.rdf#i154661273822140"
          },
          "actionQueue": [
            {
              "parameters": {
                "testDefinition": "http://sample.local/first.rdf#i1544535042652725",
                "testCompilation": "http://local.domain/first.rdf#i1544535107181528-|http://sample/first.rdf#i1544535107965629+",
                "serviceCallId": "http://sample.local/first.rdf#i154661273822140"
              }
            }
          ]
        }';

        $this->fileMock->method('read')
            ->willReturn($json);

        $parser = new JsonOfflineTestParser($this->fileMock);
        $parser->setServiceLocator($this->getMockServiceLocator());

        $this->assertFalse($parser->validateUris());
    }

    public function testValidate()
    {
        $json = '{
          "testConfig": {
            "exitUrl": "http://sample.local/taoDelivery/DeliveryServer/index",
            "testDefinition": "http://sample.local/first.rdf#i1544535042652725",
            "testCompilation": "http://sample.local/first.rdf#i1544535107181528-|http://sample/first.rdf#i1544535107965629+",
            "serviceCallId": "http://sample.local/first.rdf#i154661273822140"
          },
          "actionQueue": [
            {
              "parameters": {
                "testDefinition": "http://sample.local/first.rdf#i1544535042652725",
                "testCompilation": "http://local.domain/first.rdf#i1544535107181528-|http://sample/first.rdf#i1544535107965629+",
                "serviceCallId": "http://sample.local/first.rdf#i154661273822140"
              }
            }
          ]
        }';

        $this->fileMock->method('read')
            ->willReturn($json);

        $parser = new JsonOfflineTestParser($this->fileMock);
        $parser->setServiceLocator($this->getMockServiceLocator());

        $this->expectException(common_Exception::class);

        $parser->validate();
    }

    public function isInterruptedDataProvider()
    {
        return [
            ['{}', false],
            ['{"isExitTest":true}', true],
            ['{"isExitTest":"true"}', true],
            ['{"isExitTest":false}', false],
            ['{"isExitTest":"false"}', false],
            ['{"isExitTest":null}', false],
            ['{"isExitTest":1}', true],
            ['{"isExitTest":0}', false],
        ];
    }

    private function getMockServiceLocator()
    {
        $uriProvider = $this->prophesize(UriProvider::class);
        $uriProvider->provide()->willReturn('http://local.domain/first.rdf#i1544535042650000');

        return $this->getServiceLocatorMock([
            UriProvider::SERVICE_ID => $uriProvider
        ]);
    }
}
