const path = require('path');
const webpack = require('webpack');
const pkg = require('./package.json');

const isProd = (process.env.NODE_ENV === 'production');

const banner =  'remotestorage.js ' + pkg.version +
              ', ' + pkg.homepage +
              ', ' + pkg.license + ' licensed';

// minimize only in production
const plugins = isProd ? [
  new webpack.BannerPlugin(banner)
] : [];

module.exports = (env = {}) => ({
  entry: [env.solid ? './src/remotestorage-solid.ts' : './src/remotestorage.ts'],
  devtool: 'source-map',
  // the only external dependecy is xmlhttprequest because it is
  // different in browser and in node env so user has to manage with that
  externals: ['xmlhttprequest'],
  plugins: plugins,
  module: {
    rules: [
      {
        test: /[/\\]solid\.ts$/,
        // Select the SDKs' ESM exports even though tsc emits require() for
        // Node. Their CommonJS bundles retain otherwise unused RDF APIs.
        resolve: { conditionNames: ['import', 'browser', 'webpack', 'default'] },
      },
      {
        test: /\.ts$/,
        use: 'ts-loader',
        exclude: /node_modules/,
      }
    ]
  },
  resolve: {
    extensions: ['.ts', '.mjs', '.js', '.json'],
  },
  output: {
    path: path.resolve(__dirname, 'release'),
    filename: env.solid ? 'remotestorage-solid.js' : 'remotestorage.js',
    library: {
      name: 'RemoteStorage',
      type: 'umd',
      export: 'default',
      umdNamedDefine: true,
    },
    globalObject: 'this'
  }
});
