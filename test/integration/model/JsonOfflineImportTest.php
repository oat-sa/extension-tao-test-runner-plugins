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
 * Copyright (c) 2019 (original work) Open Assessment Technologies SA (under the project TAO-PRODUCT);
 *
 */

use oat\tao\model\upload\UploadService;
use oat\tao\test\TaoPhpUnitTestRunner;
use oat\taoDelivery\model\execution\DeliveryExecution;
use oat\taoDelivery\model\execution\DeliveryExecutionInterface;
use oat\taoDelivery\model\execution\ServiceProxy;
use oat\taoTestRunnerPlugins\model\offline\JsonOfflineTestImporter;
use oat\taoTestRunnerPlugins\model\offline\OfflineTestParser;
use oat\taoQtiTest\models\runner\communicator\QtiCommunicationService;
use oat\taoQtiTest\models\runner\QtiRunnerService;
use oat\taoQtiTest\models\runner\QtiRunnerServiceContext;
use qtism\common\datatypes\QtiFloat;
use qtism\common\enums\BaseType;
use qtism\common\enums\Cardinality;
use qtism\runtime\common\OutcomeVariable;
use qtism\runtime\tests\AssessmentTestSession;

class JsonOfflineImportTest extends TaoPhpUnitTestRunner
{

    public function testImport()
    {
        $file = $this->getTempFileToUpload('json/sample.json');
        $importer = new JsonOfflineTestImporter();
        $importer->setServiceLocator($this->getMockServiceLocator());
        $class = $this->prophesize('\core_kernel_classes_Class');
        $resource = $this->prophesize('\core_kernel_classes_Resource');
        $class->createInstanceWithProperties([])
            ->willReturn($resource->reveal());
        $report = $importer->import($class->reveal(), ['uploaded_file' => $file]);

        $this->assertInstanceOf('common_report_Report', $report);
        $this->assertEquals(common_report_Report::TYPE_INFO, $report->getType());
        $this->assertEquals(2, count($report->getSuccesses()));
    }
    /**
     * @param $path
     * @return \oat\oatbox\filesystem\File
     */
    protected function getTempFileToUpload($path)
    {
        //copy file because it should be removed
        $path = $this->getSamplePath($path);
        $file = $this->getTempDirectory()->getFile('test-import');
        $file->write(file_get_contents($path));
        $this->assertTrue($file->exists());
        return $file;
    }
    /**
     * @param $path
     * @return string
     */
    protected function getSamplePath($path)
    {
        return __DIR__ . DIRECTORY_SEPARATOR .
            '..'. DIRECTORY_SEPARATOR .
            'samples' . DIRECTORY_SEPARATOR .
            trim($path, '\\/');
    }
    /**
     * @return \Zend\ServiceManager\ServiceLocatorInterface
     */
    protected function getMockServiceLocator()
    {
        $deP = $this->prophesize(DeliveryExecution::class);
        $deP->getIdentifier()->willReturn('http://sample/first.rdf#i154661273822140');
        $deP->getLabel()->willReturn('test');
        $deP->getUserIdentifier()->willReturn('http://sample/first.rdf#i154661273822141');
        $stateProphecy = $this->prophesize(\core_kernel_classes_Resource::class);
        $stateProphecy->getUri()->willReturn(DeliveryExecution::STATE_ACTIVE);
        $deP->getState()->willReturn($stateProphecy);
        $deP->setState(DeliveryExecutionInterface::STATE_FINISHED)->willReturn($stateProphecy);
        $de = $deP->reveal();
        $prophecy = $this->prophesize(ServiceProxy::class);
        $prophecy->getDeliveryExecution('http://sample/first.rdf#i154661273822140')->willReturn($de);
        $upload = $this->prophesize(UploadService::class);
        $assessmentTestSession = $this->prophesize(AssessmentTestSession::class);
        $assessmentTestSession->setVariable(
            new OutcomeVariable(
                OfflineTestParser::IS_OFFLINE_VARIABLE,
                Cardinality::SINGLE,
                BaseType::FLOAT,
                new QtiFloat(1.0)
            )
        )->willReturn(true);
        $assessmentTestSession = $assessmentTestSession->reveal();
        $serviceContext =  $this->prophesize(QtiRunnerServiceContext::class);
        $serviceContext->getTestSession()->willReturn($assessmentTestSession);
        $serviceContext->setTestSession($assessmentTestSession)->willReturn(true);
        $serviceContext = $serviceContext->reveal();
        $qtiRunnerService = $this->prophesize(QtiRunnerService::class);
        $qtiRunnerService->getServiceContext(
            'http://sample/first.rdf#i1544535042652725',
            'http://sample/first.rdf#i1544535107181528-|http://sample/first.rdf#i1544535107965629+',
            'http://sample/first.rdf#i154661273822140',
            'http://sample/first.rdf#i154661273822141'
        )->willReturn($serviceContext);
        $qtiCommunicationService = $this->prophesize(QtiCommunicationService::class);
        $qtiCommunicationService->processInput($serviceContext, $this->getMockData())->willReturn(true);
        $serviceLocatorMock = $this->getServiceLocatorMock([
            ServiceProxy::SERVICE_ID => $prophecy,
            QtiRunnerService::SERVICE_ID => $qtiRunnerService,
            UploadService::SERVICE_ID => $upload,
            QtiCommunicationService::SERVICE_ID => $qtiCommunicationService
        ]);
        return $serviceLocatorMock;
    }
    /**
     * @return array
     */
    protected function getMockData()
    {
        return [
            [
                'channel' => 'sync',
                'message' =>
                    [
                        [
                            'action' => 'move',
                            'timestamp' => 1546612781734,
                            'parameters' =>
                                [
                                    'itemDefinition' => 'item-1',
                                    'itemResponse' => '{"RESPONSE":{"base":null}}',
                                    'itemState' => '{"RESPONSE":{"response":{"base":null}}}',
                                    'direction' => 'next',
                                    'scope' => 'item',
                                    'itemDuration' => 25.051399999996647,
                                    'start' => true,
                                    'actionId' => 'move_1546612781729',
                                    'testDefinition' => 'http://sample/first.rdf#i1544535042652725',
                                    'testCompilation' => 'http://sample/first.rdf#i1544535107181528-|http://sample/first.rdf#i1544535107965629+',
                                    'serviceCallId' => 'http://sample/first.rdf#i154661273822140',
                                    'offline' => true,
                                ],
                        ],
                        [
                            'action' => 'move',
                            'timestamp' => 1546612782342,
                            'parameters' =>
                                [
                                    'itemDefinition' => 'item-2',
                                    'itemResponse' => '{"RESPONSE":{"list":{"identifier":[]}}}',
                                    'itemState' => '{"RESPONSE":{"response":{"list":{"identifier":[]}},"order":["Prehistory","ModernEra","Antiquity","MiddleAges","ContemporaryEra"]}}',
                                    'direction' => 'next',
                                    'scope' => 'item',
                                    'itemDuration' => 0,
                                    'start' => true,
                                    'actionId' => 'move_1546612782338',
                                    'testDefinition' => 'http://sample/first.rdf#i1544535042652725',
                                    'testCompilation' => 'http://sample/first.rdf#i1544535107181528-|http://sample/first.rdf#i1544535107965629+',
                                    'serviceCallId' => 'http://sample/first.rdf#i154661273822140',
                                    'offline' => true,
                                ],
                        ],
                        [
                            'action' => 'move',
                            'timestamp' => 1546612783047,
                            'parameters' =>
                                [
                                    'itemDefinition' => 'item-3',
                                    'itemResponse' => '{"RESPONSE":{"base":{"integer":0}}}',
                                    'itemState' => '{"RESPONSE":{"response":{"base":{"integer":0}}}}',
                                    'direction' => 'next',
                                    'scope' => 'item',
                                    'itemDuration' => 0,
                                    'start' => true,
                                    'actionId' => 'move_1546612783041',
                                    'testDefinition' => 'http://sample/first.rdf#i1544535042652725',
                                    'testCompilation' => 'http://sample/first.rdf#i1544535107181528-|http://sample/first.rdf#i1544535107965629+',
                                    'serviceCallId' => 'http://sample/first.rdf#i154661273822140',
                                    'offline' => true,
                                ],
                        ],
                        [
                            'action' => 'move',
                            'timestamp' => 1546612784553,
                            'parameters' =>
                                [
                                    'itemDefinition' => 'item-4',
                                    'itemResponse' => '{"RESPONSE":{"list":{"directedPair":[]}}}',
                                    'itemState' => '{"RESPONSE":{"response":{"list":{"directedPair":[]}},"order":[["C","D","P","L"],["R","T","M"]]}}',
                                    'direction' => 'next',
                                    'scope' => 'item',
                                    'itemDuration' => 1.0027999999001622,
                                    'start' => true,
                                    'actionId' => 'move_1546612784550',
                                    'testDefinition' => 'http://sample/first.rdf#i1544535042652725',
                                    'testCompilation' => 'http://sample/first.rdf#i1544535107181528-|http://sample/first.rdf#i1544535107965629+',
                                    'serviceCallId' => 'http://sample/first.rdf#i154661273822140',
                                ],
                        ],
                    ],
            ],
        ];
    }

}
