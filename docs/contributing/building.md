# Building

::: tip
We\'re using npm scripts for all common tasks, so check out the
`scripts` section in `package.json` to learn about what they\'re doing
exactly and what else is available.
:::

## Setup

```sh
$ npm install
```

## Development

```sh
$ npm run dev
```

This will watch `src/` for changes and build `remotestorage.js` in the
`release/` directory every time you save a source file. Useful for
testing rs.js changes with an app, for example by creating a symlink to
`release/remotestorage.js`.

This build includes [source
maps](https://www.html5rocks.com/en/tutorials/developertools/sourcemaps/)
directly, so you can easily place `debugger` statements in the code and
step through the actual source code in your browser\'s debugger tool.

## Production

```sh
$ npm run build:release
```

This creates the minified production build in `release/`.

It also creates a separate source maps file, which you can link to in
case you want to (e.g. to improve exception tracking/debugging in
production).

## Optional Solid bundle

```sh
$ npm run build:solid
```

This builds `release/remotestorage-solid.js`, which includes Solid login and
RDF dependencies. Applications offering Solid use this bundle instead of the
default bundle. The default build does not include these dependencies. See
[Solid storage](../solid) for connection requirements and validation steps.
