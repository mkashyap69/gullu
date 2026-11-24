// Signature moment 2 · The answer (1.7). The screen itself lives in src/screens/AnswerScreen.tsx.
import { router } from 'expo-router';

import { AnswerScreen } from '@/screens/AnswerScreen';

export default function AnswerMoment() {
  return <AnswerScreen replayable onDone={() => router.push('/dev/moments/home-rings')} />;
}
