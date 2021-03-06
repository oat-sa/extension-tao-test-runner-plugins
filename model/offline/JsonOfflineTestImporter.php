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
use common_exception_Error;
use common_exception_InvalidArgumentType;
use common_report_Report as Report;
use core_kernel_classes_Class;
use Exception;
use oat\oatbox\filesystem\File;
use oat\taoDelivery\model\execution\DeliveryExecutionInterface;
use oat\taoDelivery\model\execution\ServiceProxy;
use oat\taoQtiTest\models\runner\communicator\QtiCommunicationService;
use oat\taoQtiTest\models\runner\communicator\SyncChannel;
use oat\taoQtiTest\models\runner\QtiRunnerService;
use oat\taoQtiTest\models\runner\QtiRunnerServiceContext;
use qtism\common\datatypes\QtiFloat;
use qtism\common\enums\BaseType;
use qtism\common\enums\Cardinality;
use qtism\runtime\common\OutcomeVariable;
use qtism\runtime\tests\AssessmentTestSession;
use tao_helpers_form_Form as Form;
use oat\tao\model\import\ImportHandlerHelperTrait;
use oat\tao\model\import\TaskParameterProviderInterface;
use Zend\ServiceManager\ServiceLocatorAwareInterface;

/**
 * Class JsonOfflineTestImporter
 * @package oat\taoTestRunnerPlugins\model
 */
class JsonOfflineTestImporter implements \tao_models_classes_import_ImportHandler, ServiceLocatorAwareInterface, TaskParameterProviderInterface
{
    use ImportHandlerHelperTrait { getTaskParameters as getDefaultTaskParameters; }

    /** @var QtiRunnerServiceContext */
    private $serviceContext;

    /** @var OfflineTestParserInterface */
    private $offlineParser;

    /** @var Report */
    private $report;

    /**
     * Returns a textual description of the import format
     *
     * @return string
     */
    public function getLabel()
    {
        return __('JSON with test actions');
    }

    /**
     * Returns a form in order to prepare the import
     * if the import is from a file, the form should include the file element
     *
     * @return Form
     */
    public function getForm()
    {
        return (new OfflineTestImportForm([]))->getForm();
    }

    /**
     * @param core_kernel_classes_Class $class
     * @param Form|array $form
     * @param string|null $userId owner of the resource
     * @return Report
     * @throws common_exception_Error
     */
    public function import($class, $form, $userId = null)
    {
        if (isset($form['uploaded_file']) && $form['uploaded_file'] instanceof File) {
            $uploadedFile = $form['uploaded_file'];
        } else {
            $uploadedFile = $this->fetchUploadedFile($form);
        }

        $this->report = Report::createInfo(__('Test actions importing'));

        try {

            switch ($uploadedFile->getMimeType()) {
                case 'application/json':
                case 'text/plain':
                    $this->setOfflineParser(JsonOfflineTestParser::class, $uploadedFile);
                    break;
                default:
                    throw new common_Exception(__('Invalid MimeType of file'));
                    break;
            }

            $this->importActions();

            $successReport = Report::createSuccess(
                __('Test actions imported successfully. Imported execution %s', $this->getOfflineParser()->getSessionId())
            );
            $successReport->setData([
                'uriResource' => $this->getOfflineParser()->getSessionId()
            ]);
            $this->report->add($successReport);

        } catch (Exception $e) {
            $this->report = Report::createFailure(__('Fail to import test actions with message: '. $e->getMessage()));
        }

        $this->getUploadService()->remove($uploadedFile);

        return $this->report;
    }

    /**
     * Defines the task parameters to be stored for later use.
     *
     * @param Form $form
     * @return array
     */
    public function getTaskParameters(Form $form)
    {
        return array_merge(
            $form->getValues(),
            $this->getDefaultTaskParameters($form)
        );
    }

    /**
     * Gets the test service context
     * @param DeliveryExecutionInterface $deliveryExecution
     * @return QtiRunnerServiceContext
     * @throws \common_Exception
     */
    protected function getServiceContext(DeliveryExecutionInterface $deliveryExecution)
    {
        if (!$this->serviceContext) {
            $testDefinition = $this->getOfflineParser()->getTestConfig('testDefinition');
            $testCompilation = $this->getOfflineParser()->getTestConfig('testCompilation');
            $testExecution = $this->getOfflineParser()->getSessionId();
            $this->serviceContext = $this->getTestRunnerService()->getServiceContext(
                $testDefinition,
                $testCompilation,
                $testExecution,
                $deliveryExecution->getUserIdentifier()
            );
        }

        return $this->serviceContext;
    }

    /**
     * @return OfflineTestParserInterface
     */
    protected function getOfflineParser()
    {
        return $this->offlineParser;
    }

    /**
     * @param string $type
     * @param File $uploadedFile
     * @return $this
     */
    protected function setOfflineParser($type, File $uploadedFile)
    {
        if (!$this->offlineParser) {
            $this->offlineParser = new $type($uploadedFile);
            $this->offlineParser->setServiceLocator($this->getServiceLocator());
        }

        return $this;
    }

    /**
     * @throws common_Exception
     * @throws common_exception_InvalidArgumentType
     */
    protected function importActions()
    {
        $parsedSession = $this->getOfflineParser();

        $parsedSession->validate(); // validating data in the file before moving forward

        $data = $parsedSession->getActionsQueue();

        if (!$data) {
            throw new common_Exception(__('Cannot find any actions for importing.'));
        }

        $input[] = [
            'channel' => SyncChannel::CHANNEL_NAME,
            'message' => $data
        ];

        /** @var DeliveryExecutionInterface $deliveryExecution */
        $deliveryExecution = $this->getProxyService()->getDeliveryExecution($parsedSession->getSessionId());

        if ($deliveryExecution->getState()->getUri() !== DeliveryExecutionInterface::STATE_ACTIVE) {
            throw new common_Exception(__('Delivery execution %s is not active state.', $deliveryExecution->getIdentifier()));
        }

        /** @var QtiRunnerServiceContext $serviceContext */
        $serviceContext = $this->getServiceContext($deliveryExecution);

        $testState = DeliveryExecutionInterface::STATE_TERMINATED;

        if (!$parsedSession->isInterrupted()) {

            /** @var AssessmentTestSession $testSession */
            $testSession = $serviceContext->getTestSession();

            $testSession->setVariable(new OutcomeVariable(
                OfflineTestParserInterface::IS_OFFLINE_VARIABLE,
                Cardinality::SINGLE,
                BaseType::FLOAT,
                new QtiFloat(1.0))
            );

            $serviceContext->setTestSession($testSession);

            $testState = DeliveryExecutionInterface::STATE_FINISHED;
        }

        $this->getCommunicationService()->processInput($serviceContext, $input);

        $deliveryExecution->setState($testState);

        $successReport = Report::createSuccess(
            __('%s actions were successfully imported', count($data))
        );

        $successReport->setData(['uriResource' => $parsedSession->getSessionId()]);

        $this->report->add($successReport);
    }

    /**
     * @return QtiRunnerService
     */
    protected function getTestRunnerService()
    {
        return $this->getServiceLocator()->get(QtiRunnerService::SERVICE_ID);
    }

    /**
     * @return ServiceProxy
     */
    protected function getProxyService()
    {
        return $this->getServiceLocator()->get(ServiceProxy::SERVICE_ID);
    }

    /**
     * @return QtiCommunicationService
     */
    protected function getCommunicationService()
    {
        return $this->getServiceLocator()->get(QtiCommunicationService::SERVICE_ID);
    }

}
