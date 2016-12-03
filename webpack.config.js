var webpack = require('webpack');
var isProd = (process.env.NODE_ENV === 'production');

// minimize only in production
var plugins = []// isProd ? [new webpack.optimize.UglifyJsPlugin({minimize: true})] : []

module.exports = {
  entry: ['bluebird', './src/remotestorage.js'],
  devtool: isProd ? '#source-map' : '#eval-source-map',
  output: {
    filename: __dirname + '/release/' + (isProd?'stable':'head') + '/remotestorage.js',
    library: 'RemoteStorage',
    libraryTarget: 'umd',
    umdNamedDefine: true
  },
  externals: [ 'xmlhttprequest' ],
  plugins: plugins,
  module: {
    loaders: [
      {
        test: /\.js$/,
        exclude: /node_modules/,
        loader: 'babel-loader',
        query: {
          presets: ['es2015']
        }

      }
    ]
  }
};
