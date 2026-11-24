// Top bar for Motion lab moments: close/back on one side, Replay on the other.
import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Icon } from '../components/Icon';
import { PressScale } from '../components/Pressable';
import { Body } from '../components/Text';
import { colors } from '../theme/tokens';

export function LabTop({ icon = 'close', onReplay, right }: { icon?: 'close' | 'back' | 'none'; onReplay?: () => void; right?: string }) {
  return (
    <View style={styles.bar}>
      {icon === 'back' ? (
        <PressScale onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Back">
          <Icon name="back" size={26} />
        </PressScale>
      ) : onReplay ? (
        <PressScale onPress={onReplay} accessibilityRole="button" accessibilityLabel="Replay" style={styles.replay}>
          <Body color={colors.textGhost}>Replay</Body>
        </PressScale>
      ) : (
        <View />
      )}
      {icon === 'close' ? (
        <PressScale onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Close">
          <Icon name="close" size={26} />
        </PressScale>
      ) : right ? (
        <Body color={colors.text}>{right}</Body>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', minHeight: 44 },
  replay: { minHeight: 44, justifyContent: 'center' },
});
