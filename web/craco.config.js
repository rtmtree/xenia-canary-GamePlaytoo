const path = require('path');

module.exports = {
  webpack: {
    configure: (webpackConfig, { env, paths }) => {
      // Handle WebAssembly files
      webpackConfig.experiments = {
        ...webpackConfig.experiments,
        asyncWebAssembly: true,
        syncWebAssembly: true,
      };

      // Add rule for WASM files
      webpackConfig.module.rules.push({
        test: /\.wasm$/,
        type: 'webassembly/async',
      });

      // Ensure WASM files are not processed by other loaders
      webpackConfig.module.rules.forEach(rule => {
        if (rule.oneOf) {
          rule.oneOf.forEach(oneOfRule => {
            if (oneOfRule.type === 'asset/resource') {
              oneOfRule.exclude = /\.(wasm)$/;
            }
          });
        }
      });

      // Copy WASM files to build directory
      webpackConfig.plugins.forEach(plugin => {
        if (plugin.constructor.name === 'CopyPlugin') {
          plugin.patterns.push({
            from: 'public/wasm',
            to: 'wasm',
            toType: 'dir'
          });
        }
      });

      return webpackConfig;
    },
  },
};
