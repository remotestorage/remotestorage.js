# Contribution Guidelines

## Regarding work on remotestorage/* repositories

### General workflow

*  When you start  working  on an existing GitHub issue (or you plan on  doing that in the  immediate  future), assign it to yourself, so that  others can see it  and don't  start working on it themselves.
* When you create a branch to work on something, use the naming scheme described further down in this document.
* Never push directly to the `master` branch for any changes to the source code itself.
* As soon as you want others to review your changes, or even just discuss them, create a pull request. Don't forget to explain roughly what it is you're doing in that branch, i.e. what the problem/idea is and what the result is supposed to be when merging the changes. If necessary, or helpful, mention related discussions in other issues.
* A pull request can be merged as soon as at least two people with commit access to the repo have given their +1, meaning they reviewed and manually tested the changes and have no further improvements to suggest.

### Git workflow

#### Branching 

Branches on our organization repositories should be created using the following scheme:

`[bugfix|feature]/[issue id]-[description_with_underscores]`

So for example, if you want to work on fixing a bug with let's say initial sync, that is described in issue #423, the branch should look something like:

`bugfix/423-race_condition_on_initial_sync`

And if it's an enhancement to the widget it could look like this e.g.:

`feature/321-customizable_widget_content`

If there's no issue yet, create one first!

#### Rebase when pulling changes

Always use `--rebase` when pulling code from the org repo. That way your local changes are added on top of what's on the remote, avoiding merge commits and mixing up the commit history. You can also setup Git to use rebase by default by running `git config --global branch.autosetuprebase always` once.

The easiest way to update your local repository with all remote changes, including all branches – old and new – is a tool called [git-up](https://github.com/aanand/git-up). With that installed you can just run `git up` instead of `git pull [options]`, which will fetch all branches from all remotes and rebase your commits on top of them (as well as stash and unstash uncommitted code, if necessary).

#### Commit messages

* The first line of the message (aptly called "subject line" in Git terminology) should not be longer than 72 characters.
* If the subject line is not enough to describe the changes properly, add a blank line after the subject line and then as much text as you want, using normal language with capitalization, punctuation, etc.
* Always use messages that describe roughly *what* the changes is and, if not obvious, *why* this change leads to the desired result.
* Leave out any text that isn't directly associated with the changes, that the commit introduces. Examples: "as suggested by @chucknorris", "lol wtf was that", "not sure if this fixes it".
* Commit as much and often as possible locally (and with any message that helps you during your work), and then clean up the history and merge commits that belong together before pushing to the org repo. You can do that with `git rebase -i [ref]` ([learn more](http://www.reviewboard.org/docs/codebase/dev/git/clean-commits/#rewriting-history)).
* You can reference issues from commit messages by adding keywords with issue numbers. Certain keywords will even close the issue automatically, once a branch is merged into master. For example `Fix widget flickering when opening bubble (fixes #423)` will close issue #423 when appearing on the master branch at GitHub.

#### Reviewing pull requests

* Check if it works, if it has unit tests, if the tests pass, and if jshint and CodeClimate are happy.
* Check if the code is understandable, with clear and unambiguous names for functions and variables, and that it has (naturaldocs) comments and a changelog entry.
* If you use `git up`, like recommended above, it will automatically create tracked branches for all remote branches. So in order to review/test a branch on the org repo, just do `git checkout [branchname]`. You can then also add new commits to that branch and push them in order to add your changes to the pull request.
* If the pull request was issued from a user's own repository, you'll have to fetch the code from there, of course. If you haven't pulled from that user yet, you can add a new remote for the user with `git remote add [username] [repo-url]`. After that, `git up` will fetch code from that remote as well, so you can then check it out using `git checkout [username]/branchname`.

  (This will put you in a so-called 'detached HEAD' state, but don't worry, everything is fine! If you want to work on that code, just create a new branch from there with the command Git shows you then, or just go back to your code with e.g. `git checkout master` later.)

#### Merging pull requests

* Once a pull request has two +1s for the latest changes from collaborators, you can either merge it yourself or wait for somebody to do it for you (which will happen very soon).
* If the new commits and their commit messages in that branch all make sense on their own, you can use the merge button on GitHub directly.
* If there are a lot of small commits, which might not make sense on their own, or pollute the main project history (often the case with long running pull requests with a lot of additions during their lifetime), fetch the latest changes to your local machine, and either do an interactive rebase to clean up branch and merge normally, or use `git merge --squash` to squash them all into one commit during the merge.
* Whenever you squash multiple commits with either `git rebase -i` or `git merge --squash`, make sure to follow the commit message guidelines above. Don't just leave all old commit messages in there (which is the default), but delete them and create a new meaningful message for the whole changeset.
* When squashing/editing/amending other peoples' commits, use `--author` to set them as the original author. You don't need full names for that, but just something that Git can find in the history. It'll tell you if it can't find an author and let you do it again.

