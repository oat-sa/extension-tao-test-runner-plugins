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
use oat\generis\Helper\SystemHelper;
use tao_helpers_form_FormFactory;
use tao_helpers_form_xhtml_Form;

/**
 * Class OfflineTestImportForm
 * @package oat\taoTestRunnerPlugins\model
 */
class OfflineTestImportForm extends \tao_helpers_form_FormContainer
{

    /**
     * @return mixed|void
     * @throws common_Exception
     */
    protected function initForm()
    {
        $this->form = new tao_helpers_form_xhtml_Form('export');

        $submitElt = tao_helpers_form_FormFactory::getElement('upload', 'Free');
        $submitElt->setValue('<a href="#" class="form-submitter btn-success small"><span class="icon-import"></span> ' . __('Upload') . '</a>');

        $this->form->setActions([$submitElt], 'bottom');
        $this->form->setActions([], 'top');
    }

    /**
     * Used to create the form elements and bind them to the form instance
     *
     * @access protected
     */
    protected function initElements()
    {
        $descElt = tao_helpers_form_FormFactory::getElement('offline_desc', 'Free');
        $descElt->setValue(__('Import a test sent to you by an offline test taker.'));
        $this->form->addElement($descElt);

        //create file upload form box
        $fileElt = tao_helpers_form_FormFactory::getElement('source', 'AsyncFile');
        if (isset($_POST['import_sent_file'])) {
            $fileElt->addValidator(tao_helpers_form_FormFactory::getValidator('NotEmpty'));
        } else {
            $fileElt->addValidator(tao_helpers_form_FormFactory::getValidator('NotEmpty', ['message' => '']));
        }
        $fileElt->addValidators(array(
            tao_helpers_form_FormFactory::getValidator('FileSize', ['max' => SystemHelper::getFileUploadLimit()]),
            tao_helpers_form_FormFactory::getValidator('FileMimeType', ['mimetype' => ['application/json', 'text/plain'], 'extension' => ['json']]),
        ));

        $this->form->addElement($fileElt);

        $fileSentElt = tao_helpers_form_FormFactory::getElement('import_sent_file', 'Hidden');
        $fileSentElt->setValue(1);
        $this->form->addElement($fileSentElt);
    }
}
