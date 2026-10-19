// Люки под штангу микрофона в 3D — места и размеры в mic-hatch.js, лист 51.
//
// В модели (buildModel): графитовые фланцы и крышки двух люков — они в каждом
// столе; снизу — выборка Ø200 × 20 с тёмными стенками, на её потолке стальное
// кольцо, в середине отверстие Ø80 до крышки. Вырез в низе плиты — build-core.js. Для кадров блока «Микрофон» (geometry.json → micShowcase) — открытый люк
// с мембраной, условная покупная штанга, микрофон и кабель: это вещи клиента,
// поэтому в модель стола они не входят.
//
// Координаты — как у корпуса до отражения (mirror.js); θ — от оси экрана, плюс —
// вправо от сидящего.

import {
  at, radial, tangent, add, sub, mul, norm, cross, len,
  cylinder, lathe, roundedBox, link, cable,
} from './build-monitor-rail.js?v=20260925-real';
import { LEVEL_1, UNDER_1 } from './params.js';
import { MIC_HATCH, MIC_CONDUIT, POCKET_TOP, micSleeve } from './mic-hatch.js';

// Фланец стоит в четверти заподлицо со шпоном; в сетке — на 0,4 выше плиты,
// чтобы грань не совпала с рабочей поверхностью.
const FACE = LEVEL_1 + 0.4;
const R_HOLE = MIC_HATCH.hole / 2, R_FLANGE = MIC_HATCH.flange / 2, R_LID = MIC_HATCH.lid / 2;
const NOTCH = 7;                     // выемка под палец в крышке, радиус

export const HATCH_COLORS = {
  metal: [0.2, 0.21, 0.225],
  gap: [0.02, 0.02, 0.022],
  tpe: [0.035, 0.035, 0.04],
  arm: [0.075, 0.075, 0.08],
  body: [0.06, 0.06, 0.065],
  grille: [0.03, 0.03, 0.032],
  cable: [0.05, 0.05, 0.055],
};
const C = HATCH_COLORS;

// Фланец: кольцо Ø96/Ø80 с фаской по наружной кромке.
function flange(mesh, o) {
  lathe(mesh, add(o, [0, 0, -1.2]), [0, 0, 1],
    [[R_HOLE, 0], [R_FLANGE - 0.8, 0], [R_FLANGE, 0.4], [R_FLANGE - 0.4, 1.2], [R_HOLE + 0.6, 1.2], [R_HOLE, 0.6], [R_HOLE, 0]], C.metal, 96);
}

// Крышка Ø78 с выемкой под палец со стороны стенки; тёмный зазор 1 по кругу.
function lid(metal, gap, o, theta) {
  lathe(metal, add(o, [0, 0, -1.2]), [0, 0, 1], [[0, 0], [R_LID, 0], [R_LID, 0.9], [R_LID - 0.6, 1.2], [0, 1.2]], C.metal, 96);
  lathe(gap, add(o, [0, 0, -1.3]), [0, 0, 1], [[R_LID, 0], [R_HOLE, 0], [R_HOLE, 1.1], [R_LID, 1.1]], C.gap, 96);
  // выемка под палец у края со стороны стенки: тёмная лунка вровень с крышкой,
  // её край уходит под фланец
  const n = add(o, mul(radial(theta), R_LID - NOTCH + 3));
  lathe(gap, add(n, [0, 0, -0.6]), [0, 0, 1], [[0, 0], [NOTCH, 0], [NOTCH, 0.64], [0, 0.64]], C.gap, 40);
}

// Низ люка: выборка до +780 (стенки и открытый край потолка — gap), стенка
// отверстия Ø80 до крышки (gap), стальное кольцо 3 мм на потолке выборки (metal).
// Окно канала — в стенке отверстия со стороны Tech Bay, над кольцом: из ниши его
// не видно, поэтому отдельно не рисуется.
function underside(metal, gap, theta) {
  const o = at(theta, MIC_HATCH.r, UNDER_1);
  const rP = MIC_HATCH.pocket / 2, dP = POCKET_TOP - UNDER_1, top = FACE - 1.2 - UNDER_1;
  const [sIn, sOut, sT] = MIC_HATCH.steel;
  lathe(gap, o, [0, 0, 1], [[rP, 0], [rP, dP], [R_HOLE, dP], [R_HOLE, top]], C.gap, 96);
  lathe(metal, add(o, [0, 0, dP - sT]), [0, 0, 1],
    [[sIn / 2, sT], [sOut / 2, sT], [sOut / 2, 0.6], [sOut / 2 - 0.6, 0], [sIn / 2 + 0.6, 0], [sIn / 2, 0.6], [sIn / 2, sT]], C.metal, 96);
}

// Люки в каждом столе: фланцы и крышки (metal), зазоры и выемки (gap), низ люка.
export function buildMicHatches(metal, gap, angles = MIC_HATCH.angles) {
  for (const theta of angles) {
    const o = at(theta, MIC_HATCH.r, FACE);
    flange(metal, o);
    lid(metal, gap, o, theta);
    underside(metal, gap, theta);
  }
}

// ── Витрина: штанга клиента в правом люке ───────────────────────────────────
// Рот сидящего: глаза на +1300 и в 120 перед центром отверстия (docs/monitor-mount),
// рот на 105 ниже. Микрофон — в 80 перед ртом, на 35 ниже и на 20 в сторону штанги.
export const MOUTH = { r: 130, z: 1195 };
// Низкопрофильная штанга (как Elgato Wave Mic Arm LP, RØDE PSA1+ в нижнем положении,
// Thronmax Caster): ствол из струбцины, горизонтальное первое звено, в локте шарнир
// с горизонтальной осью, второе звено с газовой пружиной внутри, на конце шарнир
// наклона и шпилька 5/8″ вверх. Кабель внутри, в канале под магнитными крышками на
// боках звеньев. Сечения и длины — по фото этих штанг, без логотипов.
export const SHOWCASE_ARM = { l1: 300, l2: 380, s1: [34, 42], s2: [30, 36], column: 36 };
const MIC_LEN = 185, MIC_R = 27;

export function micPose(side = 1, mouth = MOUTH) {
  const M = at(0, mouth.r, mouth.z);
  const cap = add(M, add(mul(radial(0), 80), add(mul(tangent(0), side * 20), [0, 0, -35])));
  const f = norm(sub(M, cap));
  const back = sub(cap, mul(f, MIC_LEN));
  const yoke = sub(cap, mul(f, 100));
  const tip = add(yoke, [0, 0, -74]);
  return { M, cap, f, back, yoke, tip };
}

// Вещательный динамический микрофон класса SM7B, без логотипов (27.09.2026): торцевой,
// 191 мм. Корпус Ø54 с фаской, канавкой и лёгким расширением к переду; металлическое
// кольцо; поролоновая ветрозащита Ø63 с куполом; на заднем торце — панель с двумя
// переключателями (срез НЧ, подъём середины). U-образная скоба в точке равновесия,
// барашки Ø34 с накаткой по бокам, снизу переходник 5/8″ с контргайкой. Разъём XLR —
// снизу на заднем торце, вилка кабеля с хвостовиком.
const XLR_DROP = 13;                         // ось разъёма ниже оси корпуса

// Барашек с накаткой: 40 зубцов по ободу, плоские торцы с фаской.
function knob(mesh, c, axis, r, w, color) {
  const a = norm(axis);
  const b1 = norm(cross(a, Math.abs(a[2]) < 0.9 ? [0, 0, 1] : [1, 0, 0])), b2 = cross(a, b1);
  const N = 80, rings = [[r - 2.2, 0], [r, 1.6], [r, w - 1.6], [r - 2.2, w]];
  const rad = (k, ring) => (ring === 1 || ring === 2 ? r - (k % 2 ? 1.1 : 0) : ring === 0 || ring === 3 ? r - 2.2 : r);
  const P = (k, i) => {
    const t = (2 * Math.PI * k) / N, d = add(mul(b1, Math.cos(t)), mul(b2, Math.sin(t)));
    return { p: add(c, add(mul(d, rad(k, i)), mul(a, rings[i][1]))), n: i === 0 ? norm(add(d, mul(a, -1))) : i === 3 ? norm(add(d, a)) : d };
  };
  const push = (tri) => { for (const v of tri) { mesh.position.push(...v.p); mesh.normal.push(...v.n); mesh.color.push(...color); } };
  for (let i = 0; i < 3; i++) for (let k = 0; k < N; k++) {
    const k1 = (k + 1) % N;
    const q = [P(k, i), P(k1, i), P(k1, i + 1), P(k, i + 1)];
    push([q[0], q[2], q[1]]); push([q[0], q[3], q[2]]);
  }
  for (const [i, sgn] of [[0, -1], [3, 1]]) {
    const cc = { p: add(c, mul(a, rings[i][1])), n: mul(a, sgn) };
    for (let k = 0; k < N; k++) {
      const v0 = { ...P(k, i), n: mul(a, sgn) }, v1 = { ...P((k + 1) % N, i), n: mul(a, sgn) };
      push(sgn > 0 ? [cc, v0, v1] : [cc, v1, v0]);
    }
  }
}

function buildMic(parts, { f, back, yoke }) {
  const s = norm(cross(f, [0, 0, 1]));
  const u = cross(s, f);
  const at_ = (h, du = 0, ds = 0) => add(back, add(mul(f, h), add(mul(u, du), mul(s, ds))));
  // корпус
  lathe(parts.body, back, f, [[0, 0], [21, 0], [24.5, 1.2], [26.2, 3.5], [26.6, 6], [26.6, 11.5], [25.8, 12.2],
    [25.8, 14.6], [26.6, 15.3], [26.9, 40], [27.3, 80], [27.3, 111], [26.6, 113]], C.body, 72);
  // кольцо на стыке с ветрозащитой
  lathe(parts.metal, at_(112), f, [[26.4, 0], [28.6, 0.8], [28.9, 2], [28.9, 8.4], [28.2, 9.6], [27.2, 10]], C.metal, 72);
  // ветрозащита: цилиндр с лёгкой бочкой и купол
  const foam = [[27.6, 0], [30.2, 1.4], [31.2, 5], [31.6, 14], [31.6, 32]];
  for (let k = 1; k <= 12; k++) { const t = (k / 12) * Math.PI / 2; foam.push([31.6 * Math.cos(t), 32 + 41 * Math.sin(t)]); }
  lathe(parts.grille, at_(118), f, foam, C.grille, 72);
  // задний торец: панель переключателей и два рычажка
  roundedBox(parts.gap, at_(-0.15, 8, 0), f, s, u, [0.4, 11, 6], 0.3, C.gap, 1);
  for (const ds of [-5, 5]) roundedBox(parts.metal, at_(-0.9, 8.5, ds), f, s, u, [0.9, 1.4, 3.2], 0.6, C.metal, 2);
  // разъём XLR снизу сзади и вилка кабеля с хвостовиком
  lathe(parts.metal, at_(0.2, -XLR_DROP), mul(f, -1), [[0, 0], [10.2, 0], [10.2, 7], [9.6, 8], [9.6, 30], [8.4, 34]], C.metal, 40);
  lathe(parts.body, at_(-33, -XLR_DROP), mul(f, -1), [[8.4, 0], [7, 6], [5.2, 12], [4, 20], [3.4, 26]], C.body, 32);
  // скоба: две щёки по бокам, перемычка под корпусом, переходник 5/8″ вниз
  const yh = len(sub(yoke, back));
  for (const k of [-1, 1]) {
    const side = MIC_R + 5.5;
    roundedBox(parts.arm, at_(yh, -16, k * side), f, s, u, [12, 3.2, 30], 3, C.arm, 3);
    cylinder(parts.gap, at_(yh, 0, k * (side + 3)), mul(s, k), 10, 2.2, 0.4, C.gap, 36);
    knob(parts.arm, at_(yh, 0, k * (side + 5)), mul(s, k), 17, 13, C.arm);
    cylinder(parts.metal, at_(yh, 0, k * (side + 17.8)), mul(s, k), 6, 0.6, 0.2, C.metal, 32);
  }
  roundedBox(parts.arm, at_(yh, -44, 0), f, s, u, [12, MIC_R + 8.7, 3.6], 3, C.arm, 3);
  cylinder(parts.arm, add(yoke, [0, 0, -70]), [0, 0, 1], 11, 24, 2, C.arm, 40);
  knob(parts.arm, add(yoke, [0, 0, -74]), [0, 0, 1], 13.5, 6, C.arm);
  cylinder(parts.metal, add(yoke, [0, 0, -80]), [0, 0, 1], 7.9, 6, 1, C.metal, 24);
}

// Мембрана из ТПЭ вместо крышки: четыре сектора с крестовой прорезью 1,6 мм, как у
// кабельных вводов; под ней темнота. Хребет струбцины и кабель проходят по прорези.
function membrane(parts, o, theta) {
  const out = radial(theta), tg = tangent(theta), SLIT = 1.6, N = 16;
  lathe(parts.gap, add(o, [0, 0, -12]), [0, 0, 1], [[0, 0], [R_HOLE, 0], [R_HOLE, 10], [0, 10]], C.gap, 64);
  for (const [su, sv] of [[1, 1], [-1, 1], [-1, -1], [1, -1]]) {
    const c = add(o, add(mul(out, su * SLIT / 2), add(mul(tg, sv * SLIT / 2), [0, 0, 0.3])));
    const pts = [];
    for (let k = 0; k <= N; k++) {
      const a = (Math.PI / 2) * (k / N);
      const x = Math.max(0, R_HOLE * Math.cos(a) - SLIT / 2), y = Math.max(0, R_HOLE * Math.sin(a) - SLIT / 2);
      pts.push(add(c, add(mul(out, su * x), mul(tg, sv * y))));
    }
    for (let k = 0; k < N; k++) {
      const tri = su * sv > 0 ? [c, pts[k], pts[k + 1]] : [c, pts[k + 1], pts[k]];
      for (const p of tri) { parts.tpe.position.push(...p); parts.tpe.normal.push(0, 0, 1); parts.tpe.color.push(...C.tpe); }
    }
  }
}

// Штанга клиента в люке theta: струбцина хребтом у дальнего края люка, верхняя губка
// лежит на столе (или накладке) к стенке; звенья в одной вертикальной плоскости до
// узла под микрофоном; кабель по звеньям и вниз в прорезь мембраны.
export function buildMicShowcase(parts, theta = MIC_HATCH.angles[0], { top = LEVEL_1, pose = micPose(Math.sign(theta)) } = {}) {
  const o = at(theta, MIC_HATCH.r, FACE);
  const out = radial(theta), tg = tangent(theta);
  flange(parts.metal, o);
  membrane(parts, o, theta);
  const spine = add(at(theta, MIC_HATCH.r + R_HOLE - 12, top), [0, 0, 0]);
  roundedBox(parts.arm, add(spine, add(mul(out, 32), [0, 0, 7])), out, tg, [0, 0, 1], [44, 30, 7], 3, C.arm, 3);
  roundedBox(parts.arm, add(spine, [0, 0, -6]), out, tg, [0, 0, 1], [9, 26, 20], 3, C.arm, 3);
  const socket = add(spine, [0, 0, 14]);
  cylinder(parts.arm, socket, [0, 0, 1], 19, 46, 3, C.arm, 48);
  // звенья в одной вертикальной плоскости: в плане — прямая от ствола к шпильке.
  // Первое звено горизонтально, второе поднимается к узлу; высота ствола — такая,
  // чтобы узел пришёлся под скобу микрофона.
  const A = SHOWCASE_ARM;
  const T = pose.tip;
  const hp = [T[0] - socket[0], T[1] - socket[1], 0];
  const e = norm(hp), dPlan = len(hp);
  const n = norm(cross(e, [0, 0, 1]));
  const cosP = Math.min(1, (dPlan - A.l1) / A.l2), sinP = Math.sqrt(1 - cosP * cosP);
  const tipJ = add(T, [0, 0, -12]);                       // ось шарнира наклона на конце
  const zS = tipJ[2] - A.l2 * sinP;
  const B = [socket[0], socket[1], zS];
  const E = add(B, mul(e, A.l1));
  const d2 = norm(sub(tipJ, E)), up2 = norm(cross(n, d2));
  // ствол: гильза на гнезде, труба Ø36 и скруглённое колено в первое звено
  cylinder(parts.arm, add(socket, [0, 0, 40]), [0, 0, 1], 21, 16, 3, C.arm, 48);
  cylinder(parts.arm, add(socket, [0, 0, 50]), [0, 0, 1], A.column / 2, zS - socket[2] - 50, 2, C.arm, 48);
  // звено: брусок со скруглёнными кромками и торцами; на боках — крышки кабельного
  // канала в тонкой тёмной рамке (они снимаются на магнитах)
  const segment = (P, Q, [w, hgt], up) => {
    const ex = norm(sub(Q, P)), ey = norm(cross(up, ex)), ez = cross(ex, ey);
    const L = len(sub(Q, P)), mid = mul(add(P, Q), 0.5);
    roundedBox(parts.arm, mid, ex, ey, ez, [L / 2 + hgt / 2, w / 2, hgt / 2], Math.min(w, hgt) / 2 - 1, C.arm, 5);
    for (const sgn of [-1, 1]) {
      roundedBox(parts.gap, add(mid, mul(ey, sgn * (w / 2 - 0.3))), ex, ey, ez, [L / 2 - 26, 0.6, hgt / 2 - 7], 0.3, C.gap, 1);
      roundedBox(parts.arm, add(mid, mul(ey, sgn * (w / 2 + 0.05))), ex, ey, ez, [L / 2 - 28, 0.6, hgt / 2 - 8.5], 0.5, C.arm, 2);
    }
  };
  segment(B, E, A.s1, [0, 0, 1]);
  segment(E, tipJ, A.s2, up2);
  // шарниры: в корне первого звена — вертикальный (поворот), в локте — наклон второго
  // звена, на конце — наклон узла; тёмные торцевые шайбы по бокам
  const barrel = (c, axis, r, w) => {
    cylinder(parts.arm, add(c, mul(axis, -w / 2)), axis, r, w, 3, C.arm, 48);
    for (const sgn of [-1, 1]) cylinder(parts.gap, add(c, mul(axis, sgn * (w / 2) - (sgn < 0 ? 0.6 : 0))), axis, r - 4, 0.6, 0.2, C.gap, 40);
  };
  cylinder(parts.arm, add(B, [0, 0, -A.s1[1] / 2 - 6]), [0, 0, 1], A.column / 2 + 3, A.s1[1] + 12, 4, C.arm, 48);
  barrel(E, n, 25, A.s1[0] + 8);
  barrel(tipJ, n, 16, A.s2[0] + 4);
  cylinder(parts.arm, add(tipJ, [0, 0, 6]), [0, 0, 1], 10, 8, 2, C.arm, 32);
  buildMic(parts, pose);
  // кабель: из вилки петлёй в узел на конце штанги (дальше — внутри канала);
  // у основания выходит из ствола со стороны −касательной, огибает губку и уходит в
  // прорезь мембраны у края люка
  const micUp = cross(norm(cross(pose.f, [0, 0, 1])), pose.f);
  const plugEnd = add(pose.back, add(mul(pose.f, -59), mul(micUp, -XLR_DROP)));
  cable(parts.cables, [
    add(plugEnd, mul(pose.f, 6)), plugEnd, add(mul(add(plugEnd, tipJ), 0.5), [0, 0, -34]),
    add(tipJ, add(mul(d2, -18), [0, 0, -6])), add(tipJ, add(mul(d2, -30), [0, 0, -4])),
  ], 3.2, C.cable);
  const side = (t, r, z) => add(o, add(mul(tg, -t), add(mul(out, r), [0, 0, z])));
  const exit = add([socket[0], socket[1], socket[2] + 70], mul(tg, -12));
  cable(parts.cables, [
    add(exit, mul(tg, 6)), exit, add([socket[0], socket[1], socket[2] + 40], mul(tg, -32)),
    side(40, 28, socket[2] - FACE + 22), side(41, 22, 18), side(37, 12, 15), side(29, 5, 10),
    side(CABLE_DROP + 1, 1, 5), side(CABLE_DROP, 0, -8), side(R_HOLE - 4, 0, MIC_CONDUIT.mouthZ - FACE),
    side(R_HOLE + 12, 0, MIC_CONDUIT.mouthZ - FACE),
  ], 3.2, C.cable);
  const reach = dPlan;
  return { B, E, T, tipJ, reach, plan: dPlan, pitch: Math.atan2(sinP, cosP) * 180 / Math.PI };
}

// ── Закладной канал ──────────────────────────────────────────────────────────
// Трасса — micConduitPath (mic-hatch.js): труба в сотах кольца, камера над Tech Bay
// и гильза вниз. Всё внутри кольца и корпуса; в модели стола — только гильза
// (группа mic-channel), в схеме «Данные» — вся трасса (build-electrics.js).
const CABLE_DROP = 30;                       // кабель проходит прорезь в 30 от центра люка

export function buildMicSleeve(mesh) {
  const [top, bottom] = micSleeve();
  const [od, id] = MIC_CONDUIT.sleeve;
  lathe(mesh, bottom, [0, 0, 1], [[id / 2, 0], [od / 2, 0], [od / 2, top[2] - bottom[2]], [id / 2, top[2] - bottom[2]], [id / 2, 0]], C.metal, 40);
}

export const micShowcaseParts = () => Object.fromEntries(['metal', 'gap', 'tpe', 'arm', 'body', 'grille', 'cables']
  .map((k) => [k, { position: [], normal: [], color: [] }]));
