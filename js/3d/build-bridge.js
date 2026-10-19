// Bridge — одна подъёмная секция входа 60 мм: петля по левой кромке проёма (x = 950),
// свободный конец лежит на опорном выступе справа. Ход 0…100°.
// Геометрия строится в закрытом положении; поворот задаётся матрицей узла.
//
// Сама плита — лист 20: 793 × 1050 × 60 с зазорами 3 у петли и 4 у выступа.
// В ней выбраны две утопленные ручки (снизу) и два канала под газлифты (снизу);
// фурнитура — в bridge-fittings.js.
//
// Плита — та же сотовая, что кольцо (вид 33): обшивка 8 + соты 44 + обшивка 8,
// в рамке из берёзовой фанеры 40 по контуру (у наружного торца — 60). Все
// выборки и весь крепёж — только в фанере: ручки у кромки проёма и у торца
// лежат в рамке, каналы газлифтов с крышками — в закладных 80 × 300 из той же
// фанеры, вклеенных в соты. В соты не врезается ничего.
//
// Поднятый мост смотрит нижней гранью прямо на человека, поэтому она собрана
// без щелей: верх, низ и кромка разбиты по одному общему набору отметок x,
// а контуры ручек и каналов дают вершины ровно на этих отметках. Прежде низ
// резался на полосы вокруг выборок, и на стыках полос оставались Т-образные
// вершины — в рендере по всей длине секции шли тёмные нитки.

import {
  SIZE, CENTER, R_HOLE, LEVEL_1, UNDER_1, EDGE_R, EDGE_SEG,
  ENTRY_X0, LEAF_X0, LEAF_X1, arcY,
} from './params.js';
import { addQuad, addPolygon, polygonNormal } from './mesh.js';
import { clipPolygon } from './entry-cut.js';
import { PALETTE } from './palette.js';
import {
  CHANNEL_TOP, CHANNEL_W, CHANNEL_X1, STRUT_Y, REBATE_D, REBATE_W, COVER_X0, COVER_T, COVER_LIP, COVER_SEAM,
} from './bridge-fittings.js';

const STEPS = 128; // базовое разбиение кромки по дуге отверстия

const R = EDGE_R;
const FLAT_X0 = LEAF_X0 + R;
const FLAT_X1 = LEAF_X1 - R;
const FLAT_Y1 = SIZE - R;
const flatFrontY = (x) => arcY(x, R_HOLE + R);
const FILLET_SEG = 6;
const EPS = 1e-6;

// Четверть 24 × 3 по нижней кромке свободного конца, лист 23. В неё встают
// накладки POM, и ими секция приземляется на плоскую опорную полосу — сталь
// за счёт этого остаётся простым прокатом без ступеньки.
const REBATE_X = LEAF_X1 - REBATE_W;
const REBATE_Z = UNDER_1 + REBATE_D;

// ─── Выборки в нижней грани ─────────────────────────────────────────────────
// Каждая выборка задана в плане как область между нижней lo(x) и верхней hi(x)
// границей на отрезке x0…x1: у ручек и каналов любое вертикальное сечение —
// один отрезок. Так контур выборки ложится на общие отметки x без Т-стыков.

// Капсула вдоль X: ручка у наружного торца.
function straightSlot(xa, xb, yc, r) {
  const c0 = xa + r, c1 = xb - r;
  const half = (x) => {
    const d = x < c0 ? c0 - x : x > c1 ? x - c1 : 0;
    return Math.sqrt(Math.max(0, r * r - d * d));
  };
  return { x0: xa, x1: xb, r, lo: (x) => yc - half(x), hi: (x) => yc + half(x), mid: [(xa + xb) / 2, yc] };
}

// Капсула по дуге радиуса rc вокруг центра отверстия: ручка у кромки проёма
// идёт параллельно кромке, и перемычка между ними везде одинаковая.
function arcSlot(rc, halfLen, r) {
  const phi = halfLen / rc;
  const s = Math.sin(phi);
  const ends = [[CENTER - rc * s, CENTER + rc * Math.cos(phi)], [CENTER + rc * s, CENTER + rc * Math.cos(phi)]];
  const ri = rc - r, ro = rc + r;
  const ranges = (x) => {
    const out = [];
    const dx = x - CENTER;
    const rMin = Math.max(ri, Math.abs(dx) / s);
    if (rMin <= ro) out.push([CENTER + Math.sqrt(rMin * rMin - dx * dx), CENTER + Math.sqrt(ro * ro - dx * dx)]);
    for (const [ex, ey] of ends) {
      const h = r * r - (x - ex) ** 2;
      if (h > -1e-6) out.push([ey - Math.sqrt(Math.max(0, h)), ey + Math.sqrt(Math.max(0, h))]);
    }
    return out;
  };
  return {
    x0: ends[0][0] - r, x1: ends[1][0] + r, r,
    lo: (x) => Math.min(...ranges(x).map((v) => v[0])),
    hi: (x) => Math.max(...ranges(x).map((v) => v[1])),
    mid: [CENTER, CENTER + rc],
  };
}

// Канал газлифта: открыт в торец у петли, дальний конец — полукруг фрезы Ø34.
function channel(yc) {
  const r = CHANNEL_W / 2, cx = CHANNEL_X1 - r;
  const half = (x) => (x <= cx ? r : Math.sqrt(Math.max(0, r * r - (x - cx) ** 2)));
  return { x0: FLAT_X0, x1: CHANNEL_X1, r, open: true, lo: (x) => yc - half(x), hi: (x) => yc + half(x), mid: [cx, yc] };
}

// Снизу канал открыт только до крышки: прямоугольный вырез от торца у петли.
function notch(yc) {
  const r = CHANNEL_W / 2;
  return { x0: FLAT_X0, x1: COVER_X0, r, open: true, noCaps: true, lo: () => yc - r, hi: () => yc + r, mid: [COVER_X0, yc] };
}

// Контур крышки в нижней грани: прямой торец в открытой части, дальний конец —
// полукруг, соосный с концом канала. grow — наружу, на ширину шва.
function coverOutline(yc, grow) {
  const r = CHANNEL_W / 2 + COVER_LIP + grow;
  const cx = CHANNEL_X1 - CHANNEL_W / 2;
  const half = (x) => (x <= cx ? r : Math.sqrt(Math.max(0, r * r - (x - cx) ** 2)));
  return { x0: COVER_X0, x1: cx + r, r, square: true, lo: (x) => yc - half(x), hi: (x) => yc + half(x), mid: [cx, yc] };
}

// Шов вокруг крышки — две полосы, нижняя и верхняя: каждое вертикальное сечение
// полосы — один отрезок. За концом крышки полосы смыкаются на оси канала.
function seamStrips(yc) {
  const lid = coverOutline(yc, 0), rim = coverOutline(yc, COVER_SEAM);
  const strip = (lo, hi) => ({ x0: rim.x0, x1: rim.x1, r: COVER_SEAM / 2, square: true, noCaps: true, yc, lid, lo, hi, mid: rim.mid });
  return [
    strip(rim.lo, (x) => (x <= lid.x1 ? lid.lo(x) : yc)),
    strip((x) => (x <= lid.x1 ? lid.hi(x) : yc), rim.hi),
  ];
}

// Утопленные ручки, лист 20: площадка 200 × 28, глубина 25 от нижней грани, —
// у каждой кромки, изнутри стола и из комнаты, чтобы секцию можно было поднять
// с любой стороны. Сверху их не видно: выборка идёт снизу, пальцы заходят под
// кромку. Выбраны концевой фрезой Ø28, поэтому концы полукруглые, а по краю
// снята фаска 2 — острое ребро шпона на ручке под пальцами не оставляют.
const HANDLE_R = 14;
const HANDLE_DEPTH = 25;
const HANDLE_CHAMFER = 2;
const HANDLE_EDGE = 12;                      // перемычка от кромки проёма до ручки
const HANDLE_X = [ENTRY_X0 + 300, ENTRY_X0 + 500];
const HANDLE_OUTER_Y = SIZE - 20 - HANDLE_R; // 20 от наружного торца
const handleShape = (grow) => [
  arcSlot(R_HOLE + HANDLE_EDGE + HANDLE_R, (HANDLE_X[1] - HANDLE_X[0]) / 2 - HANDLE_R, HANDLE_R + grow),
  straightSlot(HANDLE_X[0] - grow, HANDLE_X[1] + grow, HANDLE_OUTER_Y, HANDLE_R + grow),
];
const HANDLES = handleShape(0);
const HANDLE_RIMS = handleShape(HANDLE_CHAMFER);
const CHANNELS = STRUT_Y.map(channel);
const NOTCHES = STRUT_Y.map(notch);
const LIDS = STRUT_Y.map((y) => coverOutline(y, 0));
const LID_RIMS = STRUT_Y.map((y) => coverOutline(y, COVER_SEAM));
const SEAMS = STRUT_Y.map(seamStrips);

// Отметки в концевых полукругах: косинусная раскладка, гуще у самого конца.
function capSamples(shape) {
  const xs = [shape.x0, shape.x1];
  if (shape.noCaps) return xs;
  for (let k = 1; k < 10; k++) {
    const d = shape.r * (1 - Math.cos((k / 10) * (Math.PI / 2)));
    if (!shape.open && !shape.square) xs.push(shape.x0 + d);
    xs.push(shape.x1 - d);
  }
  return xs;
}

// Общий набор отметок x: база по дуге, начало четверти, концы всех выборок.
// Концы выборок и начало четверти при слиянии близких отметок не теряются:
// колонка не должна проходить сквозь конец выборки.
const XS = (() => {
  const shapes = [...HANDLES, ...HANDLE_RIMS, ...CHANNELS, ...NOTCHES, ...LIDS, ...LID_RIMS, ...SEAMS.flat()];
  const keys = new Set([FLAT_X0, FLAT_X1, REBATE_X, ...shapes.flatMap((s) => [s.x0, s.x1])]);
  const raw = Array.from({ length: STEPS + 1 }, (_, j) => FLAT_X0 + (j * (FLAT_X1 - FLAT_X0)) / STEPS);
  raw.push(...keys, ...shapes.flatMap(capSamples));
  raw.sort((a, b) => a - b);
  const out = [];
  for (const x of raw) {
    const last = out[out.length - 1];
    if (last === undefined || x - last > 0.05) out.push(x);
    else if (keys.has(x) && !keys.has(last)) out[out.length - 1] = x;
  }
  return out;
})();

const within = (shape, x) => x >= shape.x0 - EPS && x <= shape.x1 + EPS;
// Цепочка границы выборки по общим отметкам: нижняя или верхняя, слева направо.
const chain = (shape, side, z) => XS.filter((x) => within(shape, x)).map((x) => [x, shape[side](x), z]);

// Грань с нормалью в заданную сторону: наружу из тела плиты.
function addFacing(mesh, pts, dir, color) {
  const n = polygonNormal(pts);
  if (!n) return;
  addPolygon(mesh, n[0] * dir[0] + n[1] * dir[1] + n[2] * dir[2] >= 0 ? pts : pts.slice().reverse(), color);
}

// Полоса треугольников между двумя цепочками, идущими слева направо.
function zip(a, b, emit) {
  let i = 0, j = 0;
  while (i < a.length - 1 || j < b.length - 1) {
    if (j >= b.length - 1 || (i < a.length - 1 && a[i + 1][0] <= b[j + 1][0])) { emit([a[i], a[i + 1], b[j]]); i++; }
    else { emit([a[i], b[j + 1], b[j]]); j++; }
  }
}

// Направление с грани внутрь выборки — туда смотрят её стенки и потолок.
function inward(shape, p) {
  const x = Math.min(Math.max(p[0], shape.x0 + shape.r), shape.x1 - shape.r);
  const y = (shape.lo(x) + shape.hi(x)) / 2;
  const d = [x - p[0], y - p[1]];
  const l = Math.hypot(d[0], d[1]) || 1;
  return [d[0] / l, d[1] / l, 0];
}

// ─── Кромка ─────────────────────────────────────────────────────────────────
// Секция поднимается, и в поднятом положении к человеку обращены все её кромки,
// а не только верх со стороны отверстия. Поэтому R8 идёт по всем двенадцати
// рёбрам плиты: сверху и снизу по дуге, по наружному торцу и по обоим боковым,
// плюс вертикальные углы в плане. Где сходятся три скругления, получается
// сферический угол — это даёт сама развёртка профиля по скруглённому контуру.

// Профиль кромки снизу вверх: (отступ внутрь от контура, отметка).
// Нижний вал, вертикальная грань между индексами EDGE_SEG и EDGE_SEG + 1, верхний вал.
const PROFILE = [
  ...Array.from({ length: EDGE_SEG + 1 }, (_, k) => {
    const phi = (Math.PI / 2) * (k / EDGE_SEG);
    return [R - R * Math.sin(phi), UNDER_1 + R - R * Math.cos(phi)];
  }),
  ...Array.from({ length: EDGE_SEG + 1 }, (_, k) => {
    const phi = (Math.PI / 2) * (k / EDGE_SEG);
    return [R - R * Math.cos(phi), LEVEL_1 - R + R * Math.sin(phi)];
  }),
];
const FACE = EDGE_SEG; // полоса вертикальной грани в профиле

// Точки свободного торца между скруглениями углов.
const freeEndYs = () => {
  const y0 = flatFrontY(FLAT_X1);
  return Array.from({ length: 9 }, (_, j) => y0 + ((FLAT_Y1 - y0) * j) / 8);
};
// Торец у петли: в него выходят каналы газлифтов, их границы — отдельные точки.
const HINGE_YS = [FLAT_Y1, flatFrontY(FLAT_X0), ...CHANNELS.flatMap((c) => [c.lo(FLAT_X0), c.hi(FLAT_X0)])]
  .sort((a, b) => b - a);

// Точка контура на плане: основание p и направление внутрь n. Отступ d от контура
// даёт p + d·n — для прямых, дуги отверстия и скруглений углов это верно одинаково.
function contour() {
  const pts = [];
  const H = [CENTER, CENTER];
  const fillet = (c, a0, a1) => {
    for (let k = 0; k <= FILLET_SEG; k++) {
      const a = a0 + ((a1 - a0) * k) / FILLET_SEG;
      const v = [Math.cos(a), Math.sin(a)];
      pts.push({ p: [c[0] + R * v[0], c[1] + R * v[1]], n: [-v[0], -v[1]] });
    }
  };
  const toHole = (c) => Math.atan2(H[1] - c[1], H[0] - c[0]);
  const c0 = [FLAT_X0, flatFrontY(FLAT_X0)];
  const c1 = [FLAT_X1, flatFrontY(FLAT_X1)];

  // Обход против часовой, плита слева: угол у петли, дуга отверстия, угол у выступа,
  // свободный торец, наружные углы и наружный торец, торец у петли.
  fillet(c0, Math.PI, toHole(c0) + Math.PI * 2);
  for (const x of XS) {
    const len = R_HOLE + R;
    const u = [(x - CENTER) / len, (flatFrontY(x) - CENTER) / len];
    const pt = { p: [CENTER + R_HOLE * u[0], CENTER + R_HOLE * u[1]], n: u };
    pts.push(pt);
    // На начале четверти кромка идёт двумя кольцами — полным и срезанным:
    // между ними и встаёт стенка четверти, без отдельной грани поперёк вала.
    if (x === REBATE_X) pts.push({ ...pt, rebate: true });
  }
  fillet(c1, toHole(c1) + Math.PI * 2, Math.PI * 2);
  for (const y of freeEndYs()) pts.push({ p: [LEAF_X1, y], n: [-1, 0] });
  fillet([FLAT_X1, FLAT_Y1], 0, Math.PI / 2);
  for (const x of XS.slice().reverse()) {
    if (x === REBATE_X) pts.push({ p: [x, SIZE], n: [0, -1], rebate: true });
    pts.push({ p: [x, SIZE], n: [0, -1] });
  }
  fillet([FLAT_X0, FLAT_Y1], Math.PI / 2, Math.PI);
  for (const y of HINGE_YS) pts.push({ p: [LEAF_X0, y], n: [1, 0], hinge: true });
  return pts;
}

// Вал снизу у свободного конца срезан четвертью: ниже её потолка материала нет.
// Решает положение точки контура на плоскости низа, одно на всё кольцо профиля.
const inRebate = ({ p, n, rebate }) => rebate || p[0] + R * n[0] > REBATE_X + EPS;
function profilePoint(pt, index) {
  const [d, z] = PROFILE[index];
  const x = pt.p[0] + d * pt.n[0], y = pt.p[1] + d * pt.n[1];
  return [x, y, index < FACE && inRebate(pt) ? Math.max(z, REBATE_Z) : z];
}

const inChannel = (y) => CHANNELS.some((c) => y > c.lo(FLAT_X0) && y < c.hi(FLAT_X0));

// Вычитание прямоугольного окна из плоской грани по двум её осям.
function cutOut(poly, axisA, [a0, a1], axisB, [b0, b1]) {
  const before = clipPolygon(poly, axisA, a0, true);
  const after = clipPolygon(poly, axisA, a1, false);
  const band = clipPolygon(clipPolygon(poly, axisA, a0, false), axisA, a1, true);
  return [before, after, clipPolygon(band, axisB, b0, true), clipPolygon(band, axisB, b1, false)]
    .filter((p) => p.length >= 3);
}

// ─── Плоскости верха и низа ─────────────────────────────────────────────────
// Колонка между соседними отметками x: от дуги отверстия до наружного торца,
// за вычетом выборок. Каждый кусок — трапеция с вертикальными боками; на бока
// добавлены вершины соседей (концы выборок, точки торцов), чтобы стык был общим.
function columnPieces(xa, xb, shapes, sideYs) {
  const active = shapes.filter((s) => within(s, xa) && within(s, xb) && s.x1 - s.x0 > EPS)
    .sort((s, t) => s.lo((xa + xb) / 2) - t.lo((xa + xb) / 2));
  const bounds = (x) => {
    const b = [flatFrontY(x)];
    for (const s of active) b.push(s.lo(x), s.hi(x));
    b.push(FLAT_Y1);
    return b;
  };
  const A = bounds(xa), B = bounds(xb);
  const pieces = [];
  for (let k = 0; k < A.length; k += 2) {
    const extra = (x, y0, y1) => (sideYs.get(x) || []).filter((y) => y > y0 + EPS && y < y1 - EPS);
    // Против часовой: низ слева направо, правый бок вверх, верх, левый бок вниз.
    pieces.push([
      [xb, B[k]], ...extra(xb, B[k], B[k + 1]).sort((u, v) => u - v).map((y) => [xb, y]), [xb, B[k + 1]],
      [xa, A[k + 1]], ...extra(xa, A[k], A[k + 1]).sort((u, v) => v - u).map((y) => [xa, y]), [xa, A[k]],
    ]);
  }
  return pieces;
}

// Точки, лежащие на вертикальных боках колонок: концы выборок и точки торцов.
function sideVertices(shapes, edges) {
  const map = new Map();
  const add = (x, y) => { if (!map.has(x)) map.set(x, []); map.get(x).push(y); };
  // У прямого торца выборки на бок соседа ложатся обе его вершины.
  for (const s of shapes) {
    if (!s.open) { add(s.x0, s.lo(s.x0)); add(s.x0, s.hi(s.x0)); }
    add(s.x1, s.lo(s.x1));
    add(s.x1, s.hi(s.x1));
  }
  for (const [x, ys] of edges) for (const y of ys) add(x, y);
  return map;
}

function flatFace(mesh, z, shapes, sideYs, [x0, x1], down, color) {
  for (let i = 0; i < XS.length - 1; i++) {
    const xa = XS[i], xb = XS[i + 1];
    if (xa < x0 - EPS || xb > x1 + EPS) continue;
    for (const piece of columnPieces(xa, xb, shapes, sideYs)) {
      const pts = piece.map(([x, y]) => [x, y, z]);
      // Веер от правого нижнего угла: вершины на левом боку дают целые треугольники.
      addPolygon(mesh, down ? pts.reverse() : pts, color);
    }
  }
}

// ─── Выборки: ручки и каналы ────────────────────────────────────────────────
function handlePocket(mesh, rim, slot) {
  const color = PALETTE.worktopBottom;
  const zc = UNDER_1 + HANDLE_CHAMFER, zf = UNDER_1 + HANDLE_DEPTH;
  // Фаска: от контура в нижней грани к стенке ручки.
  for (const side of ['lo', 'hi'])
    zip(chain(rim, side, UNDER_1), chain(slot, side, zc), (t) => addFacing(mesh, t, [...inward(slot, t[0]).slice(0, 2), -1], color));
  // Стенки по контуру ручки.
  const ring = [...chain(slot, 'lo', 0), ...chain(slot, 'hi', 0).reverse().slice(1, -1)];
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i], b = ring[(i + 1) % ring.length];
    addFacing(mesh, [[a[0], a[1], zc], [b[0], b[1], zc], [b[0], b[1], zf], [a[0], a[1], zf]], inward(slot, a), color);
  }
  // Дно выборки смотрит вниз, в сторону пальцев.
  zip(chain(slot, 'lo', zf), chain(slot, 'hi', zf), (t) => addFacing(mesh, t, [0, 0, -1], color));
}

function channelGroove(mesh, ch, open) {
  const color = PALETTE.worktopBottom;
  const zLid = UNDER_1 + COVER_T;
  const wall = (a, b, z0, z1, dir) =>
    addFacing(mesh, [[a[0], a[1], z0], [b[0], b[1], z0], [b[0], b[1], z1], [a[0], a[1], z1]], dir, color);
  // Открытая часть у петли: стенки на всю высоту канала, с вершиной на отметке
  // верха крышки — там к ним примыкают стенки над крышкой.
  for (const side of ['lo', 'hi']) {
    const c = chain(open, side, 0);
    for (let i = 0; i < c.length - 1; i++)
      for (const [z0, z1] of [[UNDER_1, zLid], [zLid, CHANNEL_TOP]]) wall(c[i], c[i + 1], z0, z1, inward(ch, c[i]));
  }
  // Торец крышки, выходящий в открытую часть: за него крышку и снимают.
  wall([COVER_X0, open.lo(COVER_X0)], [COVER_X0, open.hi(COVER_X0)], UNDER_1, zLid, [-1, 0, 0]);
  // Над крышкой канал идёт до полукруглого конца; верх крышки виден в вырез.
  const tunnel = (side, z) => chain(ch, side, z).filter(([x]) => x >= COVER_X0 - EPS);
  const ring = [...tunnel('lo', 0), ...tunnel('hi', 0).reverse().slice(1)];
  for (let i = 0; i < ring.length - 1; i++) wall(ring[i], ring[i + 1], zLid, CHANNEL_TOP, inward(ch, ring[i]));
  zip(tunnel('lo', zLid), tunnel('hi', zLid), (t) => addFacing(mesh, t, [0, 0, 1], color));
  // У устья стенки идут по нижнему валу кромки у петли.
  for (const [y, dir] of [[ch.lo(FLAT_X0), 1], [ch.hi(FLAT_X0), -1]]) {
    const side = [];
    for (let k = EDGE_SEG; k >= 0; k--) {
      const [d, z] = PROFILE[k];
      side.push([LEAF_X0 + d, y, z]);
    }
    side.push([FLAT_X0, y, zLid], [FLAT_X0, y, CHANNEL_TOP], [LEAF_X0, y, CHANNEL_TOP]);
    addFacing(mesh, side, [0, dir, 0], color);
  }
  // Потолок канала: над валом у устья и дальше по всей выборке.
  addFacing(mesh, [[LEAF_X0, ch.lo(FLAT_X0), CHANNEL_TOP], [FLAT_X0, ch.lo(FLAT_X0), CHANNEL_TOP],
    [FLAT_X0, ch.hi(FLAT_X0), CHANNEL_TOP], [LEAF_X0, ch.hi(FLAT_X0), CHANNEL_TOP]], [0, 0, -1], color);
  zip(chain(ch, 'lo', CHANNEL_TOP), chain(ch, 'hi', CHANNEL_TOP), (t) => addFacing(mesh, t, [0, 0, -1], color));
}

// Шов крышки: тёмная канавка 0,8 на глубину 1,5 — дальше её закрывает четверть.
const SEAM_DEPTH = 1.5;
function coverSeam(mesh, strip) {
  const z = UNDER_1 + SEAM_DEPTH;
  zip(chain(strip, 'lo', z), chain(strip, 'hi', z), (t) => addFacing(mesh, t, [0, 0, -1], PALETTE.buffer));
  const ring = [...chain(strip, 'lo', 0), ...chain(strip, 'hi', 0).reverse()];
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i], b = ring[(i + 1) % ring.length];
    if (Math.hypot(a[0] - b[0], a[1] - b[1]) < EPS) continue;
    // За концом крышки полосы сомкнуты по оси канала: стенки там нет.
    if (Math.abs(a[1] - strip.yc) < EPS && Math.abs(b[1] - strip.yc) < EPS && Math.min(a[0], b[0]) >= strip.lid.x1 - EPS) continue;
    addFacing(mesh, [[a[0], a[1], UNDER_1], [b[0], b[1], UNDER_1], [b[0], b[1], z], [a[0], a[1], z]], inward(strip, a), PALETTE.buffer);
  }
}

export function buildBridge(mesh) {
  const path = contour();

  // Кромка по всему контуру: нижний вал, торец и верхний вал одной развёрткой.
  for (let i = 0; i < path.length - 1; i++) {
    const a = path[i], b = path[i + 1];
    const openChannel = a.hinge && b.hinge && inChannel((a.p[1] + b.p[1]) / 2);
    for (let k = 0; k < PROFILE.length - 1; k++) {
      if (k === EDGE_SEG) {
        const face = [profilePoint(a, k), profilePoint(b, k), profilePoint(b, k + 1), profilePoint(a, k + 1)];
        if (openChannel) {
          for (const part of cutOut(face, 1, [a.p[1], b.p[1]].sort((u, v) => u - v), 2, [UNDER_1, CHANNEL_TOP]))
            addPolygon(mesh, part, PALETTE.bridge);
        } else {
          // Полоса торца режется на отметке потолка каналов по всему контуру:
          // у стенок канала там вершина, и стык должен быть общим.
          const [p0, p1, p2, p3] = face;
          const cut = (p) => [p[0], p[1], CHANNEL_TOP];
          addPolygon(mesh, [p0, p1, cut(p1), cut(p0)], PALETTE.bridge);
          addPolygon(mesh, [cut(p0), cut(p1), p2, p3], PALETTE.bridge);
        }
        continue;
      }
      if (openChannel && k < EDGE_SEG) continue; // канал открыт в нижнюю кромку
      // Шпон огибает и нижний вал (софтформинг), поэтому цвет — как у кромки.
      addQuad(mesh, profilePoint(a, k), profilePoint(b, k), profilePoint(b, k + 1), profilePoint(a, k + 1), PALETTE.bridge);
    }
  }

  // Верх секции: рабочая плоскость 820 без единого выреза.
  const topSides = sideVertices([], [[FLAT_X0, HINGE_YS], [FLAT_X1, freeEndYs()]]);
  flatFace(mesh, LEVEL_1, [], topSides, [FLAT_X0, FLAT_X1], false, PALETTE.bridge);

  // Низ секции: та же плита за вычетом каналов под газлифты, ручек и четверти.
  const cuts = [...NOTCHES, ...SEAMS.flat(), ...HANDLE_RIMS];
  flatFace(mesh, UNDER_1, cuts, sideVertices(cuts, [[FLAT_X0, HINGE_YS]]), [FLAT_X0, REBATE_X], true, PALETTE.worktopBottom);
  // Потолок четверти на отметке 763.
  flatFace(mesh, REBATE_Z, [], sideVertices([], [[FLAT_X1, freeEndYs()]]), [REBATE_X, FLAT_X1], true, PALETTE.worktopBottom);

  // Стенка четверти поперёк плоскости низа, от вала у отверстия до вала у торца.
  // Её части на самих валах дают кольца кромки на x = REBATE_X.
  addFacing(mesh, [[REBATE_X, flatFrontY(REBATE_X), UNDER_1], [REBATE_X, FLAT_Y1, UNDER_1],
    [REBATE_X, FLAT_Y1, REBATE_Z], [REBATE_X, flatFrontY(REBATE_X), REBATE_Z]], [1, 0, 0], PALETTE.worktopBottom);

  // Ручки выбраны снизу вверх, из нижней грани плиты. Выборка идёт по телу
  // двухсторонне облицованной плиты, поэтому стенки и дно получают тот же
  // нижний шпон, что и сама грань, — а не цвет зазора.
  HANDLES.forEach((slot, i) => handlePocket(mesh, HANDLE_RIMS[i], slot));
  CHANNELS.forEach((ch, i) => channelGroove(mesh, ch, NOTCHES[i]));
  for (const strip of SEAMS.flat()) coverSeam(mesh, strip);
}

// Контур секции для линий: касательные скруглений на верхней и нижней плоскости.
export function bridgeEdges() {
  const outline = [...XS.map((x) => [x, flatFrontY(x), LEVEL_1]), [FLAT_X1, FLAT_Y1, LEVEL_1], [FLAT_X0, FLAT_Y1, LEVEL_1]];
  // Снизу плоскость кончается у четверти.
  const xb = XS.filter((x) => x <= REBATE_X + EPS);
  const bottom = [...xb.map((x) => [x, flatFrontY(x), UNDER_1]), [REBATE_X, FLAT_Y1, UNDER_1], [FLAT_X0, FLAT_Y1, UNDER_1]];
  const handles = HANDLE_RIMS.map((rim) => [...chain(rim, 'lo', UNDER_1), ...chain(rim, 'hi', UNDER_1).reverse()]);
  return { outline, bottom, handles };
}

// Ось поворота секции: лежит в плоскости столешницы у левой кромки проёма.
export const HINGE = [ENTRY_X0, 0, LEVEL_1];
