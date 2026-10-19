// Мусорное ведро блока К6 (build-trash.js): литой полипропилен, утолщённый буртик по
// верху, ступенька-пояс и одно ребро жёсткости на стенке, литое кольцо основания и
// чёрный мешок, заведённый через буртик. Ведро без крышки: ниша закрыта фасадом, а
// выдвинутое ведро стоит под секцией Bridge, где крышке некуда открыться (params.js,
// TRASH_BIN).
//
// Оси — (u, v, z) блока: u поперёк хода, v вдоль хода (build-trash.js переставляет их
// в x, y). Контур в плане — скруглённый прямоугольник, сужающийся книзу; все сечения
// строятся от одной формулы и потому сшиваются без швов. Мешок — один лист, обращённый
// нормалью «от ведра»: внутри — к центру, поверх буртика — вверх, снаружи — наружу.

import { addQuad, addPolygon, addLoft, roundedRect } from './mesh.js';
import { PALETTE } from './palette.js';

const STEPS = 10;                 // сегментов на скруглённый угол: 44 точки на контур
const TWO_PI = Math.PI * 2;
const FOOT = 5;                   // литое кольцо основания: высота
const FOOT_INSET = 9;             // и его отступ от стенки
const FILLET = 6;                 // радиус нижней кромки корпуса
const LIP = { in: -2, out: 7, half: 4, r: 2.5 };   // буртик: от -2 (внутрь) до +7 (наружу), высота 2 × half
const BAG_A = 6.5;                // заворот мешка: полуось по нормали к стенке
const BAG_B = LIP.half + 0.4;     // и по высоте — на 0,4 выше буртика
const BAG_IN = 4.0;               // мешок внутри отстоит от стенки
export const BAG_OUT = LIP.out + 2; // на сколько мешок у буртика выступает за стенку (габарит для проверок)
const BAG_POINTS = 120;           // точек контура мешка: складки должны лечь и на прямые стороны

const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const wave = (th, k1, p1, k2, p2) => 0.6 * Math.sin(k1 * th + p1) + 0.4 * Math.sin(k2 * th + p2);
// Складки мешка: пять гармоник разной частоты, чтобы они не выстраивались в узор.
const crease = (th) => 0.34 * Math.sin(5 * th + 0.3) + 0.26 * Math.sin(9 * th + 1.7) + 0.2 * Math.sin(14 * th + 0.4)
  + 0.12 * Math.sin(19 * th + 2.6) + 0.08 * Math.sin(27 * th + 1.1);

// Контур ведра на высоте z: размеры линейно между дном и верхом, радиус угла 22 → 30.
function outlineAt(bin, z) {
  const [z0, z1] = bin.z;
  const k = Math.min(1, Math.max(0, (z - z0) / (z1 - z0)));
  const w = bin.bottom[0] + (bin.top[0] - bin.bottom[0]) * k;
  const d = bin.bottom[1] + (bin.top[1] - bin.bottom[1]) * k;
  return { w, d, r: 22 + 8 * k };
}

// Точки контура со смещением inset внутрь (отрицательное — наружу).
function ring(bin, c, z, inset = 0) {
  const { w, d, r } = outlineAt(bin, z);
  return roundedRect(c[0], c[1], w - 2 * inset, d - 2 * inset, Math.max(2, r - inset), STEPS);
}

// Контур заново по равным долям длины: на прямых сторонах скруглённого прямоугольника
// нет промежуточных точек, а мешку нужны складки и там.
function resample(pts, n) {
  const acc = [0];
  for (let i = 1; i <= pts.length; i++) {
    const a = pts[i - 1], b = pts[i % pts.length];
    acc.push(acc[i - 1] + Math.hypot(b[0] - a[0], b[1] - a[1]));
  }
  const total = acc[pts.length];
  const out = [];
  let seg = 0;
  for (let i = 0; i < n; i++) {
    const s = (i / n) * total;
    while (acc[seg + 1] < s) seg++;
    const a = pts[seg], b = pts[(seg + 1) % pts.length];
    const t = (s - acc[seg]) / (acc[seg + 1] - acc[seg]);
    out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
  }
  return out;
}

function normalsOf(pts) {
  return pts.map((p, i) => {
    const a = pts[(i + pts.length - 1) % pts.length], b = pts[(i + 1) % pts.length];
    const tu = b[0] - a[0], tv = b[1] - a[1];
    const l = Math.hypot(tu, tv) || 1;
    return [tv / l, -tu / l];               // контур идёт против часовой: наружу — вправо от хода
  });
}

// Точки контура, сдвинутые вдоль нормали на o (наружу +) и поднятые на z.
function displaced(pts, normals, os, zs) {
  return pts.map((p, i) => [p[0] + normals[i][0] * os[i], p[1] + normals[i][1] * os[i], typeof zs === 'number' ? zs : zs[i]]);
}

// Скруглённый прямоугольник в плоскости (o, z), обход против часовой — сечение буртика.
function lipProfile() {
  const { in: o0, out: o1, half, r } = LIP;
  const corners = [[o1 - r, half - r, 0], [o0 + r, half - r, 90], [o0 + r, -half + r, 180], [o1 - r, -half + r, 270]];
  const pts = [];
  for (const [co, cz, start] of corners)
    for (let i = 0; i <= 4; i++) {
      const a = ((start + (i * 90) / 4) * Math.PI) / 180;
      pts.push([co + r * Math.cos(a), cz + r * Math.sin(a)]);
    }
  return pts;
}

export function buildBin(mesh, c, bin) {
  const [z0, z1] = bin.z;
  const plastic = PALETTE.binPlastic, bag = PALETTE.binBag;
  const at = (z, inset) => ring(bin, c, z, inset).map(([u, v]) => [u, v, z]);

  // ─── Корпус: нижняя кромка R6, ребро жёсткости, ступенька-пояс под буртиком ───────
  const zFoot = z0 + FOOT;                       // дно корпуса над кольцом основания
  const profile = [];                            // [z, inset]; inset < 0 — наружу
  for (let k = 0; k <= 6; k++) {
    const a = (Math.PI / 2) * (k / 6);
    profile.push([zFoot + FILLET * (1 - Math.cos(a)), FILLET * (1 - Math.sin(a))]);
  }
  const push = (z, inset) => { if (z > profile[profile.length - 1][0] + 0.01) profile.push([z, inset]); };
  // Одно прессованное ребро на трети высоты: литьё даёт его мягче, чем штамповка (1 мм).
  const zRib = z0 + (z1 - z0) * 0.34;
  for (const [dz, depth] of [[-8, 0], [-5, 0.4], [-2, 0.95], [2, 0.95], [5, 0.4], [8, 0]]) push(zRib + dz, depth);
  // Пояс: верхние 80 мм стенки толще на 0,9 — виден в просвете под свисающим мешком.
  push(z1 - 88, 0); push(z1 - 84, -0.9); push(z1 - 16, -0.9); push(z1 - 12, 0);
  push(z1 - LIP.half, 0);
  addLoft(mesh, profile.map(([z, inset]) => at(z, inset)), plastic, { cap: false });
  addPolygon(mesh, at(zFoot, FILLET).reverse(), plastic);

  // ─── Литое кольцо основания: чуть уже дна, между ним и кромкой — тень ──────────────
  addLoft(mesh, [at(z0, FOOT_INSET), at(zFoot, FOOT_INSET)], plastic, { cap: false });
  addPolygon(mesh, at(z0, FOOT_INSET).reverse(), plastic);

  // ─── Буртик: скруглённое сечение 9 × 8 по контуру ─────────────────────────────────
  const rim = ring(bin, c, z1, 0);
  const rimN = normalsOf(rim);
  const lip = lipProfile();
  const place = (i, [o, dz]) => [rim[i][0] + rimN[i][0] * o, rim[i][1] + rimN[i][1] * o, z1 + dz];
  for (let i = 0; i < rim.length; i++) {
    const j = (i + 1) % rim.length;
    for (let k = 0; k < lip.length; k++) {
      const l = (k + 1) % lip.length;
      addQuad(mesh, place(i, lip[k]), place(j, lip[k]), place(j, lip[l]), place(i, lip[l]), plastic);
    }
  }

  // ─── Мешок: один лист снизу вверх, через буртик, вниз по наружной стенке ──────────
  const th = Array.from({ length: BAG_POINTS }, (_, i) => (i / BAG_POINTS) * TWO_PI);
  const sections = [];
  const section = (z, os) => {
    const base = resample(ring(bin, c, z, 0), BAG_POINTS);
    return displaced(base, normalsOf(base), os, z);
  };
  const bagFloor = z0 + FOOT + FILLET + 3;       // дно мешка над дном корпуса
  const span = z1 - bagFloor;
  const inside = (z) => th.map((t) => {
    const depth = 1 - (z - bagFloor) / span;                       // 1 у дна, 0 у буртика
    return -BAG_IN - (0.5 + 0.5 * crease(t)) * (1.0 + 7.5 * depth ** 1.25);
  });
  // Дно мешка скруглено: три сечения от центра дна к стенке.
  sections.push(section(bagFloor, th.map(() => -BAG_IN - 13)));
  sections.push(section(bagFloor + 2, inside(bagFloor).map((o) => o - 6)));
  sections.push(section(bagFloor + 5, inside(bagFloor).map((o) => o - 2)));
  for (const z of [bagFloor + 12, 190, 250, 320, 400, 480, 545, z1 - 22, z1 - 10, z1 - 3])
    sections.push(section(z, inside(z)));
  // Заворот через буртик: полуэллипс вокруг его сечения.
  for (const deg of [170, 150, 130, 110, 90, 70, 50, 30, 12]) {
    const a = (deg * Math.PI) / 180;
    sections.push(section(z1 + BAG_B * Math.sin(a), th.map(() => (LIP.out + LIP.in) / 2 + BAG_A * Math.cos(a))));
  }
  // Свисающая наружная часть: край неровный, мешок отходит от стенки складками.
  const hem = th.map((t) => 44 + 11 * Math.sin(3 * t + 0.4) + 7 * Math.sin(8 * t + 2.1) + 4 * Math.sin(15 * t + 0.2) + 3 * Math.sin(23 * t + 1.3));
  for (const f of [0.08, 0.2, 0.36, 0.55, 0.78, 1]) {
    const s = smooth(0, 0.55, f);
    const os = th.map((t) => {
      const pleat = 6.0 * Math.max(0, crease(t) + 0.1) ** 1.1 * f + 0.8 * wave(t, 5, 2.2, 11, 0.9) * f;
      return BAG_OUT * (1 - s) + (1.5 + pleat) * s;
    });
    sections.push(section(z1, os).map((p, i) => { p[2] = z1 - f * hem[i]; return p; }));
  }
  // Обход секций развёрнут: нормаль мешка — «от ведра» (внутри к центру, снаружи наружу).
  addLoft(mesh, sections.map((s) => s.slice().reverse()), bag, { cap: false });
  addPolygon(mesh, sections[0], bag);
}
