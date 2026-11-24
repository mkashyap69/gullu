/**
 * Stroke icons on a 24 grid (1.9 stroke, round caps), from the set in design/html/*.dc.html.
 * Drawn with Skia paths; circles are written as two arcs so one SVG string covers each icon.
 */
import { Canvas, Group, Path, Skia } from '@shopify/react-native-skia';
import { useMemo } from 'react';

const circle = (cx: number, cy: number, r: number) => `M${cx - r} ${cy}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0`;

export const ICONS = {
  home: 'M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z',
  goals: `${circle(12, 12, 9)}${circle(12, 12, 5)}${circle(12, 12, 1)}`,
  payday: 'M12 3v10M8 9l4 4 4-4M5 14v4a3 3 0 0 0 3 3h8a3 3 0 0 0 3-3v-4',
  wealth: 'M12 3v9h9M21 12a9 9 0 1 1-9-9',
  you: `${circle(12, 8, 4)}M4 21a8 8 0 0 1 16 0`,
  bell: 'M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15zM10 20a2 2 0 0 0 4 0',
  close: 'M6 6l12 12M18 6 6 18',
  back: 'M15 5l-7 7 7 7',
  chevron: 'M9 5l7 7-7 7',
  check: 'M5 12.5l4.5 4.5L19 7.5',
  income: 'M12 21V11M8 15l4-4 4 4M5 10V6a3 3 0 0 1 3-3h8a3 3 0 0 1 3 3v4',
} as const;
export type IconName = keyof typeof ICONS;

export function Icon({ name, size = 22, color = '#FFFFFF', strokeWidth = 1.9 }: { name: IconName; size?: number; color?: string; strokeWidth?: number }) {
  const path = useMemo(() => Skia.Path.MakeFromSVGString(ICONS[name])!, [name]);
  const s = size / 24;
  return (
    <Canvas style={{ width: size, height: size }} pointerEvents="none">
      <Group transform={[{ scale: s }]}>
        <Path path={path} style="stroke" strokeWidth={strokeWidth} strokeCap="round" strokeJoin="round" color={color} />
      </Group>
    </Canvas>
  );
}
