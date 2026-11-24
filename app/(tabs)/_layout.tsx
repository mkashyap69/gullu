// The five tabs (01-PRODUCT information architecture): Home · Goals · Payday (Income for retirees) · Wealth · You.
// Pushed screens sit above the tabs, so the tab bar hides on them (Known design fix 4).
import { Tabs } from 'expo-router/js-tabs';

import { TabBar, type TabKey } from '@/components/TabBar';
import { useProfileStore } from '@/state/stores';

export default function TabsLayout() {
  const retiree = useProfileStore((s) => s.profile?.work === 'retired');
  return (
    <Tabs
      screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: 'transparent' }, animation: 'fade' }}
      tabBar={({ state, navigateToTab }) => (
        <TabBar
          active={state.routes[state.index].name as TabKey}
          retiree={retiree}
          onSelect={(t) => {
            const route = state.routes.find((r) => r.name === t);
            if (route) navigateToTab(route.key);
          }}
        />
      )}
    >
      <Tabs.Screen name="home" />
      <Tabs.Screen name="goals" />
      <Tabs.Screen name="payday" />
      <Tabs.Screen name="wealth" />
      <Tabs.Screen name="you" />
    </Tabs>
  );
}
