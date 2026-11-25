import { useFonts } from 'expo-font';
import { DarkTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { ScreenBackground } from '@/components/ScreenBackground';
import { Body } from '@/components/Text';
import { isMemoryDb, openDb } from '@/data/db';
import { demoAppData } from '@/data/demo';
import { FpsOverlay } from '@/dev/FpsOverlay';
import { useBackgroundStore } from '@/state/background';
import { setDb } from '@/state/dbHolder';
import { applyAppData, hydrate, useSettingsStore } from '@/state/stores';
import { interFonts } from '@/theme/fonts';

SplashScreen.preventAutoHideAsync().catch(() => undefined);

// Screens are transparent: the gradient lives in one persistent layer behind the navigator.
const theme = { ...DarkTheme, colors: { ...DarkTheme.colors, background: 'transparent', card: 'transparent' } };

export default function RootLayout() {
  const [fontsLoaded] = useFonts(interFonts);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const variant = useBackgroundStore((s) => s.variant);
  const fps = useSettingsStore((s) => s.fpsOverlay);

  useEffect(() => {
    (async () => {
      setDb(await openDb());
      if (isMemoryDb) {
        // Web preview: no encrypted database in the browser, so it starts fresh in memory
        // (or with a demo persona: ?demo=manish / ?demo=sunita).
        const demo = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('demo') : null;
        applyAppData(demo === 'manish' || demo === 'sunita' ? demoAppData(demo) : null);
        setReady(true);
        return;
      }
      await hydrate();
      setReady(true);
    })().catch((e: unknown) => setError(String(e)));
  }, []);

  useEffect(() => {
    if ((fontsLoaded && ready) || error) SplashScreen.hideAsync().catch(() => undefined);
  }, [fontsLoaded, ready, error]);

  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        <StatusBar style="light" />
        <ScreenBackground variant={variant} />
        {error ? (
          <View style={styles.center}>
            <Body center>{error}</Body>
          </View>
        ) : fontsLoaded && ready ? (
          <ThemeProvider value={theme}>
            <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: 'transparent' }, animation: 'default' }}>
              <Stack.Screen name="(tabs)" options={{ animation: 'fade' }} />
              <Stack.Screen name="goal/[id]" options={{ animation: 'fade' }} />
              <Stack.Screen name="goal/day/[id]" options={{ animation: 'fade' }} />
              <Stack.Screen name="market-fall" options={{ animation: 'fade' }} />
              <Stack.Screen name="milestone" options={{ animation: 'fade' }} />
              <Stack.Screen name="level-up" options={{ animation: 'fade' }} />
              <Stack.Screen name="payday/why/[id]" options={{ animation: 'fade' }} />
              <Stack.Screen name="payday/values" options={{ animation: 'fade' }} />
              <Stack.Screen name="payday/receipt" options={{ animation: 'fade' }} />
              <Stack.Screen name="wealth/year" options={{ animation: 'fade' }} />
              <Stack.Screen name="dev/moments/goal-detail" options={{ animation: 'fade' }} />
              <Stack.Screen name="dev/moments/receipt" options={{ animation: 'fade' }} />
            </Stack>
          </ThemeProvider>
        ) : null}
        {fps ? <FpsOverlay /> : null}
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#07060D' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
});
