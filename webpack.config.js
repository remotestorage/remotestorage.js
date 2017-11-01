var webpack = require('webpack');
var isProd = (process.env.NODE_ENV === 'production');

var PACKAGE = require('./package.json');
var banner =  'remotestorage.js ' + PACKAGE.version +
              ', ' + PACKAGE.homepage +
              ', ' + PACKAGE.license + ' licensed';

// minimize only in production
var plugins = isProd ? [
  new webpack.optimize.UglifyJsPlugin({minimize: true}),
  new webpack.BannerPlugin(banner)
] : [];

module.exports = {
  entry: ['./src/remotestorage.js'],
  devtool: isProd ? '#source-map' : '#eval-source-map',
  output: {
    filename: 'release/remotestorage.js',
    // global export name if needed
    library: 'RemoteStorage',
    libraryTarget: 'umd',
    umdNamedDefine: true
  },
  // the only external dependecy is xmlhttprequest because it is
  // different in browser and in node env so user has to manage with that
  externals: [ 'xmlhttprequest' ],
  plugins: plugins,

  // using babel to transpile ES6
  module: {
    loaders: [
      {
        test: /\.js$/,
        exclude: /node_modules/,
        loader: 'babel-loader',
        query: {
          presets: ['es2015'],
          plugins: ['babel-plugin-array-includes']
        }
      }
    ]
  }
};
