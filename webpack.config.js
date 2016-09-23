module.exports = {
  entry: './src/init.js',
  devtool: 'source-map',
  output: {
    filename: __dirname + '/build/build.js',
    library: 'RemoteStorage',
    libraryTarget: 'umd',
    umdNamedDefine: true
  },
  resolve: {
    extensions: ['', '.js']
  }
};
