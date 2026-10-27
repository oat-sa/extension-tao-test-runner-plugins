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
 * Copyright (c) 2026 (original work) Open Assessment Technologies SA;
 */

declare(strict_types=1);

namespace oat\taoTestRunnerPlugins\migrations;

use Doctrine\DBAL\Schema\Schema;
use oat\oatbox\reporting\Report;
use oat\tao\scripts\tools\migrations\AbstractMigration;
use oat\taoTests\models\runner\plugins\PluginRegistry;
use oat\taoTests\models\runner\plugins\TestPlugin;

final class Version202610211506000000_taoTestRunnerPlugins extends AbstractMigration
{
    private const MODULE = 'taoTestRunnerPlugins/runner/plugins/security/lockDownBrowser';

    public function getDescription(): string
    {
        return 'Register Lock down browser security plugin';
    }

    public function up(Schema $schema): void
    {
        $registry = PluginRegistry::getRegistry();

        if (!$registry->isRegistered(self::MODULE)) {
            $registry->register(TestPlugin::fromArray([
                'id' => 'lockDownBrowser',
                'name' => 'Lock down browser',
                'module' => self::MODULE,
                'bundle' => 'taoTestRunnerPlugins/loader/testPlugins.min',
                'description' => 'Lock down browser session, security violations, and exit',
                'category' => 'security',
                'active' => false,
                'tags' => []
            ]));
        }

        $this->addReport(Report::createSuccess(sprintf('Plugin "%s" successfully registered', self::MODULE)));
    }

    public function down(Schema $schema): void
    {
        $registry = PluginRegistry::getRegistry();

        if ($registry->isRegistered(self::MODULE)) {
            $registry->remove(self::MODULE);
        }

        $this->addReport(Report::createSuccess(sprintf('Plugin "%s" successfully removed', self::MODULE)));
    }
}
