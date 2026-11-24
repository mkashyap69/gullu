/**
 * The five-tab bar: Home, Goals, Payday (Income for retirees), Wealth, You. Labels 11px,
 * active white, idle white at 55%. The active icon does a small bounce on select.
 * `active={null}` shows no active tab (pushed screens, Known design fix 4).
 */
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withSpring } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { haptics } from '../motion/haptics';
import { useReduceMotion } from '../motion/prefs';
import { family } from '../theme/fonts';
import { spring } from '../theme/motion';
import { colors, components } from '../theme/tokens';
import { Icon, type IconName } from './Icon';
import { PressScale } from './Pressable';

export type TabKey = 'home' | 'goals' | 'payday' | 'wealth' | 'you';

function Tab({ icon, label, active, onPress }: { icon: IconName; label: string; active: boolean; onPress: () => void }) {
  const reduce = useReduceMotion();
  const s = useSharedValue(1);
  useEffect(() => {
    if (active && !reduce) s.value = withSequence(withSpring(1.18, spring.press), withSpring(1, spring.bouncy));
  }, [active, reduce, s]);
  const a = useAnimatedStyle(() => ({ transform: [{ scale: s.value }] }));
  const color = active ? colors.text : colors.navIdle;
  return (
    <PressScale
      onPress={() => {
        if (!active) haptics.selection();
        onPress();
      }}
      accessibilityRole="tab"
      accessibilityLabel={label}
      accessibilityState={{ selected: active }}
      style={styles.tab}
    >
      <Animated.View style={a}>
        <Icon name={icon} size={components.navIcon.icon} color={color} />
      </Animated.View>
      <Animated.Text style={[styles.label, { color }]} maxFontSizeMultiplier={1.3}>
        {label}
      </Animated.Text>
    </PressScale>
  );
}

export function TabBar({ active, retiree, onSelect }: { active: TabKey | null; retiree?: boolean; onSelect: (t: TabKey) => void }) {
  const insets = useSafeAreaInsets();
  const tabs: { key: TabKey; icon: IconName; label: string }[] = [
    { key: 'home', icon: 'home', label: 'Home' },
    { key: 'goals', icon: 'goals', label: 'Goals' },
    retiree ? { key: 'payday', icon: 'income', label: 'Income' } : { key: 'payday', icon: 'payday', label: 'Payday' },
    { key: 'wealth', icon: 'wealth', label: 'Wealth' },
    { key: 'you', icon: 'you', label: 'You' },
  ];
  return (
    <View style={[styles.bar, { paddingBottom: Math.max(insets.bottom, 8) }]} accessibilityRole="tablist">
      {tabs.map((t) => (
        <Tab key={t.key} icon={t.icon} label={t.label} active={active === t.key} onPress={() => onSelect(t.key)} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', justifyContent: 'space-around', paddingTop: 8 },
  tab: { minWidth: 56, minHeight: 48, alignItems: 'center', justifyContent: 'center', gap: 3 },
  label: { fontSize: 11, lineHeight: 14, fontFamily: family['500'] },
});
