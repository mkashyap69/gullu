/**
 * Export my data (8.3): a JSON file of everything, or CSV of holdings and goals, handed to the
 * system share sheet. The file is written to the cache and deleted once the sheet closes.
 */
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';

import { getDb } from '../state/dbHolder';
import { exportGoalsCsv, exportHoldingsCsv, exportJson } from './repo';

export async function exportData(kind: 'json' | 'csv'): Promise<boolean> {
  if (Platform.OS === 'web' || !(await Sharing.isAvailableAsync())) return false;
  const db = getDb();
  const files =
    kind === 'json'
      ? [{ name: 'money-plan.json', text: await exportJson(db), mime: 'application/json' }]
      : [
          { name: 'money-plan-holdings.csv', text: await exportHoldingsCsv(db), mime: 'text/csv' },
          { name: 'money-plan-goals.csv', text: await exportGoalsCsv(db), mime: 'text/csv' },
        ];
  for (const f of files) {
    const file = new File(Paths.cache, f.name);
    if (file.exists) file.delete();
    file.create();
    file.write(f.text);
    try {
      await Sharing.shareAsync(file.uri, { mimeType: f.mime, dialogTitle: 'Export my data' });
    } finally {
      if (file.exists) file.delete();
    }
  }
  return true;
}
