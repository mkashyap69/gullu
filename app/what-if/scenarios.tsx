/**
 * 6.3 Scenarios (sky). Saved scenarios as cards; pick up to 3 (each lifts as it is picked), then
 * "Compare N" opens them side by side, goal by goal. Reduced motion: no lift, the table just appears.
 */
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, useAnimatedStyle, withSpring } from 'react-native-reanimated';

import { GhostButton, PrimaryButton } from '@/components/Buttons';
import { PressScale } from '@/components/Pressable';
import { Screen } from '@/components/Screen';
import { Body, Caption, H1, Label } from '@/components/Text';
import { LabTop } from '@/dev/LabTop';
import { compareScenario, describeChanges, scenarioResult, type Scenario } from '@/engine/scenario';
import { haptics } from '@/motion/haptics';
import { useReduceMotion } from '@/motion/prefs';
import { ringName } from '@/plan/selectors';
import { usePlanInput } from '@/plan/usePlan';
import { useScenarioStore } from '@/state/stores';
import { signature, spring } from '@/theme/motion';
import { colors, radius } from '@/theme/tokens';

function Card({ s, picked, onPress, line2, line3 }: { s: Scenario; picked: boolean; onPress: () => void; line2: string; line3: string }) {
  const reduce = useReduceMotion();
  const a = useAnimatedStyle(() => ({ transform: [{ scale: reduce ? 1 : withSpring(picked ? signature.liftScale : 1, spring.snappy) }] }));
  return (
    <PressScale onPress={onPress} accessibilityRole="checkbox" accessibilityState={{ checked: picked }} accessibilityLabel={s.name} testID={`scenario-${s.id}`}>
      <Animated.View style={[styles.card, picked && styles.picked, a]}>
        <Label>{s.name}</Label>
        <Body>{line2}</Body>
        <Caption color={colors.text}>{line3}</Caption>
      </Animated.View>
    </PressScale>
  );
}

export default function Scenarios() {
  const input = usePlanInput();
  const scenarios = useScenarioStore((s) => s.scenarios);
  const remove = useScenarioStore((s) => s.remove);
  const reduce = useReduceMotion();
  const [picked, setPicked] = useState<string[]>([]);
  const [comparing, setComparing] = useState(false);
  const results = useMemo(() => (input ? new Map(scenarios.map((s) => [s.id, compareScenario(input, s.changes)])) : new Map()), [input, scenarios]);
  if (!input) return null;
  const toggle = (id: string) => {
    haptics.selection();
    setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : p.length >= 3 ? p : [...p, id]));
  };
  const chosen = scenarios.filter((s) => picked.includes(s.id));

  if (comparing && chosen.length) {
    const goals = results.get(chosen[0].id)!.outcomes;
    return (
      <Screen background="sky" scroll footer={<GhostButton label="Back to scenarios" color={colors.text} onPress={() => setComparing(false)} />}>
        <LabTop icon="back" />
        <H1>Side by side</H1>
        <Animated.View entering={reduce ? undefined : FadeIn} style={styles.table}>
          <View style={styles.tr}>
            <Caption style={styles.th}>Goal</Caption>
            <Caption style={styles.td}>Now</Caption>
            {chosen.map((s) => (
              <Caption key={s.id} style={styles.td} color={colors.text} numberOfLines={2}>
                {s.name}
              </Caption>
            ))}
          </View>
          {goals.map((o: { goalId: string; name: string; before: string }) => (
            <View key={o.goalId} style={styles.tr}>
              <Body color={colors.text} style={styles.th} numberOfLines={1}>
                {ringName(o.name)}
              </Body>
              <Body style={styles.td}>{o.before}</Body>
              {chosen.map((s) => {
                const r = results.get(s.id)!.outcomes.find((x: { goalId: string }) => x.goalId === o.goalId);
                return (
                  <Label key={s.id} style={styles.td} color={r?.worse ? colors.stretch : colors.text}>
                    {r?.after ?? '—'}
                  </Label>
                );
              })}
            </View>
          ))}
        </Animated.View>
      </Screen>
    );
  }

  return (
    <Screen
      background="sky"
      footer={
        scenarios.length ? (
          <PrimaryButton label={picked.length >= 2 ? `Compare ${picked.length}` : 'Pick 2 or 3'} disabled={picked.length < 2} onPress={() => setComparing(true)} testID="scenarios-compare" />
        ) : (
          <PrimaryButton label="Try a what if" onPress={() => router.replace('/what-if')} />
        )
      }
    >
      <LabTop icon="back" />
      <H1>Your scenarios</H1>
      <Body>{scenarios.length ? 'Pick up to 3 to compare side by side.' : 'Scenarios you save in What if show up here.'}</Body>
      <ScrollView style={styles.list} contentContainerStyle={styles.listIn}>
        {scenarios.map((s) => (
          <View key={s.id}>
            <Card s={s} picked={picked.includes(s.id)} onPress={() => toggle(s.id)} line2={describeChanges(input, s.changes)} line3={scenarioResult(input, s.changes, results.get(s.id)!.outcomes)} />
            {picked.includes(s.id) ? <GhostButton label="Delete" onPress={() => { setPicked((p) => p.filter((x) => x !== s.id)); remove(s.id); }} /> : null}
          </View>
        ))}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { marginTop: 16 },
  listIn: { gap: 12, paddingBottom: 24 },
  card: { backgroundColor: colors.glass, borderRadius: radius.md, padding: 16, gap: 4, borderWidth: 1.5, borderColor: 'transparent' },
  picked: { borderColor: colors.white, backgroundColor: colors.glassStrong },
  table: { marginTop: 20, gap: 4 },
  tr: { flexDirection: 'row', alignItems: 'center', minHeight: 44, gap: 8 },
  th: { flex: 1.2 },
  td: { flex: 1, textAlign: 'right' },
});
