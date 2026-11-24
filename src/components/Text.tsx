/**
 * Text variants. Two sizes per screen (03-DESIGN-SYSTEM.md rule 2): pick from Big, H1, Body,
 * Caption, Micro, Label. Inter only. Dynamic type up to 1.3× (Big caps at 1.15×).
 */
import type { ReactNode } from 'react';
import { Text as RNText, type TextProps, type TextStyle } from 'react-native';

import { family, type Weight } from '../theme/fonts';
import { colors, type as typeScale } from '../theme/tokens';

type Variant = keyof typeof typeScale;

export function textStyle(variant: Variant, color: string = colors.text, weight?: Weight): TextStyle {
  const t = typeScale[variant];
  const w = (weight ?? t.fontWeight) as Weight;
  return {
    fontSize: t.fontSize,
    lineHeight: t.lineHeight,
    letterSpacing: 'letterSpacing' in t ? t.letterSpacing : undefined,
    fontFamily: family[w],
    color,
  };
}

type Props = TextProps & { children?: ReactNode; color?: string; weight?: Weight; center?: boolean; numeric?: boolean };

function make(variant: Variant, defaultColor: string, maxScale = 1.3) {
  function V({ color = defaultColor, weight, center, numeric, style, ...rest }: Props) {
    return (
      <RNText
        maxFontSizeMultiplier={maxScale}
        {...rest}
        style={[
          textStyle(variant, color, weight),
          center ? { textAlign: 'center' } : null,
          numeric ? { fontVariant: ['tabular-nums'] } : null,
          style,
        ]}
      />
    );
  }
  V.displayName = `Text.${variant}`;
  return V;
}

export const Big = make('big', colors.text, 1.15);
export const H1 = make('h1', colors.text);
export const Body = make('body', colors.textBody);
export const Label = make('label', colors.text);
export const Caption = make('caption', colors.textCaption);
export const Micro = make('micro', colors.textCaption);
