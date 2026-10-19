// Рабочая накладка — опция конфигуратора (шаг «Накладка»), контур из worktop-pad.js
// и чертежа 30. Две детали: цельная C-образная R508…R1150 на неподвижной рабочей
// поверхности и отдельная на верху Bridge. Вторая — своя группа: едет вместе с секцией.
//
// Вид — как у настольного кожаного коврика: край завальцован (верх скруглён R3)
// и по всему контуру идёт строчка в 7 мм от кромки. Углы в плане — R15.
// Толщина 4 мм — середина ориентира 3–4,5 мм из docs/worktop-pad. Состав ещё не
// выбран, поэтому это толщина для вида, а не производственный размер. Накладка
// лежит на отметке 820 и не заходит на скругление R8 у отверстия.
//
// Люки под штангу микрофона (mic-hatch.js): в основной детали два отверстия Ø100
// вокруг фланцев Ø96 — с той же завальцованной кромкой и строчкой по кругу.

import { LEVEL_1, SEGMENTS } from './params.js';
import { addPolygon, polygonNormal } from './mesh.js';
import { PAD } from './worktop-pad.js';
import { PALETTE } from './palette.js';
import { MIC_HATCH, hatchCenter } from './mic-hatch.js';

export const PAD_THICK = 4;
const EDGE_ROUND = 3;        // завальцованный край: скругление верха
const EDGE_STEPS = 4;
const STITCH_INSET = 7;      // строчка от кромки
const STITCH = { length: 4, gap: 2.5, width: 0.9, lift: 0.3 };
const ARC_STEPS = SEGMENTS * 2; // разбиение дуг основной детали
const BRIDGE_STEPS = 64;        // разбиение передней дуги детали на Bridge

// Профиль кромки: (отступ внутрь от контура, высота над столешницей) снизу вверх.
const PROFILE = [[0, 0], ...Array.from({ length: EDGE_STEPS + 1 }, (_, k) => {
  const phi = (Math.PI / 2) * (k / EDGE_STEPS);
  return [EDGE_ROUND * (1 - Math.cos(phi)), PAD_THICK - EDGE_ROUND + EDGE_ROUND * Math.sin(phi)];
})];

// Грань с нормалью наружу из тела детали: mirror.js и Blender берут её из обхода.
function addOutward(mesh, pts, outward, color = PALETTE.pad) {
  const n = polygonNormal(pts);
  if (!n) return;
  const out = n[0] * outward[0] + n[1] * outward[1] + n[2] * outward[2] >= 0;
  addPolygon(mesh, out ? pts : pts.slice().reverse(), color);
}

const arc = (r, a0, a1, steps) => Array.from({ length: steps + 1 }, (_, i) => {
  const a = a0 + ((a1 - a0) * i) / steps;
  return [PAD.cx + r * Math.cos(a), PAD.cy + r * Math.sin(a)];
});

// Углы в плане скруглены, как у кожаного коврика и как у самой секции Bridge.
// Центр скругления от отступа d не зависит: контур, отступивший на d, огибает
// тот же центр радиусом CORNER_R − d. Поэтому кромка и строчка идут концентрично.
const CORNER_R = 15;
const CORNER_STEPS = 8;
const dir = (v) => Math.atan2(v[1], v[0]);
// Дуга скругления вокруг центра c (от центра стола) — короткой стороной от a0 к a1.
function corner(c, rad, a0, a1) {
  let da = a1 - a0;
  da -= Math.PI * 2 * Math.round(da / (Math.PI * 2));
  return Array.from({ length: CORNER_STEPS + 1 }, (_, k) => {
    const a = a0 + (da * k) / CORNER_STEPS;
    return [PAD.cx + c[0] + rad * Math.cos(a), PAD.cy + c[1] + rad * Math.sin(a)];
  });
}
// Центр скругления между срезом x и окружностью: на расстоянии dist от центра стола.
const onCircle = (x, dist) => [x, Math.sqrt(dist * dist - x * x)];

// Контур основной детали, отступивший внутрь на d: наружная дуга R − d, внутренняя
// r + d, проход шире на 2d. Срез у петли стоит на
// PAD_HINGE_MAIN дальше от оси, чем срез у выступа (worktop-pad.js). Обход против
// часовой, деталь слева: скругление у петли, наружная дуга через зад, скругление и
// срез у выступа, внутренняя дуга назад, срез у петли. Половины контура равной
// длины, чтобы верх сшивался полосами «снаружи — внутри».
function mainContour(d) {
  const R = PAD.outerRadius, r = PAD.innerRadius, rc = CORNER_R - d;
  const xl = PAD.mainX0 - PAD.cx - CORNER_R, xr = PAD.mainX1 - PAD.cx + CORNER_R;
  const oL = onCircle(xl, R - CORNER_R), oR = onCircle(xr, R - CORNER_R);
  const iL = onCircle(xl, r + CORNER_R), iR = onCircle(xr, r + CORNER_R);
  return {
    outer: [
      ...corner(oL, rc, 0, dir(oL)),
      ...arc(R - d, dir(oL), dir(oR) + Math.PI * 2, ARC_STEPS).slice(1, -1),
      ...corner(oR, rc, dir(oR), Math.PI),
    ],
    inner: [
      ...corner(iR, rc, Math.PI, dir(iR) + Math.PI),
      ...arc(r + d, dir(iR) + Math.PI * 2, dir(iL), ARC_STEPS).slice(1, -1),
      ...corner(iL, rc, dir(iL) + Math.PI, 0),
    ],
  };
}

// Контур детали на Bridge: спереди дуга по отверстию, сзади прямая у скругления
// секции, все четыре угла скруглены.
function bridgeContour(d) {
  const r = PAD.innerRadius, rc = CORNER_R - d;
  const a = PAD.bridgeX0 - PAD.cx + CORNER_R, b = PAD.bridgeX1 - PAD.cx - CORNER_R;
  const y = PAD.bridgeEndY - PAD.cy - CORNER_R;
  const fa = onCircle(a, r + CORNER_R), fb = onCircle(b, r + CORNER_R);
  const front = [
    ...corner(fa, rc, Math.PI, dir(fa) + Math.PI),
    ...arc(r + d, dir(fa), dir(fb), BRIDGE_STEPS).slice(1, -1),
    ...corner(fb, rc, dir(fb) + Math.PI, 0),
  ];
  const back = [
    ...corner([b, y], rc, 0, Math.PI / 2),
    ...Array.from({ length: BRIDGE_STEPS - 1 }, (_, i) =>
      [PAD.cx + b - ((b - a) * (i + 1)) / BRIDGE_STEPS, PAD.cy + y + rc]),
    ...corner([a, y], rc, Math.PI / 2, Math.PI),
  ];
  return { outer: front, inner: back };
}

const loop = ({ outer, inner }) => [...outer, ...inner];

// Верх или низ: полосы между парами точек двух половин контура. Полоса i идёт от
// точки наружной половины к парной точке внутренней, параметр t — вдоль неё.
// Отверстия holes ([x, y, r]) вырезаются окном: полосы у отверстия режутся по t,
// а между краем окна и окружностью строится кольцо с точками на общих лучах.
function addCap(mesh, { outer, inner }, z, up, holes = []) {
  const n = outer.length;
  const P = (i, t) => {
    const a = outer[i], e = inner[n - 1 - i];
    return [a[0] + (e[0] - a[0]) * t, a[1] + (e[1] - a[1]) * t];
  };
  const quad = (i, t0, t1) => {
    const q = [P(i, t0), P(i + 1, t0), P(i + 1, t1), P(i, t1)].map((p) => [p[0], p[1], z]);
    addOutward(mesh, q, [0, 0, up ? 1 : -1]);
  };
  const windows = holes.map(([hx, hy, r]) => windowFor(P, n, hx, hy, r));
  for (let i = 0; i < n - 1; i++) {
    const cuts = [0, 1];
    for (const w of windows) if (i >= w.i0 - 1 && i <= w.i1 + 1) cuts.push(w.t0, w.t1);
    const ts = [...new Set(cuts)].sort((p, q) => p - q);
    for (let k = 0; k < ts.length - 1; k++) {
      const tm = (ts[k] + ts[k + 1]) / 2;
      if (windows.some((w) => i >= w.i0 && i <= w.i1 && tm > w.t0 && tm < w.t1)) continue;
      quad(i, ts[k], ts[k + 1]);
    }
  }
  holes.forEach(([hx, hy, r], h) => ringFill(mesh, windowLoop(P, windows[h]), hx, hy, r, z, up));
}

// Окно вокруг отверстия: полосы i0…i1, чьи рёбра проходят ближе r + 12 к центру,
// и отрезок t0…t1 вдоль полос, накрывающий круг с запасом.
function windowFor(P, n, hx, hy, r) {
  const s = r + 12;
  let i0 = Infinity, i1 = -Infinity, t0 = 1, t1 = 0;
  for (let i = 0; i < n - 1; i++) {
    for (const j of [i, i + 1]) {
      const a = P(j, 0), b = P(j, 1);
      const dx = b[0] - a[0], dy = b[1] - a[1], l2 = dx * dx + dy * dy;
      const t = Math.max(0, Math.min(1, ((hx - a[0]) * dx + (hy - a[1]) * dy) / l2));
      if (Math.hypot(a[0] + dx * t - hx, a[1] + dy * t - hy) > s) continue;
      i0 = Math.min(i0, i); i1 = Math.max(i1, i);
      const l = Math.sqrt(l2);
      t0 = Math.min(t0, t - s / l); t1 = Math.max(t1, t + s / l);
    }
  }
  if (!Number.isFinite(i0) || t0 <= 0 || t1 >= 1) throw new Error(`накладка: отверстие (${hx}, ${hy}) не помещается в деталь`);
  return { i0, i1, t0, t1 };
}

// Контур окна по вершинам полос — те же точки, что у соседних четырёхугольников.
const windowLoop = (P, { i0, i1, t0, t1 }) => {
  const low = [], high = [];
  for (let i = i0; i <= i1 + 1; i++) { low.push(P(i, t0)); high.push(P(i, t1)); }
  return [...low, ...high.reverse()];
};

// Кольцо между контуром окна и окружностью: каждый отрезок контура делится так,
// чтобы шаг по углу был не больше 4°, парная точка окружности — на том же луче.
function ringFill(mesh, loop, hx, hy, r, z, up) {
  const outerPts = [];
  for (let k = 0; k < loop.length; k++) {
    const a = loop[k], b = loop[(k + 1) % loop.length];
    const da = Math.abs(Math.atan2(b[1] - hy, b[0] - hx) - Math.atan2(a[1] - hy, a[0] - hx));
    const steps = Math.max(1, Math.ceil(Math.min(da, 2 * Math.PI - da) / (4 * Math.PI / 180)));
    for (let s = 0; s < steps; s++) outerPts.push([a[0] + (b[0] - a[0]) * s / steps, a[1] + (b[1] - a[1]) * s / steps]);
  }
  const innerPts = outerPts.map(([x, y]) => {
    const ang = Math.atan2(y - hy, x - hx);
    return [hx + r * Math.cos(ang), hy + r * Math.sin(ang)];
  });
  for (let k = 0; k < outerPts.length; k++) {
    const j = (k + 1) % outerPts.length;
    addOutward(mesh, [outerPts[k], outerPts[j], innerPts[j], innerPts[k]].map((p) => [p[0], p[1], z]), [0, 0, up ? 1 : -1]);
  }
}

// Боковина по профилю кромки: соседние отступы сшиваются полосой по всему контуру.
function addRim(mesh, contourAt) {
  const layers = PROFILE.map(([d, z]) => loop(contourAt(d)).map((p) => [p[0], p[1], z]));
  for (let k = 0; k < layers.length - 1; k++) {
    const lo = layers[k], hi = layers[k + 1];
    for (let i = 0; i < lo.length; i++) {
      const j = (i + 1) % lo.length;
      const dx = lo[j][0] - lo[i][0], dy = lo[j][1] - lo[i][1];
      const len = Math.hypot(dx, dy);
      if (len < 1e-6) continue;
      // Деталь слева от обхода, значит наружу — вправо; вверх — у скруглённой части.
      addOutward(mesh, [lo[i], lo[j], hi[j], hi[i]], [dy / len, -dx / len, 0.5]);
    }
  }
}

// Строчка: штрихи по контуру, отступившему на STITCH_INSET, чуть над кожей.
// Шаг считается по длине всего контура: штрих, попавший на вершину, достраивается
// на следующем отрезке, поэтому ритм строчки ровный.
function addStitch(mesh, pts) {
  const z = PAD_THICK + STITCH.lift;
  const period = STITCH.length + STITCH.gap;
  let walked = 0;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i], b = pts[(i + 1) % pts.length];
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (len < 1e-6) continue;
    const ux = (b[0] - a[0]) / len, uy = (b[1] - a[1]) / len;
    const nx = -uy * STITCH.width / 2, ny = ux * STITCH.width / 2;
    for (let k = Math.floor(walked / period); k * period < walked + len; k++) {
      const s = Math.max(k * period - walked, 0);
      const e = Math.min(k * period + STITCH.length - walked, len);
      if (e - s < 1e-3) continue;
      const p = [a[0] + ux * s, a[1] + uy * s], q = [a[0] + ux * e, a[1] + uy * e];
      addOutward(mesh, [[p[0] - nx, p[1] - ny, z], [q[0] - nx, q[1] - ny, z],
        [q[0] + nx, q[1] + ny, z], [p[0] + nx, p[1] + ny, z]], [0, 0, 1], PALETTE.padStitch);
    }
    walked += len;
  }
}

// Кромка отверстия: тот же профиль, что у контура, но «внутрь детали» — это от центра
// отверстия наружу. Наружу из тела — к центру отверстия и вверх.
function addHoleRim(mesh, [hx, hy, r]) {
  const N = 72;
  const ringAt = (rad, z) => Array.from({ length: N }, (_, k) => {
    const a = (2 * Math.PI * k) / N;
    return [hx + rad * Math.cos(a), hy + rad * Math.sin(a), z];
  });
  const layers = PROFILE.map(([d, z]) => ringAt(r + d, z));
  for (let k = 0; k < layers.length - 1; k++) {
    for (let i = 0; i < N; i++) {
      const j = (i + 1) % N, lo = layers[k], hi = layers[k + 1];
      const mx = (lo[i][0] + lo[j][0]) / 2 - hx, my = (lo[i][1] + lo[j][1]) / 2 - hy, l = Math.hypot(mx, my);
      addOutward(mesh, [lo[i], lo[j], hi[j], hi[i]], [-mx / l, -my / l, 0.5]);
    }
  }
}

function buildPad(mesh, contourAt, holes = []) {
  addCap(mesh, contourAt(EDGE_ROUND), PAD_THICK, true, holes.map(([x, y, r]) => [x, y, r + EDGE_ROUND]));
  addCap(mesh, contourAt(0), 0, false, holes);
  addRim(mesh, contourAt);
  addStitch(mesh, loop(contourAt(STITCH_INSET)));
  for (const h of holes) {
    addHoleRim(mesh, h);
    addStitch(mesh, Array.from({ length: 180 }, (_, k) => {
      const a = (2 * Math.PI * k) / 180;
      return [h[0] + (h[2] + STITCH_INSET) * Math.cos(a), h[1] + (h[2] + STITCH_INSET) * Math.sin(a)];
    }));
  }
  // Всё построено от нуля — поднимаем на рабочую поверхность.
  for (let i = 2; i < mesh.position.length; i += 3) mesh.position[i] += LEVEL_1;
}

// Отверстия под люки микрофона — в основной детали.
export const PAD_HOLES = MIC_HATCH.angles.map((a) => [...hatchCenter(a), MIC_HATCH.padHole / 2]);
export const buildWorktopPad = (mesh) => buildPad(mesh, mainContour, PAD_HOLES);
export const buildBridgePad = (mesh) => buildPad(mesh, bridgeContour);
