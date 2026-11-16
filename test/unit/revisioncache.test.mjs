import 'mocha';
import { expect } from 'chai';

import RevisionCache from '../../build/revisioncache.js';

describe('RevisionCache', () => {
  let revCache;

  beforeEach(() => {
    revCache = new RevisionCache('rev');
  });

  it('#set with propagation enabled updates the revision of parent folders', () => {
    revCache.activatePropagation();
    revCache.set('/foo/bar', 1);

    expect(revCache.get('/foo/bar')).to.equal(1);
    expect(revCache.get('/foo/')).to.not.equal('rev');
    expect(revCache.get('/')).to.not.equal('rev');
  });

  it('#set with propagation disabled does not update the revision of parent folders', () => {
    revCache.deactivatePropagation();
    revCache.set('/foo/bar', 1);

    expect(revCache.get('/foo/bar')).to.equal(1);
    expect(revCache.get('/foo/')).to.equal('rev');
    expect(revCache.get('/')).to.equal('rev');
  });

  it('#delete with propagation enabled updates the revision of parent folders', () => {
    revCache.activatePropagation();
    revCache.set('/foo/bar', 1);
    const revFoo = revCache.get('/foo/');
    const revRoot = revCache.get('/');
    revCache.delete('/foo/bar');

    expect(revCache.get('/foo/bar')).to.equal(null);
    expect(revCache.get('/foo/')).to.not.equal(revFoo);
    expect(revCache.get('/')).to.not.equal(revRoot);
  });

  it('#delete with propagation disabled does not update the revision of parent folders', () => {
    revCache.deactivatePropagation();
    revCache.set('/foo/bar', 1);
    const revFoo = revCache.get('/foo/');
    const revRoot = revCache.get('/');
    revCache.delete('/foo/bar');

    expect(revCache.get('/foo/bar')).to.equal(null);
    expect(revCache.get('/foo/')).to.equal(revFoo);
    expect(revCache.get('/')).to.equal(revRoot);
  });

  it('#activatePropagation updates the revision of changed folders', () => {
    revCache.deactivatePropagation();
    revCache.set('/foo/bar', 1);
    revCache.activatePropagation();

    expect(revCache.get('/foo/')).to.not.equal('rev');
    expect(revCache.get('/')).to.not.equal('rev');
  });

  it('folders revision remain the same even if changes are not provided in the same order', () => {
    revCache.activatePropagation();
    revCache.set('/foo/bar', 1);
    revCache.set('/foo/bar2', 1);
    revCache.set('/foo/bar3', 1);
    revCache.set('/foo/bar4', 1);
    revCache.set('/foo2/bar', 1);
    revCache.set('/foo2/bar2', 1);
    revCache.set('/foo2/bar3', 1);
    revCache.set('/foo2/bar4', 1);
    const revFoo = revCache.get('/foo/');
    const revFoo2 = revCache.get('/foo2/');
    const revRoot = revCache.get('/');

    // Reapply changes in a different order against a fresh cache and confirm
    // that the resulting parent-folder revisions are stable
    revCache = new RevisionCache('rev');
    revCache.activatePropagation();
    revCache.set('/foo2/bar4', 1);
    revCache.set('/foo/bar3', 1);
    revCache.set('/foo2/bar3', 1);
    revCache.set('/foo/bar', 1);
    revCache.set('/foo/bar4', 1);
    revCache.set('/foo/bar2', 1);
    revCache.set('/foo2/bar2', 1);
    revCache.set('/foo2/bar', 1);

    expect(revCache.get('/foo/')).to.equal(revFoo);
    expect(revCache.get('/foo2/')).to.equal(revFoo2);
    expect(revCache.get('/')).to.equal(revRoot);
  });

  it('changes every ancestor revision when a file is renamed without changing its revision', () => {
    revCache.set('/folder/old-name', 'same-content');
    const folder = revCache.get('/folder/');
    const root = revCache.get('/');
    revCache.deactivatePropagation();
    revCache.delete('/folder/old-name');
    revCache.set('/folder/new-name', 'same-content');
    revCache.activatePropagation();
    expect(revCache.get('/folder/')).not.to.equal(folder);
    expect(revCache.get('/')).not.to.equal(root);
  });

  it('invalidates descendants of a deleted folder without deleting similar sibling names', () => {
    revCache.set('/folder/nested/file', 'one');
    revCache.set('/folder-sibling/file', 'two');
    revCache.delete('/FOLDER/');
    expect(revCache.get('/folder/nested/file')).to.equal(null);
    expect(revCache.get('/folder/nested/')).to.equal(null);
    expect(revCache.get('/folder/')).to.equal(null);
    expect(revCache.get('/folder-sibling/file')).to.equal('two');
    revCache.set('/folder/restored', 'three');
    expect(revCache.get('/folder/')).not.to.equal(null);
    expect(revCache.get('/folder/nested/file')).to.equal(null);
  });
});
