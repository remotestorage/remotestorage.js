# remoteStorage.js Release Checklist

* Create changelog since last release
    * Collect and summarize changes using `git log <LAST RELEASE TAG>..HEAD`
    * Add changes to `CHANGELOG.md`
* If new files were added to `test/unit/`, then add them to `.travis.yml`
* If new files were added to `src/`, then add them to `build/components.json`: once in `files` and once in `groups`
* Verify tests are green: `npm test`
* Bump version in `src/version.js`
* Bump version in `package.json`
* Build everything: `make all`
* Manually test all browsers you have access to, including mobile devices and private browsing mode
* Manually test the special build files (.amd.js, .nocache.js)
* Copy build files into `/release/head/`
* Create release dir in `/release` and move build files there
* Commit changes to Git and `git push origin master`
* Tag version in Git: `git tag x.x.x` and push to GitHub master: `git push origin master --tags`
* Publish release on GitHub
    * Go to https://github.com/remotestorage/remotestorage.js/tags and click "add release notes"
    * Use version string as title and changelog items as description
    * For RCs and betas, tick the "This is a pre-release" option on the bottom
* Publish to npm (https://www.npmjs.org/package/remotestoragejs):
  * `npm publish`
* Publish release on remotestorage.io
    * `git up`
    * While in the gh-pages branch:
        * Copy the release from the remotestorage.js repo into `release/` dir
        * `rm -rf doc/*`
        * Copy `/doc/code` from remoteStorage.js repo to `doc/code`
        * Commit changes to Git
    * While back in master branch:
        * Update version number, links, file size in `views/integrate/_hero.jade`
        * Commit changes to Git
        * Run `./deploy`
        * `git push origin master`
* Update shim repo (for bower) with new release (components-remotestorage)
    * Add release files
    * Update version in config files (bower.json & package.json)
    * Commit
    * Tag new version
    * `git push origin master --tags`
* Update https://github.com/remotestorage/myfavoritedrinks to use new release
    * Replace `remotestorage.js` with new release build
    * Check if everything is still working
    * Commit
    * `git push origin`
    * `git push 5apps master`
* Announce release on community forums
    * Create a new topic in "remoteStorage.js Core" similar to e.g. this one: http://community.remotestorage.io/t/remotestorage-js-0-8-3-released/95
* Link release announcement on forums from
    * Unhosted mailing list
    * Twitter
    * IRC
