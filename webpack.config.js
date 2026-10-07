const path = require('path');
const TerserPlugin = require('terser-webpack-plugin');
const pixiDirectory = path.dirname(require.resolve('pixi.js'));

module.exports = {
    entry: path.join(__dirname, 'src/index.js'),
    experiments: { outputModule: true },
    output: {
        path: path.join(__dirname, 'dist/'),
        filename: 'index.js',
        chunkFilename: '[name].js',
        publicPath: 'auto',
        uniqueName: 'live2dPlus',
        module: true,
        clean: true,
    },
    resolve: {
        alias: {
            // The lipsync patch and filters must share Pixi's own core/display
            // instances, regardless of npm's hoisted or nested folder layout.
            '@pixi/core$': require.resolve('@pixi/core', { paths: [pixiDirectory] }),
            '@pixi/display$': require.resolve('@pixi/display', { paths: [pixiDirectory] }),
        },
    },
    module: {
        rules: [
            {
                // Bundle the legacy Live2D core runtime libraries as raw source
                // strings. They are injected into the page as global-scope
                // <script> blobs at runtime (see src/live2d.js), so they must
                // not be transpiled or wrapped in a module closure.
                test: /\.js$/,
                include: path.join(__dirname, 'src', 'lib'),
                type: 'asset/source',
            },
            {
                test: /\.js/,
                exclude: [/node_modules/, path.join(__dirname, 'src', 'lib')],
                options: {
                    cacheDirectory: true,
                    presets: [
                        '@babel/preset-env',
                        ['@babel/preset-react', { runtime: 'automatic' }],
                    ],
                },
                loader: 'babel-loader',
            },
        ],
    },
    optimization: {
        minimize: true,
        minimizer: [new TerserPlugin({
            extractComments: true,
        })],
    },
};
