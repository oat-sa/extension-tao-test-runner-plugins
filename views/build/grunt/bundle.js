module.exports = function(grunt) {
    'use strict';

    var root        = grunt.option('root');
    var libs        = grunt.option('mainlibs');
    var ext         = require(root + '/tao/views/build/tasks/helpers/extensions')(grunt, root);
    var out         = 'output';

    var testPlugins = ext.getExtensionSources('taoTestRunnerPlugins', [
        'views/js/runner/plugins/**/*.js',
    ], true);

    var paths = {
        'taoTestRunnerPlugins' : root + '/taoTestRunnerPlugins/views/js',
        'taoTests' : root + '/taoTests/views/js'
    };

    grunt.config.merge({
        requirejs: {
            taotestrunnerplugins : {
                options: {
                    paths : paths,
                    include: testPlugins,
                    exclude : ['json!i18ntr/messages.json'].concat(libs),
                    out: out + "/testPlugins.min.js"
                }
            }
        },

        copy : {
            taotestrunnerpluginsbundle : {
                files: [
                    { src: [out + '/testPlugins.min.js'],  dest: root + '/taoTestRunnerPlugins/views/js/loader/testPlugins.min.js' },
                    { src: [out + '/testPlugins.min.js.map'],  dest: root + '/taoTestRunnerPlugins/views/js/loader/testPlugins.min.js.map' }
                ]
            }
        }
    });

    // bundle task
    grunt.registerTask('taotestrunnerpluginsbundle', ['clean:bundle', 'requirejs:taotestrunnerplugins', 'copy:taotestrunnerpluginsbundle']);
};
