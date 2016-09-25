module.exports = {
  entry: './src/init.js',
  devtool: 'source-map',
  output: {
    filename: __dirname + '/build/build.js',
    library: 'remotestoragejs',
    libraryTarget: 'umd',
    umdNamedDefine: true
  },
  externals: [ 'xmlhttprequest' ],
  resolve: {
    extensions: ['', '.js']
  }
};
