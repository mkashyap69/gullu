/**
 * Local notifications (expo-notifications): no push, no server. After every data change the next
 * 8 weeks are recomputed by the planner and rescheduled. Payday carries actions. Every
 * notification deep-links to the screen it talks about.
 */
import * as Notifications from 'expo-notifications';
import { router, type Href } from 'expo-router';

import { notifyInput } from './input';
import { planNotifications, type PlannedNotification } from './plan';

let ready = false;

export async function setupNotifications(): Promise<() => void> {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: false, shouldSetBadge: false }),
  });
  // 07: "Show me the moves", not "Show me what to buy" (no buy/sell, ever).
  await Notifications.setNotificationCategoryAsync('payday', [
    { identifier: 'moves', buttonTitle: 'Show me the moves', options: { opensAppToForeground: true } },
    { identifier: 'tomorrow', buttonTitle: 'Remind me tomorrow', options: { opensAppToForeground: false } },
    { identifier: 'done', buttonTitle: 'Already done', options: { opensAppToForeground: true } },
  ]);
  ready = true;
  const sub = Notifications.addNotificationResponseReceivedListener(async (r) => {
    const data = r.notification.request.content.data as { url?: string };
    switch (r.actionIdentifier) {
      case 'moves':
        return router.push('/payday/check-in');
      case 'done':
        return router.push({ pathname: '/payday/check-in', params: { all: '1' } });
      case 'tomorrow': {
        const c = r.notification.request.content;
        const t = new Date();
        await Notifications.scheduleNotificationAsync({
          identifier: 'payday-tomorrow',
          content: { title: c.title ?? '', body: c.body ?? '', data: c.data, categoryIdentifier: 'payday' },
          trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: new Date(t.getFullYear(), t.getMonth(), t.getDate() + 1, 9) },
        });
        return;
      }
      default:
        if (data?.url) router.push(data.url as Href);
    }
  });
  return () => sub.remove();
}

/** Recompute and replace every scheduled notification. `withPending`: the app is going to the background. */
export async function reschedule(input: Parameters<typeof notifyInput>[0] | null, streak: number, enabled: boolean, withPending = false): Promise<PlannedNotification[]> {
  if (!ready) return [];
  const perm = await Notifications.getPermissionsAsync();
  const keepTomorrow = (await Notifications.getAllScheduledNotificationsAsync()).some((n) => n.identifier === 'payday-tomorrow');
  for (const n of await Notifications.getAllScheduledNotificationsAsync()) if (n.identifier !== 'payday-tomorrow' || !keepTomorrow) await Notifications.cancelScheduledNotificationAsync(n.identifier);
  if (!enabled || !perm.granted || !input) return [];
  const list = planNotifications(notifyInput(input, streak, withPending));
  for (const n of list) {
    await Notifications.scheduleNotificationAsync({
      identifier: n.id,
      content: { title: n.title, body: n.body, data: { url: n.url }, categoryIdentifier: n.category },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: n.at },
    });
  }
  return list;
}
