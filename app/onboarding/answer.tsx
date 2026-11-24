// 1.7 Answer: the onboarding payoff. Workers see goals on track; retirees see how long the income lasts.
import { router } from 'expo-router';

import { AnswerScreen } from '@/screens/AnswerScreen';
import { RetireeAnswer } from '@/screens/RetireeAnswer';
import { useProfileStore } from '@/state/stores';

export default function Answer() {
  const retired = useProfileStore((s) => s.profile?.work === 'retired');
  const done = () => router.replace('/onboarding/notify');
  return retired ? <RetireeAnswer onDone={done} /> : <AnswerScreen onDone={done} />;
}
