/** A typed rupee amount, formatted the Indian way as you type (₹1,60,000). Numeric keyboard. */
import { useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';

import { groupIndian } from '../lib/formatINR';
import { colors } from '../theme/tokens';
import { Body } from './Text';
import { textStyle } from './Text';

export function AmountField({
  label,
  value,
  onChange,
  testID,
  placeholder = '₹0',
  negative,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  testID?: string;
  placeholder?: string;
  negative?: boolean;
}) {
  const [focused, setFocused] = useState(false);
  const text = value > 0 ? `${negative ? '−' : ''}₹${groupIndian(value)}` : '';
  return (
    <View style={styles.row}>
      <Body color={colors.text} style={styles.label}>
        {label}
      </Body>
      <TextInput
        testID={testID}
        accessibilityLabel={label}
        value={text}
        placeholder={placeholder}
        placeholderTextColor={colors.textCaption}
        keyboardType="number-pad"
        inputMode="numeric"
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        onChangeText={(t) => onChange(Number(t.replace(/[^\d]/g, '')) || 0)}
        style={[textStyle('label', colors.text, '800'), styles.input, focused && styles.focused]}
        maxFontSizeMultiplier={1.3}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', minHeight: 56, gap: 12 },
  label: { flex: 1 },
  input: { width: 150, textAlign: 'right', paddingVertical: 8, paddingHorizontal: 10, borderRadius: 12, fontVariant: ['tabular-nums'] },
  focused: { backgroundColor: colors.glass },
});
