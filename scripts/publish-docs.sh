#!/bin/bash

make doc && \
rm -rf tmp && \
cp -R doc/code tmp && \
rm -rf doc/code && \
git checkout doc/config && \
git checkout gh-pages && \
cp -R tmp/* . && \
rm -rf tmp && \
git add . && \
git commit -a -m "Update docs - `date -u`" && \
git push origin gh-pages && \
git checkout master
