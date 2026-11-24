/** GlassCard (white at 8%, radius 20–28, no border) and Row (60px min, dot/icon, chevron, press highlight). */
import type { ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { colors, components, layout, radius, space } from '../theme/tokens';
import { Icon } from './Icon';
import { PressScale } from './Pressable';
import { Body, Caption } from './Text';

export function GlassCard({ children, style, strong }: { children: ReactNode; style?: StyleProp<ViewStyle>; strong?: boolean }) {
  return <View style={[styles.glass, strong && { backgroundColor: colors.glassStrong }, style]}>{children}</View>;
}

export function Row({
  title,
  detail,
  right,
  dot,
  chevron,
  onPress,
  left,
}: {
  title: string;
  detail?: string;
  right?: ReactNode;
  dot?: string;
  chevron?: boolean;
  onPress?: () => void;
  left?: ReactNode;
}) {
  const body = (
    <View style={styles.row}>
      {dot ? <View style={[styles.dot, { backgroundColor: dot }]} /> : null}
      {left}
      <View style={styles.rowText}>
        <Body color={colors.text}>{title}</Body>
        {detail ? <Caption>{detail}</Caption> : null}
      </View>
      {right}
      {chevron ? <Icon name="chevron" size={18} color={colors.textCaption} /> : null}
    </View>
  );
  if (!onPress) return body;
  return (
    <PressScale onPress={onPress} accessibilityRole="button" accessibilityLabel={title}>
      {body}
    </PressScale>
  );
}

const styles = StyleSheet.create({
  glass: { backgroundColor: colors.glass, borderRadius: radius.lg, padding: space.lg - 4 },
  row: { minHeight: layout.rowMinHeight, flexDirection: 'row', alignItems: 'center', gap: space.sm },
  rowText: { flex: 1 },
  dot: { width: components.dot, height: components.dot, borderRadius: components.dot / 2 },
});
