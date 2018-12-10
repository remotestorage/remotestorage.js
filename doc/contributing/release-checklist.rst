Release checklist
=================

.. highlight:: bash

* Build library and manually test all browsers you have access to, including
  mobile devices and private browsing mode

* Create changelog since last release

    * Collect and summarize changes using e.g.::

         git log --no-merges <LAST RELEASE TAG>..HEAD

    * Add changes to `CHANGELOG.md`
    * Commit to Git

* Run ``npm version patch|minor|major|x.x.x-rc1``. This will automatically:

    * run the test suite
    * update the version in package.json
    * update the version in bower.json
    * create a release build
    * commit everything using version as commit description
    * create a Git tag for the version
    * push the release commit and tag to GitHub

* Publish release notes on GitHub

    * Go to https://github.com/remotestorage/remotestorage.js/tags and click "Add release notes"
    * Use version string as title and changelog items as description
    * For RCs and betas, tick the "This is a pre-release" option on the bottom
    * These notes will automatically be posted `to the community forums
      <https://community.remotestorage.io/t/release-updates-for-rs-libraries/433>`
      after a while

* Publish to npm (https://www.npmjs.org/package/remotestoragejs)::

     npm publish

* Update https://github.com/remotestorage/myfavoritedrinks to use new release

    * Replace ``remotestorage.js`` file with new release build
    * Check if everything is still working
    * Commit
    * ``git push origin``
    * ``git push 5apps master``

* Link release announcement on Mastodon (remoteStorage@kosmos.social). This
  will automatically cross-post to Twitter and IRC.

* If it's an important release, also notify the Unhosted mailing list
