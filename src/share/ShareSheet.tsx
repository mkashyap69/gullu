/**
 * Share a card (receipt, milestone, level up). Amounts are hidden by default; a toggle shows them.
 * The system share sheet is the only way out: nothing is uploaded.
 */
import { useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';

import { GhostButton, PrimaryButton } from '@/components/Buttons';
import { Sheet } from '@/components/Sheet';
import { Body, Caption, Label } from '@/components/Text';
import { Toggle } from '@/components/Toggle';

import { shareCard, type Card } from './shareCard';

export function ShareSheet({ card, open, onClose }: { card: Card; open: boolean; onClose: () => void }) {
  const [show, setShow] = useState(false);
  return (
    <Sheet open={open} onClose={onClose}>
      <View style={styles.sheet}>
        <Label>Share this card</Label>
        <Body>{card.title}</Body>
        <Toggle label="Show amounts" detail="Off: every rupee figure is hidden on the card" value={show} onChange={setShow} />
        <PrimaryButton
          label="Share"
          onPress={async () => {
            await shareCard(card, show);
            onClose();
          }}
        />
        {Platform.OS === 'web' ? <Caption>Sharing works on your phone.</Caption> : null}
        <GhostButton label="Not now" onPress={onClose} />
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({ sheet: { gap: 12 } });
