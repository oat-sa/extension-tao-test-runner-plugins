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

use oat\generis\test\TestCase;
use oat\oatbox\filesystem\File;
use oat\taoTestRunnerPlugins\model\offline\JsonOfflineTestParser;

class JsonOfflineTestParserTest extends TestCase
{
    /**
     * @dataProvider isInterruptedDataProvider
     *
     * @param $json
     * @param $expected
     */
    public function testIsInterrupted($json, $expected)
    {
        /** @var File $file */
        $file = $this->getMockBuilder(File::class)
            ->disableOriginalConstructor()
            ->getMock();

        $file->method('read')
            ->willReturn($json);

        $parser = new JsonOfflineTestParser($file);

        $this->assertEquals($parser->isInterrupted(), $expected);
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
}
