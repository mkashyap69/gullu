/**
 * Screen frame: safe areas plus the design frame's 30px top / 24px side padding. The gradient
 * itself is the persistent layer in the root layout; `background` picks it on focus.
 */
import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useScreenBackground } from '../state/background';
import { layout } from '../theme/tokens';
import type { GradientVariant } from './ScreenBackground';

export function Screen({
  background,
  children,
  scroll,
  footer,
  style,
}: {
  background: GradientVariant;
  children: ReactNode;
  scroll?: boolean;
  /** Pinned bottom area (primary button, tab bar). */
  footer?: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  useScreenBackground(background);
  const insets = useSafeAreaInsets();
  const pad = { paddingTop: insets.top + layout.screenPadding.top, paddingHorizontal: layout.screenPadding.horizontal };
  return (
    <View style={styles.fill}>
      {scroll ? (
        <ScrollView contentContainerStyle={[pad, { paddingBottom: layout.screenPadding.bottom }, style]} showsVerticalScrollIndicator={false}>
          {children}
        </ScrollView>
      ) : (
        <View style={[styles.fill, pad, style]}>{children}</View>
      )}
      {footer ? <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, layout.screenPadding.bottom) }]}>{footer}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  footer: { paddingHorizontal: layout.screenPadding.horizontal, gap: 4, alignItems: 'center' },
});
