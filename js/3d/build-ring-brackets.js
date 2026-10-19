// Кронштейны рабочего кольца — узел У4, листы 06 и 34. Кольцо лежит на корпусе
// опорой 100, а консоль над нишей для ног держат 21 косынка на стенке ниши R1050.
//
// Кронштейн — сварная косынка 170 × 170 из стали 6, порошок графит: полка 40
// под кольцом, полка 40 на стенке, между ними ребро по краю полок. В стену —
// 2 × М8 × 40 в закладную полосу, в кольцо — 2 × М8 × 30 снизу в пазы 9 × 14.
// Винты DIN 912 чёрные, под ними шайбы DIN 125 Ø16: DIN 9021 Ø24 наезжала на
// швы ребра — ось винта в 14 от ребра. Колпачков на винты нет (27.09.2026:
// «делай, но без перебора» — но открытая косынка стоит на высоте колен, и
// 28.09.2026 решено закрыть само ребро: мягкий кожух R14 (резина/TPE, цвет
// PALETTE.buffer, как у буфера-упора) на всех 21 кронштейнах, приклеен на
// сварной шов диагонального ребра — от полки под кольцом (SH) до полки на
// стене (LOW). Винты остаются открытыми — кожух закрывает только кромку.
//
// θ — от оси экрана, плюс вправо от сидящего, как у люков микрофона (mic-hatch.js).
// Раскладка — план 03 листа 34: симметрично, шаг ≤ 300 по R1050, соседние не
// ближе 150 (парами не ставим), от стыков модулей корпуса (±31,6° на стенке) не
// ближе 70, у стыка A (±50°) — по кронштейну с обеих сторон: 130 в С1, 100 в С2
// и С3. Люки микрофона (mic-hatch.js, ±34,8° на R900) стоят посередине между
// кронштейнами ±26,7° и ±43° (27.09.2026: кронштейн ±37° попадал болтом в
// отверстие люка). Лишних нет: между ±26,7° пролёт 53° — это три кронштейна,
// от стыка A до входа — пять на сторону. Всё сверяет tools/check-math.mjs.
// Ребро кольца под кронштейном — от обода до стенки ниши R1066: над корпусом
// кольцо лежит на нём и ребро не нужно, там идут трубы кабеля микрофона.
//
// Геометрия двух уровней: detail = true — для Blender (чешуя шва, накатка
// головок, пазы и фаски в полную силу), по умолчанию — лёгкая для сайта.

import { CENTER, R_BELT_LOW, UNDER_1 } from './params.js';
import { addPolygon, addLathe } from './mesh.js';
import { PALETTE } from './palette.js';

export const RING_BRACKETS = Object.freeze({
  angles: [0, ...[13.35, 26.7, 43, 55.5, 70, 86, 102, 118, 134.3, 150].flatMap((t) => [t, -t])],
  reach: 170,        // вылет полки от стенки
  drop: 170,         // высота полки на стенке
  width: 40,         // ширина обеих полок
  t: 6,              // сталь
  wallBolts: [20, 150],   // оси М8 × 40 от низа кольца вниз
  ringBolts: [40, 135],   // оси М8 × 30 от стенки: пазы в 35 и 130 от конца полки
  kneeGuardR: 14,         // радиус мягкого кожуха на диагональном ребре (28.09.2026)
});

const D = Math.PI / 180;
const { reach: REACH, drop: DROP, t: T } = RING_BRACKETS;
const W = RING_BRACKETS.width / 2;
const TOP = UNDER_1, SH = TOP - T, LOW = TOP - DROP;   // 760, 754 — низ полки, 590
const WEB = [W - T, W];                                  // ребро по краю полок

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const mul = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = (v) => { const l = Math.hypot(v[0], v[1], v[2]) || 1; return mul(v, 1 / l); };
const avg = (pts) => mul(pts.reduce(add, [0, 0, 0]), 1 / pts.length);

// Выпуклая грань, обход — так, чтобы нормаль смотрела по want.
function facet(mesh, pts, want, color) {
  let n = [0, 0, 0];
  for (let i = 1; i < pts.length - 1; i++) n = add(n, cross(sub(pts[i], pts[0]), sub(pts[i + 1], pts[0])));
  if (Math.hypot(n[0], n[1], n[2]) < 1e-9) return;
  addPolygon(mesh, dot(n, want) < 0 ? pts.slice().reverse() : pts, color);
}

// ── плоские детали: контур в 2D ────────────────────────────────────────────
const area2 = (poly) => poly.reduce((s, p, i) => { const q = poly[(i + 1) % poly.length]; return s + p[0] * q[1] - q[0] * p[1]; }, 0);
const ccw = (poly) => (area2(poly) < 0 ? poly.slice().reverse() : poly);
// Выпуклый контур внутрь, у каждого ребра свой отступ.
function inset(poly, offs) {
  const n = poly.length;
  const lines = poly.map((a, i) => {
    const b = poly[(i + 1) % n], len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const nx = -(b[1] - a[1]) / len, ny = (b[0] - a[0]) / len;
    return { p: [a[0] + nx * offs[i], a[1] + ny * offs[i]], d: [(b[0] - a[0]) / len, (b[1] - a[1]) / len] };
  });
  return lines.map((L, i) => {
    const P = lines[(i - 1 + n) % n];
    const den = P.d[0] * L.d[1] - P.d[1] * L.d[0];
    if (Math.abs(den) < 1e-9) return L.p;
    const t = ((L.p[0] - P.p[0]) * L.d[1] - (L.p[1] - P.p[1]) * L.d[0]) / den;
    return [P.p[0] + P.d[0] * t, P.p[1] + P.d[1] * t];
  });
}
// Прямоугольник со скруглениями [r00, r10, r11, r01], против часовой.
function rrect(u0, u1, v0, v1, radii, k) {
  const pts = [];
  const corners = [[u0, v0, 180, 1, 1], [u1, v0, 270, -1, 1], [u1, v1, 0, -1, -1], [u0, v1, 90, 1, -1]];
  corners.forEach(([cx, cy, a0, sx, sy], i) => {
    const r = radii[i];
    if (r <= 0) { pts.push([cx, cy]); return; }
    for (let j = 0; j <= k; j++) {
      const a = (a0 + (90 * j) / k) * D;
      pts.push([cx + sx * r + r * Math.cos(a), cy + sy * r + r * Math.sin(a)]);
    }
  });
  return pts;
}
function ray(poly, c, a) {
  const dx = Math.cos(a), dy = Math.sin(a);
  let best = Infinity;
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i], q = poly[(i + 1) % poly.length];
    const ex = q[0] - p[0], ey = q[1] - p[1], den = dx * ey - dy * ex;
    if (Math.abs(den) < 1e-12) continue;
    const t = ((p[0] - c[0]) * ey - (p[1] - c[1]) * ex) / den;
    const u = ((p[0] - c[0]) * dy - (p[1] - c[1]) * dx) / den;
    if (t > 1e-9 && u >= -1e-9 && u <= 1 + 1e-9) best = Math.min(best, t);
  }
  return [c[0] + dx * best, c[1] + dy * best];
}
const circle = (c, r, n) => Array.from({ length: n }, (_, i) => [c[0] + r * Math.cos((i * 2 * Math.PI) / n), c[1] + r * Math.sin((i * 2 * Math.PI) / n)]);
// Паз вдоль u — по радиусу кольца: допуск ±2,5.
function slot(c, r, half, n) {
  const pts = [];
  for (let i = 0; i <= n; i++) { const a = (-90 + (180 * i) / n) * D; pts.push([c[0] + half + r * Math.cos(a), c[1] + r * Math.sin(a)]); }
  for (let i = 0; i <= n; i++) { const a = (90 + (180 * i) / n) * D; pts.push([c[0] - half + r * Math.cos(a), c[1] + r * Math.sin(a)]); }
  return pts;
}

// Кромка стали под порошком — валик r 1,2 (для сайта — фаска), кромки отверстий — фаска 0,5.
const B = 1.2, HB = 0.5, K = 1 - Math.SQRT1_2;
const EDGE_FULL = [[B, 1], [B * K, 1 - (B * K) / T], [0, 1 - B / T], [0, B / T], [B * K, (B * K) / T], [B, 0]];
const EDGE_LIGHT = [[B, 1], [0, 1 - B / T], [0, B / T], [B, 0]];
const HOLE = [[HB, 1], [0, 1 - HB / T], [0, HB / T], [HB, 0]];

// Пластина из выпуклых ячеек: у каждой контур, признак наружной кромки у рёбер
// (по общим сторонам ячеек кромки нет) и, может быть, отверстие. Отверстие
// сшивается с контуром лучами из его центра. map([u, v, w]) → мир, w — доля толщины.
function plate(mesh, map, cells, q, color) {
  const up = sub(map([0, 0, 1]), map([0, 0, 0]));
  const upN = norm(up);
  const P3 = (p, w) => map([p[0], p[1], w]);
  for (const { poly, outer, hole } of cells) {
    const layers = q.edge.map(([k]) => inset(poly, outer.map((o) => (o ? k : 0))));
    const cen = hole ? hole.c : poly.reduce((s, p) => [s[0] + p[0] / poly.length, s[1] + p[1] / poly.length], [0, 0]);
    let rings = layers, holes = null;
    if (hole) {
      const hp = HOLE.map(([k]) => ccw(hole.shape(k)));
      const set = new Set();
      for (const p of [...layers.flat(), ...hp.flat()]) set.add(Math.round(Math.atan2(p[1] - cen[1], p[0] - cen[0]) * 1e6) / 1e6);
      for (let i = 0; i < q.rays; i++) set.add(Math.round((-Math.PI + (i * 2 * Math.PI) / q.rays) * 1e6) / 1e6);
      const A = [...set].sort((a, b) => a - b);
      rings = layers.map((l) => A.map((a) => ray(l, cen, a)));
      holes = hp.map((h) => A.map((a) => ray(h, cen, a)));
    }
    // Отрезок на общей стороне ячеек — стенки там нет.
    const onInner = (a, b) => {
      const m = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
      return poly.some((p, i) => {
        if (outer[i]) return false;
        const r = poly[(i + 1) % poly.length], ex = r[0] - p[0], ey = r[1] - p[1], L2 = ex * ex + ey * ey;
        const t = ((m[0] - p[0]) * ex + (m[1] - p[1]) * ey) / L2;
        return t > -1e-6 && t < 1 + 1e-6 && Math.abs((m[0] - p[0]) * ey - (m[1] - p[1]) * ex) / Math.sqrt(L2) < 1e-4;
      });
    };
    const top = rings[0], bot = rings[rings.length - 1];
    if (!holes) {
      facet(mesh, top.map((p) => P3(p, 1)), up, color);
      facet(mesh, bot.map((p) => P3(p, 0)), mul(up, -1), color);
    } else {
      const ht = holes[0], hb = holes[holes.length - 1], axis = P3(cen, 0.5);
      for (let i = 0; i < top.length; i++) {
        const j = (i + 1) % top.length;
        facet(mesh, [P3(top[i], 1), P3(top[j], 1), P3(ht[j], 1), P3(ht[i], 1)], up, color);
        facet(mesh, [P3(bot[i], 0), P3(bot[j], 0), P3(hb[j], 0), P3(hb[i], 0)], mul(up, -1), color);
      }
      for (let k = 0; k < holes.length - 1; k++) {
        const a = holes[k], b = holes[k + 1];
        for (let i = 0; i < a.length; i++) {
          const j = (i + 1) % a.length;
          const f = [P3(a[i], HOLE[k][1]), P3(a[j], HOLE[k][1]), P3(b[j], HOLE[k + 1][1]), P3(b[i], HOLE[k + 1][1])];
          const inward = sub(axis, avg(f));
          facet(mesh, f, sub(inward, mul(upN, dot(inward, upN))), color);
        }
      }
    }
    for (let k = 0; k < rings.length - 1; k++) {
      const a = rings[k], b = rings[k + 1];
      const lift = q.edge[k][1] + q.edge[k + 1][1] - 1;      // > 0 — верхний валик, < 0 — нижний
      for (let i = 0; i < a.length; i++) {
        const j = (i + 1) % a.length;
        if (onInner(a[i], a[j]) && onInner(b[i], b[j])) continue;
        const f = [P3(a[i], q.edge[k][1]), P3(a[j], q.edge[k][1]), P3(b[j], q.edge[k + 1][1]), P3(b[i], q.edge[k + 1][1])];
        const outw = sub(avg(f), P3(cen, 0.5));
        facet(mesh, f, add(sub(outw, mul(upN, dot(outw, upN))), mul(upN, lift * 40)), color);
      }
    }
  }
}
const cells = (list, internal) => list.map(({ poly, hole }) => {
  const p = ccw(poly);
  return { poly: p, hole, outer: p.map((a, i) => { const b = p[(i + 1) % p.length]; return !(Math.abs(a[0] - internal) < 1e-6 && Math.abs(b[0] - internal) < 1e-6); }) };
});

// ── сварной угловой шов ────────────────────────────────────────────────────
// Полуавтомат, катет leg, сверху порошок. Грань почти плоская, выпуклость ~0,4,
// к металлу подходит полого; чешуя — дуги серединой вперёд по ходу горелки,
// шаг 1,5, пологий подъём и крутой спад; граница сплавления гуляет ±0,25; на
// старте наплыв, в конце кратер. У лёгкой версии остаются катет и выпуклость.
const hash = (n) => { const x = Math.sin(n * 127.1) * 43758.5453; return x - Math.floor(x); };
const noise = (x) => { const i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f); return hash(i) * (1 - u) + hash(i + 1) * u; };
function weld(mesh, along, [x0, x1], [e1, e2], leg, q, color) {
  const len = x1 - x0, seed = x0 * 13.7 + leg;
  const n = Math.max(2, Math.ceil(len / q.weldStep)), m = q.weldCross;
  const rough = q.detail ? 1 : 0;
  const sec = [];
  for (let i = 0; i <= n; i++) {
    const x = x0 + (len * i) / n, xs = x - x0;
    const taper = Math.sqrt(Math.max(0, Math.min(1, xs / 2.2, (x1 - x) / 2.2)));
    const start = rough * 0.18 * Math.exp(-(((xs - 2.5) / 1.8) ** 2));
    const crater = rough * -0.3 * Math.exp(-(((x1 - x - 2.4) / 1.3) ** 2));
    const legAt = (k) => leg * (0.3 + 0.7 * taper) * (1 + rough * 0.05 * (noise(xs / 9 + seed + k) - 0.5)) + rough * 0.25 * (noise(xs / 1.7 + seed + 3 + k) - 0.5);
    const L1 = legAt(0), L2 = legAt(7);
    const o = along(x), pts = [o];
    for (let k = 0; k <= m; k++) {
      const t = k / m, across = 2 * t - 1;
      const phase = (xs - 1.1 * (1 - across * across)) / 1.5, f = phase - Math.floor(phase);
      const ripple = 0.5 - 0.5 * Math.cos(Math.PI * (f < 0.78 ? f / 0.78 : (1 - f) / 0.22));
      const bulge = ((0.38 + rough * 0.06 * (noise(xs / 6 + seed + 5) - 0.5)) * taper + start + crater * taper
        + rough * 0.075 * (ripple - 0.5) * taper) * Math.pow(Math.sin(Math.PI * t), 1.6);
      const off = bulge * Math.SQRT1_2;
      pts.push(add(o, add(mul(e1, L1 * (1 - t) + off), mul(e2, L2 * t + off))));
    }
    sec.push(pts);
  }
  for (let i = 0; i < n; i++) {
    const a = sec[i], b = sec[i + 1], root = avg([a[0], b[0]]);
    for (let k = 1; k < a.length - 1; k++) {
      const f = [a[k], a[k + 1], b[k + 1], b[k]];
      facet(mesh, f, sub(avg(f), root), color);
    }
  }
  const axis = sub(along(x1), along(x0));
  facet(mesh, sec[0], mul(axis, -1), color);
  facet(mesh, sec[n], axis, color);
}

// ── крепёж ────────────────────────────────────────────────────────────────
// DIN 125 М8: Ø8,4 / Ø16 × 1,6, кромки обкатаны.
const WASHER_T = 1.6;
const WASHER = [[0, 4.2], [0, 7.7], [0.12, 7.93], [0.35, 8], [1.25, 8], [1.48, 7.93], [WASHER_T, 7.7], [WASHER_T, 4.6], [1.25, 4.2], [0, 4.2]];
// DIN 912 М8, класс 8.8, чёрное оксидирование. Головка Ø13 × 8: прямая накатка
// 36 зубцов, фаска 0,6 сверху, опорный торец; шестигранник 6 на глубину 4,5 с
// зенковкой и конусом 118° от сверла на дне.
function din912(mesh, base, dir, q, color) {
  const ax = norm(dir), g = Math.abs(ax[2]) < 0.9 ? [0, 0, 1] : [1, 0, 0];
  const u = norm(cross(ax, g)), v = cross(ax, u);
  const at = (t, r, a) => add(base, add(mul(ax, t), add(mul(u, r * Math.cos(a)), mul(v, r * Math.sin(a)))));
  const RIBS = 36, steps = q.knurl ? RIBS * q.knurl : 18;   // на сайте накатки не видно — головка гладкая
  const set = new Set();
  for (let i = 0; i < steps; i++) set.add(+((i * 2 * Math.PI) / steps).toFixed(7));
  for (let k = 0; k < 6; k++) set.add(+((k * Math.PI) / 3).toFixed(7));
  const ang = [...set].sort((a, b) => a - b);
  const knurl = (a) => { if (!q.knurl) return 6.4; const f = ((a * RIBS) / (2 * Math.PI)) % 1; return 6.5 - 0.22 * Math.abs(2 * f - 1); };
  const hex = (a) => { const m = ((a % (Math.PI / 3)) + Math.PI / 3) % (Math.PI / 3); return 3 / Math.cos(m - Math.PI / 6); };
  const prof = [
    [0, () => 4.6], [0, () => 6.1], [0.15, (a) => knurl(a) - 0.25], [0.45, knurl], [7.2, knurl],
    [7.55, (a) => knurl(a) - 0.3], [8, () => 5.8], [8, () => 3.85], [7.7, hex], [3.5, hex], [2.4, () => 0.001],
  ];
  const SOCKET = 7;                                      // с этого участка профиль уходит в гнездо
  for (let k = 0; k < prof.length - 1; k++) {
    const [t0, r0] = prof[k], [t1, r1] = prof[k + 1];
    for (let i = 0; i < ang.length; i++) {
      const a0 = ang[i], a1 = ang[(i + 1) % ang.length];
      const f = [at(t0, r0(a0), a0), at(t0, r0(a1), a1), at(t1, r1(a1), a1), at(t1, r1(a0), a0)];
      const c = avg(f), radial = sub(c, add(base, mul(ax, dot(sub(c, base), ax))));
      const dr = (r1(a0) + r1(a1) - r0(a0) - r0(a1)) / 2;
      const want = k >= SOCKET ? add(mul(radial, -1), ax) : add(mul(norm(radial), t1 - t0), mul(ax, -dr || 1));
      facet(mesh, f, want, color);
    }
  }
}

// Узел в своих координатах: d — от стенки ниши к отверстию, s — по касательной,
// z — отметка. Стенка ниши в модели — хорды R1050, отклонение от дуги < 0,4 мм.
function frame(theta) {
  const a = (theta - 90) * D;
  const out = [Math.cos(a), Math.sin(a)], tan = [-out[1], out[0]];
  return ([d, s, z]) => [CENTER + (R_BELT_LOW - d) * out[0] + s * tan[0], CENTER + (R_BELT_LOW - d) * out[1] + s * tan[1], z];
}

const QUALITY = {
  light: { detail: false, edge: EDGE_LIGHT, rays: 24, hole: 12, slot: 5, corner: 3, weldStep: 2, weldCross: 4, knurl: 0, lathe: 12 },
  full: { detail: true, edge: EDGE_FULL, rays: 96, hole: 28, slot: 12, corner: 6, weldStep: 0.3, weldCross: 14, knurl: 6, lathe: 32 },
};

// Мягкий кожух на диагональном ребре — капсула (латха профиля R по прямой
// между концами ребра): два четвертных купола по краям, цилиндр между ними.
// a, b — концы ребра в мировых координатах, R — радиус кожуха.
function kneeGuard(mesh, a, b, R, sides, color) {
  const len = Math.hypot(...sub(b, a));
  const n = 6;
  const profile = [];
  for (let i = 0; i <= n; i++) { const ang = (Math.PI / 2) * (i / n); profile.push([R - R * Math.cos(ang), R * Math.sin(ang)]); }
  for (let i = 0; i <= n; i++) { const ang = (Math.PI / 2) * (i / n); profile.push([len - R + R * Math.sin(ang), R * Math.cos(ang)]); }
  addLathe(mesh, a, b, profile, color, { sides });
}

export function buildRingBrackets(mesh, { detail = false } = {}) {
  const q = QUALITY[detail ? 'full' : 'light'];
  const steel = PALETTE.powder, fastener = PALETTE.bolt;
  const [b1, b2] = RING_BRACKETS.ringBolts;
  const [z1, z2] = RING_BRACKETS.wallBolts.map((k) => TOP - k);
  const bm = (b1 + b2) / 2, zm = (z1 + z2) / 2;
  // Ребро: угол у полок срезан 12 × 12 под швы, вершина скруглена, низ — на 6
  // выше скругления полки на стене.
  const webPoly = ccw([[18, SH], [REACH - 6, SH], [REACH - 1, SH - 1.5], [REACH, SH - 5], [16.5, LOW + 7], [12, LOW + 6], [T, LOW + 6], [T, SH - 12]]);
  for (const theta of RING_BRACKETS.angles) {
    const at = frame(theta);
    const dir = (v) => sub(at(v), at([0, 0, 0]));
    // Полка под кольцом: u = d, v = s, w — от низа полки к кольцу. Пазы 9 × 14.
    plate(mesh, ([u, v, w]) => at([u, v, SH + w * T]), cells([
      { poly: rrect(0, bm, -W, W, [0, 0, 0, 0], q.corner), hole: { c: [b1, 0], shape: (k) => slot([b1, 0], 4.5 + k, 2.5, q.slot) } },
      { poly: rrect(bm, REACH, -W, W, [0, 6, 6, 0], q.corner), hole: { c: [b2, 0], shape: (k) => slot([b2, 0], 4.5 + k, 2.5, q.slot) } },
    ], bm), q, steel);
    // Полка на стене: u = z, v = s, w — от стены. Отверстия Ø9, нижние углы R6.
    plate(mesh, ([u, v, w]) => at([w * T, v, u]), cells([
      { poly: rrect(zm, SH, -W, W, [0, 0, 0, 0], q.corner), hole: { c: [z1, 0], shape: (k) => circle([z1, 0], 4.5 + k, q.hole) } },
      { poly: rrect(LOW, zm, -W, W, [6, 0, 0, 6], q.corner), hole: { c: [z2, 0], shape: (k) => circle([z2, 0], 4.5 + k, q.hole) } },
    ], zm), q, steel);
    plate(mesh, ([u, v, w]) => at([u, WEB[0] + w * T, v]), [{ poly: webPoly, outer: webPoly.map(() => true) }], q, steel);
    // Швы: ребро — полка под кольцом, ребро — полка на стене, полка — полка.
    weld(mesh, (x) => at([x, WEB[0], SH]), [19, REACH - 7], [dir([0, -1, 0]), dir([0, 0, -1])], 4, q, steel);
    weld(mesh, (x) => at([T, WEB[0], x]), [LOW + 8, SH - 13], [dir([1, 0, 0]), dir([0, -1, 0])], 4, q, steel);
    weld(mesh, (x) => at([T, x, SH]), [-W + 1, WEB[0] - 0.2], [dir([1, 0, 0]), dir([0, 0, -1])], 3.5, q, steel);
    // Крепёж: шайба и винт на каждом отверстии.
    for (const z of [z1, z2]) {
      addLathe(mesh, at([T, 0, z]), at([T + 1, 0, z]), WASHER, fastener, { sides: q.lathe });
      din912(mesh, at([T + WASHER_T, 0, z]), dir([1, 0, 0]), q, fastener);
    }
    for (const d of [b1, b2]) {
      addLathe(mesh, at([d, 0, SH]), at([d, 0, SH - 1]), WASHER, fastener, { sides: q.lathe });
      din912(mesh, at([d, 0, SH - WASHER_T]), [0, 0, -1], q, fastener);
    }
    // Мягкий кожух на ребре — от полки под кольцом до полки на стене.
    kneeGuard(mesh, at([REACH, WEB[0] + T, SH - 5]), at([16.5, WEB[0] + T, LOW + 7]),
      RING_BRACKETS.kneeGuardR, q.lathe, PALETTE.buffer);
  }
}
