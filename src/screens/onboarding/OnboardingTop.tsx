// Onboarding top bar: back on the left, step dots on the right (Known design fix 6: dots match the steps).
import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Icon } from '../../components/Icon';
import { PressScale } from '../../components/Pressable';
import { StepDots } from '../../components/StepDots';
import { steps, useOnboarding } from '../../state/onboarding';

export function OnboardingTop({ step, onBack }: { step: 'about' | 'risk' | 'goals' | 'have' | 'monthly'; onBack?: () => void }) {
  const work = useOnboarding((s) => s.work);
  const list = steps(work);
  return (
    <View style={styles.bar}>
      <PressScale onPress={onBack ?? (() => router.back())} accessibilityRole="button" accessibilityLabel="Back" testID="onboarding-back">
        <Icon name="back" size={26} />
      </PressScale>
      <StepDots count={list.length} active={Math.max(0, list.indexOf(step))} />
    </View>
  );
}

const styles = StyleSheet.create({ bar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', minHeight: 44, marginBottom: 24 } });
