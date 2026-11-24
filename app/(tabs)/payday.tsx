// Payday tab (4.x) is built in Phase 5. Until then: the Phase 2 prototype of the payday moment.
import { ComingSoon } from '@/screens/ComingSoon';

export default function PaydayTab() {
  return (
    <ComingSoon
      background="ember"
      title="Payday comes next."
      body="Placing this month's money, check-in and the receipt are Phase 5."
      links={__DEV__ ? [{ label: 'See the payday moment', href: '/dev/moments/payday' }] : []}
    />
  );
}
