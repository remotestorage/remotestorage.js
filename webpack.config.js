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

module.exports = {
  entry: ['./src/remotestorage.js'],
  devtool: isProd ? 'source-map' : 'eval',
  output: {
    path: path.resolve(__dirname, 'release'),
    filename: 'remotestorage.js',
    // global export name if needed
    library: 'RemoteStorage',
    libraryTarget: 'umd',
    umdNamedDefine: true
  },
  // the only external dependecy is xmlhttprequest because it is
  // different in browser and in node env so user has to manage with that
  externals: [ 'xmlhttprequest' ],
  plugins: plugins,

  module: {
    rules: [
      {
        test: /\.js$/,
        exclude: /node_modules/,
        use: {
          loader: 'babel-loader',
          options: {
            presets: ['es2015'],
            plugins: ['babel-plugin-array-includes']
          }
        }
      }
    ]
  }
};
