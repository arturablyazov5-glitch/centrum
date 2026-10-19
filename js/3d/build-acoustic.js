// Акустическая лента на внутренней стенке R1150 — листы 27–28 и acoustics-notes.md.
// Вогнутая стенка собирает отражение в точке головы, поэтому в пазу 44 стоит
// поглотитель: ПЭТ-войлок 24 на воздушном зазоре 20, лицо войлока заподлицо
// с гранью стенки. Поверх войлока — вертикальные рейки 10 × 27 из шпона
// (стенка за ними — серая панель корпуса) с шагом 20: половина поверхности открыта, и звук уходит в войлок.
// Рейка сидит в войлоке на 12 и выступает из грани стенки на 15 (лицо на R1135),
// поэтому лента читается рельефом. Паз LED кончается на R1132: свет идёт вниз
// в 3 мм от лица реек и скользит по ним.
//
// В модели видны только лицо войлока и выступающие 15 мм реек. Паз, зазор и
// посадка рейки в войлок — за гранью стенки и в модель не входят.
//
// Лента идёт от Ls до Rs через перед и дальше по спуску: верх реек и войлока
// повторяет низ выступа, лента кончается, где рейка стала бы ниже 40. Решётки 5.1
// рейки не прерывают: в рейках пяти окон вырезан круг Ø186 под решётку Ø180,
// над кругом и под ним рейки идут дальше. Куски реек внутри круга вынесены
// в отдельный набор: без опции круг закрыт ими, и лента сплошная; с опцией на их
// месте решётки (build-speakers.js). Войлок за решёткой остаётся.

import { CENTER, R_BELT_HIGH, LEVEL_1, LEVEL_2, TOP_THICK, underAt, riseSlope } from './params.js';
import { addPolygon, polygonNormal } from './mesh.js';
import { SPEAKER_CHANNELS, speakerAngle, GRILLE_D, SPEAKER_Z } from './build-speakers.js';
import { PALETTE } from './palette.js';
import { POSTS, SOCKET_FRAME, SOCKET_Z, powerFrames } from './sockets.js';
import { RAIL_HIGH } from './build-monitor-rail.js?v=20260925-real';

export const SLAT_W = 10;              // ширина рейки по дуге
export const SLAT_PITCH = 20;          // шаг: зазор 10, открыто 50 %
export const SLAT_PROUD = 15;          // выступ лица рейки над гранью стенки
export const SLAT_Z0 = LEVEL_1 + 40;   // +860: цоколь 40 над рабочей поверхностью
// +1182: над рейками — верхняя шина под мониторы 28 (build-monitor-rail.js, лист 44).
export const SLAT_Z1 = RAIL_HIGH[0];
export const SLAT_MIN_H = 40;          // на спуске лента идёт, пока рейка не ниже 40
const SLOPE_GAP = 3;                   // на спуске верх реек на 3 ниже выступа: не заходит в LED
export const HOLE_GAP = 3;             // зазор от кромки решётки до торцов реек
export const HOLE_R = GRILLE_D / 2 + HOLE_GAP; // круг Ø186 в рейках под решётку Ø180
const COLUMNS = 5;                     // торец рейки по дуге круга — ступенями по 2 мм
const FELT_PROUD = 0.5;                // лицо войлока чуть перед гранью: без мерцания с корпусом

// Проёмы вокруг рамок каждого поста, включая зазор 3 мм, — у каждого пакета
// свои (sockets.js). Корпус строится до mirror.js: мировой угол рамки a здесь
// равен π − a; s отсчитывается от направления 270°.
const SOCKET_GAP = 3;
const socketS = (a) => {
  const angle = Math.atan2(Math.sin(Math.PI - a), Math.cos(Math.PI - a));
  return Math.atan2(Math.sin(1.5 * Math.PI - angle), Math.cos(1.5 * Math.PI - angle)) * R_BELT_HIGH;
};
const socketHalf = Math.atan((SOCKET_FRAME / 2 + SOCKET_GAP) / (R_BELT_HIGH - SLAT_PROUD)) * R_BELT_HIGH;
export const socketCuts = (pkg) => Object.keys(POSTS).map((post) => {
  const s = powerFrames(pkg).filter((f) => f.post === post).map((f) => socketS(f.angle));
  return [Math.min(...s) - socketHalf, Math.max(...s) + socketHalf];
});
const SOCKET_BOTTOM = SOCKET_Z - SOCKET_FRAME / 2 - SOCKET_GAP;
const SOCKET_TOP = SOCKET_Z + SOCKET_FRAME / 2 + SOCKET_GAP;

function socketSpans(s, width, cuts) {
  const start = s - width / 2, end = s + width / 2;
  const edges = cuts.flat().filter((v) => v > start && v < end).sort((p, q) => p - q);
  const points = [start, ...edges, end];
  return points.slice(1).map((b, i) => {
    const mid = (points[i] + b) / 2;
    return { a: points[i], b, cut: cuts.some(([c0, c1]) => mid > c0 && mid < c1) };
  });
}

// Положение по дуге R1150 от оси экрана, мм, плюс — к каналу R.
const angleAt = (s) => speakerAngle((s / R_BELT_HIGH) * (180 / Math.PI));
const wallPoint = (s, depth) => {
  const a = angleAt(s);
  const r = R_BELT_HIGH - depth;
  return [CENTER + r * Math.cos(a), CENTER + r * Math.sin(a)];
};

const holeCenters = SPEAKER_CHANNELS.map((c) => (c.deg * Math.PI / 180) * R_BELT_HIGH);
// Ось круга, который задевает рейка, или null.
const holeOf = (s) => holeCenters.find((w) => Math.abs(s - w) < HOLE_R + SLAT_W / 2) ?? null;
// Полувысота круга на расстоянии x от его оси по дуге; 0 — мимо круга.
const halfChord = (x) => Math.sqrt(Math.max(0, HOLE_R * HOLE_R - x * x));
// Верх реек и войлока — под верхней шиной +1182, на спуске — по низу выступа.
const topAt = (s) => {
  const y = wallPoint(s, 0)[1];
  return Math.min(SLAT_Z1, underAt(y) - SLOPE_GAP * Math.min(1, Math.abs(riseSlope(y))));
};
// Рейка стоит, пока над всей её ячейкой остаётся не меньше SLAT_MIN_H.
const onWall = (s) => [s - SLAT_PITCH / 2, s + SLAT_PITCH / 2]
  .every((e) => topAt(e) - SLAT_Z0 >= SLAT_MIN_H);

// Все рейки ленты: симметрично от оси экрана, поэтому отражение сцены их не меняет.
export const SLATS = (() => {
  const out = [];
  for (let k = 0; onWall(k * SLAT_PITCH); k++) {
    for (const s of k === 0 ? [0] : [-k * SLAT_PITCH, k * SLAT_PITCH])
      out.push({ s, hole: holeOf(s) });
  }
  return out.sort((a, b) => a.s - b.s);
})();

// Грань наружу от тела рейки (или от стенки — для войлока).
function addOutward(mesh, pts, outward, color) {
  const n = polygonNormal(pts);
  if (!n) return;
  addPolygon(mesh, n[0] * outward[0] + n[1] * outward[1] + n[2] * outward[2] >= 0 ? pts : pts.slice().reverse(), color);
}

// Кусок рейки от lo(ds) до hi(ds) по высоте, ds — от оси рейки по дуге.
// caps — какие концы закрыть торцом: нижний виден над столешницей и в круге,
// верхний — только в круге; у выступа верх рейки упирается и закрыт.
function addSlat(mesh, s, lo, hi, caps, columns = 1, cuts = []) {
  for (const span of socketSpans(s, SLAT_W, cuts)) {
    const mid = (span.a + span.b) / 2;
    const low = (ds) => lo(ds + mid - s);
    const high = (ds) => hi(ds + mid - s);
    const width = span.b - span.a;
    if (!span.cut) { addSlatPart(mesh, mid, low, high, caps, columns, width); continue; }
    if (low(0) < SOCKET_BOTTOM)
      addSlatPart(mesh, mid, low, (ds) => Math.min(high(ds), SOCKET_BOTTOM), { ...caps, high: true }, columns, width);
    if (high(0) > SOCKET_TOP)
      addSlatPart(mesh, mid, (ds) => Math.max(low(ds), SOCKET_TOP), high, { ...caps, low: true }, columns, width);
  }
}

function addSlatPart(mesh, s, lo, hi, caps, columns, width) {
  const a = angleAt(s);
  const inward = [-Math.cos(a), -Math.sin(a), 0];
  const tangent = [-Math.sin(a), Math.cos(a), 0];
  const at = (ds, depth, z) => [...wallPoint(s + ds, depth), z];
  const h = width / 2;
  const ds = Array.from({ length: columns + 1 }, (_, i) => -h + (width * i) / columns);
  for (let i = 0; i < columns; i++) {
    const [p, q] = [ds[i], ds[i + 1]];
    // Лицо рейки — по хорде на R1135.
    addOutward(mesh, [at(p, SLAT_PROUD, lo(p)), at(q, SLAT_PROUD, lo(q)), at(q, SLAT_PROUD, hi(q)), at(p, SLAT_PROUD, hi(p))], inward, PALETTE.belt);
    if (caps.low)
      addOutward(mesh, [at(p, 0, lo(p)), at(q, 0, lo(q)), at(q, SLAT_PROUD, lo(q)), at(p, SLAT_PROUD, lo(p))], [0, 0, -1], PALETTE.belt);
    if (caps.high)
      addOutward(mesh, [at(p, 0, hi(p)), at(q, 0, hi(q)), at(q, SLAT_PROUD, hi(q)), at(p, SLAT_PROUD, hi(p))], [0, 0, 1], PALETTE.belt);
  }
  // Боковины радиальные.
  for (const side of [-1, 1]) {
    const o = [tangent[0] * side, tangent[1] * side, 0];
    const e = side * h;
    addOutward(mesh, [at(e, 0, lo(e)), at(e, SLAT_PROUD, lo(e)), at(e, SLAT_PROUD, hi(e)), at(e, 0, hi(e))], o, PALETTE.belt);
  }
}

// Лицо войлока — ячейка шага вокруг рейки.
function addFelt(mesh, s, cuts) {
  const a = angleAt(s);
  const inward = [-Math.cos(a), -Math.sin(a), 0];
  const at = (ds, z) => [...wallPoint(s + ds, FELT_PROUD), z];
  for (const { a: start, b: end, cut } of socketSpans(s, SLAT_PITCH, cuts)) {
    const a = start - s, b = end - s;
    if (!cut) {
      addOutward(mesh, [at(a, SLAT_Z0), at(b, SLAT_Z0), at(b, topAt(end)), at(a, topAt(start))], inward, PALETTE.felt);
      continue;
    }
    addOutward(mesh, [at(a, SLAT_Z0), at(b, SLAT_Z0), at(b, SOCKET_BOTTOM), at(a, SOCKET_BOTTOM)], inward, PALETTE.felt);
    addOutward(mesh, [at(a, SOCKET_TOP), at(b, SOCKET_TOP), at(b, topAt(end)), at(a, topAt(start))], inward, PALETTE.felt);
  }
}

const bottom = () => SLAT_Z0;

// Лента без кругов: входит в базу всегда. Рейки окон — куски под кругом и над ним.
// Проёмы под рамки — по пакету электрики: у старшего пакета рамок больше.
export function buildAcoustic(mesh, pkg = 'base') {
  const cuts = socketCuts(pkg);
  for (const { s, hole } of SLATS) {
    addFelt(mesh, s, cuts);
    const top = (ds) => topAt(s + ds);
    // На спуске верх реек отстаёт от выступа, и его закрывает торец.
    const slope = topAt(s) < SLAT_Z1 - 0.01;
    if (hole === null) { addSlat(mesh, s, bottom, top, { low: true, high: slope }, slope ? COLUMNS : 1, cuts); continue; }
    const cut = (ds) => halfChord(s + ds - hole);
    addSlat(mesh, s, bottom, (ds) => SPEAKER_Z - cut(ds), { low: true, high: true }, COLUMNS);
    addSlat(mesh, s, (ds) => SPEAKER_Z + cut(ds), top, { low: true }, COLUMNS);
  }
}

// Куски реек внутри кругов 5.1: видны, пока опция не выбрана.
export function buildAcousticWindows(mesh) {
  for (const { s, hole } of SLATS) {
    if (hole === null) continue;
    const cut = (ds) => halfChord(s + ds - hole);
    addSlat(mesh, s, (ds) => SPEAKER_Z - cut(ds), (ds) => SPEAKER_Z + cut(ds), {}, COLUMNS);
  }
}
