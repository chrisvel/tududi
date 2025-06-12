const path = require('path');
const webpack = require('webpack');
const ReactRefreshWebpackPlugin = require('@pmmmwh/react-refresh-webpack-plugin');
const HtmlWebpackPlugin = require('html-webpack-plugin');

const isDevelopment = process.env.NODE_ENV !== 'production';

module.exports = {
  entry: './frontend/index.tsx',
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: '[name].[contenthash].js',
    publicPath: '/',
    clean: true
  },
  resolve: {
    extensions: ['.tsx', '.ts', '.js'],
  },
  devServer: {
    static: {
      directory: path.join(__dirname, 'public'),
    },
    hot: isDevelopment,
    watchFiles: isDevelopment ? ['frontend/**/*'] : [],
    port: 8080,
    host: '0.0.0.0',
    historyApiFallback: true,
    proxy: [{
      context: ['/api', '/locales'],
      target: 'http://localhost:9292',
      changeOrigin: true,
      secure: false,
      cookieDomainRewrite: 'localhost',
      headers: {
        'Access-Control-Allow-Origin': '*'
      },
      onProxyRes: function(proxyRes, req, res) {
        proxyRes.headers['Access-Control-Allow-Origin'] = 'http://localhost:8080';
        proxyRes.headers['Access-Control-Allow-Credentials'] = 'true';
      }
    }],
    // Add middleware to log requests for translation files to help with debugging
    setupMiddlewares: (middlewares, devServer) => {
      if (!devServer) {
        throw new Error('webpack-dev-server is not defined');
      }

      devServer.app.get('/locales/*', (req, res, next) => {
        console.log('Translation file requested:', req.path);
        next();
      });

      return middlewares;
    },
  },
  plugins: [
    isDevelopment && new ReactRefreshWebpackPlugin(),
    isDevelopment && new webpack.HotModuleReplacementPlugin(),
    new HtmlWebpackPlugin({
      title: 'Tududi',
      filename: 'index.html',
      template: 'public/index.html'
    }),
  ].filter(Boolean),
  module: {
    rules: [
      {
        test: /\.(js|jsx|ts|tsx)$/,
        exclude: /node_modules/,
        use: [
          {
            loader: 'babel-loader',
            options: {
              presets: [
                '@babel/preset-env',
                '@babel/preset-react',
                '@babel/preset-typescript',
              ],
              plugins: [
                isDevelopment && 'react-refresh/babel',
              ].filter(Boolean),
            },
          },
        ],
      },
      {
        test: /\.css$/i,
        use: ['style-loader', 'css-loader', 'postcss-loader'],
      },
    ],
  },
  mode: isDevelopment ? 'development' : 'production',
};
