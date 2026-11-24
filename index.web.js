// Web entry (dev previews only; the product is iOS/Android): load CanvasKit for Skia from the
// local bundle (public/canvaskit.wasm, copied by `npm run web:setup`), then start Expo Router.
import { LoadSkiaWeb } from '@shopify/react-native-skia/lib/module/web';

LoadSkiaWeb({ locateFile: (file) => `/${file}` }).then(() => {
  require('expo-router/entry');
});
