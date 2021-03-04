<?php

declare(strict_types=1);

namespace oat\taoTestRunnerPlugins\migrations;

use Doctrine\DBAL\Schema\Schema;
use oat\tao\scripts\tools\migrations\AbstractMigration;

/**
 * Auto-generated Migration: Please modify to your needs!
 */
final class Version202103041620053819_taoTestRunnerPlugins extends AbstractMigration
{

    public function getDescription(): string
    {
        return 'Update config for full screen plugin';
    }

    public function up(Schema $schema): void
    {
        // protected $configs = [
        //     'fullScreen' => [
        //         'config' => [
        //             'focus' => 'ok'
        //         ]
        //     ]
        // ];
    }

    public function down(Schema $schema): void
    {
        // protected $configs = [
        //     'fullScreen' => null
        // ];
    }
}
