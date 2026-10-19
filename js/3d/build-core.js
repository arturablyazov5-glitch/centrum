// Core и Sector: несущий корпус с центральным отверстием Ø1000, пояс хранения,
// рабочая поверхность 820, переход на второй уровень 1270 и вырез прохода 800.

import {
  SIZE, CENTER, CORNER_R, R_HOLE, R_BELT_LOW, R_BELT_HIGH, R_LIP,
  LEVEL_1, UNDER_1, TOP_THICK, EDGE_R, EDGE_SEG, ENTRY_X0, ENTRY_X1, SEGMENTS,
  PLINTH, PLINTH_RECESS, ENTRY_Y,
  topAt, underAt, ringPoint, lipPoint, lipOverhang, boundaryPoint, boundaryInsetPoint, arcY,
} from './params.js';
import { addPolygon, addQuad, polygonNormal } from './mesh.js';
import { outsideEntry } from './entry-cut.js';
import { addWallWithOpenings, addSeamedWall } from './openings.js';
import { SEAM_ANGLES, MODULE_SEAMS, SEAM_Z, inwardAt } from './seams.js';
import { buildReceiverJambs } from './receiver-door.js';
import { LEDGE_BOTTOM, LEDGE_Y1 } from './bridge-fittings.js';
import { PALETTE } from './palette.js';
import { SOCKET_ANGLES, SOCKET_HOLE, SOCKET_Z } from './sockets.js';
import { AUDIO_PANELS, R_BACK, Z_CUT, pocketHalf } from './audio-panels.js';
import { buildAudioPocketCut } from './build-audio-panels.js';
import { MIC_HATCH, hatchCenter } from './mic-hatch.js';

// Карманы под панели для наушников (audio-panels.js): вырез в кромке отверстия с
// прямыми стенками (buildAudioPocketCut), закрытыми чёрной вставкой с кантом.
// Карманы есть в каждом столе: в центре панель базы, по бокам — опция или глухая панель.
const POCKETS = AUDIO_PANELS.map(({ theta }) => {
  const mid = ((270 + theta) * Math.PI / 180 + Math.PI * 2) % (Math.PI * 2);
  const half = pocketHalf() * Math.PI / 180;
  return [mid - half, mid + half];
});
const inPocket = (a) => POCKETS.some(([a0, a1]) => a > a0 && a < a1);

// Грань корпуса с учётом выреза прохода. trim дополнительно отводит грань
// от торца прохода, где кромку берёт на себя скругление торца (buildEntryEnd).
function addCut(mesh, poly, color, mergeEps = 0.001, trim = null) {
  for (const piece of trim ? trim(poly) : [poly])
    for (const part of outsideEntry(piece, mergeEps)) addPolygon(mesh, part, color);
}

// Отсечение выпуклого многоугольника полуплоскостью f(p) ≥ 0, f линейна.
function clipHalf(poly, f) {
  const out = [];
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length];
    const fa = f(a), fb = f(b);
    if (fa >= 0) out.push(a);
    if ((fa >= 0) !== (fb >= 0)) {
      const t = fa / (fa - fb);
      out.push(a.map((v, k) => v + t * (b[k] - v)));
    }
  }
  return out.length >= 3 ? [out] : [];
}

// Торцы столешницы у прохода, лист 20: у петли материал слева (s = −1),
// у опорного выступа — справа (s = +1). Торец скруглён R8 сверху, снизу
// над нишей для ног и по вертикальному углу у отверстия — как сам Bridge.
const ENDS = [{ x: ENTRY_X0, s: -1 }, { x: ENTRY_X1, s: 1 }];
const endFillet = ({ x, s }) => [x + s * EDGE_R, arcY(x + s * EDGE_R, R_HOLE + EDGE_R)];
const nearEnd = ({ x, s }, p) => p[1] > ENTRY_Y && s * (p[0] - CENTER) > 0 && s * (p[0] - x) < EDGE_R;
const trimWith = (clip) => (poly) => {
  let parts = [poly];
  for (const end of ENDS)
    if (poly.some((p) => nearEnd(end, p))) parts = parts.flatMap((part) => clip(end, part));
  return parts;
};
// Плоскости верха и низа кончаются там, где начинается вал торца.
const TRIM_FLAT = trimWith(({ x, s }, poly) => clipHalf(poly, (p) => s * (p[0] - x) - EDGE_R));
// Кромка отверстия кончается на радиусе, где начинается скругление угла в плане.
const TRIM_HOLE = trimWith((end, poly) => {
  const c = endFillet(end);
  const len = Math.hypot(c[0] - CENTER, c[1] - CENTER);
  const u = [(c[0] - CENTER) / len, (c[1] - CENTER) / len];
  return clipHalf(poly, (p) => -end.s * (u[0] * (p[1] - CENTER) - u[1] * (p[0] - CENTER)));
});
// Вал наружного контура сходится с валом торца на ус под 45°.
const TRIM_OUTER = trimWith(({ x, s }, poly) => clipHalf(poly, (p) => s * (p[0] - x) - (SIZE - p[1])));

// Полоса вала на кромке — около 3 мм, то есть мельче штатного порога слияния 5 мм.
// Для неё порог снижен: слипание вершин здесь стирало бы саму скруглённую кромку.
const EDGE_MERGE_EPS = 0.001;

// Uniform rays from the table centre left only a few facets on each R200
// corner. Sample the actual corner arc, including both tangent endpoints.
const CORE_ANGLES = (() => {
  const tau = Math.PI * 2;
  const angles = Array.from({ length: SEGMENTS }, (_, i) => i * tau / SEGMENTS);
  for (let corner = 0; corner < 4; corner++) {
    const middle = (corner + 0.5) * Math.PI / 2;
    const cx = Math.sign(Math.cos(middle)) * (CENTER - CORNER_R);
    const cy = Math.sign(Math.sin(middle)) * (CENTER - CORNER_R);
    for (let i = 0; i <= 48; i++) {
      const a = (corner + i / 48) * Math.PI / 2;
      angles.push((Math.atan2(cy + CORNER_R * Math.sin(a), cx + CORNER_R * Math.cos(a)) + tau) % tau);
    }
  }
  // Швы модулей корпуса (seams.js): кромки фасок и дно канавки — общие вершины всех слоёв.
  angles.push(...SEAM_ANGLES);
  // Границы карманов и мелкий шаг внутри них: дуга кармана — по граду.
  for (const [a0, a1] of POCKETS) {
    const n = Math.ceil((a1 - a0) / (Math.PI / 180));
    for (let k = 0; k <= n; k++) angles.push(a0 + ((a1 - a0) * k) / n);
  }
  angles.sort((a, b) => a - b);
  const unique = angles.filter((a, i) => i === 0 || a - angles[i - 1] > 1e-7);
  return [...unique, tau];
})();

// Отверстия под гнёзда розеток в стенке между уровнями (sockets.js). Корпус
// строится до отражения (mirror.js: x → 2700 − x), поэтому мировой угол a
// здесь становится π − a. Квадрат 64 × 64 закрыт рамкой 84 мм со всех сторон.
const TAU = Math.PI * 2;
const SOCKET_CUTS = SOCKET_ANGLES.map((a) => {
  const middle = ((Math.PI - a) % TAU + TAU) % TAU;
  const half = Math.atan(SOCKET_HOLE / 2 / R_BELT_HIGH);
  return [middle - half, middle + half];
});
const SOCKET_HOLE_Z = [SOCKET_Z - SOCKET_HOLE / 2, SOCKET_Z + SOCKET_HOLE / 2];

// Облицовка стенки между уровнями на одном участке кольца. Где участок заходит
// в отверстие розетки, он делится по углу, и в полосе отверстия остаются только
// куски ниже и выше него. Точки деления лежат на хорде участка, а не на дуге:
// так новые вершины не отходят от плоскости грани и не дают щелей со столешницей.
function addBeltWall(mesh, angles, beltHigh, under, color) {
  const [a0, a1] = angles;
  const breaks = [a0, a1];
  for (const [h0, h1] of SOCKET_CUTS) for (const h of [h0, h1]) if (h > a0 && h < a1) breaks.push(h);
  breaks.sort((x, y) => x - y);
  const at = (a, z) => {
    const t = (a - a0) / (a1 - a0);
    return [beltHigh[0][0] + (beltHigh[1][0] - beltHigh[0][0]) * t, beltHigh[0][1] + (beltHigh[1][1] - beltHigh[0][1]) * t, z];
  };
  const top = (a) => under[0] + (under[1] - under[0]) * (a - a0) / (a1 - a0);
  const band = (s, e, z0, z1) => addCut(mesh, [at(s, z0), at(e, z0), at(e, z1(e)), at(s, z1(s))], color);
  for (let i = 0; i < breaks.length - 1; i++) {
    const [s, e] = [breaks[i], breaks[i + 1]];
    const mid = (s + e) / 2;
    if (!SOCKET_CUTS.some(([h0, h1]) => mid > h0 && mid < h1)) { band(s, e, LEVEL_1, top); continue; }
    band(s, e, LEVEL_1, () => SOCKET_HOLE_Z[0]);
    band(s, e, SOCKET_HOLE_Z[1], top);
  }
}

// То же для наружной стенки, где дополнительно вырезаны проёмы фасадных модулей.
function addWall(mesh, poly, color) {
  for (const part of outsideEntry(poly)) addWallWithOpenings(mesh, part, color);
}

// Графитовая стенка корпуса: проёмы и швы модулей — фаски 1,5 × 45° (seams.js).
function addSideWall(mesh, poly, color) {
  for (const part of outsideEntry(poly)) addSeamedWall(mesh, part, color);
}

// Торец столешницы у прохода: профиль кромки, протянутый по контуру торца —
// от скругления угла у отверстия вдоль прохода до уса с наружным валом.
// Нижний вал есть только над нишей для ног; дальше под торцом стоит стенка
// корпуса заподлицо, и нижней кромки там нет.
function buildEntryEnd(mesh, end) {
  const { x: xe, s } = end;
  const R = EDGE_R;
  const quarter = (k) => (Math.PI / 2) * (k / EDGE_SEG);
  const top = Array.from({ length: EDGE_SEG + 1 }, (_, k) => [R - R * Math.cos(quarter(k)), LEVEL_1 - R + R * Math.sin(quarter(k))]);
  const low = Array.from({ length: EDGE_SEG + 1 }, (_, k) => [R - R * Math.sin(quarter(k)), UNDER_1 + R - R * Math.cos(quarter(k))]);
  const c = endFillet(end);
  const yBody = arcY(xe, R_BELT_LOW);

  const withLow = [];
  const a0 = Math.atan2(CENTER - c[1], CENTER - c[0]);
  const a1 = s < 0 ? 0 : -Math.PI;
  for (let k = 0; k <= 6; k++) {
    const a = a0 + ((a1 - a0) * k) / 6;
    const v = [Math.cos(a), Math.sin(a)];
    withLow.push({ p: [c[0] + R * v[0], c[1] + R * v[1]], n: [-v[0], -v[1]] });
  }
  for (let j = 1; j <= 8; j++) withLow.push({ p: [xe, c[1] + ((yBody - c[1]) * j) / 8], n: [s, 0] });
  const flush = [];
  for (let j = 0; j <= 4; j++) flush.push({ p: [xe, yBody + ((SIZE - yBody) * j) / 4], n: [s, 0] });
  flush.push({ p: [xe, SIZE], n: [s, -1] }); // ус с валом наружного контура

  const sweep = (path, profile) => {
    const at = ({ p, n }, [d, z]) => [p[0] + d * n[0], p[1] + d * n[1], z];
    for (let i = 0; i < path.length - 1; i++)
      for (let k = 0; k < profile.length - 1; k++) {
        const quad = [at(path[i], profile[k]), at(path[i + 1], profile[k]), at(path[i + 1], profile[k + 1]), at(path[i], profile[k + 1])];
        // Нормаль в корпусе принята внутрь материала.
        addPolygon(mesh, s < 0 ? quad.reverse() : quad, PALETTE.worktop);
      }
  };
  sweep(withLow, [...low, ...top]);
  sweep(flush, [[0, UNDER_1], ...top]);

  // Нижний вал обрывается у стенки ниши: торец вала закрыт плоской заглушкой.
  const cap = [[xe, yBody, UNDER_1], ...low.map(([d, z]) => [xe + s * d, yBody, z])];
  const n = polygonNormal(cap);
  if (n) addPolygon(mesh, n[1] >= 0 ? cap : cap.reverse(), PALETTE.worktop);
}

// Низ плиты на одном участке: четырёхугольник от внутренней грани до стенки ниши.
// Где участок задевает выборку под люком микрофона (mic-hatch.js), он режется на
// полосы по хорде участка, и в каждой полосе круг Ø200 вынимается: остаются куски
// до выборки и после неё. Точки лежат на прямых участка — щелей со стенкой нет.
const HATCH_POCKETS = MIC_HATCH.angles.map((t) => [...hatchCenter(t), MIC_HATCH.pocket / 2]);
function addUnder(mesh, [from, to], put) {
  const z = UNDER_1, N = 24;
  const lerp = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
  const P = (v) => [...v, z];
  // На линии от p к q — доли входа в круг и выхода из него; null — мимо круга.
  const cut = ([cx, cy, r], p, q) => {
    const d = [q[0] - p[0], q[1] - p[1]], f = [p[0] - cx, p[1] - cy];
    const A = d[0] ** 2 + d[1] ** 2, B = 2 * (f[0] * d[0] + f[1] * d[1]), C = f[0] ** 2 + f[1] ** 2 - r * r;
    const disc = B * B - 4 * A * C;
    if (disc <= 0) return null;
    const s0 = (-B - Math.sqrt(disc)) / (2 * A), s1 = (-B + Math.sqrt(disc)) / (2 * A);
    return s1 <= 0 || s0 >= 1 ? null : [Math.max(0, s0), Math.min(1, s1)];
  };
  const lines = Array.from({ length: N + 1 }, (_, i) => [lerp(from[0], from[1], i / N), lerp(to[0], to[1], i / N)]);
  const circle = HATCH_POCKETS.find((c) => lines.some(([p, q]) => cut(c, p, q)));
  if (!circle) {
    put([P(from[0]), P(to[0]), P(to[1]), P(from[1])]);
    return;
  }
  // Полоса без выреза — точка «входа» и «выхода» совпадает с ближайшей к центру
  // точкой линии: у края круга куски сходятся клином, без щели.
  const rows = lines.map(([p, q]) => {
    let s = cut(circle, p, q);
    if (!s) {
      const d = [q[0] - p[0], q[1] - p[1]];
      const m = Math.min(1, Math.max(0, ((circle[0] - p[0]) * d[0] + (circle[1] - p[1]) * d[1]) / (d[0] ** 2 + d[1] ** 2)));
      s = [m, m];
    }
    return { p, q, a: lerp(p, q, s[0]), b: lerp(p, q, s[1]) };
  });
  const clean = (poly) => poly.filter((w, k) => Math.hypot(w[0] - poly[(k + poly.length - 1) % poly.length][0], w[1] - poly[(k + poly.length - 1) % poly.length][1]) > 1e-6);
  for (let i = 0; i < N; i++) {
    const u = rows[i], v = rows[i + 1];
    for (const poly of [[P(u.p), P(u.a), P(v.a), P(v.p)], [P(u.b), P(u.q), P(v.q), P(v.b)]]) {
      const c = clean(poly);
      if (c.length >= 3) put(c);
    }
  }
}

export function buildCore(mesh) {
  // Карманы для наушников: прямой вырез, верх задаётся Z_CUT.
  for (const { theta } of AUDIO_PANELS) buildAudioPocketCut(mesh, theta, PALETTE.worktop);
  for (let i = 0; i < CORE_ANGLES.length - 1; i++) {
    const angles = [CORE_ANGLES[i], CORE_ANGLES[i + 1]];
    const inner = angles.map((a) => ringPoint(a, R_HOLE));
    const beltLow = angles.map((a) => ringPoint(a, R_BELT_LOW));
    const beltHigh = angles.map((a) => ringPoint(a, R_BELT_HIGH));
    const lip = angles.map(lipPoint);
    const outer = angles.map(boundaryPoint);
    const outerFlat = angles.map((a) => boundaryInsetPoint(a, EDGE_R));
    const plinth = angles.map((a) => boundaryInsetPoint(a, PLINTH_RECESS));

    const at = (p, z) => [p[0], p[1], z];
    const topLip = lip.map((p) => topAt(p[1]));
    const raised = Math.max(...angles.map(lipOverhang)) > 0.1;
    const under = beltHigh.map((p) => underAt(p[1]));

    // Плоская часть рабочей поверхности начинается уже за скруглением кромки.
    const innerFlat = angles.map((a) => ringPoint(a, R_HOLE + EDGE_R));

    // Рабочая поверхность Sector: кольцо 508…1150 на отметке 820.
    addCut(mesh, [at(innerFlat[0], LEVEL_1), at(innerFlat[1], LEVEL_1), at(beltHigh[1], LEVEL_1), at(beltHigh[0], LEVEL_1)], PALETTE.worktop, 0.001, TRIM_FLAT);

    // Четверть вала R8 между рабочей плоскостью и гранью отверстия: предплечья
    // лежат именно здесь, и острый угол давал бы точечный пик давления.
    // Профиль идёт от (500+R, 820) к (500, 820−R) по дуге с центром (500+R, 820−R).
    const edgeAt = (t) => {
      const phi = (Math.PI / 2) * t;
      return [R_HOLE + EDGE_R * (1 - Math.sin(phi)), LEVEL_1 - EDGE_R * (1 - Math.cos(phi))];
    };
    for (let j = 0; j < EDGE_SEG; j++) {
      const [rHi, zHi] = edgeAt(j / EDGE_SEG);
      const [rLo, zLo] = edgeAt((j + 1) / EDGE_SEG);
      const hi = angles.map((a) => ringPoint(a, rHi));
      const lo = angles.map((a) => ringPoint(a, rLo));
      // В корпусе принят обход, дающий нормаль внутрь материала: у плоскости 820
      // она смотрит вниз, у грани отверстия — наружу от центра. Вал обходим так же,
      // иначе в OBJ для Blender он окажется вывернут относительно обеих соседних
      // граней. В вебе это незаметно: шейдер разворачивает нормаль к зрителю.
      addCut(mesh, [at(lo[0], zLo), at(lo[1], zLo), at(hi[1], zHi), at(hi[0], zHi)], PALETTE.worktop, EDGE_MERGE_EPS, TRIM_HOLE);
    }

    // Кромка столешницы по отверстию между валами: тот же шпон, огибающий вал (софтформинг).
    // Над карманом для наушников кромка кончается на верху скругления устья.
    const pocket = inPocket((angles[0] + angles[1]) / 2);
    const edgeLow = pocket ? Z_CUT : UNDER_1 + EDGE_R;
    addCut(mesh, [at(inner[0], edgeLow), at(inner[1], edgeLow), at(inner[1], LEVEL_1 - EDGE_R), at(inner[0], LEVEL_1 - EDGE_R)], PALETTE.worktop, 0.001, TRIM_HOLE);

    // Тот же R8 снизу: под кромку тянутся рукой, и острый угол там так же режет.
    // Профиль от (500, 760+R) к (500+R, 760) по дуге с центром (500+R, 760+R).
    const lowAt = (t) => {
      const phi = (Math.PI / 2) * t;
      return [R_HOLE + EDGE_R * (1 - Math.cos(phi)), UNDER_1 + EDGE_R * (1 - Math.sin(phi))];
    };
    for (let j = 0; j < EDGE_SEG && !pocket; j++) {
      const [rHi, zHi] = lowAt(j / EDGE_SEG);
      const [rLo, zLo] = lowAt((j + 1) / EDGE_SEG);
      const hi = angles.map((a) => ringPoint(a, rHi));
      const lo = angles.map((a) => ringPoint(a, rLo));
      addCut(mesh, [at(lo[0], zLo), at(lo[1], zLo), at(hi[1], zHi), at(hi[0], zHi)], PALETTE.worktop, EDGE_MERGE_EPS, TRIM_HOLE);
    }

    // Низ столешницы над нишей для ног: кольцо 508…1050 на отметке 760.
    const underFrom = pocket ? angles.map((a) => ringPoint(a, R_BACK)) : innerFlat;
    addUnder(mesh, [underFrom, beltLow], (poly) => addCut(mesh, poly, PALETTE.worktopBottom, 0.001, TRIM_FLAT));

    // Нижняя внутренняя стенка от пола до первого уровня — та же панель, что снаружи.
    addCut(mesh, [at(beltLow[0], 0), at(beltLow[1], 0), at(beltLow[1], UNDER_1), at(beltLow[0], UNDER_1)], PALETTE.side);

    if (raised) {
      // Стенка между первым и вторым уровнями — та же серая панель корпуса;
      // шпон только на рейках акустической ленты перед ней (build-acoustic.js).
      addBeltWall(mesh, angles, beltHigh, under, PALETTE.side);
      // Нижняя сторона 60-мм выступа вокруг LED-паза облицована тем же шпоном,
      // что и верх; сама лента остаётся отдельной светящейся геометрией.
      const lipRadius = angles.map((a) => Math.min(EDGE_R, lipOverhang(a)));
      const lipFlat = lip.map((p, index) => {
        const dx = p[0] - CENTER, dy = p[1] - CENTER;
        const length = Math.hypot(dx, dy) || 1;
        return [p[0] + (dx / length) * lipRadius[index], p[1] + (dy / length) * lipRadius[index]];
      });
      addCut(mesh, [at(lipFlat[0], underAt(lipFlat[0][1])), at(lipFlat[1], underAt(lipFlat[1][1])), at(beltHigh[1], under[1]), at(beltHigh[0], under[0])], PALETTE.worktopBottom);
      addCut(mesh, [at(lip[0], underAt(lip[0][1]) + lipRadius[0]), at(lip[1], underAt(lip[1][1]) + lipRadius[1]),
        at(lip[1], topLip[1] - lipRadius[1]), at(lip[0], topLip[0] - lipRadius[0])], PALETTE.worktop);
      // Нижняя кромка выступа над лентой — тоже R8: над Sector до неё достаёт рука.
      // Паз LED начинается в 18 мм от кромки, вал его не задевает.
      for (let j = 0; j < EDGE_SEG; j++) {
        const lowPoint = (index, t) => {
          const phi = (Math.PI / 2) * t;
          const r = lipRadius[index];
          const s = 1 - Math.cos(phi);
          const x = lip[index][0] + (lipFlat[index][0] - lip[index][0]) * s;
          const y = lip[index][1] + (lipFlat[index][1] - lip[index][1]) * s;
          return [x, y, underAt(y) + r - r * Math.sin(phi)];
        };
        addCut(mesh, [lowPoint(0, (j + 1) / EDGE_SEG), lowPoint(1, (j + 1) / EDGE_SEG),
          lowPoint(1, j / EDGE_SEG), lowPoint(0, j / EDGE_SEG)], PALETTE.worktop, EDGE_MERGE_EPS);
      }
      for (let j = 0; j < EDGE_SEG; j++) {
        const bevelPoint = (index, t) => {
          const phi = (Math.PI / 2) * t;
          const r = lipRadius[index];
          const s = 1 - Math.cos(phi);
          const x = lip[index][0] + (lipFlat[index][0] - lip[index][0]) * s;
          const y = lip[index][1] + (lipFlat[index][1] - lip[index][1]) * s;
          return [x, y, topAt(y) - r + r * Math.sin(phi)];
        };
        addCut(mesh, [bevelPoint(0, j / EDGE_SEG), bevelPoint(1, j / EDGE_SEG),
          bevelPoint(1, (j + 1) / EDGE_SEG), bevelPoint(0, (j + 1) / EDGE_SEG)], PALETTE.worktop, EDGE_MERGE_EPS);
      }
    }

    // Верхняя поверхность корпуса: в высокой зоне от кромки выступа, в плоской — от пояса.
    const start = raised ? lip.map((p, index) => {
      const dx = p[0] - CENTER, dy = p[1] - CENTER;
      const length = Math.hypot(dx, dy) || 1;
      const r = Math.min(EDGE_R, lipOverhang(angles[index]));
      return [p[0] + (dx / length) * r, p[1] + (dy / length) * r];
    }) : beltHigh;
    // Длинные неплоские четырёхугольники давали видимые треугольные полосы
    // на переходе. Делим поверхность по ширине, сохраняя исходный профиль.
    const point = (edge, t) => {
      const x = start[edge][0] + (outerFlat[edge][0] - start[edge][0]) * t;
      const y = start[edge][1] + (outerFlat[edge][1] - start[edge][1]) * t;
      return [x, y, topAt(y)];
    };
    for (let j = 0; j < 24; j++) {
      const offset = mesh.position.length;
      addCut(mesh, [point(0, j / 24), point(1, j / 24),
        point(1, (j + 1) / 24), point(0, (j + 1) / 24)], PALETTE.upper, 0.001, TRIM_FLAT);
      for (let k = offset; k < mesh.position.length; k += 3) {
        const y = mesh.position[k + 1];
        const slope = (topAt(y + 0.1) - topAt(y - 0.1)) / 0.2;
        const length = Math.hypot(slope, 1);
        mesh.normal[k] = 0;
        mesh.normal[k + 1] = -slope / length;
        mesh.normal[k + 2] = 1 / length;
      }
    }

    // Наружная стенка заканчивается под столешницей; последние 60 мм — отдельная
    // деревянная кромка. Так текстура не растягивается вниз на весь корпус.
    const outerTop = outer.map((p) => topAt(p[1]));
    const outerUnder = outer.map((p) => underAt(p[1]));
    addSideWall(mesh, [at(outer[0], PLINTH), at(outer[1], PLINTH), at(outer[1], outerUnder[1]), at(outer[0], outerUnder[0])], PALETTE.side);
    // Цоколь утоплен на 50 по всему контуру (лист 29): тёмная матовая панель
    // и нижняя кромка корпуса над ней. Фасад от этого «висит» над полом.
    addCut(mesh, [at(plinth[0], 0), at(plinth[1], 0), at(plinth[1], PLINTH), at(plinth[0], PLINTH)], PALETTE.plinth);
    addCut(mesh, [at(plinth[0], PLINTH), at(plinth[1], PLINTH), at(outer[1], PLINTH), at(outer[0], PLINTH)], PALETTE.underside);
    addWall(mesh, [at(outer[0], outerUnder[0]), at(outer[1], outerUnder[1]),
      at(outer[1], outerTop[1] - EDGE_R), at(outer[0], outerTop[0] - EDGE_R)], PALETTE.worktop);
    // Тот же R8, что у отверстия и верхнего пояса, теперь идёт по всему
    // наружному контуру. Это реальная геометрия, а не только сглаженная нормаль.
    for (let j = 0; j < EDGE_SEG; j++) {
      const bevelPoint = (index, t) => {
        const phi = (Math.PI / 2) * t;
        const s = 1 - Math.cos(phi);
        const x = outer[index][0] + (outerFlat[index][0] - outer[index][0]) * s;
        const y = outer[index][1] + (outerFlat[index][1] - outer[index][1]) * s;
        return [x, y, topAt(y) - EDGE_R + EDGE_R * Math.sin(phi)];
      };
      addCut(mesh, [bevelPoint(0, j / EDGE_SEG), bevelPoint(1, j / EDGE_SEG),
        bevelPoint(1, (j + 1) / EDGE_SEG), bevelPoint(0, (j + 1) / EDGE_SEG)], PALETTE.worktop, EDGE_MERGE_EPS, TRIM_OUTER);
    }
    addCut(mesh, [at(beltLow[0], 0), at(plinth[0], 0), at(plinth[1], 0), at(beltLow[1], 0)], PALETTE.underside);
  }

  // Стенка со стороны выступа показана настоящей панелью 18 мм, а не одной гранью:
  // иначе не видно, что её верх выбран и полоса лежит в выборке, а не внутри стенки.
  // Со стороны петли толщина не нужна — там в стенку заходит кронштейн петли.
  const WALL_T = 18;

  // Торец стенки у прохода в плоскости x. Ниже PLINTH он кончается на выемке
  // цоколя: выемка по наружному контуру открыта в проход, а не заглушена.
  const PLINTH_Y = SIZE - PLINTH_RECESS;
  // withOpenings — стенка со стороны петли: в ней окно мусорной ниши К6 (openings.js,
  // PASSAGE_OPENINGS), фасад блока стоит в этом окне заподлицо.
  const endFace = (x, y0, y1, z0, z1, color, withOpenings = false) => {
    if (z0 < PLINTH && Math.min(y1, PLINTH_Y) > y0)
      addQuad(mesh, [x, y0, z0], [x, Math.min(y1, PLINTH_Y), z0], [x, Math.min(y1, PLINTH_Y), Math.min(z1, PLINTH)], [x, y0, Math.min(z1, PLINTH)], color);
    if (z1 > PLINTH) {
      const upper = [[x, y0, Math.max(z0, PLINTH)], [x, y1, Math.max(z0, PLINTH)], [x, y1, z1], [x, y0, z1]];
      if (withOpenings) addWallWithOpenings(mesh, upper, color);
      else addPolygon(mesh, upper, color);
    }
  };

  // Торцы прохода: стенка корпуса ниже столешницы и замкнутый кромочный профиль 100 × 60.
  for (const x of [ENTRY_X0, ENTRY_X1]) {
    const yBody = arcY(x, R_BELT_LOW);
    // Со стороны выступа верх стенки выбран на толщину опорной полосы Bridge:
    // полоса ложится в эту выборку. Последние 30 мм у входа стенка идёт на полную
    // высоту и закрывает торец полосы — с порога его не видно.
    if (x === ENTRY_X1) {
      endFace(x, yBody, LEDGE_Y1, 0, LEDGE_BOTTOM, PALETTE.side);
      endFace(x, LEDGE_Y1, SIZE, 0, UNDER_1, PALETTE.side);
    } else {
      endFace(x, yBody, SIZE, 0, UNDER_1, PALETTE.side, true);
    }
  }

  for (const end of ENDS) buildEntryEnd(mesh, end);

  // Откосы проёма дверцы ресивера на левом боку (receiver-door.js).
  buildReceiverJambs(mesh);

  // Тело и дно выборки той же стенки. Выборка кончается там же, где полоса,
  // а дальше стенка выходит на полную высоту и закрывает её торец.
  const wallY = arcY(ENTRY_X1, R_BELT_LOW);
  const back = ENTRY_X1 + WALL_T;
  endFace(back, wallY, LEDGE_Y1, 0, LEDGE_BOTTOM, PALETTE.side);
  endFace(back, LEDGE_Y1, SIZE, 0, UNDER_1, PALETTE.side);
  addQuad(mesh, [ENTRY_X1, wallY, LEDGE_BOTTOM], [back, wallY, LEDGE_BOTTOM],
    [back, LEDGE_Y1, LEDGE_BOTTOM], [ENTRY_X1, LEDGE_Y1, LEDGE_BOTTOM], PALETTE.side);
  // Торцевая ступенька выборки: ею стенка и упирается в конец полосы.
  addQuad(mesh, [ENTRY_X1, LEDGE_Y1, LEDGE_BOTTOM], [back, LEDGE_Y1, LEDGE_BOTTOM],
    [back, LEDGE_Y1, UNDER_1], [ENTRY_X1, LEDGE_Y1, UNDER_1], PALETTE.side);
  addQuad(mesh, [ENTRY_X1, LEDGE_Y1, UNDER_1], [back, LEDGE_Y1, UNDER_1],
    [back, SIZE, UNDER_1], [ENTRY_X1, SIZE, UNDER_1], PALETTE.side);
}

// Контурные линии корпуса: только конструктивные кромки, без швов полигональной сетки.
export function coreEdges() {
  const rings = [];
  const push = (r, z) => {
    const pts = [];
    for (const a of CORE_ANGLES) {
      let p;
      if (r === 'outer') p = boundaryPoint(a);
      else if (r === 'plinth') p = boundaryInsetPoint(a, PLINTH_RECESS);
      else if (r === 'lipFlat') {
        const lip = lipPoint(a);
        const dx = lip[0] - CENTER, dy = lip[1] - CENTER;
        const length = Math.hypot(dx, dy) || 1;
        const radius = Math.min(EDGE_R, lipOverhang(a));
        p = [lip[0] + (dx / length) * radius, lip[1] + (dy / length) * radius];
      } else p = ringPoint(a, r);
      pts.push([p[0], p[1], typeof z === 'function' ? z(p[1]) : z]);
    }
    rings.push(pts);
  };
  // Кромка скруглена, поэтому силуэтная линия идёт по верхней касательной вала —
  // там, где кончается плоскость. Нижнюю касательную не рисуем: две линии в 8 мм
  // друг от друга читались бы как шов, а не как вал.
  push(R_HOLE + EDGE_R, LEVEL_1);
  push(R_HOLE + EDGE_R, UNDER_1);
  push(R_BELT_HIGH, LEVEL_1);
  push('lipFlat', (y) => topAt(y));
  push('outer', (y) => topAt(y) - EDGE_R);
  push('outer', PLINTH);
  push('plinth', 0);
  // Швы модулей (seams.js): тень канавки — тонкой линией в 2 мм перед гранью,
  // как контур фасадов ящиков (drawerEdges). Горизонтальный шов +760 — только
  // там, где выше корпуса стоит графитовая стенка пояса.
  const out = (p, d = 2) => { const n = inwardAt(p); return [p[0] - n[0] * d, p[1] - n[1] * d]; };
  const FACE = { front: (a) => [a, 0], side: (a) => [0, a], facade: (a) => [SIZE, a] };
  for (const { face, at } of MODULE_SEAMS) {
    const p = out(FACE[face](at));
    rings.push([[p[0], p[1], PLINTH], [p[0], p[1], SEAM_Z]]);
  }
  let run = [];
  for (const a of CORE_ANGLES) {
    const q = boundaryPoint(a);
    if (underAt(q[1]) > SEAM_Z + 2.5) { const p = out(q); run.push([p[0], p[1], SEAM_Z]); continue; }
    if (run.length > 1) rings.push(run);
    run = [];
  }
  if (run.length > 1) rings.push(run);
  return rings;
}

export { underAt, CENTER };
