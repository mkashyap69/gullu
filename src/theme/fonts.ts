// Inter, bundled from @expo-google-fonts/inter (local TTFs: the app never loads fonts from the network).
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  Inter_800ExtraBold,
} from '@expo-google-fonts/inter';

export const interFonts = { Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold, Inter_800ExtraBold };

/** Android needs one family per weight; iOS accepts either. */
export const family = {
  '400': 'Inter_400Regular',
  '500': 'Inter_500Medium',
  '600': 'Inter_600SemiBold',
  '700': 'Inter_700Bold',
  '800': 'Inter_800ExtraBold',
} as const;
export type Weight = keyof typeof family;

/** The TTF used by Skia text (coin ₹ glyphs, chart labels). */
export const interBoldTtf = Inter_800ExtraBold;
export const interMediumTtf = Inter_500Medium;
