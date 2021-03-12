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
 * Copyright (c) 2021 (original work) Open Assessment Technologies SA;
 */

const path = require('path');

/**
 * configure the extension sass compilation
 *
 * @param {Object} grunt - the grunt object (by convention)
 */
module.exports = function(grunt) {
    'use strict';

    const root       = path.join(grunt.option('root'), '/taoTestRunnerPlugins/views/');

    grunt.config.merge({
        sass : {
            taotestrunnerplugins: {
                options: {},
                files : [
                    {
                        dest : path.join(root, 'css/fullscreen.css'),
                        src : path.join(root, 'scss/fullscreen.scss')
                    }
                ]
            },
        },
        watch : {
            taotestrunnerpluginssass : {
                files : [path.join(root, 'scss/**/*.scss')],
                tasks : ['sass:taotestrunnerplugins'],
                options : {
                    debounceDelay : 1000
                }
            }
        },
        notify : {
            taotestrunnerpluginssass : {
                options: {
                    title: 'Grunt SASS',
                    message: 'SASS files compiled to CSS'
                }
            }
        }
    });

    //register an alias for main build
    grunt.registerTask('taotestrunnerpluginssass', ['sass:taotestrunnerplugins']);
};
