// Dev switch: "Load demo data: Manish / Sunita", and the plan the engine computes from it.
import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Amount } from '@/components/Amount';
import { GhostButton, PrimaryButton } from '@/components/Buttons';
import { Screen } from '@/components/Screen';
import { GlassCard, Row } from '@/components/Surfaces';
import { Body, Caption, H1 } from '@/components/Text';
import { WORD, WORD_COLOR } from '@/dev/labData';
import { demoAppData, sunitaWithdrawalSpec } from '@/data/demo';
import { withdrawalLikely } from '@/engine/withdrawal';
import { formatINR } from '@/lib/formatINR';
import { usePlan } from '@/plan/usePlan';
import { loadDemo, useProfileStore } from '@/state/stores';
import { colors } from '@/theme/tokens';

export default function DemoData() {
  const profile = useProfileStore((s) => s.profile);
  const { plan, rangesReady } = usePlan();
  const [busy, setBusy] = useState(false);
  const load = async (who: 'manish' | 'sunita') => {
    setBusy(true);
    await loadDemo(demoAppData(who));
    setBusy(false);
  };
  return (
    <Screen background="night" scroll>
      <H1>Demo data</H1>
      <Body>Loaded: {profile ? `${profile.name}, ${profile.age}` : 'nothing'}. Data lives in the encrypted database on this phone.</Body>
      <View style={styles.buttons}>
        <PrimaryButton label="Load demo data: Manish" state={busy ? 'loading' : 'idle'} onPress={() => load('manish')} />
        <GhostButton label="Load demo data: Sunita" onPress={() => load('sunita')} />
      </View>
      {plan ? (
        <GlassCard>
          <Body color={colors.text}>
            {plan.onTrack} of {plan.total} goals on track {rangesReady ? '' : '(ranges loading…)'}
          </Body>
          {plan.goals.map((g) => (
            <Row
              key={g.goalId}
              title={g.name}
              detail={`${WORD[g.affordability]} · needs ${g.requiredMonthly != null ? formatINR(g.requiredMonthly) : "—"} a month`}
              right={<Amount value={g.actualMonthly} variant="label" color={WORD_COLOR[g.affordability]} />}
            />
          ))}
          {profile?.work === 'retired' ? <Caption>Money likely lasts until {withdrawalLikely(sunitaWithdrawalSpec()).lastsUntil}.</Caption> : null}
        </GlassCard>
      ) : null}
      <GhostButton label="Back" onPress={() => router.back()} />
    </Screen>
  );
}

const styles = StyleSheet.create({ buttons: { marginVertical: 20, gap: 4 } });
