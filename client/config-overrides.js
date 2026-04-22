module.exports = function override(config) {
  config.resolve.fallback = {
    ...config.resolve.fallback,
    http: require.resolve('stream-http'),
    stream: require.resolve('stream-browserify'),
  };
  return config;
};
