var webpack = require("webpack");

module.exports = {
    externals: [
        {xmlhttprequest: "{XMLHttpRequest:XMLHttpRequest}"}
    ],
    plugins: [
        //new webpack.optimize.UglifyJsPlugin({
            //compress: { warnings: false }
        //}),
    ],
    module: {
        rules: [
            {
                test: /\.js$/,
                exclude: /(node_modules|bower_components)/,
                use: {
                    loader: 'babel-loader',
                    options: {
                        plugins: ['transform-class-properties', 'transform-runtime'],
                        presets: ['es2015', 'es2017', 'react'],
                    }
                }
            }
        ]
    }
};
