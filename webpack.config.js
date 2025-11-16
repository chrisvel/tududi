const path = require('path');
const ReactRefreshWebpackPlugin = require('@pmmmwh/react-refresh-webpack-plugin');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const CopyWebpackPlugin = require('copy-webpack-plugin');
const webpack = require('webpack');

const isDevelopment = process.env.NODE_ENV !== 'production';

module.exports = {
    entry: './frontend/index.tsx',
    cache: {
        type: 'filesystem',
        buildDependencies: {
            config: [__filename],
        },
    },
    output: {
        path: path.resolve(__dirname, 'dist'),
        filename: '[name].[contenthash].js',
        publicPath: '',
        clean: true,
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
        proxy: [
            {
                context: ['/api', '/locales'],
                target: 'http://localhost:3002',
                changeOrigin: true,
                secure: false,
                cookieDomainRewrite: 'localhost',
                headers: {
                    'Access-Control-Allow-Origin': '*',
                },
                onProxyRes: function (proxyRes, req, res) {
                    proxyRes.headers['Access-Control-Allow-Origin'] =
                        'http://localhost:8080';
                    proxyRes.headers['Access-Control-Allow-Credentials'] =
                        'true';
                },
            },
        ],
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
        new webpack.DefinePlugin(
            Object.fromEntries(
                Object.entries({
                    ENABLE_NOTE_COLOR: process.env.ENABLE_NOTE_COLOR,
                    TUDUDI_BASE_PATH: process.env.TUDUDI_BASE_PATH || '',
                }).map(([key, value]) => [
                    `process.env.${key}`,
                    JSON.stringify(value),
                ])
            )
        ),
        new HtmlWebpackPlugin({
            title: 'tududi',
            filename: 'index.html',
            template: 'public/index.html',
            templateParameters: {
                BASE_PATH: process.env.TUDUDI_BASE_PATH || '',
            },
        }),
        new CopyWebpackPlugin({
            patterns: [
                {
                    from: 'public',
                    to: '',
                    globOptions: {
                        ignore: ['**/index.html'],
                    },
                },
            ],
        }),
    ].filter(Boolean),
    module: {
        rules: [
            {
                test: /\.(js|jsx|ts|tsx)$/,
                exclude: /node_modules/,
                use: {
                    loader: 'swc-loader',
                    options: {
                        jsc: {
                            parser: {
                                syntax: 'typescript',
                                tsx: true,
                                decorators: false,
                                dynamicImport: true,
                            },
                            transform: {
                                react: {
                                    runtime: 'automatic',
                                    development: isDevelopment,
                                    refresh: isDevelopment,
                                },
                            },
                            target: 'es2018',
                        },
                        module: {
                            type: 'es6',
                        },
                    },
                },
            },
            {
                test: /\.css$/i,
                use: ['style-loader', 'css-loader', 'postcss-loader'],
            },
        ],
    },
    mode: isDevelopment ? 'development' : 'production',
};
