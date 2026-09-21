// Core и Sector: несущий корпус с центральным отверстием Ø1200, пояс хранения,
// рабочая поверхность 820, переход на второй уровень 1270 и вырез прохода 800.

import {
  SIZE, CENTER, CORNER_R, R_HOLE, R_BELT_LOW, R_BELT_HIGH, R_LIP,
  LEVEL_1, UNDER_1, TOP_THICK, EDGE_R, EDGE_SEG, ENTRY_X0, ENTRY_X1, SEGMENTS,
  topAt, underAt, ringPoint, lipPoint, lipOverhang, boundaryPoint, boundaryInsetPoint, arcY,
} from './params.js';
import { addPolygon, addQuad } from './mesh.js';
import { outsideEntry } from './entry-cut.js';
import { addWallWithOpenings } from './openings.js';
import { LEDGE_BOTTOM, LEDGE_Y1 } from './bridge-fittings.js';
import { PALETTE } from './palette.js';

// Грань корпуса с учётом выреза прохода.
function addCut(mesh, poly, color, mergeEps = 0.001) {
  for (const part of outsideEntry(poly, mergeEps)) addPolygon(mesh, part, color);
}

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
  angles.sort((a, b) => a - b);
  const unique = angles.filter((a, i) => i === 0 || a - angles[i - 1] > 1e-7);
  return [...unique, tau];
})();

// То же для наружной стенки, где дополнительно вырезаны проёмы фасадных модулей.
function addWall(mesh, poly, color) {
  for (const part of outsideEntry(poly)) addWallWithOpenings(mesh, part, color);
}

export function buildCore(mesh) {
  for (let i = 0; i < CORE_ANGLES.length - 1; i++) {
    const angles = [CORE_ANGLES[i], CORE_ANGLES[i + 1]];
    const inner = angles.map((a) => ringPoint(a, R_HOLE));
    const beltLow = angles.map((a) => ringPoint(a, R_BELT_LOW));
    const beltHigh = angles.map((a) => ringPoint(a, R_BELT_HIGH));
    const lip = angles.map(lipPoint);
    const outer = angles.map(boundaryPoint);
    const outerFlat = angles.map((a) => boundaryInsetPoint(a, EDGE_R));

    const at = (p, z) => [p[0], p[1], z];
    const topLip = lip.map((p) => topAt(p[1]));
    const raised = Math.max(...angles.map(lipOverhang)) > 0.1;
    const under = beltHigh.map((p) => underAt(p[1]));

    // Плоская часть рабочей поверхности начинается уже за скруглением кромки.
    const innerFlat = angles.map((a) => ringPoint(a, R_HOLE + EDGE_R));

    // Рабочая поверхность Sector: кольцо 608…1250 на отметке 820.
    addCut(mesh, [at(innerFlat[0], LEVEL_1), at(innerFlat[1], LEVEL_1), at(beltHigh[1], LEVEL_1), at(beltHigh[0], LEVEL_1)], PALETTE.worktop);

    // Четверть вала R8 между рабочей плоскостью и гранью отверстия: предплечья
    // лежат именно здесь, и острый угол давал бы точечный пик давления.
    // Профиль идёт от (600+R, 820) к (600, 820−R) по дуге с центром (600+R, 820−R).
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
      addCut(mesh, [at(lo[0], zLo), at(lo[1], zLo), at(hi[1], zHi), at(hi[0], zHi)], PALETTE.worktop, EDGE_MERGE_EPS);
    }

    // Кромка столешницы по отверстию ниже вала: накладной брусок по всей толщине.
    addCut(mesh, [at(inner[0], UNDER_1), at(inner[1], UNDER_1), at(inner[1], LEVEL_1 - EDGE_R), at(inner[0], LEVEL_1 - EDGE_R)], PALETTE.worktop);

    // Низ столешницы над нишей для ног: кольцо 600…1150 на отметке 760.
    addCut(mesh, [at(inner[0], UNDER_1), at(beltLow[0], UNDER_1), at(beltLow[1], UNDER_1), at(inner[1], UNDER_1)], PALETTE.worktopBottom);

    // Нижняя внутренняя стенка от пола до первого уровня остаётся серой.
    addCut(mesh, [at(beltLow[0], 0), at(beltLow[1], 0), at(beltLow[1], UNDER_1), at(beltLow[0], UNDER_1)], PALETTE.innerWall);

    if (raised) {
      // Стенка между первым и вторым уровнями облицована вертикальным шпоном.
      addCut(mesh, [at(beltHigh[0], LEVEL_1), at(beltHigh[1], LEVEL_1), at(beltHigh[1], under[1]), at(beltHigh[0], under[0])], PALETTE.belt);
      // Нижняя сторона 60-мм выступа вокруг LED-паза облицована тем же шпоном,
      // что и верх; сама лента остаётся отдельной светящейся геометрией.
      addCut(mesh, [at(lip[0], underAt(lip[0][1])), at(lip[1], underAt(lip[1][1])), at(beltHigh[1], under[1]), at(beltHigh[0], under[0])], PALETTE.worktopBottom);
      const lipRadius = angles.map((a) => Math.min(EDGE_R, lipOverhang(a)));
      const lipFlat = lip.map((p, index) => {
        const dx = p[0] - CENTER, dy = p[1] - CENTER;
        const length = Math.hypot(dx, dy) || 1;
        return [p[0] + (dx / length) * lipRadius[index], p[1] + (dy / length) * lipRadius[index]];
      });
      addCut(mesh, [at(lip[0], underAt(lip[0][1])), at(lip[1], underAt(lip[1][1])),
        at(lip[1], topLip[1] - lipRadius[1]), at(lip[0], topLip[0] - lipRadius[0])], PALETTE.worktop);
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
        point(1, (j + 1) / 24), point(0, (j + 1) / 24)], PALETTE.upper);
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
    const outerUnder = outerTop.map((z) => z - TOP_THICK);
    addWall(mesh, [at(outer[0], 0), at(outer[1], 0), at(outer[1], outerUnder[1]), at(outer[0], outerUnder[0])], PALETTE.side);
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
        bevelPoint(1, (j + 1) / EDGE_SEG), bevelPoint(0, (j + 1) / EDGE_SEG)], PALETTE.worktop, EDGE_MERGE_EPS);
    }
    addCut(mesh, [at(beltLow[0], 0), at(outer[0], 0), at(outer[1], 0), at(beltLow[1], 0)], PALETTE.underside);
  }

  // Стенка со стороны выступа показана настоящей панелью 18 мм, а не одной гранью:
  // иначе не видно, что её верх выбран и полоса лежит в выборке, а не внутри стенки.
  // Со стороны петли толщина не нужна — там в стенку заходит кронштейн петли.
  const WALL_T = 18;

  // Торцы прохода: стенка корпуса ниже столешницы и замкнутый кромочный профиль 100 × 60.
  for (const x of [ENTRY_X0, ENTRY_X1]) {
    const yBody = arcY(x, R_BELT_LOW);
    const yPanel = arcY(x, R_HOLE);
    // Со стороны выступа верх стенки выбран на толщину опорной полосы Bridge:
    // полоса ложится в эту выборку. Последние 30 мм у входа стенка идёт на полную
    // высоту и закрывает торец полосы — с порога его не видно.
    if (x === ENTRY_X1) {
      addQuad(mesh, [x, yBody, 0], [x, LEDGE_Y1, 0], [x, LEDGE_Y1, LEDGE_BOTTOM], [x, yBody, LEDGE_BOTTOM], PALETTE.innerWall);
      addQuad(mesh, [x, LEDGE_Y1, 0], [x, SIZE, 0], [x, SIZE, UNDER_1], [x, LEDGE_Y1, UNDER_1], PALETTE.innerWall);
    } else {
      addQuad(mesh, [x, yBody, 0], [x, SIZE, 0], [x, SIZE, UNDER_1], [x, yBody, UNDER_1], PALETTE.innerWall);
    }
    addQuad(mesh, [x, yPanel, UNDER_1], [x, SIZE, UNDER_1], [x, SIZE, LEVEL_1], [x, yPanel, LEVEL_1], PALETTE.worktop);
  }

  // Тело и дно выборки той же стенки. Выборка кончается там же, где полоса,
  // а дальше стенка выходит на полную высоту и закрывает её торец.
  const wallY = arcY(ENTRY_X1, R_BELT_LOW);
  const back = ENTRY_X1 + WALL_T;
  addQuad(mesh, [back, wallY, 0], [back, LEDGE_Y1, 0], [back, LEDGE_Y1, LEDGE_BOTTOM], [back, wallY, LEDGE_BOTTOM], PALETTE.innerWall);
  addQuad(mesh, [back, LEDGE_Y1, 0], [back, SIZE, 0], [back, SIZE, UNDER_1], [back, LEDGE_Y1, UNDER_1], PALETTE.innerWall);
  addQuad(mesh, [ENTRY_X1, wallY, LEDGE_BOTTOM], [back, wallY, LEDGE_BOTTOM],
    [back, LEDGE_Y1, LEDGE_BOTTOM], [ENTRY_X1, LEDGE_Y1, LEDGE_BOTTOM], PALETTE.innerWall);
  // Торцевая ступенька выборки: ею стенка и упирается в конец полосы.
  addQuad(mesh, [ENTRY_X1, LEDGE_Y1, LEDGE_BOTTOM], [back, LEDGE_Y1, LEDGE_BOTTOM],
    [back, LEDGE_Y1, UNDER_1], [ENTRY_X1, LEDGE_Y1, UNDER_1], PALETTE.innerWall);
  addQuad(mesh, [ENTRY_X1, LEDGE_Y1, UNDER_1], [back, LEDGE_Y1, UNDER_1],
    [back, SIZE, UNDER_1], [ENTRY_X1, SIZE, UNDER_1], PALETTE.innerWall);
}

// Контурные линии корпуса: только конструктивные кромки, без швов полигональной сетки.
export function coreEdges() {
  const rings = [];
  const push = (r, z) => {
    const pts = [];
    for (const a of CORE_ANGLES) {
      let p;
      if (r === 'outer') p = boundaryPoint(a);
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
  push(R_HOLE, UNDER_1);
  push(R_BELT_HIGH, LEVEL_1);
  push('lipFlat', (y) => topAt(y));
  push('outer', (y) => topAt(y) - EDGE_R);
  push('outer', 0);
  return rings;
}

export { underAt, CENTER };
