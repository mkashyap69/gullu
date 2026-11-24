/**
 * Notification pre-prompt after 1.7 (07-NOTIFICATIONS-WIDGETS: no permission prompt until the end of
 * onboarding, with a screen that says what they're for). Copy drafted for owner review.
 * Local notifications only: nothing is sent to or from a server.
 */
import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { GhostButton, PrimaryButton } from '@/components/Buttons';
import { Rise } from '@/components/Rise';
import { Screen } from '@/components/Screen';
import { Body, H1 } from '@/components/Text';
import { Gullu } from '@/gullu/Gullu';
import { useSettingsStore } from '@/state/stores';

export default function Notify() {
  const update = useSettingsStore((s) => s.update);
  const [busy, setBusy] = useState(false);
  const finish = async (on: boolean) => {
    if (on) {
      setBusy(true);
      try {
        const res = await Notifications.requestPermissionsAsync();
        await update({ notifications: res.granted });
      } catch {
        await update({ notifications: false });
      }
    } else {
      await update({ notifications: false });
    }
    router.replace('/home');
  };
  return (
    <Screen
      background="dusk"
      footer={
        <>
          <PrimaryButton testID="notify-on" label="Turn on reminders" state={busy ? 'loading' : 'idle'} onPress={() => finish(true)} />
          <GhostButton label="Not now" onPress={() => finish(false)} />
        </>
      }
    >
      <View style={styles.hero}>
        <Gullu size={180} expression="wave" />
      </View>
      <Rise index={0}>
        <H1>Want a nudge on payday?</H1>
      </Rise>
      <Rise index={1}>
        <Body>I&apos;ll remind you when money lands and when it&apos;s placed. At most 2 a week, never about markets. They&apos;re made on this phone, nothing is sent anywhere.</Body>
      </Rise>
    </Screen>
  );
}

const styles = StyleSheet.create({ hero: { alignItems: 'center', marginTop: 60, marginBottom: 24 } });
