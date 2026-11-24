// Gullu — the Money Plan mascot. A clay gullak (Indian piggy bank) with a coin slot on top.
// gullu(id, expr) returns SVG inner markup in a 240x240 viewBox. expr: happy|wave|think|celebrate|sleepy|concern|catch
const INK = '#14080A', DEEP = '#7A1F08', SLOT = '#3A0F05';
// Collectible looks, unlocked by level (base..free) or season (diwali, holi)
const SKIN_GRAD = { base: ['#FFB273', '#F06A24', '#B8350F', '#8A2209'], free: ['#FFE6A0', '#F2B23A', '#C27A12', '#8A520A'] };
const BAND = { base: '#FFE7C2', steady: '#7FF0E0', secure: '#FFD25A', builder: '#FFD25A', halfway: '#FFD25A', free: '#FFF6D6', diwali: '#FFD25A', holi: '#FFFFFF' };
function skinExtras(skin) {
  let x = '';
  const flower = (cx, cy) => [0, 72, 144, 216, 288].map(a => `<circle cx="${(cx + 6 * Math.cos(a * Math.PI / 180)).toFixed(1)}" cy="${(cy + 6 * Math.sin(a * Math.PI / 180)).toFixed(1)}" r="4.2" fill="#FFB000"></circle>`).join('') + `<circle cx="${cx}" cy="${cy}" r="3.4" fill="#C2410C"></circle>`;
  if (['secure', 'builder', 'halfway', 'free', 'diwali'].includes(skin)) x += '<ellipse cx="120" cy="57" rx="19" ry="7" fill="none" stroke="#FFC83D" stroke-width="3"></ellipse><circle cx="120" cy="45" r="10" fill="none" stroke="#FFC83D" stroke-width="2.5"></circle>';
  if (['builder', 'free'].includes(skin)) x += flower(66, 150) + flower(174, 150);
  if (['halfway', 'free'].includes(skin)) x += '<path d="M62 168 l9 -8 l9 8 l9 -8 l9 8 l9 -8 l9 8 l9 -8 l9 8 l9 -8 l9 8 l9 -8 l9 8" fill="none" stroke="#FFC83D" stroke-width="2.5" stroke-linejoin="round"></path>';
  if (skin === 'diwali') x += '<path d="M120 10 C112 22 112 30 120 34 C128 30 128 22 120 10 Z" fill="#FFB000"></path><path d="M120 18 C116 25 116 29 120 31 C124 29 124 25 120 18 Z" fill="#FFF1A8"></path>' + flower(70, 158) + flower(170, 158);
  if (skin === 'holi') x += '<circle cx="72" cy="120" r="13" fill="#FF4FA3" fill-opacity="0.75"></circle><circle cx="170" cy="112" r="11" fill="#3BE08A" fill-opacity="0.75"></circle><circle cx="150" cy="180" r="10" fill="#4C7DFF" fill-opacity="0.75"></circle><circle cx="96" cy="88" r="7" fill="#FFD25A" fill-opacity="0.85"></circle>';
  return x;
}
function gullu(id, expr, opts) {
  opts = opts || {};
  const aura = opts.aura === false ? '' : `<circle cx="120" cy="140" r="116" fill="url(#au-${id})"></circle>`;
  const defs = `<defs>
<radialGradient id="gb-${id}" cx="0.38" cy="0.32" r="0.75">${(SKIN_GRAD[opts.skin] || SKIN_GRAD.base).map((c, i) => `<stop offset="${[0, 0.45, 0.85, 1][i]}" stop-color="${c}"></stop>`).join('')}</radialGradient>
<radialGradient id="au-${id}" cx="0.5" cy="0.5" r="0.5"><stop offset="0" stop-color="${opts.auraColor || '#8B7CF6'}" stop-opacity="0.6"></stop><stop offset="1" stop-color="${opts.auraColor || '#8B7CF6'}" stop-opacity="0"></stop></radialGradient>
</defs>`;
  const armL = { up: 'M46 138 Q26 116 32 92', down: 'M44 150 Q28 158 32 174', chin: 'M44 150 Q28 158 32 174', side: 'M44 146 Q22 140 18 120' };
  const armR = { up: 'M194 138 Q214 116 208 92', down: 'M196 150 Q212 158 208 174', chin: 'M192 162 Q172 182 152 174', side: 'M196 146 Q218 140 222 120' };
  const arms = { happy: ['down', 'down'], wave: ['down', 'up'], think: ['down', 'chin'], celebrate: ['up', 'up'], sleepy: ['down', 'down'], concern: ['down', 'down'], catch: ['side', 'side'] }[expr];
  const arm = (d) => `<path d="${d}" fill="none" stroke="${DEEP}" stroke-width="11" stroke-linecap="round"></path>`;
  const eye = (x, px, py) => `<ellipse cx="${x}" cy="134" rx="13" ry="15" fill="#FFFFFF"></ellipse><circle cx="${px}" cy="${py}" r="7.5" fill="${INK}"></circle><circle cx="${px + 3}" cy="${py - 4}" r="2.6" fill="#FFFFFF"></circle>`;
  let face = '', extra = '';
  const cheeks = `<ellipse cx="80" cy="158" rx="10" ry="5.5" fill="#FF6FA0" fill-opacity="0.55"></ellipse><ellipse cx="160" cy="158" rx="10" ry="5.5" fill="#FF6FA0" fill-opacity="0.55"></ellipse>`;
  const smile = `<path d="M107 160 Q120 173 133 160" fill="none" stroke="${SLOT}" stroke-width="4.5" stroke-linecap="round"></path>`;
  switch (expr) {
    case 'happy': case 'wave':
      face = eye(98, 99, 137) + eye(142, 143, 137) + smile + cheeks; break;
    case 'think':
      face = eye(98, 103, 129) + eye(142, 147, 129) + `<path d="M112 163 Q120 159 128 163" fill="none" stroke="${SLOT}" stroke-width="4.5" stroke-linecap="round"></path>` + cheeks;
      extra = `<circle cx="194" cy="74" r="5" fill="#FFFFFF" fill-opacity="0.85"></circle><circle cx="208" cy="56" r="7" fill="#FFFFFF" fill-opacity="0.85"></circle><circle cx="224" cy="34" r="10" fill="#FFFFFF" fill-opacity="0.85"></circle>`; break;
    case 'celebrate':
      face = `<path d="M86 138 Q98 124 110 138" fill="none" stroke="${INK}" stroke-width="5" stroke-linecap="round"></path><path d="M130 138 Q142 124 154 138" fill="none" stroke="${INK}" stroke-width="5" stroke-linecap="round"></path><path d="M103 155 Q120 184 137 155 Z" fill="${SLOT}"></path><ellipse cx="120" cy="168" rx="7" ry="4" fill="#FF6F7F"></ellipse>` + cheeks;
      extra = coin(34, 66, 13) + coin(206, 52, 11) + coin(222, 112, 8) + `<g stroke="#FFE08A" stroke-width="3" stroke-linecap="round"><path d="M28 112 l-10 -4"></path><path d="M30 124 l-12 4"></path><path d="M184 30 l4 -10"></path><path d="M196 34 l10 -6"></path></g>`; break;
    case 'sleepy':
      face = `<path d="M86 136 Q98 144 110 136" fill="none" stroke="${INK}" stroke-width="5" stroke-linecap="round"></path><path d="M130 136 Q142 144 154 136" fill="none" stroke="${INK}" stroke-width="5" stroke-linecap="round"></path><circle cx="120" cy="162" r="4.5" fill="${SLOT}"></circle>` + cheeks;
      extra = `<g fill="#FFFFFF" font-family="Inter, sans-serif" font-weight="800"><text x="176" y="84" font-size="22">z</text><text x="196" y="62" font-size="16">z</text><text x="210" y="44" font-size="12">z</text></g>`; break;
    case 'concern':
      face = eye(98, 99, 140) + eye(142, 141, 140) + `<path d="M84 114 L108 122" stroke="${INK}" stroke-width="5" stroke-linecap="round"></path><path d="M156 114 L132 122" stroke="${INK}" stroke-width="5" stroke-linecap="round"></path><path d="M106 165 Q113 158 120 165 Q127 172 134 165" fill="none" stroke="${SLOT}" stroke-width="4.5" stroke-linecap="round"></path>`;
      extra = `<path d="M182 92 Q174 108 182 114 Q190 108 182 92 Z" fill="#9FD8FF"></path>`; break;
    case 'catch':
      face = eye(98, 99, 128) + eye(142, 143, 128) + `<ellipse cx="120" cy="163" rx="8" ry="9" fill="${SLOT}"></ellipse>` + cheeks;
      extra = coin(120, 14, 13) + `<g stroke="#FFE08A" stroke-width="2.5" stroke-linecap="round" stroke-opacity="0.8"><path d="M100 2 v10"></path><path d="M140 2 v10"></path></g>`; break;
  }
  return defs + aura + extra +
    `<ellipse cx="96" cy="215" rx="15" ry="7" fill="${DEEP}"></ellipse><ellipse cx="144" cy="215" rx="15" ry="7" fill="${DEEP}"></ellipse>` +
    arm(armL[arms[0]]) + arm(armR[arms[1]]) +
    `<path d="M120 58 C78 58, 40 98, 40 142 C40 188, 76 214, 120 214 C164 214, 200 188, 200 142 C200 98, 162 58, 120 58 Z" fill="url(#gb-${id})"></path>` +
    `<ellipse cx="120" cy="57" rx="19" ry="7" fill="${DEEP}"></ellipse><circle cx="120" cy="45" r="10" fill="url(#gb-${id})"></circle>` +
    `<rect x="101" y="74" width="38" height="8" rx="4" fill="${SLOT}"></rect>` +
    `<ellipse cx="84" cy="98" rx="17" ry="9" fill="#FFFFFF" fill-opacity="0.32" transform="rotate(-32 84 98)"></ellipse>` +
    `<path d="M56 180 Q120 200 184 180" fill="none" stroke="${BAND[opts.skin] || BAND.base}" stroke-width="2.5" stroke-opacity="0.85"></path>` +
    [76, 92, 108, 124, 140, 156].map((x, i) => `<circle cx="${x + 4}" cy="${190 + (i === 0 || i === 5 ? -3 : 0)}" r="3" fill="${BAND[opts.skin] || BAND.base}" fill-opacity="0.9"></circle>`).join('') +
    skinExtras(opts.skin) + face;
}
function coin(x, y, r) {
  return `<circle cx="${x}" cy="${y}" r="${r}" fill="#FFC83D" stroke="#C98A00" stroke-width="2"></circle><text x="${x}" y="${y + r * 0.42}" font-size="${(r * 1.2).toFixed(0)}" font-weight="800" fill="#8A5A00" text-anchor="middle" font-family="Inter, sans-serif">₹</text>`;
}
// standalone svg element
function gulluSvg(id, expr, w, label, opts) {
  return `<svg width="${w}" height="${w}" viewBox="0 0 240 240" role="img" aria-label="${label}">${gullu(id, expr, opts)}</svg>`;
}
module.exports = { gullu, gulluSvg, coin };
