/**
 * Gruntfile
 * Provides tasks and commands to build and distribute the project
 *
 * @param grunt
 * @copyright (c) 2019 Passbolt SA
 * @licence GNU Affero General Public License http://www.gnu.org/licenses/agpl-3.0.en.html
 */
module.exports = function (grunt) {

  /**
   * Path shortcuts
   */
  var path = {
    build: 'build/all/',

    dist_chromium_mv2: 'dist/chromium-mv2/',
    dist_chromium_mv3: 'dist/chromium-mv3/',
    dist_safari: 'dist/safari/',
    dist_firefox: 'dist/firefox/',

    src: 'src/all/',
    test: 'test/',
    src_background_page: 'src/all/background_page/',
    src_chromium_mv2: 'src/chrome/',
    src_chromium_mv3: 'src/chrome-mv3/',
    src_safari: 'src/safari/',
    src_firefox: 'src/firefox/',
  };
  const firefoxWebExtBuildName = 'passbolt_-_open_source_password_manager';

  /**
   * Import package.json file content
   */
  var pkg = grunt.file.readJSON('package.json');
  var manifestVersion =  pkg.version.replace(/-.*(\.\d*)$/, '$1');

  /**
   * Load and enable Tasks
   */
  grunt.loadNpmTasks('grunt-shell');
  grunt.loadNpmTasks('grunt-contrib-clean');
  grunt.loadNpmTasks('grunt-contrib-copy');

  grunt.registerTask('default', ['bundle']);

  grunt.registerTask('bundle', ['copy:background_page']);
  grunt.registerTask('bundle-mv3', ['copy:service_worker']);
  grunt.registerTask('bundle-firefox', ['copy:manifest_firefox', 'bundle']);
  grunt.registerTask('bundle-chromium-mv2', ['copy:manifest_chromium_mv2', 'bundle']);
  grunt.registerTask('bundle-chromium-mv3', ['copy:manifest_chromium_mv3', 'bundle-mv3']);
  grunt.registerTask('bundle-safari', ['copy:manifest_safari', 'bundle']);

  grunt.registerTask('build', ['build-firefox-prod', 'build-chromium-mv2-prod', 'build-chromium-mv3-prod']);

  grunt.registerTask('build-firefox', ['build-firefox-debug', 'build-firefox-prod']);
  grunt.registerTask('build-firefox-debug', ['clean:build', 'bundle-firefox', 'shell:build_mv2_debug', 'shell:build_firefox_debug']);
  grunt.registerTask('build-firefox-prod', ['clean:build', 'bundle-firefox', 'shell:build_mv2_prod', 'shell:build_firefox_prod']);

  grunt.registerTask('build-chromium-mv2', ['build-chromium-mv2-debug', 'build-chromium-mv2-prod']);
  grunt.registerTask('build-chromium-mv2-debug', ['clean:build', 'bundle-chromium-mv2', 'shell:build_mv2_debug', 'shell:build_chromium_mv2_debug']);
  grunt.registerTask('build-chromium-mv2-prod', ['clean:build', 'bundle-chromium-mv2', 'shell:build_mv2_prod', 'shell:build_chromium_mv2_prod']);

  grunt.registerTask('build-chromium-mv3', ['build-chromium-mv3-debug', 'build-chromium-mv3-prod']);
  grunt.registerTask('build-chromium-mv3-debug', ['clean:build', 'bundle-chromium-mv3', 'shell:build_mv3_debug', 'shell:build_chromium_mv3_debug']);
  grunt.registerTask('build-chromium-mv3-prod', ['clean:build', 'bundle-chromium-mv3', 'shell:build_mv3_prod', 'shell:build_chromium_mv3_prod']);

  grunt.registerTask('build-safari', ['build-safari-debug', 'build-safari-prod']);
  grunt.registerTask('build-safari-debug', ['clean:build', 'bundle-safari', 'shell:build_background_page_safari_debug', 'shell:build_common_scripts_debug']);
  grunt.registerTask('build-safari-prod', ['clean:build', 'bundle-safari', 'shell:build_background_page_safari_prod', 'shell:build_common_scripts_prod']);

  /**
   * Main grunt tasks configuration
    */
  grunt.initConfig({
    pkg: grunt.file.readJSON('package.json'),

    /**
     * Clean operations
     */
    clean: {
      build: [
        path.build + '**'
      ]
    },

    /**
     * Copy operations
     */
    copy: {
      background_page: {
        files: [
          { expand: true, cwd: path.src_background_page, src: 'index.html', dest: path.build }
        ]
      },
      service_worker: {
        files: [
          { expand: true, cwd: path.src_chromium_mv3, src: 'serviceWorker.js', dest: path.build + 'serviceWorker' },
          { expand: true, cwd: `${path.src_chromium_mv3}/offscreens`, src: 'offscreen.html', dest: `${path.build}/offscreens` },
        ]
      },
      // switch manifest file to firefox or chrome
      manifest_firefox: {
        files: [{
          expand: true, cwd: path.src_firefox, src: 'manifest.json', dest: path.build
        }]
      },
      manifest_chromium_mv2: {
        files: [{
          expand: true, cwd: path.src_chromium_mv2, src: 'manifest.json', dest: path.build
        }]
      },
      manifest_chromium_mv3: {
        files: [{
          expand: true, cwd: path.src_chromium_mv3, src: 'manifest.json', dest: path.build
        }]
      },
      manifest_safari: {
        files: [{
          expand: true, cwd: path.src_safari, src: 'manifest.json', dest: path.build
        }]
      }
    },

    /**
     * Shell commands
     */
    shell: {
      options: { stderr: false },
      /**
       * Build background page.
       */
      build_mv2_prod: {
        command: [
          'npm run build:mv2'
        ].join(' && ')
      },
      build_background_page_safari_prod: {
        command: [
          'npm run build:safari:background-page'
        ].join(' && ')
      },
      build_mv2_debug: {
        command: [
          'npm run dev:build:mv2'
        ].join(' && ')
      },
      build_background_page_safari_debug: {
        command: [
          'npm run dev:build:safari:background-page'
        ].join(' && ')
      },
      /**
       * Build MV3 (service worker + offscreens).
       */
      build_mv3_prod: {
        command: [
          'npm run build:mv3',
        ].join(' && ')
      },
      build_mv3_debug: {
        command: [
          'npm run dev:build:mv3',
        ].join(' && ')
      },

      /**
       * Build common scripts (content scripts + web-accessible resources).
       */
      build_common_scripts_prod: {
        command: [
          'npm run build:common-scripts'
        ].join(' && ')
      },
      build_common_scripts_debug: {
        command: [
          'npm run dev:build:common-scripts'
        ].join(' && ')
      },
      // Execute the eslint command
      eslint: {
        command: [
          'npm run eslint'
        ].join(' && ')
      },

      /**
       * Unit tests.
       */
      test: {
        stdout: true,
        command: "npm run test"
      },

      /**
       * Firefox
       */
      build_firefox_debug: {
        options: {
          stderr: false
        },
        command: [
          'mkdir -p ' + path.dist_firefox,
          './node_modules/.bin/web-ext build -s=' + path.build + ' -a=' + path.dist_firefox + '  -o=true',
          'mv ' + path.dist_firefox + firefoxWebExtBuildName + '-' + manifestVersion + '.zip ' + path.dist_firefox + 'passbolt-' + pkg.version + '-debug.zip',
          'rm -f ' + path.dist_firefox + 'passbolt-latest@passbolt.com.zip',
          'ln -fs passbolt-' + pkg.version + '-debug.zip ' + path.dist_firefox + 'passbolt-latest@passbolt.com.zip',
          "echo '\nMoved to " + path.dist_firefox + "passbolt-" + pkg.version + "-debug.zip'"
        ].join(' && ')
      },
      build_firefox_prod: {
        options: {
          stderr: false
        },
        command: [
          'mkdir -p ' + path.dist_firefox,
          './node_modules/.bin/web-ext build -s=' + path.build + ' -a=' + path.dist_firefox + '  -o=true',
          'mv ' + path.dist_firefox + firefoxWebExtBuildName + '-' + manifestVersion + '.zip ' + path.dist_firefox + '/passbolt-' + pkg.version + '.zip',
          "echo '\nMoved to " + path.dist_firefox + "passbolt-" + pkg.version + ".zip'"
        ].join(' && ')
      },

      /**
       * Chrome
       */
      build_chromium_mv2_debug: {
        options: {
          stderr: false
        },
        command: [
          'mkdir -p ' + path.dist_chromium_mv2,
          './node_modules/.bin/crx pack ' + path.build + ' -p key.pem -o ' + path.dist_chromium_mv2 + 'passbolt-' + pkg.version + '-debug.crx',
          'rm -f ' + path.dist_chromium_mv2 + 'passbolt-latest@passbolt.com.crx',
          'ln -fs passbolt-' + pkg.version + '-debug.crx ' + path.dist_chromium_mv2 + 'passbolt-latest@passbolt.com.crx'
        ].join(' && ')
      },
      build_chromium_mv2_prod: {
        options: {
          stderr: false
        },
        command: [
          'mkdir -p ' + path.dist_chromium_mv2,
          'zip -q -1 -r ' + path.dist_chromium_mv2 + 'passbolt-' + pkg.version + '.zip ' + path.build,
          './node_modules/.bin/crx pack ' + path.build + ' -p key.pem -o ' + path.dist_chromium_mv2 + 'passbolt-' + pkg.version + '.crx ',
          "echo '\nZip and Crx files generated in " + path.dist_chromium_mv2 + "'"
        ].join(' && ')
      },
      /**
       * Chrome MV3
       */
      build_chromium_mv3_debug: {
        options: {
          stderr: false
        },
        command: [
          'mkdir -p ' + path.dist_chromium_mv3,
          './node_modules/.bin/crx pack ' + path.build + ' -p key.pem -o ' + path.dist_chromium_mv3 + 'passbolt-' + pkg.version + '-debug.crx',
          'rm -f ' + path.dist_chromium_mv3 + 'passbolt-latest@passbolt.com.crx',
          'ln -fs passbolt-' + pkg.version + '-debug.crx ' + path.dist_chromium_mv3 + 'passbolt-latest@passbolt.com.crx'
        ].join(' && ')
      },
      build_chromium_mv3_prod: {
        options: {
          stderr: false
        },
        command: [
          'mkdir -p ' + path.dist_chromium_mv3,
          'zip -q -1 -r ' + path.dist_chromium_mv3 + 'passbolt-' + pkg.version + '.zip ' + path.build,
          './node_modules/.bin/crx pack ' + path.build + ' -p key.pem -o ' + path.dist_chromium_mv3 + 'passbolt-' + pkg.version + '.crx ',
          "echo '\nZip and Crx files generated in " + path.dist_chromium_mv3 + "'"
        ].join(' && ')
      }
    }
  });
};
