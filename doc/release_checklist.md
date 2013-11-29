# remoteStorage.js Release Checklist

* Create changelog since last release
    * Collect and summarize changes using `git log <LAST RELEASE TAG>..HEAD`
    * Add changes to `CHANGELOG.md`
* Verify tests are green: `npm test`
* Bump version in `src/version.js`
* Bump version in `package.json`
* Build everything: `make all`
* Create release dir in `/release` and move build files there
* Commit changes to Git
* Tag version in Git: `git tag x.x.x` and push to GitHub master: `git push --tags`
* Publish release on GitHub
    * Go to https://github.com/remotestorage/remotestorage.js/tags and click "add release notes"
    * Use version string as title and changelog items as description
    * For RCs, tick the "This is a pre-release" option on the bottom
* Publish release on remotestorage.io
    * While in the gh-pages branch:
        * Copy the release from the remotestorage.js repo into `release/` dir
        * `rm -rf doc/`
        * Copy `/doc/code` from remoteStorage.js repo to `doc/code`
        * Commit docs and release to Git
    * While back in master branch:
        * Update version number, links, file size in `views/integrate/_hero.jade`
        * Run `./deploy`
* Update shim repo with new release (components-remotestorage)
    * Add release files
    * Update version in config files
    * Commit
    * Tag new version
    * `git push --tags`
* Announce release on community forums
    * Create a new topic in "remoteStorage.js Core" similar to e.g. this one: http://community.remotestorage.io/t/remotestorage-js-0-8-3-released/95
* Link release announcement on forums from
    * Unhosted mailing list
    * Twitter
    * IRC
