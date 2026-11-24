/**
 * Web preview only: the gradient as CSS. Browsers cap live WebGL contexts (~16), and Skia gives
 * every canvas its own, so a Skia background is the first thing a busy web page loses. Phones use
 * the Skia version (ScreenBackground.tsx) with cross-fade and drift.
 */
import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet } from 'react-native';

import { gradients } from '../theme/tokens';

export type GradientVariant = keyof typeof gradients;

export function ScreenBackground({ variant }: { variant: GradientVariant }) {
  const g = gradients[variant];
  return <LinearGradient colors={[...g.colors] as [string, string, ...string[]]} locations={[...g.locations] as [number, number, ...number[]]} style={StyleSheet.absoluteFill} pointerEvents="none" />;
}
