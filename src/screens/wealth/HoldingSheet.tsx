// Add or edit a holding of any kind (5.3, 5.6).
import { useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';

import { AmountField } from '../../components/AmountField';
import { PrimaryButton } from '../../components/Buttons';
import { SegmentedPills } from '../../components/Pill';
import { Label, textStyle } from '../../components/Text';
import { Toggle } from '../../components/Toggle';
import { ALL_CLASSES, type AssetClass, type Holding } from '../../engine/types';
import { CLASS_NAME } from '../../lib/classes';
import { useHoldingsStore } from '../../state/stores';
import { colors } from '../../theme/tokens';

export function HoldingSheet({ holding, today, onDone }: { holding?: Holding; today: number; onDone: () => void }) {
  const upsert = useHoldingsStore((s) => s.upsertHolding);
  const [name, setName] = useState(holding?.name ?? '');
  const [cls, setCls] = useState<AssetClass>(holding?.assetClass ?? 'indianEquity');
  const [value, setValue] = useState(holding?.value ?? 0);
  const [isStock, setIsStock] = useState(holding?.isStock ?? false);
  return (
    <View style={sheetStyles.sheet}>
      <Label>{holding ? 'Edit holding' : 'Add a holding'}</Label>
      <TextInput value={name} onChangeText={setName} placeholder="Name, as in your app" placeholderTextColor={colors.textCaption} style={[textStyle('body', colors.text), sheetStyles.name]} testID="holding-name" />
      <SegmentedPills<AssetClass> value={cls} onChange={setCls} options={ALL_CLASSES.map((c) => ({ value: c, label: CLASS_NAME[c] }))} />
      <AmountField label="Value today" value={value} onChange={setValue} testID="holding-value" />
      {cls === 'indianEquity' || cls === 'globalEquity' ? <Toggle label="A single company's stock" value={isStock} onChange={setIsStock} /> : null}
      <PrimaryButton
        label="Save"
        disabled={!name.trim() || value <= 0}
        onPress={async () => {
          const h: Holding = holding
            ? { ...holding, name: name.trim(), assetClass: cls, value, isStock, planned: cls !== 'other', valueAt: today }
            : { id: `h-${Date.now().toString(36)}`, name: name.trim(), type: isStock ? 'stock' : cls === 'cash' ? 'cash' : cls === 'gold' ? 'etf' : cls === 'other' ? 'other' : 'mutualFund', assetClass: cls, isStock, planned: cls !== 'other', value, valueAt: today, createdAt: today };
          await upsert(h);
          onDone();
        }}
      />
    </View>
  );
}


const sheetStyles = StyleSheet.create({
  sheet: { gap: 12 },
  name: { paddingVertical: 10, paddingHorizontal: 12, borderRadius: 12, backgroundColor: colors.glass },
});
