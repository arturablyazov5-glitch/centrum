// Компонент одного ящика. Вся геометрия строится от границ переданной ячейки,
// поэтому все девять ящиков в блоке — это один и тот же код: правка здесь
// меняет каждый ящик сразу.

import { addPolygon, addQuad, addPrism } from './mesh.js';
import { buildInnerSlide } from './build-slides.js';
import { PALETTE } from './palette.js';
import { X_FACE as X, FRONT_T, SIDE, WALL_H, RAIL_GAP, BOX_BACK, BOX_FRONT } from './drawer-geometry.js';

const PULL_W = 0.44;       // ширина пальцевого выреза в долях фасада
const PULL_H = 42;         // глубина U-образного выреза от верхней кромки
const PULL_STEPS = 10;     // сегменты плавной нижней кромки выреза

// Призма с осью толщины по X. Нужна именно для фасада: его контур лежит в
// плоскости YZ, а стандартная addPrism() выдавливает контур по Z.
function addYzPrism(mesh, contour, x0, x1, color) {
  for (let i = 0; i < contour.length; i++) {
    const a = contour[i], b = contour[(i + 1) % contour.length];
    addQuad(mesh, [x0, a[0], a[1]], [x0, b[0], b[1]], [x1, b[0], b[1]], [x1, a[0], a[1]], color);
  }
  addPolygon(mesh, contour.map(([y, z]) => [x0, y, z]).reverse(), color);
  addPolygon(mesh, contour.map(([y, z]) => [x1, y, z]), color);
}

function pullProfile(y0, y1, z1) {
  const mid = (y0 + y1) / 2;
  const half = Math.min(((y1 - y0) * PULL_W) / 2, 220);
  const points = [];
  for (let i = 0; i <= PULL_STEPS; i++) {
    const t = i / PULL_STEPS;
    // Мягкая ложбина: у краёв кромка остаётся на уровне верха фасада,
    // в центре палец входит на полные 42 мм.
    points.push([mid - half + 2 * half * t, z1 - PULL_H * Math.sin(Math.PI * t)]);
  }
  return points;
}

// Фасад без накладной ручки. Материал действительно отсутствует в центральной
// части верхней кромки; профиль выреза — плавная U-образная линия, а не тёмная
// наклейка поверх сплошной панели.
function buildFingerPullFacade(mesh, cell) {
  const { y0, y1, z0, z1 } = cell;
  const profile = pullProfile(y0, y1, z1);
  const [pullY0] = profile[0];
  const [pullY1] = profile[profile.length - 1];
  const zBottom = z1 - PULL_H;
  const x0 = X - FRONT_T, x1 = X;

  // Нижняя часть и боковые стойки оставляют отверстие открытым сверху.
  addYzPrism(mesh, [[y0, z0], [y1, z0], [y1, zBottom], [y0, zBottom]], x0, x1, PALETTE.drawer);
  addYzPrism(mesh, [[y0, zBottom], [pullY0, zBottom], [pullY0, z1], [y0, z1]], x0, x1, PALETTE.drawer);
  addYzPrism(mesh, [[pullY1, zBottom], [y1, zBottom], [y1, z1], [pullY1, z1]], x0, x1, PALETTE.drawer);

  // Полоса под кривой: собрана из трапеций, поэтому её верхняя кромка повторяет
  // радиус пальцевого выреза, а не превращается в прямоугольную щель.
  for (let i = 0; i < profile.length - 1; i++) {
    const a = profile[i], b = profile[i + 1];
    addYzPrism(mesh, [[a[0], zBottom], [b[0], zBottom], b, a], x0, x1, PALETTE.drawer);
  }

}

// Ящик: фасад с утопленным вырезом, короб с бортами и внутреннее звено направляющей.
export function buildDrawer(mesh, cell) {
  const { y0, y1, z0, z1 } = cell;

  buildFingerPullFacade(mesh, cell);

  // Короб уже ячейки: по бокам остаётся место под направляющие.
  const by0 = y0 + RAIL_GAP, by1 = y1 - RAIL_GAP, bz = z0 + 18;
  const top = Math.min(bz + WALL_H, z1 - 10);
  addQuad(mesh, [BOX_BACK, by0, bz], [BOX_FRONT, by0, bz], [BOX_FRONT, by1, bz], [BOX_BACK, by1, bz], PALETTE.drawer);
  addPrism(mesh, [[BOX_BACK, by0], [BOX_BACK + SIDE, by0], [BOX_BACK + SIDE, by1], [BOX_BACK, by1]], bz, top, PALETTE.drawer, { top: true });
  addPrism(mesh, [[BOX_BACK, by0], [BOX_FRONT, by0], [BOX_FRONT, by0 + SIDE], [BOX_BACK, by0 + SIDE]], bz, top, PALETTE.drawer, { top: true });
  addPrism(mesh, [[BOX_BACK, by1 - SIDE], [BOX_FRONT, by1 - SIDE], [BOX_FRONT, by1], [BOX_BACK, by1]], bz, top, PALETTE.drawer, { top: true });

  buildInnerSlide(mesh, cell);
}

// Контур фасада для линейного слоя.
export function drawerEdges(cell) {
  const profile = pullProfile(cell.y0, cell.y1, cell.z1);
  return [[
    [X + 2, cell.y0, cell.z0], [X + 2, cell.y1, cell.z0], [X + 2, cell.y1, cell.z1],
    ...profile.slice().reverse().map(([y, z]) => [X + 2, y, z]), [X + 2, cell.y0, cell.z1],
  ]];
}
