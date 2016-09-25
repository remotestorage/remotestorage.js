var webpack = require('webpack');
var isProd = (process.env.NODE_ENV === 'production');

var plugins = isProd ? [new webpack.optimize.UglifyJsPlugin({minimize: true})] : []

module.exports = {
  entry: './src/init.js',
  devtool: !isProd && 'source-map',
  output: {
    filename: __dirname + '/build/build.js',
    library: 'RemoteStorage',
    libraryTarget: 'umd',
    umdNamedDefine: true
  },
  externals: [ 'xmlhttprequest' ],
  resolve: {
    extensions: ['', '.js']
  },
  plugins: plugins
};
