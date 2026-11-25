/**
 * App lock (8.3). When it's on, the app locks at launch and again when it comes back after more
 * than 60 seconds away. Unlocking uses Face ID / fingerprint with the phone's PIN as fallback.
 */
import * as LocalAuthentication from 'expo-local-authentication';
import { create } from 'zustand';

export const RELOCK_AFTER_MS = 60_000;

type LockState = { locked: boolean; set: (locked: boolean) => void };
export const useLockStore = create<LockState>()((set) => ({ locked: false, set: (locked) => set({ locked }) }));

/** Whether the phone can lock the app at all (biometrics or a device PIN). */
export async function canLock(): Promise<boolean> {
  const level = await LocalAuthentication.getEnrolledLevelAsync();
  return level !== LocalAuthentication.SecurityLevel.NONE;
}

export async function authenticate(prompt = 'Unlock Money Plan'): Promise<boolean> {
  const r = await LocalAuthentication.authenticateAsync({ promptMessage: prompt, cancelLabel: 'Not now' });
  return r.success;
}
