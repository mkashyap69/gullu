// motion-audit: fade-only (opacity/colour only, or follows the finger; kept with reduced motion)
/**
 * 1.2 About you (dusk). Age is a wheel with haptic ticks; pills slide a shared selected background;
 * choosing Retired cross-fades the helper line and changes the step count.
 * Income and spending rows are additions (owner decision 24 Nov 2026), copy drafted.
 */
import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';

import { AmountField } from '@/components/AmountField';
import { PrimaryButton } from '@/components/Buttons';
import { SegmentedPills } from '@/components/Pill';
import { Rise } from '@/components/Rise';
import { Screen } from '@/components/Screen';
import { ScrubValue } from '@/components/ScrubValue';
import { Body, Caption, H1 } from '@/components/Text';
import type { Work } from '@/engine/types';
import { duration } from '@/theme/motion';
import { colors } from '@/theme/tokens';
import { OnboardingTop } from '@/screens/onboarding/OnboardingTop';
import { useOnboarding } from '@/state/onboarding';

export default function AboutYou() {
  const s = useOnboarding();
  const retired = s.work === 'retired';
  const ready = s.monthlyExpenses > 0 && (retired || s.monthlyIncome > 0);
  return (
    <Screen
      background="dusk"
      scroll
      footer={<PrimaryButton testID="about-next" label="Next" disabled={!ready} onPress={() => router.push('/onboarding/risk')} />}
    >
      <OnboardingTop step="about" />
      <Rise index={0}>
        <H1>First, a little about you.</H1>
      </Rise>
      <View style={styles.row}>
        <Body color={colors.text}>Age</Body>
        <ScrubValue typeable testID="about-age" accessibilityLabel="Age" value={s.age} onChange={(age) => s.set({ age })} min={18} max={90} format={String} />
      </View>
      <Caption style={styles.label}>Work</Caption>
      <SegmentedPills<Work>
        testID="about-work"
        value={s.work}
        onChange={(work) => s.set({ work })}
        options={[
          { value: 'salaried', label: 'Salaried' },
          { value: 'business', label: 'Business' },
          { value: 'freelance', label: 'Freelance' },
          { value: 'retired', label: 'Retired' },
        ]}
      />
      <Caption style={styles.label}>People who depend on you</Caption>
      <SegmentedPills
        testID="about-deps"
        value={String(Math.min(3, s.dependents))}
        onChange={(v) => s.set({ dependents: Number(v) })}
        options={[
          { value: '0', label: 'None' },
          { value: '1', label: '1' },
          { value: '2', label: '2' },
          { value: '3', label: '3+' },
        ]}
      />
      {!retired ? (
        <>
          <Caption style={styles.label}>Payday</Caption>
          <SegmentedPills
            testID="about-payday"
            value={String(s.payday)}
            onChange={(v) => s.set({ payday: Number(v), incomeVaries: Number(v) === -1 })}
            options={[
              { value: '1', label: '1st' },
              { value: '7', label: '7th' },
              { value: '0', label: 'Last day' },
              { value: '-1', label: 'It varies' },
            ]}
          />
          <AmountField testID="about-income" label="Take-home pay a month" value={s.monthlyIncome} onChange={(monthlyIncome) => s.set({ monthlyIncome })} />
        </>
      ) : null}
      <AmountField testID="about-spending" label="Spending a month" value={s.monthlyExpenses} onChange={(monthlyExpenses) => s.set({ monthlyExpenses })} />
      <View style={styles.helper}>
        <Animated.View key={retired ? 'r' : 'w'} entering={FadeIn.duration(duration.base)} exiting={FadeOut.duration(duration.fast)}>
          <Caption>{retired ? "Got it. Next, I'll plan the income you take each month." : "Retired? I'll set up a monthly income plan instead."}</Caption>
        </Animated.View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 28, minHeight: 48 },
  label: { marginTop: 22, marginBottom: 10 },
  helper: { marginTop: 18, minHeight: 40 },
});
