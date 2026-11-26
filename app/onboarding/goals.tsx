// motion-audit: fade-only (opacity/colour only, or follows the finger; kept with reduced motion)
/**
 * 1.4 Goals (dusk). Templates pre-ticked for the life stage. Rows enter with a 40ms stagger;
 * ticking draws the check path with a light haptic; unticked rows dim to 50%. Gullu peeks from the
 * corner and nods when a goal is added. Tap a goal to edit its name, amount and date.
 * The safety net and retirement stay in every plan (01-PRODUCT: goal 0, default for everyone).
 */
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { AmountField } from '@/components/AmountField';
import { GhostButton, PrimaryButton } from '@/components/Buttons';
import { PressScale } from '@/components/Pressable';
import { Rise } from '@/components/Rise';
import { Screen } from '@/components/Screen';
import { ScrubValue } from '@/components/ScrubValue';
import { Sheet } from '@/components/Sheet';
import { Body, Caption, H1, Label, textStyle } from '@/components/Text';
import { TickCircle } from '@/components/TickCircle';
import { MONTHS, ymMonth, ymYear } from '@/engine/dates';
import { TEMPLATES, type TemplateId } from '@/engine/onboarding';
import { Gullu, type GulluHandle } from '@/gullu/Gullu';
import { formatINR } from '@/lib/formatINR';
import { haptics } from '@/motion/haptics';
import { OnboardingTop } from '@/screens/onboarding/OnboardingTop';
import { seedGoals, useOnboarding, type DraftGoal } from '@/state/onboarding';
import { duration } from '@/theme/motion';
import { colors } from '@/theme/tokens';

const LOCKED: TemplateId[] = ['safety', 'retirement'];
const DOT: Partial<Record<TemplateId, string>> = {
  safety: colors.cash,
  home: colors.goal[0],
  education: colors.goal[2],
  retirement: colors.goal[3],
  travel: colors.goal[4],
  car: colors.goal[5],
  wedding: colors.goal[5],
  parents: colors.goal[1],
  health: colors.goal[1],
  legacy: colors.goal[2],
};

function detailFor(g: DraftGoal): string {
  if (g.template === 'safety' || g.template === 'retirement' || g.template === 'education' || g.template === 'home') return g.detail;
  return `${MONTHS[ymMonth(g.date)]} ${ymYear(g.date)}`;
}

function GoalRow({ g, index, onToggle, onEdit }: { g: DraftGoal; index: number; onToggle: () => void; onEdit: () => void }) {
  const dim = useSharedValue(g.ticked ? 1 : 0.5);
  useEffect(() => {
    dim.value = withTiming(g.ticked ? 1 : 0.5, { duration: duration.fast });
  }, [g.ticked, dim]);
  const a = useAnimatedStyle(() => ({ opacity: dim.value }));
  return (
    <Rise index={Math.min(index, 8)} delay={0}>
      <View style={styles.row}>
        <Animated.View style={[styles.rowMain, a]}>
          <PressScale onPress={onEdit} style={styles.rowMain} accessibilityRole="button" accessibilityLabel={`Edit ${g.name}`} testID={`goal-edit-${g.template}`}>
            <View style={[styles.dot, { backgroundColor: DOT[g.template] ?? colors.goal[0] }]} />
            <View style={styles.flex}>
              <Body color={colors.text}>{g.name}</Body>
              <Caption>{detailFor(g)}</Caption>
            </View>
          </PressScale>
        </Animated.View>
        <PressScale onPress={onToggle} accessibilityRole="checkbox" accessibilityState={{ checked: g.ticked }} accessibilityLabel={g.name} testID={`goal-tick-${g.template}`}>
          <TickCircle done={g.ticked} />
        </PressScale>
      </View>
    </Rise>
  );
}

function EditGoal({ goal, today, onSave, onClose }: { goal: DraftGoal; today: number; onSave: (g: DraftGoal) => void; onClose: () => void }) {
  const [name, setName] = useState(goal.name);
  const [target, setTarget] = useState(goal.targetToday);
  const [date, setDate] = useState(goal.date);
  const [retireAge, setRetireAge] = useState(goal.retireAge ?? 58);
  const age = useOnboarding((s) => s.age);
  const isRetirement = goal.template === 'retirement';
  const isSafety = goal.template === 'safety';
  return (
    <View style={styles.sheet}>
      <Label>Edit goal</Label>
      <TextInput
        value={name}
        onChangeText={setName}
        style={[textStyle('body', colors.text), styles.name]}
        accessibilityLabel="Goal name"
        testID="goal-name"
        placeholder="Name"
        placeholderTextColor={colors.textCaption}
        editable={!isSafety && !isRetirement}
      />
      {isSafety ? (
        <Caption>Your safety net is {formatINR(goal.targetToday)}: months of spending you can reach any time.</Caption>
      ) : isRetirement ? (
        <View style={styles.inline}>
          <Body color={colors.text}>Stop working at</Body>
          <ScrubValue accessibilityLabel="Retirement age" value={retireAge} onChange={setRetireAge} min={Math.max(age + 1, 40)} max={75} format={String} />
        </View>
      ) : (
        <>
          <AmountField label="Amount, in today's rupees" value={target} onChange={setTarget} testID="goal-target" />
          <View style={styles.inline}>
            <Body color={colors.text}>When</Body>
            <ScrubValue
              accessibilityLabel="Goal date"
              value={date}
              onChange={setDate}
              min={today + 3}
              max={today + 40 * 12}
              pxPerStep={8}
              tickEvery={12}
              format={(v) => `${MONTHS[ymMonth(v)]} ${ymYear(v)}`}
              testID="goal-date"
            />
          </View>
        </>
      )}
      <PrimaryButton
        testID="goal-save"
        label="Save"
        onPress={() =>
          onSave({
            ...goal,
            name: name.trim() || goal.name,
            targetToday: target,
            date: isRetirement ? today + (retireAge - age) * 12 : date,
            retireAge: isRetirement ? retireAge : goal.retireAge,
            detail: isRetirement ? `Stop working at ${retireAge}` : goal.template === 'education' ? `College in ${ymYear(date)}` : goal.detail,
          })
        }
      />
      <GhostButton label="Cancel" onPress={onClose} />
    </View>
  );
}

export default function Goals() {
  const s = useOnboarding();
  const gullu = useRef<GulluHandle>(null);
  const [editing, setEditing] = useState<number | null>(null);
  const [lockedNote, setLockedNote] = useState(false);
  useEffect(() => {
    useOnboarding.getState().set({ goals: seedGoals() });
  }, []);
  const goals = s.goals ?? [];
  const update = (idx: number, g: DraftGoal) => s.set({ goals: goals.map((x, i) => (i === idx ? g : x)) });
  const toggle = (idx: number) => {
    const g = goals[idx];
    if (LOCKED.includes(g.template)) {
      setLockedNote(true);
      return;
    }
    haptics.light();
    if (!g.ticked) gullu.current?.hop(); // Gullu nods when a goal is added
    update(idx, { ...g, ticked: !g.ticked });
  };
  return (
    <View style={styles.fill}>
      <Screen background="dusk" scroll footer={<PrimaryButton testID="goals-next" label="Next" onPress={() => router.push('/onboarding/have')} />}>
        <OnboardingTop step="goals" />
        <Rise index={0}>
          <H1>What are we saving for?</H1>
          <Body>I picked the usual ones for your stage. Untick any, or add your own.</Body>
        </Rise>
        <View style={styles.list}>
          {goals.map((g, i) => (
            <GoalRow key={`${g.template}-${i}`} g={g} index={i} onToggle={() => toggle(i)} onEdit={() => setEditing(i)} />
          ))}
        </View>
        <GhostButton
          label="+ Add your own"
          onPress={() => {
            const t = TEMPLATES.custom;
            const ctx = { today: s.today, age: s.age, work: s.work, monthlyExpenses: s.monthlyExpenses, retireAge: 58 };
            const g: DraftGoal = { template: 'custom', name: t.name, targetToday: t.target(ctx), date: s.today + t.inMonths(ctx), detail: t.detail(ctx), ticked: false };
            s.set({ goals: [...goals, g] });
            setEditing(goals.length);
          }}
        />
        {lockedNote ? <Caption style={styles.note}>Every plan keeps a safety net and retirement. You can change their amounts.</Caption> : null}
        <View style={{ height: 80 }} />
      </Screen>
      <View style={styles.peek} pointerEvents="none">
        <Gullu ref={gullu} size={96} aura={false} expression="happy" />
      </View>
      <Sheet open={editing != null} onClose={() => setEditing(null)}>
        {editing != null && goals[editing] ? (
          <EditGoal
            key={editing}
            goal={goals[editing]}
            today={s.today}
            onClose={() => setEditing(null)}
            onSave={(g) => {
              update(editing, { ...g, ticked: true });
              setEditing(null);
            }}
          />
        ) : null}
      </Sheet>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  list: { marginTop: 20 },
  row: { flexDirection: 'row', alignItems: 'center', minHeight: 64 },
  rowMain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 16 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  flex: { flex: 1 },
  note: { marginTop: 8 },
  peek: { position: 'absolute', right: -22, bottom: 110, transform: [{ rotate: '-12deg' }] },
  sheet: { gap: 12 },
  name: { paddingVertical: 10, paddingHorizontal: 12, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.08)' },
  inline: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', minHeight: 56 },
});
