// Швы между модулями корпуса на наружной стенке — листы 32, 35 (п. 5) и 38 (п. 6).
// Кромки модулей на фасаде сняты фаской 1,5 × 45°: две фаски дают V-канавку
// шириной 3 и глубиной 1,5. Сквозной щели нет — стык читается тенью, как зазоры
// между ящиками. Вертикальные швы идут от цоколя до верха корпуса +760; там, где
// над корпусом стоит графитовая стенка пояса (второй уровень и спуск), по +760
// идёт такой же горизонтальный шов корпус / пояс. На первом уровне над корпусом
// лежит деревянная кромка кольца — стык совпадает со сменой материала, канавки нет.
//
// Координаты — как у корпуса до отражения (mirror.js). Грани: front — y = 0,
// side — x = 0, facade — x = 2700; along — координата вдоль грани.

import { SIZE, CENTER, CORNER_R, PLINTH, UNDER_1 } from './params.js';

export const SEAM_CHAMFER = 1.5;       // фаска 1,5 × 45° на каждой кромке
export const SEAM_Z = UNDER_1;         // +760: верх корпуса, горизонтальный шов
const C = SEAM_CHAMFER;

// Шесть стыков модулей (лист 32, план слоя 1; лист 35, «Шесть стыков»).
// У прохода К5 и К6 не стыкуются — между ними Bridge, шва нет.
// sides — по какую сторону от стыка есть фаска: у К4 | К5 фасад К4 до самого
// стыка занят ящиками (проём y = 850…2450), поэтому фаска только на К5.
export const MODULE_SEAMS = [
  { id: 'К1|К2', face: 'front', at: 800, sides: [-1, 1] },
  { id: 'К2|К3', face: 'front', at: 1900, sides: [-1, 1] },
  { id: 'К3|К4', face: 'facade', at: 820, sides: [-1, 1] },
  { id: 'К4|К5', face: 'facade', at: 2450, sides: [1] },
  { id: 'К1|К7', face: 'side', at: 820, sides: [-1, 1] },
  { id: 'К7|К6', face: 'side', at: 2450, sides: [-1, 1] },
];

const FACE_POINT = {
  front: (a) => [a, 0],
  side: (a) => [0, a],
  facade: (a) => [SIZE, a],
};

// Углы от центра на кромки фасок и дно канавки: корпус добавляет их в своё
// деление по кругу, и у всех слоёв кольца вершины на шве общие — без Т-стыков.
export const SEAM_ANGLES = MODULE_SEAMS.flatMap(({ face, at, sides }) =>
  [0, ...sides.map((s) => s * C)].map((d) => {
    const [x, y] = FACE_POINT[face](at + d);
    return (Math.atan2(y - CENTER, x - CENTER) + Math.PI * 2) % (Math.PI * 2);
  }));

// Грань и координата вдоль неё для точки на наружном контуре (плоские участки).
function faceOf(p) {
  if (p[1] < 0.5) return ['front', p[0]];
  if (p[0] < 0.5) return ['side', p[1]];
  if (p[0] > SIZE - 0.5) return ['facade', p[1]];
  return [null, 0];
}

// Глубина вертикальной канавки в точке контура: 1,5 на стыке, 0 на кромках фасок.
export function verticalDepth(p) {
  const [face, along] = faceOf(p);
  let d = 0;
  for (const seam of MODULE_SEAMS) {
    if (seam.face !== face) continue;
    const off = along - seam.at;
    if (Math.abs(off) > C + 1e-6) continue;
    if (Math.abs(off) > 1e-6 && !seam.sides.includes(Math.sign(off))) continue;
    d = Math.max(d, C - Math.abs(off));
  }
  return d;
}

// Направление внутрь материала в точке контура: на прямых участках — нормаль
// грани, на скруглениях R200 — к центру скругления. На касании оба совпадают.
export function inwardAt(p) {
  const half = CENTER - CORNER_R;
  const dx = p[0] - CENTER, dy = p[1] - CENTER;
  const ox = Math.max(Math.abs(dx) - half, 0) * Math.sign(dx);
  const oy = Math.max(Math.abs(dy) - half, 0) * Math.sign(dy);
  const l = Math.hypot(ox, oy) || 1;
  return [-ox / l, -oy / l];
}

// Отметки, на которые режется по высоте вертикальное ребро стенки с верхом top.
// Горизонтальная канавка — только там, где стенка заметно выше +760.
const hasBelt = (top) => top > SEAM_Z + C + 1;
function levels(top) {
  const zs = [PLINTH];
  if (hasBelt(top)) zs.push(SEAM_Z - C, SEAM_Z, SEAM_Z + C);
  zs.push(top);
  return zs;
}

// Глубина вершины ребра: вертикальная канавка — до +760, горизонтальная — по +760.
// Верх стенки не утапливается: над ним деталь без канавки (кольцо или кромка).
function depthAt(p2, z, top) {
  const dh = hasBelt(top) ? Math.max(0, C - Math.abs(z - SEAM_Z)) : 0;
  const dv = z <= SEAM_Z + 1e-6 ? verticalDepth(p2) : 0;
  return Math.max(dh, dv);
}

// Четвёртая координата точки — глубина канавки. Проёмы режут стенку ещё плоской
// (openings.js), а утопить вершины можно только после: clipPolygon тянет глубину
// вместе с координатами, у точек без неё глубина считается по месту.
export function sinkPoint(p) {
  const d = p.length > 3 ? p[3] : (p[2] <= SEAM_Z - C ? verticalDepth(p) : 0);
  if (!d) return [p[0], p[1], p[2]];
  const n = inwardAt(p);
  return [p[0] + n[0] * d, p[1] + n[1] * d, p[2]];
}

// Кусок наружной стенки [b0, b1, t1, t0] (низ на цоколе, верх под столешницей)
// режется по высоте на полосы канавки +760. Возвращает { pieces, caps }:
// pieces — полосы с глубиной в четвёртой координате, band — признак полосы
// нижней фаски +758,5…+760 (её в пролёте проёмов нет: там нет корпуса);
// caps — треугольники, закрывающие канавку сверху, где над ней кромка столешницы.
export function seamPieces(poly) {
  if (poly.length !== 4) return { pieces: [{ poly }], caps: [] };
  const [b0, b1, t1, t0] = poly;
  if (Math.abs(b0[2] - PLINTH) > 1e-6 || Math.abs(b1[2] - PLINTH) > 1e-6) return { pieces: [{ poly }], caps: [] };
  const column = (b, t) => levels(t[2]).map((z) => [b[0], b[1], z, depthAt(b, z, t[2])]);
  const L = column(b0, t0), R = column(b1, t1);
  // Конец спуска: у короткого ребра тоже есть отметка +758,5, чтобы низ стенки
  // остался четырёхугольником, а веер лёг выше неё — туда, где проёмов нет.
  // Иначе узкие треугольники веера резались бы окном дверцы ресивера со слиянием 5 мм.
  if (L.length !== R.length) {
    const [short, b, t] = L.length < R.length ? [L, b0, t0] : [R, b1, t1];
    if (t[2] > SEAM_Z - C + 0.5) short.splice(1, 0, [b[0], b[1], SEAM_Z - C, depthAt(b, SEAM_Z - C, t[2])]);
  }
  const pieces = [];
  const isBand = (lo, hi) => lo[2] === SEAM_Z - C && hi[2] === SEAM_Z;
  if (L.length === R.length) {
    for (let k = 0; k < L.length - 1; k++) pieces.push({ poly: [L[k], R[k], R[k + 1], L[k + 1]], band: isBand(L[k], L[k + 1]) });
  } else {
    // Переход с полосами на ребро без них (конец спуска): общие полосы, затем
    // веер от верха короткого ребра — треугольники плоские, чужих вершин на рёбрах нет.
    const leftLong = L.length > R.length;
    const [long, short] = leftLong ? [L, R] : [R, L];
    const base = short.length - 2;
    for (let k = 0; k < base; k++) pieces.push({ poly: [L[k], R[k], R[k + 1], L[k + 1]], band: isBand(L[k], L[k + 1]) });
    const apex = short[short.length - 1];
    if (leftLong) {
      pieces.push({ poly: [apex, L[base], R[base]] });
      for (let k = long.length - 1; k > base; k--) pieces.push({ poly: [apex, L[k], L[k - 1]] });
    } else {
      pieces.push({ poly: [apex, L[base], R[base]] });
      for (let k = base; k < long.length - 1; k++) pieces.push({ poly: [apex, R[k], R[k + 1]] });
    }
  }
  // Крышка канавки: верх стенки на шве утоплен, а кромка над ним — нет.
  const caps = [];
  for (const [b, t, other] of [[b0, t0, b1], [b1, t1, b0]]) {
    const top = t[2];
    const d = depthAt(b, top, top);
    if (!d) continue;
    const n = inwardAt(b);
    const sunk = [b[0] + n[0] * d, b[1] + n[1] * d, top];
    // Треугольник от точки шва до кромки фаски на этом же куске стенки. Если
    // соседняя вершина дальше фаски, кусок — не фаска (у К4 | К5 это проём ящиков).
    if (Math.hypot(other[0] - b[0], other[1] - b[1]) > C + 1e-3) continue;
    const edge = [other[0], other[1], top];
    caps.push([[b[0], b[1], top], edge, sunk]);
  }
  return { pieces, caps };
}
