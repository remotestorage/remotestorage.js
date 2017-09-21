Release Checklist
=================

* Create changelog since last release

    * Collect and summarize changes using `git log <LAST RELEASE TAG>..HEAD`
    * Add changes to `CHANGELOG.md`

* If new files were added to `test/unit/`, then add them to `.travis.yml`
* Verify tests are green: `npm test`
* Bump version in `src/version.js`
* Bump version in `package.json`
* Bump version in `bower.json`
* Build everything: `make all`
* Manually test all browsers you have access to, including mobile devices and private browsing mode
* Commit changes to Git and `git push origin master`
* Tag version in Git: `git tag x.x.x` and push to GitHub master: `git push origin master --tags`
* Publish release on GitHub

    * Go to https://github.com/remotestorage/remotestorage.js/tags and click "add release notes"
    * Use version string as title and changelog items as description
    * For RCs and betas, tick the "This is a pre-release" option on the bottom

* Publish docs on GitHub Pages
    * `./script/publish-docs`

* Publish to npm (https://www.npmjs.org/package/remotestoragejs):
  * `npm publish`

* Update https://github.com/remotestorage/myfavoritedrinks to use new release
    * Replace `remotestorage.js` with new release build
    * Check if everything is still working
    * Commit
    * `git push origin`
    * `git push 5apps master`

* Announce release on community forums
    * Create a new topic in "remoteStorage.js Core" similar to e.g. this one: http://community.remotestorage.io/t/remotestorage-js-0-8-3-released/95

* Link release announcement on
    * Unhosted mailing list
    * Mastodon/Fediverse
    * Twitter
    * IRC
