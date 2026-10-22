const path = require('node:path');
const web = path.resolve(__dirname, '../jellyfin-web-tizen-fix');
const config = require(path.join(web, 'webpack.prod.js'));
const TerserPlugin = require(path.join(web, 'node_modules/minimizer-webpack-plugin'));
config.parallelism = 2;
config.optimization = {
    ...config.optimization,
    minimizer: [new TerserPlugin({ parallel: 2 })]
};
module.exports = config;
