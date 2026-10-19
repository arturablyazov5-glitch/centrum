// Трассы жгутов панелей для наушников — docs/headphones, 27.09.2026.
//
// Рабочее кольцо — сотовая панель (обшивка 8 + соты 44 + обшивка 8, лист 33): паз
// снизу резал бы несущую обшивку и шёл бы под полками кронштейнов. Поэтому жгут
// (USB-C, USB-A, 3,5 мм — в оплётке, Ø12) идёт так же, как кабель микрофона
// (mic-hatch.js): из кармана — сверлёным каналом в брусе кромки, дальше закладной
// трубой Ø32/26 внутри сот, радиально между рёбрами кронштейнов. Трубы не переходят
// стык A (±50°): кольцо С1 / С2 / С3 — отдельные детали.
//
// Центр (С1): до края кольца над корпусом, дугой R1083 внутри дуги правого люка
//   микрофона — в ту же камеру над Tech Bay и общей гильзой вниз.
// Справа (С2): над модулем ящиков — отверстием Ø26 вниз в зазор 30 за коробами,
//   по нему к стояку подсветки ящиков, стояком в пояс, через второй хаб (HP_HUB,
//   electrics.js) и по лотку Л-24 к шахте. Хаб нужен из-за длины: USB 2.0 держит
//   5 м от порта хаба до устройства вместе с кабелем наушников (решение 27.09.2026).
// Слева (С3): над пустым К7 — отверстием вниз, в К7 под крышкой к торцу, через
//   проход жгута Ø40 (У11) в шахту Tech Bay.
// Во всех трубах с завода протяжной шнур: боковую панель ставят потом за один визит.
//
// Координаты — как у корпуса до отражения (mirror.js); θ — от оси экрана, плюс —
// вправо от сидящего.

import { CENTER, UNDER_1, TECH_SHAFT, TECH_DEPTH } from './params.js';
import { AUDIO_PANELS, R_BACK, Z_PORT } from './audio-panels.js';
import { MIC_CONDUIT } from './mic-hatch.js';
import { TRAYS, SHAFT_A, SHAFT_DATA, DRAWER_RISER, HP_HUB, at as atA, arc } from './electrics.js';
import { CARCASS_BACK, BOX_BACK } from './drawer-geometry.js';

export const AUDIO_ROUTE = Object.freeze({
  harness: 12,                 // жгут в оплётке
  tube: MIC_CONDUIT.tube,      // та же труба Ø32/26: проходит вилка USB-A
  tubeZ: MIC_CONDUIT.tubeZ,    // +774…+806 в сотах
  block: 560,                  // конец бруса кромки: до него канал сверлится
  theta: { center: -4.3, right: 75.6, left: -75.6 }, // ось трубы — между рёбрами кронштейнов, в пределах кармана
  arc: 1083,                   // дуга центральной трубы над корпусом
  drop: 1102,                  // отверстия вниз у боковых труб: справа — по середине зазора за ящиками
  hole: 26,                    // отверстие в обшивке и крышке модуля
  runZ: 720,                   // под крышкой модуля: К7 и зазор за ящиками
  k7End: 830,                  // торец К7 у К1, проход жгута Ø40 (У11)
  distributor: [300, 530, 330], // распределитель в Tech Bay: на задней стенке у рычага
});

const D = Math.PI / 180;
const pt = (theta, r, z) => [CENTER + r * Math.sin(theta * D), CENTER - r * Math.cos(theta * D), z];
const arcTheta = (r, a0, a1, z) => {
  const n = Math.max(2, Math.ceil(Math.abs(a1 - a0)));
  return Array.from({ length: n + 1 }, (_, i) => pt(a0 + ((a1 - a0) * i) / n, r, z));
};

// Трубная часть: от кармана до конца трубы в сотах, [x, y, z].
export function audioTubePath(id) {
  const R = AUDIO_ROUTE, panel = AUDIO_PANELS.find((p) => p.id === id);
  const t = R.theta[id], z = R.tubeZ;
  const pts = [pt(panel.theta, R_BACK, Z_PORT), pt(t, R_BACK + 4, Z_PORT), pt(t, R.block, z)];
  if (id !== 'center') return [...pts, pt(t, R.drop, z)];
  const { span } = MIC_CONDUIT.chamber;
  const turn = 50 / R.arc / D;
  pts.push(pt(t, R.arc - 50, z), pt(t - turn * 0.3, R.arc - 8, z));
  pts.push(...arcTheta(R.arc, t - turn, span[0], z));
  return pts;
}

// Вся трасса до распределителя в Tech Bay.
export function audioRoutePath(id) {
  const R = AUDIO_ROUTE, tube = audioTubePath(id);
  const [dx, dy, dz] = R.distributor;
  const slit = [262, TECH_DEPTH, dz];
  if (id === 'center') {
    const { theta, r } = MIC_CONDUIT.chamber;
    const c = pt(theta, r, R.tubeZ);
    return [...tube, c, [c[0], c[1], MIC_CONDUIT.bayCeiling], [c[0], c[1], 700], [c[0], 540, 700], [dx, 540, 700], [dx, dy, dz]];
  }
  const [x, y] = tube.at(-1);
  const down = [[x, y, UNDER_1 - 16], [x, y, R.runZ]];
  if (id === 'right') {
    const [rx, ry] = DRAWER_RISER, low = TRAYS.low, lz = low.z + 12;
    const a0 = Math.atan2(ry - CENTER, rx - CENTER) / D + 360;
    const [hx, hy, hz] = HP_HUB.at;
    return [...tube, ...down, [rx, y, R.runZ], [rx, ry, R.runZ], [rx, ry, lz], [hx, hy, lz], [hx, hy, hz], [hx, hy, lz],
      ...arc({ ...low, z: lz }, a0, SHAFT_A), [...SHAFT_DATA, lz], [...SHAFT_DATA, dz], slit, [dx, dy, dz]];
  }
  const shaftBack = [(TECH_SHAFT.x[0] + TECH_SHAFT.x[1]) / 2, TECH_SHAFT.y[1] - 20];
  return [...tube, ...down, [x, R.k7End, R.runZ], [shaftBack[0], TECH_SHAFT.y[1] + 10, R.runZ],
    [...shaftBack, R.runZ], [...shaftBack, dz], slit, [dx, dy, dz]];
}

// USB: от какого хаба до гнезда панели, мм трассы; у правой — ещё отрезок от
// распределителя до второго хаба.
export const USB = Object.freeze({ limit: 5000, userCable: 1500, slack: 300 });
export function usbRuns(id) {
  const p = audioRoutePath(id);
  if (id !== 'right') return { panel: pathLength(p) };
  const [hx, hy, hz] = HP_HUB.at;
  const i = p.findIndex((q) => q[0] === hx && q[1] === hy && q[2] === hz);
  return { panel: pathLength(p.slice(0, i + 1)), upstream: pathLength(p.slice(i)) };
}

export const pathLength = (pts) => pts.slice(1).reduce((s, p, i) => s + Math.hypot(...p.map((v, j) => v - pts[i][j])), 0);
// Длина жгута: по трассе + 10 % + по 300 на разделку, вверх до 0,5 м — как в журнале (electrics.js).
export const harnessLength = (id) => Math.ceil((pathLength(audioRoutePath(id)) * 1.1 + 600) / 500) / 2;
export { atA as electricsAt };
export const DRAWER_GAP = [CARCASS_BACK, BOX_BACK];
