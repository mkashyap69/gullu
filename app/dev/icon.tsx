/**
 * Dev only: renders the app icon art (Gullu `happy` on the dusk gradient) for
 * scripts/make-icons.mjs to capture. ?part=icon | fg | bg | mono | splash
 */
import { useLocalSearchParams } from 'expo-router';
import { View } from 'react-native';

import { GulluStill } from '@/gullu/Gullu';
import { gradients } from '@/theme/tokens';

export default function IconArt() {
  const { part = 'icon' } = useLocalSearchParams<{ part?: string }>();
  const size = 1024;
  const g = gradients.dusk;
  const bg = { backgroundImage: `linear-gradient(180deg, ${g.colors.map((c, i) => `${c} ${g.locations[i] * 100}%`).join(', ')})` } as object;
  const gullu = (s: number) => <GulluStill size={s} expression="happy" aura={part === 'icon'} />;
  return (
    <View testID="art" style={[{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }, part === 'icon' || part === 'bg' ? bg : { backgroundColor: 'transparent' }]}>
      {part === 'icon' ? gullu(700) : null}
      {part === 'fg' || part === 'splash' ? gullu(part === 'fg' ? 560 : 900) : null}
      {part === 'mono' ? <View style={{ filter: 'brightness(0) invert(1)' } as object}>{gullu(560)}</View> : null}
    </View>
  );
}
