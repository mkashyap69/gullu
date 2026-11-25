/**
 * Share cards (06-HABITS "Share cards"): receipt, milestone and level up, drawn offscreen with Skia
 * and handed to the system share sheet with expo-sharing. Amounts are hidden by default. Nothing
 * is uploaded: the share sheet is the only way out.
 */
import { Skia, type SkTypeface } from '@shopify/react-native-skia';
import { Asset } from 'expo-asset';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';

import { HIDDEN_AMOUNT } from '../lib/formatINR';
import { interBoldTtf, interMediumTtf } from '../theme/fonts';
import { gradients } from '../theme/tokens';

export type CardKind = 'receipt' | 'milestone' | 'levelUp';
export type Card = { kind: CardKind; title: string; line: string };

const W = 1080;
const H = 1350;

/** Every rupee figure becomes "₹ ••••••" unless the user chose to show amounts. */
export function maskAmounts(text: string): string {
  return text.replace(/[−-]?₹\s?[\d,]+(\.\d+)?(\s?(L|Cr))?/g, HIDDEN_AMOUNT);
}

let faces: { bold: SkTypeface; medium: SkTypeface } | null = null;
async function typefaces() {
  if (faces) return faces;
  const load = async (mod: number) => {
    const a = Asset.fromModule(mod);
    await a.downloadAsync(); // bundled font: resolves locally, no network
    const data = await Skia.Data.fromURI(a.localUri ?? a.uri);
    return Skia.Typeface.MakeFreeTypeFaceFromData(data)!;
  };
  faces = { bold: await load(interBoldTtf), medium: await load(interMediumTtf) };
  return faces;
}

function wrap(text: string, font: ReturnType<typeof Skia.Font>, width: number): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let cur = '';
  for (const w of words) {
    const t = cur ? `${cur} ${w}` : w;
    if (font.measureText(t).width > width && cur) {
      lines.push(cur);
      cur = w;
    } else cur = t;
  }
  if (cur) lines.push(cur);
  return lines;
}

/** Renders the card to PNG bytes. */
export async function renderCard(card: Card, showAmounts = false): Promise<Uint8Array> {
  const { bold, medium } = await typefaces();
  const surface = Skia.Surface.MakeOffscreen(W, H) ?? Skia.Surface.Make(W, H)!;
  const c = surface.getCanvas();
  const g = gradients[card.kind === 'levelUp' ? 'ember' : card.kind === 'milestone' ? 'ember' : 'ember'];
  const paint = Skia.Paint();
  paint.setShader(Skia.Shader.MakeLinearGradient({ x: 0, y: 0 }, { x: 0, y: H }, g.colors.map((x) => Skia.Color(x)), [...g.locations], 0));
  c.drawRect(Skia.XYWHRect(0, 0, W, H), paint);
  // A gold coin with ₹, Gullu's catch.
  const coin = Skia.Paint();
  coin.setColor(Skia.Color('#FFC83D'));
  c.drawCircle(W / 2, 360, 150, coin);
  const rim = Skia.Paint();
  rim.setColor(Skia.Color('#C98A00'));
  rim.setStyle(1);
  rim.setStrokeWidth(14);
  c.drawCircle(W / 2, 360, 150, rim);
  const glyph = Skia.Font(bold, 180);
  const ink = Skia.Paint();
  ink.setColor(Skia.Color('#8A5A00'));
  c.drawText('₹', W / 2 - glyph.measureText('₹').width / 2, 425, ink, glyph);
  const white = Skia.Paint();
  white.setColor(Skia.Color('#FFFFFF'));
  const soft = Skia.Paint();
  soft.setColor(Skia.Color('rgba(255,255,255,0.8)'));
  const title = Skia.Font(bold, 96);
  const body = Skia.Font(medium, 48);
  let y = 720;
  for (const l of wrap(showAmounts ? card.title : maskAmounts(card.title), title, W - 160)) {
    c.drawText(l, 80, y, white, title);
    y += 110;
  }
  y += 20;
  for (const l of wrap(showAmounts ? card.line : maskAmounts(card.line), body, W - 160)) {
    c.drawText(l, 80, y, soft, body);
    y += 66;
  }
  c.drawText('Money Plan · made on my phone', 80, H - 90, soft, Skia.Font(medium, 36));
  surface.flush();
  return surface.makeImageSnapshot().encodeToBytes();
}

export async function shareCard(card: Card, showAmounts = false): Promise<void> {
  if (Platform.OS === 'web' || !(await Sharing.isAvailableAsync())) return;
  const bytes = await renderCard(card, showAmounts);
  const file = new File(Paths.cache, `money-plan-${card.kind}.png`);
  if (file.exists) file.delete();
  file.create();
  file.write(bytes);
  await Sharing.shareAsync(file.uri, { mimeType: 'image/png', dialogTitle: 'Share' });
}
