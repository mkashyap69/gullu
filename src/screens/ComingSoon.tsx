// Placeholder for tabs built in later phases (Payday: 5, Wealth: 6, You: 7). Dev builds only show links.
import { router, type Href } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { GhostButton } from '../components/Buttons';
import { Screen } from '../components/Screen';
import type { GradientVariant } from '../components/ScreenBackground';
import { Body, H1 } from '../components/Text';
import { LabTop } from '../dev/LabTop';
import { Gullu } from '../gullu/Gullu';

export function ComingSoon({ title, body, background, links = [], back = false }: { title: string; body: string; background: GradientVariant; links?: { label: string; href: Href }[]; back?: boolean }) {
  return (
    <Screen background={background}>
      {back ? <LabTop icon="back" /> : null}
      <View style={styles.hero}>
        <Gullu size={160} expression="sleepy" />
      </View>
      <H1>{title}</H1>
      <Body>{body}</Body>
      <View style={styles.links}>
        {links.map((l) => (
          <GhostButton key={l.label} label={l.label} onPress={() => router.push(l.href)} />
        ))}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({ hero: { alignItems: 'center', marginTop: 40, marginBottom: 20 }, links: { marginTop: 16, alignItems: 'flex-start' } });
