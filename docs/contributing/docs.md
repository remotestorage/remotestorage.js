# Documentation

The documentation for remoteStorage.js comes from two different sources:

1. Markdown documents in the `docs/` folder for normal pages
2. TypeDoc comments in the source code, which are also rendered as Markdown pages when updating the website

The pages are then transformed into a functional website using [VitePress](https://vitepress.dev/). Please refer to the VitePress documentation for available [Markdown extensions](https://vitepress.dev/guide/markdown), [configuring the sidebar menu](https://vitepress.dev/reference/default-theme-sidebar), and more.

## Contributing

You can just edit any Markdown document or TypeDoc comment and propose the changes in a new pull request. No need to build the docs locally if you don't want to.

## Local preview

There is a local setup in this repository for previewing the rendered output. A live preview with automatic reloading upon changes can be started using this command:

```sh
npm run docs:dev
```

If you want to edit TypeDoc comments and have the changes appear in your local preview, then you also have to run this command:

```sh
typedoc --watch
```

## Publishing

The rs.js documentation on https://remotestorage.io/rs.js/docs/ is published from the [remotestorage/website](https://github.com/remotestorage/website/) repo. This repository is included as a submodule in the website repo, so that there is no duplication of content or builds.

This means that any merged rs.js docs changes currently require a manual update of the website repository in order to be visible in the public docs.

> [!NOTE]
> The process of updating the website automatically, whenever rs.js docs changes are merged, will be automated soon
