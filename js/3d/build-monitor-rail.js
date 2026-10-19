// Кольцевая шина под мониторы — листы 44–48, docs/monitor-mount. Решение 25.09.2026.
//
// Две шины по грани стенки R1150 на всём прямом участке (пока пояс не пошёл
// на спуск, y ≤ 1600): нижняя НШ +820…860 на месте цоколя реек, верхняя ВШ
// +1182…1210 в тени выступа (рейки поэтому кончаются на +1182, build-acoustic.js).
// ВШ — С-профиль со спинкой: в её камере 20 помещается поворотный сухарь М5
// под щель 10, в спинке — окна для кабелей 60 × 16 через 150.
// Стойка Ø40 на R1108 зажата между ними каретками НК и ВК; на стойке — рука на
// газлифте до VESA экрана. Шины и одна стойка входят в базу, до четырёх — опция
// (centrum-config.js, monitor).
//
// Геометрия здесь — для фотореалистичного кадра, а не схема: скругления кромок,
// гладкие нормали, сложенная рука с шарнирами и петли кабелей у экрана и стойки.
// Координаты — как у корпуса до отражения (mirror.js). Угол θ отсчитывается
// от оси экрана, плюс — вправо от сидящего; после отражения это −X.

import { CENTER, R_BELT_HIGH, LEVEL_1, LEVEL_2, TOP_THICK } from './params.js';

export const RAIL_END = Math.acos((CENTER - 1600) / R_BELT_HIGH) * 180 / Math.PI; // 102,56°
export const RAIL_HIGH_H = 28;
export const RAIL_LOW = [LEVEL_1, LEVEL_1 + 40];                       // на месте цоколя реек
export const RAIL_HIGH = [LEVEL_2 - TOP_THICK - RAIL_HIGH_H, LEVEL_2 - TOP_THICK];
export const RAIL_SLOT = 10;
export const POST_R = 1108;          // ось стойки: целиком под кромкой выступа R1090…1150
export const POST_D = 40;
export const POST_Z = [LEVEL_1 + 8, RAIL_HIGH[0] + 14]; // 4 мм над накладкой 4; верх в гильзе ВК
export const MAX_MONITORS = 4;
const D = Math.PI / 180;

// Экран — модель ultrawide_monitor.glb (props.js): точка установки на R850, +1094;
// лицо на 10 ближе к центру, спинка с VESA на 81 дальше. Ширина 772, верх на +175.
export const MONITOR_ORIGIN_R = 850;
export const MONITOR_ORIGIN_Z = 1094;
const MONITOR_HALF_W = 386, MONITOR_FACE = -10, MONITOR_BACK = 81, MONITOR_TOP = 175;
export const MONITOR_TOP_Z = MONITOR_ORIGIN_Z + MONITOR_TOP; // +1269 — вровень с верхней полкой

// Шаг экранов, которые сходятся кромками с зазором 6 мм и смотрят в центр.
const pitch = (s) => 2 * Math.atan((s * MONITOR_HALF_W + 3) / (MONITOR_ORIGIN_R + s * MONITOR_FACE)) / D;

// Раскладки 1…4 одинаковых экранов 34″ ultrawide. Количество меняет только
// расстановку по дуге; масштаб и высота точки установки остаются постоянными.
// Стойки: перед постами розеток (61…87°) не ставятся, поэтому крайние экраны
// четвёрки рука выносит со стойки на ±49°. Так локоть помещается за экраном
// и перед стенкой при полной ширине монитора. С 5.1 средняя стойка уходит
// с решётки C на 7°, стойки двойки — с решёток L/R на ±23,5°.
export const MONITOR_LAYOUTS = (() => {
  const step = pitch(1);
  const mk = (screens, posts, posts51) => ({ scale: 1, z: MONITOR_ORIGIN_Z, screens, posts, posts51: posts51 || posts });
  return {
    1: mk([0], [0], [7]),
    2: mk([-step / 2, step / 2], [-step / 2, step / 2], [-23.5, 23.5]),
    3: mk([-step, 0, step], [-step, 0, step], [-step, 7, step]),
    4: mk([-1.5 * step, -step / 2, step / 2, 1.5 * step], [-49, -step / 2, step / 2, 49], [-49, -23.5, 23.5, 49]),
  };
})();

// Точка VESA на спинке экрана под углом θ при масштабе scale.
export const vesaPoint = (theta, scale = 1, z = MONITOR_ORIGIN_Z) => at(theta, MONITOR_ORIGIN_R + scale * MONITOR_BACK, z);

const COLORS = {
  rail: [0.22, 0.23, 0.245],
  lips: [0.035, 0.035, 0.04],
  post: [0.2, 0.21, 0.225],
  arm: [0.075, 0.075, 0.08],
  cable: [0.05, 0.05, 0.055],
};

// ── векторы ─────────────────────────────────────────────────────────────────
export const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
export const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
export const mul = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
export const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
export const len = (a) => Math.hypot(a[0], a[1], a[2]);
export const norm = (a) => { const l = len(a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };

// Точка на радиусе r под углом θ (до отражения).
export const at = (theta, r, z) => [CENTER + r * Math.sin(theta * D), CENTER - r * Math.cos(theta * D), z];
export const radial = (theta) => [Math.sin(theta * D), -Math.cos(theta * D), 0];   // от центра к стенке
export const tangent = (theta) => [Math.cos(theta * D), Math.sin(theta * D), 0];   // по дуге, к +θ

// Треугольник с нормалями в вершинах: гладкое тонирование на скруглениях.
export function tri(mesh, p, n, color) {
  for (let i = 0; i < 3; i++) {
    mesh.position.push(...p[i]);
    mesh.normal.push(...n[i]);
    mesh.color.push(...color);
  }
}
// Сетка rows × cols точек с нормалями → треугольники (обход наружу задаёт порядок).
export function grid(mesh, P, N, color, { closeCols = false } = {}) {
  const rows = P.length, cols = P[0].length;
  for (let i = 0; i < rows - 1; i++) {
    for (let j = 0; j < (closeCols ? cols : cols - 1); j++) {
      const j1 = (j + 1) % cols;
      tri(mesh, [P[i][j], P[i + 1][j], P[i + 1][j1]], [N[i][j], N[i + 1][j], N[i + 1][j1]], color);
      tri(mesh, [P[i][j], P[i + 1][j1], P[i][j1]], [N[i][j], N[i + 1][j1], N[i][j1]], color);
    }
  }
}

// Тело вращения: профиль [[r, h]] вокруг оси (o, axis). Нормали — по касательной профиля.
export function lathe(mesh, o, axis, profile, color, sides = 48) {
  const w = norm(axis);
  const u = norm(cross(w, Math.abs(w[2]) < 0.9 ? [0, 0, 1] : [1, 0, 0]));
  const v = cross(w, u);
  const n2 = profile.map((p, i) => {
    const a = profile[Math.max(0, i - 1)], b = profile[Math.min(profile.length - 1, i + 1)];
    const dr = b[0] - a[0], dh = b[1] - a[1];
    const l = Math.hypot(dr, dh) || 1;
    return [dh / l, -dr / l]; // нормаль в плоскости профиля: (радиальная, осевая)
  });
  const P = [], N = [];
  for (let i = 0; i < profile.length; i++) {
    const row = [], nrow = [];
    for (let k = 0; k < sides; k++) {
      const t = (k / sides) * Math.PI * 2;
      const dir = add(mul(u, Math.cos(t)), mul(v, Math.sin(t)));
      row.push(add(o, add(mul(dir, profile[i][0]), mul(w, profile[i][1]))));
      nrow.push(norm(add(mul(dir, n2[i][0]), mul(w, n2[i][1]))));
    }
    P.push(row); N.push(nrow);
  }
  grid(mesh, P, N, color, { closeCols: true });
}

// Профиль цилиндра высотой h, радиусом r, со скруглёнными торцами радиуса f.
function roundedCylProfile(r, h, f, steps = 5) {
  const out = [[0, 0]];
  for (let k = 0; k <= steps; k++) { const a = (k / steps) * Math.PI / 2; out.push([r - f + f * Math.sin(a), f - f * Math.cos(a)]); }
  for (let k = 0; k <= steps; k++) { const a = (k / steps) * Math.PI / 2; out.push([r - f + f * Math.cos(a), h - f + f * Math.sin(a)]); }
  out.push([0, h]);
  return out;
}
export const cylinder = (mesh, o, axis, r, h, f, color, sides) => lathe(mesh, o, axis, roundedCylProfile(r, h, f), color, sides);

// Брусок со скруглёнными кромками (сумма Минковского коробки и шара радиуса f),
// в собственной системе (o — центр, ex/ey/ez — оси, half — полуразмеры).
export function roundedBox(mesh, o, ex, ey, ez, half, f, color, seg = 4) {
  const inner = half.map((h) => Math.max(0, h - f));
  const coords = (h, i) => {
    const out = [-h];
    for (let k = 1; k <= seg; k++) out.push(-inner[i] - f * Math.cos((k / seg) * Math.PI / 2));
    const mid = Math.max(2, Math.ceil((2 * inner[i]) / 40));
    for (let k = 1; k < mid; k++) out.push(-inner[i] + (2 * inner[i] * k) / mid);
    for (let k = seg; k >= 1; k--) out.push(inner[i] + f * Math.cos((k / seg) * Math.PI / 2));
    out.push(h);
    return out;
  };
  const toWorld = (p) => add(o, add(mul(ex, p[0]), add(mul(ey, p[1]), mul(ez, p[2]))));
  const dirW = (n) => norm(add(mul(ex, n[0]), add(mul(ey, n[1]), mul(ez, n[2]))));
  const surf = (p) => {
    const c = p.map((v, i) => Math.max(-inner[i], Math.min(inner[i], v)));
    let n = sub(p, c);
    if (len(n) < 1e-9) n = [0, 0, 0];
    n = norm(n);
    return { p: add(c, mul(n, f)), n };
  };
  // шесть граней: ось грани a, знак s; по ним сетка из координат двух других осей
  for (let a = 0; a < 3; a++) for (const s of [-1, 1]) {
    const b = (a + 1) % 3, c = (a + 2) % 3;
    const cb = coords(half[b], b), cc = coords(half[c], c);
    const P = [], N = [];
    for (const vb of cb) {
      const row = [], nrow = [];
      for (const vc of cc) {
        const p = [0, 0, 0]; p[a] = s * half[a]; p[b] = vb; p[c] = vc;
        const { p: q, n } = surf(p);
        row.push(toWorld(q)); nrow.push(dirW(n));
      }
      P.push(row); N.push(nrow);
    }
    // обход наружу: для s > 0 строки по b, столбцы по c дают нормаль +a
    grid(mesh, s > 0 ? P : P.map((r) => r.slice().reverse()), s > 0 ? N : N.map((r) => r.slice().reverse()), color);
  }
}

// Брусок вдоль отрезка A→B (скругления на концах тоже), «верх» — ближе к up.
export function link(mesh, A, B, width, height, f, color, up = [0, 0, 1]) {
  const ex = norm(sub(B, A));
  const ey = norm(cross(up, ex));
  const ez = cross(ex, ey);
  const half = [len(sub(B, A)) / 2 + height / 2, width / 2, height / 2];
  roundedBox(mesh, mul(add(A, B), 0.5), ex, ey, ez, half, f, color);
}

// Труба по гладкой кривой (Катмулл — Ром через точки): кабели.
export function cable(mesh, pts, r, color, sides = 14) {
  const curve = [];
  const segs = 10;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(pts.length - 1, i + 2)];
    for (let k = 0; k < segs; k++) {
      const t = k / segs, t2 = t * t, t3 = t2 * t;
      curve.push([0, 1, 2].map((c) => 0.5 * ((2 * p1[c]) + (-p0[c] + p2[c]) * t + (2 * p0[c] - 5 * p1[c] + 4 * p2[c] - p3[c]) * t2 + (-p0[c] + 3 * p1[c] - 3 * p2[c] + p3[c]) * t3)));
    }
  }
  curve.push(pts[pts.length - 1]);
  let prevU = null;
  const P = [], N = [];
  for (let i = 0; i < curve.length; i++) {
    const tng = norm(sub(curve[Math.min(curve.length - 1, i + 1)], curve[Math.max(0, i - 1)]));
    let u = prevU ? norm(sub(prevU, mul(tng, dot(prevU, tng)))) : norm(cross(tng, Math.abs(tng[2]) < 0.9 ? [0, 0, 1] : [1, 0, 0]));
    prevU = u;
    const v = cross(tng, u);
    const row = [], nrow = [];
    for (let k = 0; k < sides; k++) {
      const t = (k / sides) * Math.PI * 2;
      const n = add(mul(u, Math.cos(t)), mul(v, Math.sin(t)));
      row.push(add(curve[i], mul(n, r))); nrow.push(n);
    }
    P.push(row); N.push(nrow);
  }
  grid(mesh, P, N, color, { closeCols: true });
}

// ── шины ────────────────────────────────────────────────────────────────────
// Сечение шины в координатах (d — глубина от грани стенки R1150 внутрь стены, z).
// Лицо на d = −0,6 (чуть перед стенкой), щель со скруглёнными кромками R1, губки ТПЭ
// сходятся к середине щели и оставляют тёмную линию 0,6 мм.
function railProfiles([z0, z1]) {
  const zc = (z0 + z1) / 2, s0 = zc - RAIL_SLOT / 2, s1 = zc + RAIL_SLOT / 2;
  const F = -0.6, r = 1;
  const arcPts = (cz, cd, a0, a1, n = 4) => Array.from({ length: n + 1 }, (_, k) => {
    const a = a0 + ((a1 - a0) * k) / n;
    return [cd + r * Math.cos(a), cz + r * Math.sin(a)];
  });
  // низ лица → кромка щели (скругление) → в щель
  const lower = [[F + 0.6, z0], [F, z0 + 0.6], [F, s0 - r], ...arcPts(s0 - r, F + r, Math.PI, Math.PI / 2), [F + 3, s0]];
  const upper = [[F + 3, s1], ...arcPts(s1 + r, F + r, -Math.PI / 2, -Math.PI), [F, s1 + r], [F, z1 - 0.6], [F + 0.6, z1]];
  // губки: сверху и снизу к середине, выпуклые к человеку
  const lipLow = Array.from({ length: 7 }, (_, k) => { const t = k / 6; return [F + 2.4 - 1.4 * Math.sin(t * Math.PI / 2), s0 + t * (zc - 0.3 - s0)]; });
  const lipHigh = Array.from({ length: 7 }, (_, k) => { const t = k / 6; return [F + 1 + 1.4 * (1 - Math.cos(t * Math.PI / 2)), zc + 0.3 + t * (s1 - zc - 0.3)]; });
  return { face: [lower, upper], lips: [lipLow, lipHigh], gap: [[F + 3.5, zc - 0.3], [F + 3.5, zc + 0.3]] };
}

// Протяжка сечения по дуге; нормали — из касательной сечения, развёрнутые к центру.
function sweepArc(mesh, profile, color, t0 = -RAIL_END, t1 = RAIL_END, step = 0.4) {
  const n = Math.ceil((t1 - t0) / step);
  const nrm = profile.map((p, i) => {
    const a = profile[Math.max(0, i - 1)], b = profile[Math.min(profile.length - 1, i + 1)];
    const dd = b[0] - a[0], dz = b[1] - a[1], l = Math.hypot(dd, dz) || 1;
    return [dz / l, -dd / l]; // (к стене +, вверх +)
  });
  const P = [], N = [];
  for (let k = 0; k <= n; k++) {
    const t = t0 + ((t1 - t0) * k) / n;
    const rd = radial(t);
    const row = [], nrow = [];
    for (let i = 0; i < profile.length; i++) {
      const [d, z] = profile[i];
      const p = at(t, R_BELT_HIGH + d, z);
      row.push(p);
      nrow.push(norm([rd[0] * nrm[i][0], rd[1] * nrm[i][0], nrm[i][1]]));
    }
    P.push(row); N.push(nrow);
  }
  grid(mesh, P, N, color);
}

// Торцевая заглушка шины: закрывает сечение на конце дуги.
function railCap(mesh, [z0, z1], t) {
  const tg = mul(tangent(t), Math.sign(t));
  const a = at(t, R_BELT_HIGH - 0.6, z0), b = at(t, R_BELT_HIGH - 0.6, z1), c = at(t, R_BELT_HIGH + 2, z1), d = at(t, R_BELT_HIGH + 2, z0);
  const pts = t > 0 ? [a, b, c, a, c, d] : [a, c, b, a, d, c];
  for (let i = 0; i < 6; i += 3) tri(mesh, pts.slice(i, i + 3), [tg, tg, tg], COLORS.rail);
}

export function buildRails(mesh) {
  for (const zz of [RAIL_LOW, RAIL_HIGH]) {
    const { face } = railProfiles(zz);
    for (const p of face) sweepArc(mesh, p, COLORS.rail);
    railCap(mesh, zz, -RAIL_END); railCap(mesh, zz, RAIL_END);
  }
}
export function buildRailSlots(mesh) {
  for (const zz of [RAIL_LOW, RAIL_HIGH]) {
    const { lips, gap } = railProfiles(zz);
    for (const p of lips) sweepArc(mesh, p, COLORS.lips);
    sweepArc(mesh, gap, [0.005, 0.005, 0.006]);
  }
}

// ── стойка и каретки ────────────────────────────────────────────────────────
// Каретка — фрезерованный блок со скруглениями, 68 вдоль дуги. НК стоит ниже
// реек (они начинаются на +860) и доходит до лица шины целиком. ВК — рядом с
// рейками: её тело кончается перед их лицом R1135 (зазор 3), а к шине над
// рейками (выше +1182) идёт только язык. Шея 52 × 6 уходит в щель; сбоку НК —
// рычаг эксцентрика.
export const SLAT_FACE_R = R_BELT_HIGH - 15;   // лицо реек, build-acoustic.js
const CLEAR_R = SLAT_FACE_R - 3;               // всё, что ниже +1182, — не дальше R1132
function carriage(mesh, theta, z0, z1, { lever = false, tongueZ0 = null } = {}) {
  const ex = tangent(theta), ey = radial(theta), ez = [0, 0, 1];
  const r0 = 1086, r1 = tongueZ0 === null ? R_BELT_HIGH - 1.2 : CLEAR_R;
  roundedBox(mesh, at(theta, (r0 + r1) / 2, (z0 + z1) / 2), ex, ey, ez, [34, (r1 - r0) / 2, (z1 - z0) / 2], 7, COLORS.post, 6);
  if (tongueZ0 !== null) {
    const t0 = CLEAR_R - 6, t1 = R_BELT_HIGH - 1.2;
    roundedBox(mesh, at(theta, (t0 + t1) / 2, (tongueZ0 + z1) / 2), ex, ey, ez, [30, (t1 - t0) / 2, (z1 - tongueZ0) / 2], 3, COLORS.post, 4);
  }
  // тонкая линия разъёма крышки — тёмный поясок посередине высоты
  roundedBox(mesh, at(theta, (r0 + r1) / 2, (z0 + z1) / 2), ex, ey, ez, [34.2, (r1 - r0) / 2 + 0.2, 0.35], 0.3, [0.05, 0.05, 0.055], 1);
  const zc = (z0 + z1) / 2;
  roundedBox(mesh, at(theta, R_BELT_HIGH + 1.2, zc), ex, ey, ez, [26, 2.4, 2.6], 1, [0.1, 0.1, 0.11], 2);
  if (lever) {
    // рычаг: плоская лопатка на оси, прижата к боку каретки
    const side = add(at(theta, 1128, zc), mul(ex, 35.5));
    cylinder(mesh, side, ex, 7, 4, 1.2, COLORS.post, 32);
    roundedBox(mesh, add(add(side, mul(ex, 2.5)), mul(ey, -19)), ex, ey, ez, [1.8, 22, 5.5], 1.6, COLORS.post, 3);
  }
}

export function buildPost(mesh, theta) {
  const base = at(theta, POST_R, POST_Z[0]);
  // труба Ø40 с фаской торцов; снизу и сверху уходит в каретки
  cylinder(mesh, base, [0, 0, 1], POST_D / 2, POST_Z[1] - POST_Z[0], 1.5, COLORS.post, 56);
  carriage(mesh, theta, LEVEL_1 + 8, LEVEL_1 + 36, { lever: true });
  carriage(mesh, theta, RAIL_HIGH[0] - 8, RAIL_HIGH[1] - 3, { tongueZ0: RAIL_HIGH[0] + 3 });
}

// ── рука на газлифте ────────────────────────────────────────────────────────
// Хомут на стойке, плечо 250 до локтя, предплечье-параллелограмм 250 до головы,
// наклонная голова и VESA-пластина на спинке экрана. Локоть решается по двум
// длинам звеньев: сложенная рука уходит вбок вдоль стенки и прячется за экраном.
const ARM_L1 = 250, ARM_L2 = 250;
const COLLAR_Z = 1060;

function elbowPoint(P, H, side) {
  const d2 = [H[0] - P[0], H[1] - P[1]];
  const d = Math.hypot(...d2) || 1;
  const dd = Math.min(d, ARM_L1 + ARM_L2 - 1);
  const a = (ARM_L1 * ARM_L1 - ARM_L2 * ARM_L2 + dd * dd) / (2 * dd);
  const h = Math.sqrt(Math.max(0, ARM_L1 * ARM_L1 - a * a));
  const ux = d2[0] / d, uy = d2[1] / d;
  return [P[0] + ux * a - side * uy * h, P[1] + uy * a + side * ux * h];
}

export function buildArm(mesh, cables, thetaPost, thetaScreen = thetaPost, scale = 1, z = MONITOR_ORIGIN_Z) {
  const vesa = vesaPoint(thetaScreen, scale, z);
  const out = radial(thetaScreen);
  const axis = at(thetaPost, POST_R, 0);
  // хомут стойки: кольцо Ø47 × 46 — до лица реек остаётся 3,5 мм
  cylinder(mesh, [axis[0], axis[1], COLLAR_Z - 23], [0, 0, 1], 23.5, 46, 3, COLORS.arm, 64);
  const collarTop = [axis[0], axis[1], COLLAR_Z + 23];
  // голова: в 58 от пластины к стенке
  const head = add(vesa, mul(out, 58));
  const side = thetaScreen > thetaPost + 0.5 ? 1 : thetaScreen < thetaPost - 0.5 ? -1 : 1;
  const candidates = [elbowPoint(axis, head, side), elbowPoint(axis, head, -side)];
  // Два решения локтя: выбираем зазор одновременно до спинки экрана и стенки,
  // учитывая радиус шарнира 22. Один лишь знак угла может завести руку в экран.
  const clearance = (e) => Math.min(
    (e[0] - vesa[0]) * out[0] + (e[1] - vesa[1]) * out[1] - 22,
    POST_R + POST_D / 2 - Math.hypot(e[0] - CENTER, e[1] - CENTER) - 22,
  );
  const e2 = clearance(candidates[1]) > clearance(candidates[0]) + 0.001 ? candidates[1] : candidates[0];
  const zArm = COLLAR_Z + 8;
  const P0 = [axis[0], axis[1], zArm], E = [e2[0], e2[1], zArm];
  const Hc = [head[0], head[1], z + 14];
  // плечо: брусок 34 × 46, на концах шарниры
  link(mesh, P0, E, 34, 46, 12, COLORS.arm);
  cylinder(mesh, [E[0], E[1], zArm - 30], [0, 0, 1], 22, 60, 3, COLORS.arm, 48);
  // предплечье: верхняя тяга и ниже корпус газлифта — читается как параллелограмм
  const Et = [E[0], E[1], zArm + 14];
  link(mesh, Et, Hc, 30, 22, 9, COLORS.arm);
  link(mesh, [E[0], E[1], zArm - 12], [Hc[0], Hc[1], Hc[2] - 26], 20, 18, 7, COLORS.arm);
  cylinder(mesh, [Hc[0], Hc[1], Hc[2] - 40], [0, 0, 1], 17, 54, 3, COLORS.arm, 40);
  // наклон: горизонтальный шарнир по касательной и пластина VESA 100 × 100
  const tg = tangent(thetaScreen);
  cylinder(mesh, add(add(head, mul(tg, -26)), [0, 0, z - head[2]]), tg, 13, 52, 2, COLORS.arm, 40);
  roundedBox(mesh, add(vesa, mul(out, 12)), tg, out, [0, 0, 1], [58, 10, 58], 5, COLORS.arm, 3);
  roundedBox(mesh, add(vesa, mul(out, 34)), tg, out, [0, 0, 1], [16, 20, 14], 5, COLORS.arm, 3);

  // кабели: видео и питание из разъёмов внизу спинки петлёй к голове, дальше
  // внутри руки; у хомута — короткая петля в прорезь стойки со стороны стенки
  if (cables) {
    const pr = radial(thetaPost), pt = tangent(thetaPost);
    for (const [k, off] of [[0, -12], [1, 12]]) {
      const r = 3.3 - k * 0.3;
      // от разъёмов внизу спинки — вверх вплотную к спинке и в низ головы руки,
      // дальше внутри руки: в воздухе кабель не висит
      const back = MONITOR_ORIGIN_R + scale * 62;
      const vesaR = MONITOR_ORIGIN_R + scale * MONITOR_BACK;
      const port = add(at(thetaScreen, back, z - scale * 140), mul(tg, off));
      const mid = add(at(thetaScreen, back + 9, z - scale * 110), mul(tg, off));
      const top = add(at(thetaScreen, vesaR + 6, z - 66), mul(tg, off * 0.6));
      const end = add(at(thetaScreen, vesaR + 16, z - 46), mul(tg, off * 0.4));
      cable(cables, [add(port, mul(out, -4)), port, mid, top, end], r, COLORS.cable);
      // у хомута — со стороны стенки, в прорезь стойки: с кресла её не видно
      const cA = add([axis[0], axis[1], COLLAR_Z - 22], add(mul(pr, 18), mul(pt, off * 0.9)));
      const cB = add([axis[0], axis[1], COLLAR_Z - 48], add(mul(pr, 19), mul(pt, off * 0.8)));
      const cC = add([axis[0], axis[1], COLLAR_Z - 70], add(mul(pr, 14), mul(pt, off * 0.3)));
      cable(cables, [add(cA, [0, 0, 6]), cA, cB, cC], r, COLORS.cable);
    }
  }
}

// Вся раскладка: стойки, руки и кабели для count экранов.
export function buildLayout(mesh, cables, count, audio51 = false) {
  const L = MONITOR_LAYOUTS[count];
  const posts = audio51 ? L.posts51 : L.posts;
  L.screens.forEach((screen, i) => {
    buildPost(mesh, posts[i]);
    buildArm(mesh, cables, posts[i], screen, L.scale, L.z);
  });
}

// Матрица 4×4 (по столбцам) экземпляра модели экрана: масштаб вокруг точки
// установки, подъём до нужной высоты и поворот вокруг центра стола на θ.
// Мировые координаты — уже после отражения (модель экрана ставится в готовую сцену).
export function monitorInstanceMatrix(theta, scale = 1, z = MONITOR_ORIGIN_Z) {
  const O = [CENTER, CENTER - MONITOR_ORIGIN_R, MONITOR_ORIGIN_Z];
  const phi = -theta * D, c = Math.cos(phi), s = Math.sin(phi);
  // p' = R(p·scale вокруг O, +dz) вокруг C
  const t0 = [O[0] * (1 - scale), O[1] * (1 - scale), O[2] * (1 - scale) + (z - MONITOR_ORIGIN_Z)];
  const tx = t0[0] - CENTER, ty = t0[1] - CENTER;
  return [
    c * scale, s * scale, 0, 0,
    -s * scale, c * scale, 0, 0,
    0, 0, scale, 0,
    c * tx - s * ty + CENTER, s * tx + c * ty + CENTER, t0[2], 1,
  ];
}
