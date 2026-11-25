/**
 * Home-screen and lock-screen widgets (07, 9.4). Each layout is a `'widget'` function: it is
 * compiled to a string and runs in the widget's own runtime, so it may only use its props and the
 * Expo UI components (no closures, no app imports at runtime). Data comes from one snapshot written
 * by `publishWidgetSnapshot()`. Widgets are static: no animation beyond what the OS does.
 */
import { Gauge, HStack, Spacer, Text, VStack } from '@expo/ui/swift-ui';
import { containerBackground, font, foregroundStyle, gaugeStyle, lineLimit, padding, widgetURL } from '@expo/ui/swift-ui/modifiers';
import { Column, Row, Text as CText } from '@expo/ui/jetpack-compose';
import { fillMaxSize, paddingAll, background } from '@expo/ui/jetpack-compose/modifiers';
import { createWidget, type WidgetEnvironment } from 'expo-widgets';
import { Platform } from 'react-native';

import type { WidgetSnapshot } from './snapshot';

/** Status: small "Goals · 3 of 4 · on track", medium goal rows, large summary, lock-screen circle. */
function StatusIOS(p: WidgetSnapshot, env: WidgetEnvironment) {
  'widget';
  const dusk = { type: 'linearGradient' as const, colors: ['#1A0B3B', '#7A2E5A', '#F0833A'], startPoint: { x: 0.5, y: 0 }, endPoint: { x: 0.5, y: 1 } };
  const soft = foregroundStyle('#FFFFFFB3');
  const white = foregroundStyle('#FFFFFF');
  const amber = foregroundStyle('#FFC83D');
  if (env.widgetFamily === 'accessoryCircular') {
    return (
      <Gauge value={p.total ? p.onTrack / p.total : 0} currentValueLabel={<Text>{`${p.onTrack}/${p.total}`}</Text>} modifiers={[gaugeStyle('circularCapacity'), widgetURL(p.links.goals)]}>
        <Text>goals</Text>
      </Gauge>
    );
  }
  if (env.widgetFamily === 'accessoryInline') return <Text modifiers={[widgetURL(p.links.goals)]}>{`${p.onTrack}/${p.total} goals on track`}</Text>;
  if (env.widgetFamily === 'accessoryRectangular') {
    return (
      <VStack alignment="leading" modifiers={[widgetURL(p.links.goals)]}>
        <Text modifiers={[font({ weight: 'bold' })]}>{`${p.onTrack}/${p.total} goals`}</Text>
        <Text>{p.progress}</Text>
      </VStack>
    );
  }
  const rows = p.goals.map((g) => (
    <HStack key={g.id}>
      <Text modifiers={[white, font({ size: 14 })]}>{g.name}</Text>
      <Spacer />
      <Text modifiers={[g.short ? amber : soft, font({ size: 14, weight: 'semibold' })]}>{g.status}</Text>
    </HStack>
  ));
  if (env.widgetFamily === 'systemMedium') {
    return (
      <VStack alignment="leading" spacing={6} modifiers={[containerBackground(dusk, 'widget'), widgetURL(p.links.goals)]}>
        <Text modifiers={[soft, font({ size: 13 })]}>{`Money Plan · goals ${p.count} on track`}</Text>
        {rows}
      </VStack>
    );
  }
  if (env.widgetFamily === 'systemLarge') {
    return (
      <VStack alignment="leading" spacing={10} modifiers={[containerBackground(dusk, 'widget'), widgetURL(p.links.home)]}>
        <Text modifiers={[white, font({ size: 24, weight: 'heavy' })]}>{p.headline}</Text>
        {p.focus ? <Text modifiers={[soft, font({ size: 15 })]}>{p.focus}</Text> : null}
        {rows}
        <Spacer />
        {p.payday.due ? (
          <HStack modifiers={[widgetURL(p.links.payday)]}>
            <Text modifiers={[white, font({ size: 16, weight: 'bold' })]}>{`${p.payday.amount} landed`}</Text>
            <Spacer />
            <Text modifiers={[white, font({ size: 16, weight: 'bold' })]}>Place it</Text>
          </HStack>
        ) : null}
      </VStack>
    );
  }
  return (
    <VStack alignment="leading" spacing={2} modifiers={[containerBackground(dusk, 'widget'), widgetURL(p.links.goals)]}>
      <Text modifiers={[soft, font({ size: 13 })]}>Goals</Text>
      <Text modifiers={[white, font({ size: 34, weight: 'heavy' })]}>{p.count}</Text>
      <Text modifiers={[soft, font({ size: 13 })]}>on track</Text>
    </VStack>
  );
}

/** Payday: small "Payday · ₹55,000 · to place · tap to start"; lock screen rectangular and inline. */
function PaydayIOS(p: WidgetSnapshot, env: WidgetEnvironment) {
  'widget';
  const ember = { type: 'linearGradient' as const, colors: ['#2E1767', '#8A2A4E', '#DA4E16', '#FF9A2E'], startPoint: { x: 0.5, y: 0 }, endPoint: { x: 0.5, y: 1 } };
  const soft = foregroundStyle('#FFFFFFCC');
  const white = foregroundStyle('#FFFFFF');
  const title = p.payday.due ? 'Payday today' : 'Next payday';
  if (env.widgetFamily === 'accessoryInline') return <Text modifiers={[widgetURL(p.links.payday)]}>{`Payday · ${p.payday.amount} to place`}</Text>;
  if (env.widgetFamily === 'accessoryRectangular') {
    return (
      <VStack alignment="leading" modifiers={[widgetURL(p.links.payday)]}>
        <Text modifiers={[font({ weight: 'bold' })]}>{title}</Text>
        <Text>{`${p.payday.amount} to place`}</Text>
      </VStack>
    );
  }
  return (
    <VStack alignment="leading" spacing={2} modifiers={[containerBackground(ember, 'widget'), widgetURL(p.links.payday)]}>
      <Text modifiers={[soft, font({ size: 13 })]}>Payday</Text>
      <Text modifiers={[white, font({ size: 26, weight: 'heavy' }), lineLimit(1)]}>{p.payday.amount}</Text>
      <Text modifiers={[soft, font({ size: 12 })]}>{p.payday.due ? 'to place · tap to start' : 'when it lands'}</Text>
    </VStack>
  );
}

/** One goal (the user picks which): "Education · ₹6 L short". */
function GoalIOS(p: WidgetSnapshot, env: WidgetEnvironment<{ goal: string }>) {
  'widget';
  const violet = { type: 'linearGradient' as const, colors: ['#0B0A1F', '#3A1D7A', '#6A3CC9'], startPoint: { x: 0.5, y: 0 }, endPoint: { x: 0.5, y: 1 } };
  const picked = env.configuration?.goal;
  const g = p.goals.find((x) => x.id === picked) ?? p.goals.find((x) => x.short) ?? p.goals[0];
  if (!g) return <Text>Add a goal</Text>;
  return (
    <VStack alignment="leading" spacing={4} modifiers={[containerBackground(violet, 'widget'), widgetURL(`moneyplan://goal/${g.id}`), padding({ all: 2 })]}>
      <Text modifiers={[foregroundStyle('#FFFFFFB3'), font({ size: 13 })]}>{g.name}</Text>
      <Text modifiers={[foregroundStyle(g.short ? '#FFC83D' : '#FFFFFF'), font({ size: 22, weight: 'heavy' })]}>{g.status}</Text>
    </VStack>
  );
}

/** This month's moves: "April moves · 4 of 7 done · Next: S&P 500 fund · ₹4,500". */
function MovesIOS(p: WidgetSnapshot) {
  'widget';
  const ember = { type: 'linearGradient' as const, colors: ['#2E1767', '#8A2A4E', '#DA4E16'], startPoint: { x: 0.5, y: 0 }, endPoint: { x: 0.5, y: 1 } };
  const m = p.moves;
  return (
    <VStack alignment="leading" spacing={6} modifiers={[containerBackground(ember, 'widget'), widgetURL(p.links.checkIn)]}>
      <Text modifiers={[foregroundStyle('#FFFFFF'), font({ size: 17, weight: 'bold' })]}>{m ? `${m.month} moves · ${m.done} of ${m.total} done` : 'No moves this month yet'}</Text>
      {m && m.next ? <Text modifiers={[foregroundStyle('#FFFFFFCC'), font({ size: 14 })]}>{`Next: ${m.next}`}</Text> : null}
      {m && !m.next ? <Text modifiers={[foregroundStyle('#FFFFFFCC'), font({ size: 14 })]}>All done</Text> : null}
    </VStack>
  );
}

/** Android (Compose): the same content, simpler. */
function StatusAndroid(p: WidgetSnapshot) {
  'widget';
  return (
    <Column modifiers={[fillMaxSize(), background('#3A1D5A'), paddingAll(12)]}>
      <CText color="#FFFFFFB3" style={{ fontSize: 13 }}>{`Money Plan · goals ${p.count} on track`}</CText>
      {p.goals.map((g) => (
        <Row key={g.id}>
          <CText color="#FFFFFF" style={{ fontSize: 14 }}>{`${g.name}  `}</CText>
          <CText color={g.short ? '#FFC83D' : '#FFFFFFB3'} style={{ fontSize: 14 }}>{g.status}</CText>
        </Row>
      ))}
    </Column>
  );
}

function PaydayAndroid(p: WidgetSnapshot) {
  'widget';
  return (
    <Column modifiers={[fillMaxSize(), background('#8A2A4E'), paddingAll(12)]}>
      <CText color="#FFFFFFCC" style={{ fontSize: 13 }}>Payday</CText>
      <CText color="#FFFFFF" style={{ fontSize: 24, fontWeight: 'bold' }}>{p.payday.amount}</CText>
      <CText color="#FFFFFFCC" style={{ fontSize: 12 }}>{p.payday.due ? 'to place · tap to start' : 'when it lands'}</CText>
    </Column>
  );
}

const ios = Platform.OS === 'ios';
export const statusWidget = createWidget<WidgetSnapshot>('MoneyPlanStatus', ios ? StatusIOS : StatusAndroid);
export const paydayWidget = createWidget<WidgetSnapshot>('MoneyPlanPayday', ios ? PaydayIOS : PaydayAndroid);
export const goalWidget = ios ? createWidget<WidgetSnapshot, { goal: string }>('MoneyPlanGoal', GoalIOS) : null;
export const movesWidget = ios ? createWidget<WidgetSnapshot>('MoneyPlanMoves', MovesIOS) : null;
