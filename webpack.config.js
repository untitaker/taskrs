var webpack = require("webpack");

module.exports = {
    externals: [
        {xmlhttprequest: "{XMLHttpRequest:XMLHttpRequest}"}
    ],
    plugins: [
        new webpack.optimize.UglifyJsPlugin({
            compress: { warnings: false }
        }),
    ]
};
