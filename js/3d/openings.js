// Проёмы в наружной стенке корпуса: за ними стоят ниша холодильника, блок ящиков,
// отсек Tech Bay и электроотсек ЭО. Без этих вырезов фасадные модули были бы закрыты сплошной стенкой.

import { SIZE, UNDER_1, PLINTH, FRIDGE_Y, DRAWERS_Y, TECH_X, TECH_EXHAUST, TRASH_Y, ENTRY_X0 } from './params.js';
import { clipPolygon } from './entry-cut.js';
import { addPolygon, polygonNormal } from './mesh.js';
import { OPENING_TOP as DRAWERS_TOP } from './drawer-geometry.js';
import { SEAM_Z, seamPieces, sinkPoint } from './seams.js';
import { RECEIVER_DOOR } from './electrics.js';
import { EO_OPENING } from './build-eo-door.js';

// Проёмы фасада x = 2700 заданы по y, проёмы передней грани y = 0 — по x; высота — z.
export const FACADE_OPENINGS = [
  { y: FRIDGE_Y, z: [PLINTH, UNDER_1] },
  // Проём ящиков — от цоколя до низа столешницы: полосы стенки над ними нет.
  { y: DRAWERS_Y, z: [PLINTH, DRAWERS_TOP] },
];
// Tech Bay: фасад, как и дверь холодильника, закрывает кромки дна и плит над отсеком.
export const FRONT_OPENINGS = [
  { x: TECH_X, z: [PLINTH, UNDER_1] },
];
// ЭО (лист 16): окно посреди стенки К2 — дверца с щелью 3 по контуру (build-eo-door.js).
export const FRONT_WINDOWS = [
  { x: EO_OPENING.x, z: EO_OPENING.z },
];

// Задняя грань y = 2700 — сторона входа. Мусорная ниша К6 выходила сюда, пока блок
// выезжал наружу; теперь он выезжает в проход, и стенка тут сплошная.
export const BACK_OPENINGS = [];

// Мусорный модуль в К6 (build-trash.js): проём в стенке прохода x = 950, по y, от цоколя
// до низа столешницы, как у холодильника: фасад закрывает кромки дна и плит.
export const PASSAGE_OPENINGS = [
  { y: TRASH_Y, z: [PLINTH, UNDER_1] },
];

// Выброс Tech Bay в боковой грани x = 0: окно посреди стенки, за ним переходник
// к плениуму и жалюзи (build-techbay.js, buildTechBayVent).
// Там же, в хвосте К7, — дверца аудиомодуля АМ (receiver-door.js, electrics.js):
// проём есть в каждом столе, без опции 5.1 в нём глухая панель.
export const SIDE_OPENINGS = [
  { y: TECH_EXHAUST.y, z: TECH_EXHAUST.z },
  { y: RECEIVER_DOOR.y, z: RECEIVER_DOOR.z },
];

const ON_FACADE = SIZE - 0.5;
const ON_FRONT = 0.5;
const ON_SIDE = 0.5;
const ON_BACK = SIZE - 0.5;
const ON_PASSAGE = 0.5;   // допуск для стенки прохода x = ENTRY_X0

// Вычитание прямоугольника из плоского многоугольника: остаются части ниже, выше и по бокам.
function subtract(poly, axis, [a0, a1], [z0, z1]) {
  const below = clipPolygon(poly, axis, a0, true);
  const above = clipPolygon(poly, axis, a1, false);
  const band = clipPolygon(clipPolygon(poly, axis, a0, false), axis, a1, true);
  return [below, above, clipPolygon(band, 2, z0, true), clipPolygon(band, 2, z1, false)]
    .filter((p) => p.length >= 3);
}

const lerpAt = (a, b, axis, value) => {
  const t = (value - a[axis]) / (b[axis] - a[axis]);
  return a.map((v, k) => v + t * (b[k] - v));
};

// Проём от низа стенки: кусок стенки делится на три выпуклые части так, что на
// верхнем крае не появляется новых вершин. Иначе вершина разреза без пары в
// соседней деревянной кромке оставляла сквозную щель — тёмную вертикальную линию.
function cutOpening(poly, axis, span, [z0, z1]) {
  const zs = poly.map((p) => p[2]);
  const along = poly.map((p) => p[axis]);
  const zMin = Math.min(...zs), zMax = Math.max(...zs);
  if (zMin >= z1 || zMax <= z0 || Math.max(...along) <= span[0] || Math.min(...along) >= span[1]) return [poly];
  const bottom = poly.filter((p) => p[2] < zMin + 0.01).sort((p, q) => p[axis] - q[axis]);
  const top = poly.filter((p) => p[2] >= zMin + 0.01).sort((p, q) => p[axis] - q[axis]);
  if (poly.length !== 4 || bottom.length !== 2 || z0 > zMin + 0.01 || z1 >= Math.min(...top.map((p) => p[2])) - 0.01)
    return subtract(poly, axis, span, [z0, z1]);
  const [b0, b1] = bottom, [t0, t1] = top;
  const hb0 = lerpAt(b0, b1, axis, Math.max(span[0], b0[axis]));
  const hb1 = lerpAt(b0, b1, axis, Math.min(span[1], b1[axis]));
  const ht0 = [hb0[0], hb0[1], z1], ht1 = [hb1[0], hb1[1], z1];
  const n = polygonNormal(poly);
  const keep = (piece) => {
    const m = polygonNormal(piece);
    return m && n && m[0] * n[0] + m[1] * n[1] + m[2] * n[2] < 0 ? piece.reverse() : piece;
  };
  return [[b0, hb0, ht0, t0], [t0, ht0, ht1, t1], [ht1, hb1, b1, t1]].map(keep);
}

// Окно посреди стенки: четыре куска рамкой с диагональными усами от углов
// стенки к углам окна. На кромках стенки новых вершин нет — щели со соседними
// гранями не появляется (см. cutOpening).
function cutWindow(poly, axis, [a0, a1], [z0, z1]) {
  const zs = poly.map((p) => p[2]);
  const zMin = Math.min(...zs);
  const bottom = poly.filter((p) => p[2] < zMin + 0.01).sort((p, q) => p[axis] - q[axis]);
  const top = poly.filter((p) => p[2] >= zMin + 0.01).sort((p, q) => p[axis] - q[axis]);
  if (poly.length !== 4 || bottom.length !== 2) return subtract(poly, axis, [a0, a1], [z0, z1]);
  const [b0, b1] = bottom, [t0, t1] = top;
  // Стенка нарезана по длине на полосы: окно может занять часть полосы или всю.
  // Если окно доходит до края полосы, диагональный кусок с этой стороны
  // вырождается и пропускается, а вершины окна на крае совпадают с соседней полосой.
  const lo = Math.max(a0, b0[axis]), hi = Math.min(a1, b1[axis]);
  if (lo >= hi || z0 <= zMin || z1 >= Math.min(t0[2], t1[2])) return [poly];
  const at = (a, z) => { const p = lerpAt(b0, b1, axis, a); return [p[0], p[1], z]; };
  const [w00, w10, w01, w11] = [at(lo, z0), at(hi, z0), at(lo, z1), at(hi, z1)];
  const n = polygonNormal(poly);
  const keep = (piece) => {
    const m = polygonNormal(piece);
    return m && n && m[0] * n[0] + m[1] * n[1] + m[2] * n[2] < 0 ? piece.reverse() : piece;
  };
  return [[b0, w00, w01, t0], [b0, b1, w10, w00], [w10, b1, t1, w11], [t0, w01, w11, t1]]
    .filter((piece) => polygonNormal(piece)).map(keep);
}

// Проёмы грани, на которой лежит плоский кусок стенки: ось вдоль грани и способ выреза.
function faceOpenings(poly) {
  if (poly.every((p) => p[0] > ON_FACADE)) return { axis: 1, spans: FACADE_OPENINGS.map((o) => ({ span: o.y, z: o.z })), cut: cutOpening };
  // Передняя грань: проём Tech Bay от цоколя и окно ЭО посреди стенки — у каждого свой вырез.
  if (poly.every((p) => p[1] < ON_FRONT)) return { axis: 0, spans: [...FRONT_OPENINGS.map((o) => ({ span: o.x, z: o.z })), ...FRONT_WINDOWS.map((o) => ({ span: o.x, z: o.z, cut: cutWindow }))], cut: cutOpening };
  if (poly.every((p) => p[0] < ON_SIDE)) return { axis: 1, spans: SIDE_OPENINGS.map((o) => ({ span: o.y, z: o.z })), cut: cutWindow };
  if (poly.every((p) => p[1] > ON_BACK)) return { axis: 0, spans: BACK_OPENINGS.map((o) => ({ span: o.x, z: o.z })), cut: cutOpening };
  if (poly.every((p) => Math.abs(p[0] - ENTRY_X0) < ON_PASSAGE)) return { axis: 1, spans: PASSAGE_OPENINGS.map((o) => ({ span: o.y, z: o.z })), cut: cutOpening };
  return null;
}

// Грань наружной стенки с вырезанными проёмами. Для стенок вне фасадов ничего не меняется.
// sink — пост-обработка вершин (канавки швов, seams.js), после того как проёмы вырезаны.
export function addWallWithOpenings(mesh, poly, color, sink = null) {
  let parts = [poly];
  const face = faceOpenings(poly);
  // Мелкие куски швов (полосы 1,5 мм) проём, который их не задевает, не трогает:
  // иначе вычитание со слиянием вершин ближе 5 мм съело бы их целиком.
  // Допуск 0,01: вершина стыка К4 | К5 лежит на краю проёма ящиков с точностью до 1e-6.
  const TOL = 0.01;
  const misses = (part, { span, z }) => sink && (Math.max(...part.map((p) => p[face.axis])) <= span[0] + TOL
    || Math.min(...part.map((p) => p[face.axis])) >= span[1] - TOL
    || Math.max(...part.map((p) => p[2])) <= z[0] + TOL || Math.min(...part.map((p) => p[2])) >= z[1] - TOL);
  if (face) for (const o of face.spans) parts = parts.flatMap((part) => (misses(part, o) ? [part] : (o.cut || face.cut)(part, face.axis, o.span, o.z)));
  for (const part of parts) addPolygon(mesh, sink ? part.map(sink) : part, color);
}

// Доли вдоль низа куска [b0, b1, …], где его пересекают края проёмов, доходящих
// до верха корпуса: там кончается полоса нижней фаски шва +760.
function bandBreaks(poly) {
  const face = faceOpenings(poly);
  if (!face) return [];
  const [b0, b1] = poly;
  const ax = face.axis;
  const out = [];
  for (const { span, z } of face.spans) {
    if (z[1] < SEAM_Z - 0.01) continue;
    const t = span.map((v) => (v - b0[ax]) / (b1[ax] - b0[ax])).sort((a, b) => a - b);
    out.push(t);
  }
  return out;
}
const lerp4 = (a, b, t) => a.map((v, k) => v + t * (b[k] - v));

// Наружная стенка корпуса со швами модулей (seams.js): полосы канавки +760 и
// вертикальные фаски на стыках. Полоса нижней фаски в пролёте проёма, доходящего
// до +760, вынимается точно по краю проёма (clipPolygon слил бы вершины ближе 5 мм),
// а у полосы верхней фаски над ним на нижнем ребре встают те же точки — без Т-стыков.
export function addSeamedWall(mesh, poly, color) {
  const { pieces, caps } = seamPieces(poly);
  for (const { poly: piece, band } of pieces) {
    const [b0, b1, t1, t0] = piece;
    const upper = piece.length === 4 && b0[2] === SEAM_Z && b1[2] === SEAM_Z;
    const spans = band || upper ? bandBreaks(piece).filter(([a, b]) => b > 1e-6 && a < 1 - 1e-6) : [];
    if (band && spans.length) {
      // Оставляем промежутки между пролётами проёмов.
      let from = 0;
      const keep = [];
      for (const [a, b] of spans.sort((p, q) => p[0] - q[0])) {
        if (a > from + 1e-6) keep.push([from, Math.min(a, 1)]);
        from = Math.max(from, b);
      }
      if (from < 1 - 1e-6) keep.push([from, 1]);
      for (const [a, b] of keep)
        addPolygon(mesh, [lerp4(b0, b1, a), lerp4(b0, b1, b), lerp4(t0, t1, b), lerp4(t0, t1, a)].map(sinkPoint), color);
      continue;
    }
    if (upper && spans.length) {
      const ts = spans.flat().filter((t) => t > 1e-6 && t < 1 - 1e-6).sort((a, b) => a - b);
      // Веер от верхней вершины: точки на нижнем ребре не дают вырожденных треугольников.
      addPolygon(mesh, [t0, b0, ...ts.map((t) => lerp4(b0, b1, t)), b1, t1].map(sinkPoint), color);
      continue;
    }
    addWallWithOpenings(mesh, piece, color, sinkPoint);
  }
  for (const cap of caps) {
    const n = polygonNormal(cap);
    if (n) addPolygon(mesh, n[2] < 0 ? cap : cap.reverse(), color);
  }
}
