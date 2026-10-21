<?php

declare(strict_types=1);

namespace oat\taoTestRunnerPlugins\migrations;

use Doctrine\DBAL\Schema\Schema;
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
    }

    public function down(Schema $schema): void
    {
        $registry = PluginRegistry::getRegistry();

        if ($registry->isRegistered(self::MODULE)) {
            $registry->remove(self::MODULE);
        }
    }
}
