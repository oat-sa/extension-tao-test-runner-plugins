<?php

declare(strict_types=1);

namespace oat\taoTestRunnerPlugins\migrations;

use Doctrine\DBAL\Schema\Schema;
use oat\tao\scripts\tools\migrations\AbstractMigration;
use oat\taoTests\models\runner\plugins\PluginRegistry;
use oat\taoTests\models\runner\plugins\TestPlugin;

/**
 * Auto-generated Migration: Please modify to your needs!
 */
final class Version202510140956083819_taoTestRunnerPlugins extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'Register Watermark security plugin';
    }

    public function up(Schema $schema): void
    {
        $registry = PluginRegistry::getRegistry();
        if (!$registry->isRegistered('taoTestRunnerPlugins/runner/plugins/security/watermark')) {
            $registry->register(TestPlugin::fromArray([
                'id' => 'watermark',
                'name' => 'Watermark',
                'module' => 'taoTestRunnerPlugins/runner/plugins/security/watermark',
                'bundle' => 'taoTestRunnerPlugins/loader/testPlugins.min',
                'description' => 'Show watermark over the item content',
                'category' => 'tools',
                'active' => false,
                'tags' => []
            ]));
        }
    }

    public function down(Schema $schema): void
    {
        $registry = PluginRegistry::getRegistry();
        if ($registry->isRegistered('taoTestRunnerPlugins/runner/plugins/security/watermark')) {
            $registry->remove('taoTestRunnerPlugins/runner/plugins/security/watermark');
        }
    }
}
