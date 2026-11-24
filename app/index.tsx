// Entry: a fresh install starts onboarding; a saved plan opens Home.
import { Redirect } from 'expo-router';

import { useProfileStore } from '@/state/stores';

export default function Index() {
  const profile = useProfileStore((s) => s.profile);
  return <Redirect href={profile ? '/home' : '/onboarding/welcome'} />;
}
