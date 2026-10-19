// Панели для наушников в 3D — места и размеры в audio-panels.js, docs/headphones.
//
// В дереве — прямой вырез без тонкой губы (buildAudioPocketCut в корпусе).
// Чёрная вставка закрывает откосы и край выреза: кант с нахлёстом, мягким наружным
// краем и внутренним радиусом. Панель с гнёздами остаётся в глубине.
//
// Координаты — как у корпуса до отражения (mirror.js). Локальная система гнезда:
// ex — вправо для смотрящего на панель (после отражения тоже вправо), ey — вверх,
// ez — к человеку; глубина — отрицательная ez.

import {
  at, radial, tangent, add, sub, mul, dot as vdot, cross, norm, lathe, roundedBox, grid as rawGrid, cable,
} from './build-monitor-rail.js?v=20260925-real';
import { addPolygon as rawPolygon, polygonNormal } from './mesh.js';
import { R_HOLE, UNDER_1 } from './params.js';
import { PALETTE } from './palette.js';
import {
  AUDIO_POCKET as P, AUDIO_PANELS, AUDIO_PORTS, AUDIO_HOOK, R_FACE, R_BACK, Z_CEIL, Z_CUT, Z_PORT, arcDeg,
} from './audio-panels.js';

// Обход граней — как у остальных деталей корпуса до отражения: нормаль обхода
// противоположна нормали вершин (после mirror.js она смотрит наружу). Сетки здесь
// строятся в удобном порядке, а обход выравнивается по заданным нормалям.
function grid(mesh, P, N, color, opts) {
  let score = 0;
  for (let i = 0; i < P.length - 1; i++) for (let j = 0; j < P[0].length - 1; j++) {
    const n = cross(sub(P[i + 1][j], P[i][j]), sub(P[i + 1][j + 1], P[i][j]));
    score += Math.sign(vdot(n, N[i][j]));
  }
  if (score > 0) rawGrid(mesh, P.slice().reverse(), N.slice().reverse(), color, opts);
  else rawGrid(mesh, P, N, color, opts);
}
function addPolygon(mesh, pts, color, want) {
  const n = polygonNormal(pts);
  rawPolygon(mesh, n && vdot(n, want) > 0 ? pts.slice().reverse() : pts, color);
}

const C = {
  anod: PALETTE.audioAnod,
  steel: PALETTE.audioSteel,
  gold: PALETTE.audioGold,
  black: PALETTE.audioBlack,
  voids: PALETTE.audioVoid,
  etch: PALETTE.audioEtch,
};

const HALF = P.length / 2;                 // внутренний торец кармана по дуге
const MR = P.mouth;                        // скругление устья
const FR = P.faceRound;                    // скругление нижней кромки панели
const GAP = P.gap;                         // теневой зазор вокруг панели
// Точка на цилиндре: s — дуга на R_FACE от середины панели, r — радиус, z — отметка.
const on = (theta, s, r, z) => at(theta + arcDeg(s), r, z);
const nrm = (theta, s, nr, nz) => norm(add(mul(radial(theta + arcDeg(s)), nr), [0, 0, nz]));
const steps = (a, b, n) => Array.from({ length: n + 1 }, (_, k) => a + ((b - a) * k) / n);
const unique = (list) => list.sort((a, b) => a - b).filter((v, k, arr) => k === 0 || v - arr[k - 1] > 1e-6);
const quarter = (a, rad, n = 8) => steps(0, 90, n).map((t) => a + rad * (1 - Math.cos(t * Math.PI / 180)));

// Насколько раздаётся карман у устья: p — глубина в скругление от кромки стола,
// q — от низа плиты. Одно скругление — четверть круга радиуса MR, в углу — сфера.
const flare = (p, q) => MR - Math.sqrt(Math.max(0, MR * MR - p * p - q * q));
const R_MOUTH = R_HOLE - P.lipProjection;
const pFromR = (r) => Math.max(0, MR - (r - R_MOUTH));
const qFromZ = (z) => Math.max(0, MR - (z - UNDER_1));
const wallS = (r, z) => HALF + flare(pFromR(r), qFromZ(z));   // торец кармана по дуге
const ceilZ = (r) => Z_CEIL + flare(pFromR(r), 0);           // потолок кармана

// Профиль (r, z, nr, nz) протягивается по дуге по точкам S; warp задаёт сдвиг крайних точек.
function sweep(mesh, theta, profile, S, color, warp = null) {
  const s = (k, z) => (warp && (k === 0 || k === S.length - 1) ? Math.sign(S[k]) * warp(z) : S[k]);
  grid(mesh, profile.map(([r, z]) => S.map((_, k) => on(theta, s(k, z), r, z))),
    profile.map(([, z, nr, nz]) => S.map((_, k) => nrm(theta, s(k, z), nr, nz))), color);
}

// Четверть скругления в плоскости (r, z): центр, радиус, углы от a0 до a1 (градусы).
const fillet = (cr, cz, rad, a0, a1, n = 6) => steps(a0, a1, n).map((a) => {
  const c = Math.cos(a * Math.PI / 180), s = Math.sin(a * Math.PI / 180);
  return [cr + rad * c, cz + rad * s, c, s];
});

// ── Вырез и металлическая вставка ─────────────────────────────────────────────────────────
// Потолок и торцы кармана одной поверхностью: по глубине от кромки R500 до лица
// панели, по контуру — левый торец снизу вверх, потолок, правый торец сверху вниз.
// Внутренний радиус и откосы целиком принадлежат металлической вставке.
function pocketSurface(mesh, theta, color, Rs) {
  const Zw = unique([...quarter(UNDER_1, MR, 10), ...steps(UNDER_1 + MR, Z_CEIL, 8)]);
  const Sin = steps(-HALF, HALF, 34).slice(1, -1);
  const contour = (r) => {
    const top = ceilZ(r);
    const left = Zw.map((z, k) => { const zz = k === Zw.length - 1 ? top : z; return [-wallS(r, zz), zz]; });
    const right = left.slice().reverse().map(([s, z]) => [-s, z]);
    return [...left, ...Sin.map((s) => [s, top]), ...right];
  };
  const Pts = Rs.map((r) => contour(r).map(([s, z]) => on(theta, s, r, z)));
  // нормали — по соседним точкам, внутрь кармана (к оси панели и вниз)
  const N = Pts.map((row, i) => row.map((p, j) => {
    const a = Pts[Math.max(0, i - 1)][j], b = Pts[Math.min(Pts.length - 1, i + 1)][j];
    const c = row[Math.max(0, j - 1)], d = row[Math.min(row.length - 1, j + 1)];
    let n = norm(cross(sub(b, a), sub(d, c)));
    if (vdot(n, sub(on(theta, 0, Rs[i], Z_PORT), p)) < 0) n = mul(n, -1);
    return n;
  }));
  grid(mesh, Pts, N, color);
}

// Прямые стенки выборки: дерево не выступает внутрь ниши тонкой губой.
export function buildAudioPocketCut(mesh, theta, color) {
  const h = HALF + MR;
  const contour = [[-h, UNDER_1], [-h, Z_CUT], [h, Z_CUT], [h, UNDER_1]];
  for (let j = 0; j < contour.length - 1; j++) {
    const [a, b] = [contour[j], contour[j + 1]];
    // Потолок повторяет дугу стола: длинная хорда выступала бы сквозь кант.
    const n = j === 1 ? 36 : 1;
    const want = j === 1 ? [0, 0, -1] : mul(tangent(theta), j === 0 ? 1 : -1);
    for (let k = 0; k < n; k++) {
      const q = [k / n, (k + 1) / n].map((t) => a.map((v, i) => v + (b[i] - v) * t));
      const pts = [on(theta, q[0][0], R_HOLE, q[0][1]), on(theta, q[1][0], R_HOLE, q[1][1]),
        on(theta, q[1][0], R_BACK, q[1][1]), on(theta, q[0][0], R_BACK, q[0][1])];
      addPolygon(mesh, pts, color, want);
    }
  }
}

// U-образный кант перекрывает край дерева. u — отступ наружу от прямого выреза;
// углы наружного контура закруглены, наружная кромка завалена к дереву.
function pocketLip(mesh, theta) {
  const h = HALF + MR, w = P.overlap, f = P.lipRound;
  const contour = (u) => [
    ...steps(UNDER_1, Z_CUT, 16).map((z) => [-h - u, z]),
    ...steps(Math.PI, Math.PI / 2, 8).slice(1).map((a) => [-h + u * Math.cos(a), Z_CUT + u * Math.sin(a)]),
    ...steps(-h, h, 36).slice(1).map((s) => [s, Z_CUT + u]),
    ...steps(Math.PI / 2, 0, 8).slice(1).map((a) => [h + u * Math.cos(a), Z_CUT + u * Math.sin(a)]),
    ...steps(Z_CUT, UNDER_1, 16).slice(1).map((z) => [h + u, z]),
  ];
  const profile = [[0, R_MOUTH], [w - f, R_MOUTH],
    ...steps(0, Math.PI / 2, 8).slice(1).map((a) => [w - f + f * Math.sin(a), R_MOUTH + f * (1 - Math.cos(a))]),
    [w, R_HOLE], [0, R_HOLE]];
  for (let i = 0; i < profile.length - 1; i++) {
    const rows = profile.slice(i, i + 2).map(([u, r]) => contour(u).map(([s, z]) => on(theta, s, r, z)));
    for (let j = 0; j < rows[0].length - 1; j++) {
      const pts = [rows[0][j], rows[0][j + 1], rows[1][j + 1], rows[1][j]];
      const mid = mul(add(pts[0], pts[2]), 0.5);
      const want = i === profile.length - 2 ? radial(theta) : sub(mid, on(theta, 0, R_HOLE + 10, Z_PORT));
      addPolygon(mesh, pts, C.anod, want);
    }
  }
  // Нижние торцы канта закрыты, без открытого ребра листового металла.
  for (const sign of [-1, 1]) {
    addPolygon(mesh, profile.map(([u, r]) => on(theta, sign * (h + u), r, UNDER_1)), C.anod, [0, 0, -1]);
  }
}
function pocketLiner(mesh, theta) {
  pocketSurface(mesh, theta, C.anod, unique([...quarter(R_MOUTH, MR, 12), ...steps(R_MOUTH + MR, R_FACE, 12)]));
  pocketLip(mesh, theta);
}

// Край панели на лице: контур кармана минус теневой зазор.
const plateS = (z) => wallS(R_FACE, z) - GAP;

// Теневой зазор: узкая тёмная канавка между краем панели и металлическими откосами.
function shadowGap(mesh, theta) {
  const Zs = unique([...quarter(UNDER_1, MR, 10), ...steps(UNDER_1 + MR, Z_CEIL, 8)]);
  const S = steps(-HALF, HALF, 34);
  const outer = [...Zs.map((z) => [-wallS(R_FACE, z), z]), ...S.slice(1, -1).map((s) => [s, Z_CEIL]), ...Zs.slice().reverse().map((z) => [wallS(R_FACE, z), z])];
  const inner = [...Zs.map((z) => [-plateS(Math.min(z, Z_CEIL - GAP)), Math.min(z, Z_CEIL - GAP)]), ...S.slice(1, -1).map((s) => [s, Z_CEIL - GAP]),
    ...Zs.slice().reverse().map((z) => [plateS(Math.min(z, Z_CEIL - GAP)), Math.min(z, Z_CEIL - GAP)])];
  grid(mesh, [outer.map(([s, z]) => on(theta, s, R_FACE, z)), inner.map(([s, z]) => on(theta, s, R_FACE + 1.2, z))],
    [outer.map(([s]) => nrm(theta, s, -1, 0)), inner.map(([s]) => nrm(theta, s, -1, 0))], C.voids);
}

// Нижняя кромка панели: скругление R1,5 в низ плиты, дальше низ панели до её задней грани.
function faceBottom(mesh, theta, withPorts) {
  const profile = [[R_FACE, UNDER_1 + FR, -1, 0], ...fillet(R_FACE + FR, UNDER_1 + FR, FR, 180, 270, 6).slice(1), [R_BACK, UNDER_1, 0, -1]];
  sweep(mesh, theta, profile.slice().reverse(), panelS(withPorts), C.anod, (z) => plateS(z));
}

// Контур выреза: скруглённый прямоугольник w × h, радиус rad. Точка контура на луче
// под углом t от центра — через функцию расстояния, чтобы кольцо между вырезом и
// рамкой клетки собиралось из четырёхугольников.
const sdRound = (x, y, w, h, rad) => {
  const qx = Math.abs(x) - w / 2 + rad, qy = Math.abs(y) - h / 2 + rad;
  return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - rad;
};
function onRay(t, w, h, rad) {
  const dx = Math.cos(t), dy = Math.sin(t);
  let lo = 0, hi = Math.hypot(w, h);
  for (let k = 0; k < 40; k++) {
    const mid = (lo + hi) / 2;
    if (sdRound(mid * dx, mid * dy, w, h, rad) < 0) lo = mid; else hi = mid;
  }
  return [lo * dx, lo * dy];
}

const CELL = [22, 24];                      // клетка вокруг гнезда на лице панели
const EDGE_N = 12;                          // точек на сторону клетки

// Точки по дуге для всех полос лица панели: шаг ~3 мм, а над и под клетками — ровно
// точки их рамок. Соседние полосы сходятся вершина в вершину, без Т-стыков, иначе
// сглаживание в Blender даёт на плоском лице полосы и точки.
function panelS(withPorts, s0 = -HALF, s1 = HALF) {
  const out = [];
  const span = (a, b, n) => { for (const v of steps(a, b, n)) if (!out.length || v - out[out.length - 1] > 1e-6) out.push(v); };
  if (!withPorts) { span(s0, s1, Math.ceil((s1 - s0) / 3)); return out; }
  let s = s0;
  for (const port of AUDIO_PORTS) {
    const a = port.s - CELL[0] / 2;
    span(s, a, Math.max(1, Math.ceil((a - s) / 3)));
    span(a, port.s + CELL[0] / 2, EDGE_N);
    s = port.s + CELL[0] / 2;
  }
  span(s, s1, Math.max(1, Math.ceil((s1 - s) / 3)));
  return out;
}

// Рамка клетки по периметру (против часовой, от правого нижнего угла) и вырез
// по тем же лучам из центра.
function cellRing(port) {
  const [w, h] = CELL, pts = [];
  const side = (ax, ay, bx, by) => { for (const t of steps(0, 1, EDGE_N).slice(0, EDGE_N)) pts.push([ax + (bx - ax) * t, ay + (by - ay) * t]); };
  side(w / 2, -h / 2, w / 2, h / 2); side(w / 2, h / 2, -w / 2, h / 2); side(-w / 2, h / 2, -w / 2, -h / 2); side(-w / 2, -h / 2, w / 2, -h / 2);
  const [hw, hh, rad] = port.hole;
  return { cell: pts, hole: pts.map(([x, y]) => onRay(Math.atan2(y, x), hw, hh, rad)) };
}

// Лицо задней стенки: плоскость R_FACE от скругления до потолка, с вырезами под гнёзда.
function backFace(mesh, theta, withPorts) {
  const face = (s, z) => on(theta, s, R_FACE, z);
  const n = (s) => nrm(theta, s, -1, 0);
  const z0 = UNDER_1 + FR, z1 = Z_PORT - CELL[1] / 2, z2 = Z_PORT + CELL[1] / 2, z3 = Z_CEIL - GAP;
  const edgeS = (s, z) => (Math.abs(Math.abs(s) - HALF) < 1e-6 ? Math.sign(s) * plateS(z) : s);
  const patch = (S, Z) => grid(mesh, Z.map((z) => S.map((s) => face(edgeS(s, z), z))), Z.map(() => S.map(n)), C.anod);
  const S = panelS(withPorts);
  if (!withPorts) { patch(S, [z0, z3]); return; }
  patch(S, [z0, z1]);
  patch(S, [z2, z3]);
  const Zmid = steps(z1, z2, EDGE_N);
  let s = -HALF;
  for (const port of AUDIO_PORTS) {
    const a = port.s - CELL[0] / 2;
    patch(S.filter((v) => v >= s - 1e-6 && v <= a + 1e-6), Zmid);
    const { cell, hole } = cellRing(port);
    const row = (pts) => pts.map(([x, y]) => face(port.s + x, Z_PORT + y));
    grid(mesh, [row(cell), row(hole)], [cell.map(([x]) => n(port.s + x)), hole.map(([x]) => n(port.s + x))], C.anod, { closeCols: true });
    s = port.s + CELL[0] / 2;
  }
  patch(S.filter((v) => v >= s - 1e-6), Zmid);
}

// ── Гнёзда ──────────────────────────────────────────────────────────────────
// Локальная система гнезда в центре выреза на лице панели.
function frameAt(theta, s) {
  const th = theta + arcDeg(s);
  const o = at(th, R_FACE, Z_PORT);
  const ex = tangent(th), ey = [0, 0, 1], ez = mul(radial(th), -1);
  const p = (x, y, d) => add(o, add(mul(ex, x), add(mul(ey, y), mul(ez, d))));
  const v = (x, y, d) => norm(add(mul(ex, x), add(mul(ey, y), mul(ez, d))));
  return { o, ex, ey, ez, p, v };
}

// Скруглённый прямоугольник: точки и наружные нормали по периметру.
function rrContour(w, h, rad, seg = 8) {
  const pts = [];
  for (const [cx, cy, a0] of [[w / 2 - rad, h / 2 - rad, 0], [-w / 2 + rad, h / 2 - rad, 90], [-w / 2 + rad, -h / 2 + rad, 180], [w / 2 - rad, -h / 2 + rad, 270]]) {
    for (let k = 0; k <= seg; k++) {
      const a = (a0 + (90 * k) / seg) * Math.PI / 180;
      pts.push([cx + rad * Math.cos(a), cy + rad * Math.sin(a), Math.cos(a), Math.sin(a)]);
    }
  }
  return pts;
}

// Корпус гнезда: стальная рамка скруглённого сечения от d0 до лица, с кантом.
function shell(mesh, F, outer, inner, d0, color) {
  const o = rrContour(...outer), i = rrContour(...inner);
  grid(mesh, [o.map(([x, y]) => F.p(x, y, 0)), o.map(([x, y]) => F.p(x, y, d0))], [o.map(([, , nx, ny]) => F.v(nx, ny, 0)), o.map(([, , nx, ny]) => F.v(nx, ny, 0))], color, { closeCols: true });
  // кант: от наружного контура к внутреннему с лёгким завалом
  const mid = o.map(([x, y], k) => [(x + i[k][0]) / 2, (y + i[k][1]) / 2]);
  grid(mesh, [o.map(([x, y]) => F.p(x, y, -0.05)), mid.map(([x, y]) => F.p(x, y, 0)), i.map(([x, y]) => F.p(x, y, -0.08))],
    [o.map(([, , nx, ny]) => F.v(nx * 0.7, ny * 0.7, 0.7)), mid.map(() => F.v(0, 0, 1)), i.map(([, , nx, ny]) => F.v(-nx * 0.7, -ny * 0.7, 0.7))], color, { closeCols: true });
  grid(mesh, [i.map(([x, y]) => F.p(x, y, -0.08)), i.map(([x, y]) => F.p(x, y, d0))], [i.map(([, , nx, ny]) => F.v(-nx, -ny, 0)), i.map(([, , nx, ny]) => F.v(-nx, -ny, 0))], color, { closeCols: true });
  addPolygon(mesh, i.map(([x, y]) => F.p(x, y, d0)), C.voids, F.ez);
}

const box = (mesh, F, x, y, d, half, f, color) => roundedBox(mesh, F.p(x, y, d), F.ex, F.ey, F.ez, half, f, color, 2);

function usbC(mesh, F) {
  shell(mesh, F, [8.98, 3.3, 1.65], [8.34, 2.56, 1.28], -7, C.steel);
  box(mesh, F, 0, 0, -4.2, [3.345, 0.35, 2.7], 0.2, C.black);                 // язычок
  for (const sy of [1, -1]) {
    for (let k = 0; k < 12; k++) box(mesh, F, -2.75 + k * 0.5, sy * 0.365, k === 0 || k === 11 ? -3.9 : -4.1, [0.12, 0.02, 1.5], 0.01, C.gold);
    box(mesh, F, 0, sy * 1.2, -1.6, [2.1, 0.07, 0.8], 0.05, C.steel);          // пружины заземления
  }
}

function usbA(mesh, F) {
  shell(mesh, F, [12.55, 5.17, 0.45], [12.0, 4.62, 0.3], -10, C.steel);
  box(mesh, F, 0, 1.1, -5.55, [5.5, 0.92, 4.35], 0.2, C.black);               // язычок в верхней половине
  for (const x of [-3.5, -1.0, 1.0, 3.5]) box(mesh, F, x, 0.15, Math.abs(x) < 2 ? -4.7 : -4.4, [0.5, 0.03, 2.3], 0.02, C.gold);
  for (const x of [-4, 4]) for (const y of [2.2, -2.2]) box(mesh, F, x, y, -2.6, [0.7, 0.11, 1.0], 0.08, C.steel); // фиксаторы
}

function jack(mesh, F) {
  lathe(mesh, F.p(0, 0, 0), F.ez, [[1.95, -0.4], [1.95, 0.05], [2.3, 0.2], [2.9, 0.2], [3.2, 0.05], [3.2, -1.0]], C.steel, 64);
  lathe(mesh, F.p(0, 0, 0), F.ez, [[1.95, -0.3], [1.8, -0.3], [1.8, -3.2]], C.steel, 48);   // гильза
  lathe(mesh, F.p(0, 0, 0), F.ez, [[1.78, -4.9], [1.35, -4.9], [1.35, -5.6], [1.78, -5.6]], C.gold, 32);
  lathe(mesh, F.p(0, 0, 0), F.ez, [[1.8, -3.2], [1.8, -8], [0, -8]], C.voids, 32);
}

// ── Гравировка: лазер по анодированию, светлая ────────────────────────────────
function stroke(mesh, F, pts, width = 0.34) {
  for (let k = 0; k < pts.length - 1; k++) {
    const [ax, ay] = pts[k], [bx, by] = pts[k + 1];
    const l = Math.hypot(bx - ax, by - ay) || 1, nx = -(by - ay) / l * width / 2, ny = (bx - ax) / l * width / 2;
    const e = 0.03;
    addPolygon(mesh, [F.p(ax - nx, ay - ny, e), F.p(bx - nx, by - ny, e), F.p(bx + nx, by + ny, e), F.p(ax + nx, ay + ny, e)], C.etch, F.ez);
  }
}
const dot = (mesh, F, x, y, r) => addPolygon(mesh, steps(0, Math.PI * 2, 24).slice(0, 24).map((t) => F.p(x + r * Math.cos(t), y + r * Math.sin(t), 0.03)), C.etch, F.ez);

function usbIcon(mesh, F, y0, k = 0.8) {
  const q = (pts) => pts.map(([x, y]) => [x * k, y0 + y * k]);
  stroke(mesh, F, q([[-2.3, 0], [2.05, 0]]));
  addPolygon(mesh, q([[1.95, 0.55], [2.85, 0], [1.95, -0.55]]).map(([x, y]) => F.p(x, y, 0.03)), C.etch, F.ez);
  stroke(mesh, F, q([[-1.3, 0], [-0.6, 0.85], [0.85, 0.85]]));
  stroke(mesh, F, q([[-0.4, 0], [0.3, -0.8], [1.25, -0.8]]));
  dot(mesh, F, -2.45 * k, y0, 0.5 * k);
  dot(mesh, F, 1.15 * k, y0 + 0.85 * k, 0.32 * k);
  addPolygon(mesh, q([[1.25, -1.1], [1.85, -1.1], [1.85, -0.5], [1.25, -0.5]]).map(([x, y]) => F.p(x, y, 0.03)), C.etch, F.ez);
}

function headphoneIcon(mesh, F, y0) {
  stroke(mesh, F, steps(0, Math.PI, 16).map((t) => [1.6 * Math.cos(t), y0 - 0.4 + 1.6 * Math.sin(t)]), 0.38);
  for (const x of [-1.6, 1.6]) addPolygon(mesh, [[x - 0.45, y0 - 1.75], [x + 0.45, y0 - 1.75], [x + 0.45, y0 - 0.25], [x - 0.45, y0 - 0.25]].map(([a, b]) => F.p(a, b, 0.03)), C.etch, F.ez);
}

function ports(mesh, theta) {
  for (const port of AUDIO_PORTS) {
    const F = frameAt(theta, port.s);
    if (port.id === 'usbC') { usbC(mesh, F); usbIcon(mesh, F, 7.0); }
    if (port.id === 'usbA') { usbA(mesh, F); usbIcon(mesh, F, 7.6); }
    if (port.id === 'jack') { jack(mesh, F); headphoneIcon(mesh, F, 7.6); }
  }
}

// Панель в глубине кармана: гнёзда и гравировка (withPorts) или глухая панель.
export function buildAudioPanel(mesh, theta, withPorts = true) {
  pocketLiner(mesh, theta);
  shadowGap(mesh, theta);
  faceBottom(mesh, theta, withPorts);
  backFace(mesh, theta, withPorts);
  if (withPorts) ports(mesh, theta);
}

export const buildAudioCenter = (mesh) => {
  for (const p of AUDIO_PANELS.filter((q) => q.base)) buildAudioPanel(mesh, p.theta, true);
};
export const buildAudioSides = (withPorts) => (mesh) => {
  for (const p of AUDIO_PANELS.filter((q) => !q.base)) buildAudioPanel(mesh, p.theta, withPorts);
};

// ── Откидной крючок ─────────────────────────────────────────────────────────
// Сложенный — пластина заподлицо в потолке ниши с тёмным зазором по контуру.
// Раскрытый (кадры сайта) — плечо вниз на 62 мм и полка с резиновой накладкой.
export function buildAudioHook(mesh, open = false) {
  const { theta, r: [r0, r1], width, drop } = AUDIO_HOOK;
  const rm = (r0 + r1) / 2, half = (r1 - r0) / 2;
  const t = tangent(theta), u = radial(theta), z = [0, 0, 1];
  roundedBox(mesh, at(theta, rm, UNDER_1 + 0.02), t, u, z, [width / 2 + 0.8, half + 0.8, 0.05], 0.04, C.voids, 2);
  if (!open) {
    roundedBox(mesh, at(theta, rm, UNDER_1 - 0.6), t, u, z, [width / 2, half, 1.0], 0.95, C.anod);
    return;
  }
  // шарнир у стенки, плечо вниз, полка к человеку, бортик на конце
  roundedBox(mesh, at(theta, r1 - 3, UNDER_1 - 1.5), t, u, z, [width / 2, 4, 1.6], 0.6, C.anod);
  roundedBox(mesh, at(theta, r1 - 3, UNDER_1 - drop / 2), t, u, z, [width / 2, 2.2, drop / 2], 1.2, C.anod);
  roundedBox(mesh, at(theta, rm, UNDER_1 - drop + 3), t, u, z, [width / 2, half, 3], 1.5, C.anod);
  roundedBox(mesh, at(theta, rm, UNDER_1 - drop + 6.4), t, u, z, [width / 2 - 1.5, half - 4, 0.6], 0.3, C.black);
  roundedBox(mesh, at(theta, r0 + 2.5, UNDER_1 - drop + 8), t, u, z, [width / 2, 2.5, 7], 1.5, C.anod);
}

// ── Витрина для кадров сайта: штекеры и кабели клиента ─────────────────────────
// Это вещи клиента, в модель стола они не входят (geometry.json → audioShowcase).
export function buildAudioPlugs(mesh, theta, ids = ['usbA', 'jack', 'usbC'], cables = true) {
  for (const port of AUDIO_PORTS.filter((q) => ids.includes(q.id))) {
    const F = frameAt(theta, port.s);
    if (port.id === 'jack') {
      lathe(mesh, F.p(0, 0, 0), F.ez, [[0, 0], [3.1, 0], [3.3, 0.3], [3.3, 2.6], [3.9, 2.9], [3.9, 14], [3.6, 14.6], [3.1, 15], [2.9, 19], [2.2, 25], [1.9, 28], [0, 28]], C.steel, 48);
      if (cables) cable(mesh, [F.p(0, 0, 27), F.p(0, -1, 60), F.p(-6, -60, 95), F.p(-20, -260, 120)], 1.6, C.black);
    } else if (port.id === 'usbC') {
      roundedBox(mesh, F.p(0, 0, 11), F.ex, F.ey, F.ez, [6, 3.2, 10.5], 2.8, C.black);
      if (cables) cable(mesh, [F.p(0, 0, 21), F.p(0, -2, 50), F.p(10, -70, 80), F.p(40, -260, 110)], 1.9, C.black);
    } else {
      roundedBox(mesh, F.p(0, 0, 5), F.ex, F.ey, F.ez, [7.2, 3.2, 4.8], 1.8, C.black);   // приёмник беспроводной гарнитуры
    }
  }
}

// Где лежит оголовье наушников на раскрытом крючке и где конец штекера в гнезде
// 3,5 мм левой панели — по ним Blender вешает наушники и ведёт кабель.
export function hookHang() {
  const { theta, r: [r0, r1], drop } = AUDIO_HOOK;
  const left = AUDIO_PANELS.find((q) => q.id === 'left');
  return {
    point: at(theta, (r0 + r1) / 2 - 8, UNDER_1 - drop + 7), tangent: tangent(theta), radial: radial(theta),
    plugEnd: frameAt(left.theta, 0).p(0, 0, 27), plugAxis: mul(radial(left.theta), -1),
  };
}
