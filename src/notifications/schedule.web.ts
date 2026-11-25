// Web preview: no notifications.
import type { PlannedNotification } from './plan';

export async function setupNotifications(): Promise<() => void> {
  return () => undefined;
}
export async function reschedule(..._args: unknown[]): Promise<PlannedNotification[]> {
  return [];
}
