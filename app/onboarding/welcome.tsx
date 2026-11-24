/**
 * 1.1 Welcome (dusk). Gullu drops in from above the fold (squash-and-stretch landing), then waves
 * twice. Headline and body rise 12px and fade in, staggered 60ms; "Let's start" slides up last
 * but is tappable from the first frame. Ambient: the dusk gradient drifts.
 */
import { router } from 'expo-router';
import { useEffect, useRef } from 'react';
import { StyleSheet, View } from 'react-native';

import { GhostButton, PrimaryButton } from '@/components/Buttons';
import { Rise } from '@/components/Rise';
import { Screen } from '@/components/Screen';
import { Body, Caption, H1 } from '@/components/Text';
import { Gullu, type GulluHandle } from '@/gullu/Gullu';
import { useReduceMotion } from '@/motion/prefs';
import { useOnboarding } from '@/state/onboarding';
import { duration } from '@/theme/motion';

export default function Welcome() {
  const gullu = useRef<GulluHandle>(null);
  const reduce = useReduceMotion();
  useEffect(() => {
    useOnboarding.getState().reset();
    gullu.current?.land();
    // Wave once he has settled from the landing.
    const t = setTimeout(() => gullu.current?.wave(), reduce ? 0 : duration.base + duration.fast + duration.slow);
    return () => clearTimeout(t);
  }, [reduce]);
  return (
    <Screen
      background="dusk"
      footer={
        <>
          <Rise index={3} style={styles.full}>
            <PrimaryButton testID="welcome-start" label="Let's start" onPress={() => router.push('/onboarding/about')} />
          </Rise>
          <Rise index={4}>
            <Caption center>No sign-up. Your numbers stay on this phone.</Caption>
          </Rise>
          {__DEV__ ? <GhostButton label="Dev tools" onPress={() => router.push('/dev')} /> : null}
        </>
      }
    >
      <View style={styles.hero}>
        <Gullu ref={gullu} size={230} expression="wave" />
      </View>
      <Rise index={1}>
        <H1>Hi, I&apos;m Gullu.</H1>
      </Rise>
      <Rise index={2}>
        <Body>Tell me about you and your goals. I&apos;ll show you if your savings get you there, and give every rupee a job.</Body>
      </Rise>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { alignItems: 'center', marginTop: 70, marginBottom: 28 },
  full: { width: '100%' },
});
