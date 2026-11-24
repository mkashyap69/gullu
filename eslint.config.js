// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

const NO_NETWORK = 'Money Plan is fully offline: no network calls (CLAUDE.md).';

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['dist/*', 'reference/*', 'design/*', 'seed/*', 'node_modules/*', '.expo/*', 'coverage/*'],
  },
  {
    files: ['src/**/*.{ts,tsx}', 'app/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-globals': [
        'error',
        { name: 'fetch', message: NO_NETWORK },
        { name: 'XMLHttpRequest', message: NO_NETWORK },
        { name: 'WebSocket', message: NO_NETWORK },
        { name: 'EventSource', message: NO_NETWORK },
      ],
      'no-restricted-syntax': [
        'error',
        { selector: "MemberExpression[property.name='fetch']", message: NO_NETWORK },
        { selector: "MemberExpression[property.name='XMLHttpRequest']", message: NO_NETWORK },
        { selector: "MemberExpression[property.name='WebSocket']", message: NO_NETWORK },
        { selector: "MemberExpression[property.name='sendBeacon']", message: NO_NETWORK },
      ],
      'no-restricted-imports': [
        'error',
        {
          paths: [
            { name: 'axios', message: NO_NETWORK },
            { name: 'expo-network', message: NO_NETWORK },
            { name: 'expo-updates', message: NO_NETWORK },
            { name: '@react-native-community/netinfo', message: NO_NETWORK },
          ],
          patterns: [
            { group: ['@sentry/*', '@segment/*', '@amplitude/*', 'firebase', '@react-native-firebase/*'], message: NO_NETWORK },
          ],
        },
      ],
    },
  },
]);
