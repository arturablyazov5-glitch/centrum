// LED: две ветви 24 В в нижнем пазу выступа второго уровня. Полоса идёт по
// горизонтальному участку и дальше по спуску, пока паз ещё вмещает самую узкую
// ленту 8 мм (y ≈ 1968). Над проходом разомкнута — как на виде 13.

import { CENTER, R_BELT_HIGH, R_LIP, TOP_THICK, LEVEL_2, RISE, TRANS_FAR, TRANS_LEN, SEGMENTS, rise, riseSlope, underAt, ringPoint } from './params.js';
import { addPolygon } from './mesh.js';
import { outsideEntry } from './entry-cut.js';
import { PALETTE } from './palette.js';

const LIP = R_BELT_HIGH - R_LIP;    // 60 — полный выступ
const MARGIN_IN = 18;               // от кромки выступа до паза на отметке 1270
const MARGIN_OUT = 18;              // от паза до стенки
const STRIP_W = LIP - MARGIN_IN - MARGIN_OUT; // 24 — паз на горизонтальном участке
const MIN_W = 8;                    // самая узкая серийная лента: у́же паз её не вместит
const MIN_OVERHANG = LIP * MIN_W / STRIP_W; // 20 — выступ, на котором паз сузился до 8
const DROP = 0.6;                   // рассеиватель заподлицо с низом выступа
// Низ гнутой плиты на спуске кольцо сегментов аппроксимирует хордами с ошибкой
// до ~1,5 мм; на уклоне рассеиватель опущен на столько же, чтобы не уйти в плиту.
const SLOPE_DROP = 1.5;

// Вид 19: восемь вставок, перегородка 3 мм и зазор 0,5 мм с каждой стороны.
// Вид 40 уточняет раскладку: от задней оси по каждой ветви 15°, 37,5°, 60°.
// Стыки 15° и 60° совпадают со стыками пояса; 37,5° делит вставку внутри модуля.
export const LED_JOINT_GAP = 3 + 0.5 * 2;
export const LED_JOINT_ANGLES = [210, 232.5, 255, 270, 285, 307.5, 330]
  .map(degrees => degrees * Math.PI / 180);
const HALF_JOINT_ANGLE = LED_JOINT_GAP / (2 * (R_BELT_HIGH - LIP / 2));

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
export const LED_FLAT_END_Y = TRANS_FAR - TRANS_LEN; // 1600 — начало спуска
// ≈1968 — паз сузился до MIN_W: здесь лента кончается торцом.
export const LED_END_Y = (() => {
  let lo = TRANS_FAR - TRANS_LEN, hi = TRANS_FAR;
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    if (LIP * rise(mid) / RISE > MIN_OVERHANG) lo = mid; else hi = mid;
  }
  return (lo + hi) / 2;
})();
export const LED_Z = LEVEL_2 - TOP_THICK - DROP;

// На спуске выступ сужается вместе с подъёмом (lipOverhang), и паз сужается
// в той же доле: отступы от кромки и от стенки и ширина полосы остаются
// 18 / 24 / 18 от выступа. Лента кончается, когда паз сужается до MIN_W.
const overhangAt = (a) => LIP * rise(ringPoint(a, R_BELT_HIGH)[1]) / RISE;

export function buildLed(mesh) {
  const step = (Math.PI * 2) / SEGMENTS;
  const z = (p) => underAt(p[1]) - DROP - SLOPE_DROP * Math.min(1, Math.abs(riseSlope(p[1])));
  // Вставляем точные границы швов в сетку, чтобы разрыв не зависел от SEGMENTS.
  const cuts = [...Array.from({ length: SEGMENTS + 1 }, (_, i) => i * step),
    ...LED_JOINT_ANGLES.flatMap(a => [a - HALF_JOINT_ANGLE, a + HALF_JOINT_ANGLE])]
    .sort((a, b) => a - b);
  for (let i = 0; i < cuts.length - 1; i++) {
    const angles = [cuts[i], cuts[i + 1]];
    const middle = (angles[0] + angles[1]) / 2;
    if (LED_JOINT_ANGLES.some(a => Math.abs(middle - a) < HALF_JOINT_ANGLE)) continue;
    const overhang = angles.map(overhangAt);
    if (overhang[0] < MIN_OVERHANG && overhang[1] < MIN_OVERHANG) continue;
    // Сегмент, где лента кончается: этот конец подтягиваем точно к LED_END_Y.
    for (let j = 0; j < 2; j++) {
      if (overhang[j] >= MIN_OVERHANG) continue;
      const side = Math.sign(Math.cos(angles[1 - j]));
      const s = Math.asin((LED_END_Y - CENTER) / R_BELT_HIGH);
      angles[j] = side > 0 ? s : Math.PI - s;
      overhang[j] = MIN_OVERHANG;
    }
    // Отступ от стенки к оси: паз от MARGIN_OUT до выступ − MARGIN_IN, в доле от выступа.
    const at = (j, fromWall) => {
      const p = ringPoint(angles[j], R_BELT_HIGH - overhang[j] * fromWall / LIP);
      return [p[0], p[1], z(p)];
    };
    const quad = [at(0, LIP - MARGIN_IN), at(1, LIP - MARGIN_IN), at(1, MARGIN_OUT), at(0, MARGIN_OUT)];
    for (const part of outsideEntry(quad)) addPolygon(mesh, part, PALETTE.led);
  }
}
