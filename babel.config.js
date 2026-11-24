module.exports = function (api) {
  const isTest = api.env('test');
  api.cache.using(() => isTest);
  return {
    // In Jest the engine runs as plain JS: the worklets transform only slows the Monte Carlo down
    // ~10× there and adds nothing (no UI thread in tests).
    presets: [['babel-preset-expo', isTest ? { worklets: false } : {}]],
  };
};
