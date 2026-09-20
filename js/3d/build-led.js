// LED: две ветви 24 В в нижнем пазу выступа второго уровня. Полоса идёт только там,
// где выступ реально нависает над Sector, и разомкнута над проходом — как на виде 13.

import { R_BELT_HIGH, TOP_THICK, LEVEL_2, TRANS_FAR, TRANS_LEN, SEGMENTS, topAt, ringPoint, lipOverhang } from './params.js';
import { addPolygon } from './mesh.js';
import { clipPolygon, outsideEntry } from './entry-cut.js';
import { PALETTE } from './palette.js';

const R_OUT = R_BELT_HIGH - 18;
const DROP = 0.6;                   // рассеиватель заподлицо с низом выступа

// Отражённая блёскость. Прямой засветки эта лента не даёт: она утоплена в пазу
// на нижней стороне выступа и светит вниз, а глаз сидящего лежит выше её отметки,
// так что источник из рабочей позы не виден. Значимо другое — зеркальный образ
// ленты в самой столешнице. Он садится на радиусе
//     r = R_LED * (1 − (LEVEL_1 − LED_Z) / (2*LEVEL_1 − eye − LED_Z))
// и при глазе 1310…1365 это 680…712 мм от оси, то есть зона клавиатуры и рук.
// Отсечка паза (50° от середины рассеивателя, 67° от дальней кромки) гасит этот
// луч лишь частично — он выходит под 53…54° от вертикали. Поэтому защита вынесена
// в отделку: Sector матовый, см. требования к виду 14 в centrum.html.
// Пересчитать, если меняются LEVEL_1, LEVEL_2, R_BELT_HIGH или глубина паза.
export const LED_END_Y = TRANS_FAR - TRANS_LEN;
export const LED_Z = LEVEL_2 - TOP_THICK - DROP;

export function buildLed(mesh) {
  const step = (Math.PI * 2) / SEGMENTS;
  for (let i = 0; i < SEGMENTS; i++) {
    const angles = [i * step, (i + 1) * step];
    const overhang = angles.map(lipOverhang);
    // LED идёт только под горизонтальным верхним уровнем. В первом же
    // сегменте плавного спуска полоса уже отсутствует.
    const belt = angles.map((a) => ringPoint(a, R_BELT_HIGH));
    if (Math.min(belt[0][1], belt[1][1]) > LED_END_Y) continue;
    const inner = angles.map((a, j) => ringPoint(a, R_BELT_HIGH - overhang[j] + 18));
    const outer = angles.map((a) => ringPoint(a, R_OUT));
    const z = (p) => topAt(p[1]) - TOP_THICK - DROP;
    const quad = clipPolygon([
      [inner[0][0], inner[0][1], z(inner[0])],
      [inner[1][0], inner[1][1], z(inner[1])],
      [outer[1][0], outer[1][1], z(outer[1])],
      [outer[0][0], outer[0][1], z(outer[0])],
    ], 1, LED_END_Y, true);
    if (quad.length < 3) continue;
    for (const part of outsideEntry(quad)) addPolygon(mesh, part, PALETTE.led);
  }
}
