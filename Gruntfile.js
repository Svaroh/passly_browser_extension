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
   * Load and enable Tasks
   */
  grunt.loadNpmTasks('grunt-shell');
  grunt.loadNpmTasks('grunt-contrib-clean');

  grunt.registerTask('build', ['build-firefox-prod', 'build-chromium-mv2-prod', 'build-chromium-mv3-prod']);

  grunt.registerTask('build-firefox', ['build-firefox-debug', 'build-firefox-prod']);
  grunt.registerTask('build-firefox-debug', ['clean:build', 'shell:bundle_firefox_debug']);
  grunt.registerTask('build-firefox-prod', ['clean:build', 'shell:bundle_firefox_prod']);

  grunt.registerTask('build-chromium-mv2', ['build-chromium-mv2-debug', 'build-chromium-mv2-prod']);
  grunt.registerTask('build-chromium-mv2-debug', ['clean:build', 'shell:bundle_chromium_mv2_debug']);
  grunt.registerTask('build-chromium-mv2-prod', ['clean:build', 'shell:bundle_chromium_mv2_prod']);

  grunt.registerTask('build-chromium-mv3', ['build-chromium-mv3-debug', 'build-chromium-mv3-prod']);
  grunt.registerTask('build-chromium-mv3-debug', ['clean:build', 'shell:bundle_chromium_mv3_debug']);
  grunt.registerTask('build-chromium-mv3-prod', ['clean:build', 'shell:bundle_chromium_mv3_prod']);

  grunt.registerTask('build-safari', ['build-safari-debug', 'build-safari-prod']);
  grunt.registerTask('build-safari-debug', ['clean:build', 'shell:bundle_safari_debug']);
  grunt.registerTask('build-safari-prod', ['clean:build', 'shell:bundle_safari_prod']);

  grunt.initConfig({
    pkg: grunt.file.readJSON('package.json'),

    clean: {
      build: ['build/all/**'],
    },

    shell: {
      options: { stderr: false },

      bundle_firefox_prod: { command: 'npm run build:firefox' },
      bundle_firefox_debug: { command: 'npm run dev:build:firefox' },
      bundle_chromium_mv2_prod: { command: 'npm run build:chromium-mv2' },
      bundle_chromium_mv2_debug: { command: 'npm run dev:build:chromium-mv2' },
      bundle_chromium_mv3_prod: { command: 'npm run build:chromium-mv3' },
      bundle_chromium_mv3_debug: { command: 'npm run dev:build:chromium-mv3' },
      bundle_safari_prod: { command: 'npm run build:safari' },
      bundle_safari_debug: { command: 'npm run dev:build:safari' },

      eslint: { command: 'npm run lint:eslint' },
      test: { stdout: true, command: 'npm run test' },
    },
  });
};
