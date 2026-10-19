// Компонент одного ящика. Вся геометрия строится от границ переданной ячейки,
// поэтому все девять ящиков в блоке — это один и тот же код: правка здесь
// меняет каждый ящик сразу.

import { addPolygon, addQuad, addPrism } from './mesh.js';
import { PALETTE } from './palette.js';
import { X_FACE as X, FRONT_T, SIDE, WALL_H, RAIL_GAP, BOX_BACK, BOX_FRONT, CARCASS_BACK } from './drawer-geometry.js';

const PULL_W = 0.44;       // ширина пальцевого выреза в долях фасада
const PULL_H = 42;         // глубина U-образного выреза от верхней кромки
const PULL_STEPS = 10;     // сегменты плавной нижней кромки выреза
const DRAWER_LED_INSET = 10;

// Длина профиля по той же геометрии, что и подсветка на фасаде.
export const drawerLedLength = (cell) => Math.max(0,
  cell.y1 - cell.y0 - 2 * (RAIL_GAP + SIDE + DRAWER_LED_INSET));

// width — доля фасада, depth — глубина выреза от верхней кромки: у ящиков по
// умолчанию, у мусорного модуля свои (build-trash.js, TRASH_PULL) — пол-ладони.
export function pullProfile(y0, y1, z1, width = PULL_W, depth = PULL_H) {
  const mid = (y0 + y1) / 2;
  const half = Math.min(((y1 - y0) * width) / 2, 220);
  const points = [];
  for (let i = 0; i <= PULL_STEPS; i++) {
    const t = i / PULL_STEPS;
    // Мягкая ложбина: у краёв кромка остаётся на уровне верха фасада,
    // в центре палец входит на полную глубину выреза (у ящиков 42 мм).
    points.push([mid - half + 2 * half * t, z1 - depth * Math.sin(Math.PI * t)]);
  }
  return points;
}

// Фасад без накладной ручки — одна цельная плита. Материал действительно
// отсутствует в центральной части верхней кромки; профиль выреза — плавная
// U-образная линия. Лицевая и тыльная плоскости разбиты на копланарные куски
// только для триангуляции, а торцы идут лишь по внешнему контуру: внутри плиты
// нет граней, которые фаска в шейдере рисовала бы светлой линией.
// Та же плита — фасад мусорного модуля (build-trash.js): он стоит в стенке прохода,
// снаружи (в проходе) — тоже +x, поэтому строится в тех же осях, что и ящик, но на своей
// плоскости plane, с более широким и глубоким вырезом (pullW, pullH).
export function buildFingerPullFacade(mesh, cell) {
  const { y0, y1, z0, z1, plane = X, pullW = PULL_W, pullH = PULL_H } = cell;
  const profile = pullProfile(y0, y1, z1, pullW, pullH);
  const [pullY0] = profile[0];
  const [pullY1] = profile[profile.length - 1];
  const zBottom = z1 - pullH;
  const x0 = plane - FRONT_T, x1 = plane;
  const c = PALETTE.drawer;

  // Куски плоскости фасада в координатах (y, z), обход против часовой при взгляде снаружи.
  const pieces = [
    [[y0, z0], [y1, z0], [y1, zBottom], ...profile.slice().reverse().map(([y]) => [y, zBottom]), [y0, zBottom]],
    [[y0, zBottom], [pullY0, zBottom], [pullY0, z1], [y0, z1]],
    [[pullY1, zBottom], [y1, zBottom], [y1, z1], [pullY1, z1]],
  ];
  for (let i = 0; i < profile.length - 1; i++) {
    const a = profile[i], b = profile[i + 1];
    pieces.push([[a[0], zBottom], [b[0], zBottom], b, a]);
  }
  for (const piece of pieces) {
    addPolygon(mesh, piece.map(([y, z]) => [x1, y, z]), c);
    addPolygon(mesh, piece.map(([y, z]) => [x0, y, z]).reverse(), c);
  }

  // Торцы по внешнему контуру плиты: низ, бока, верх до выреза, сам вырез.
  const contour = [[y0, z0], [y1, z0], [y1, z1], ...profile.slice().reverse(), [y0, z1]];
  for (let i = 0; i < contour.length; i++) {
    const a = contour[i], b = contour[(i + 1) % contour.length];
    addQuad(mesh, [x0, a[0], a[1]], [x0, b[0], b[1]], [x1, b[0], b[1]], [x1, a[0], a[1]], c);
  }
}

// Ящик: фасад с утопленным вырезом и короб с бортами. Внутреннее звено
// направляющей — отдельная деталь (build-slides.js), оно стальное.
export function buildDrawer(mesh, cell) {
  const { y0, y1, z0, z1 } = cell;

  buildFingerPullFacade(mesh, cell);

  // Короб уже ячейки: по бокам остаётся место под направляющие.
  const by0 = y0 + RAIL_GAP, by1 = y1 - RAIL_GAP, bz = z0 + 18;
  const top = Math.min(bz + WALL_H, z1 - 12);
  addQuad(mesh, [BOX_BACK, by0, bz], [BOX_FRONT, by0, bz], [BOX_FRONT, by1, bz], [BOX_BACK, by1, bz], PALETTE.drawer);
  addPrism(mesh, [[BOX_BACK, by0], [BOX_BACK + SIDE, by0], [BOX_BACK + SIDE, by1], [BOX_BACK, by1]], bz, top, PALETTE.drawer, { top: true });
  addPrism(mesh, [[BOX_BACK, by0], [BOX_FRONT, by0], [BOX_FRONT, by0 + SIDE], [BOX_BACK, by0 + SIDE]], bz, top, PALETTE.drawer, { top: true });
  addPrism(mesh, [[BOX_BACK, by1 - SIDE], [BOX_FRONT, by1 - SIDE], [BOX_FRONT, by1], [BOX_BACK, by1]], bz, top, PALETTE.drawer, { top: true });

}

// Контур фасада для линейного слоя.
export function drawerEdges(cell) {
  const profile = pullProfile(cell.y0, cell.y1, cell.z1);
  return [[
    [X + 2, cell.y0, cell.z0], [X + 2, cell.y1, cell.z0], [X + 2, cell.y1, cell.z1],
    ...profile.slice().reverse().map(([y, z]) => [X + 2, y, z]), [X + 2, cell.y0, cell.z1],
  ]];
}

// Подсветка ящика (опция «Подсветка ящиков»): алюминиевый профиль с рассеивателем
// на изнанке фасада, сразу под пальцевым вырезом. Светит вниз, в короб; снаружи
// свет виден через вырез и над кромкой открытого ящика при любой высоте фасада.
// Едет вместе с ящиком и загорается, когда его выдвигают. Отдельная группа —
// чтобы гасить её без опции и светить только у открытого ящика.
export const DRAWER_LED_DEPTH = 8;   // выступ профиля от изнанки фасада
export const DRAWER_LED_HEIGHT = 12; // высота рассеивателя
const DRAWER_LED_DROP = 6;           // от низа пальцевого выреза
export function buildDrawerLed(mesh, cell) {
  const { y0, z1 } = cell;
  const by0 = y0 + RAIL_GAP + SIDE + DRAWER_LED_INSET, by1 = by0 + drawerLedLength(cell);
  const top = z1 - PULL_H - DRAWER_LED_DROP;
  const x1 = BOX_FRONT, x0 = x1 - DRAWER_LED_DEPTH;
  const contour = [[x0, by0], [x1, by0], [x1, by1], [x0, by1]];
  // Корпус профиля — чёрный анодированный алюминий; светит только рассеиватель снизу.
  addPrism(mesh, contour, top - DRAWER_LED_HEIGHT, top, PALETTE.hardware, { top: true });
  addPolygon(mesh, contour.slice().reverse().map(([x, y]) => [x, y, top - DRAWER_LED_HEIGHT]), PALETTE.led);
}

// Свет профиля для рендера сайта: точка чуть ниже рассеивателя и объём, куда он
// достаёт, — короб и ниша ящика от задней стенки каркаса до изнанки фасада.
// Теней рендер сайта не считает, поэтому свет ограничен этим объёмом явно.
// offset — выдвижение ящика, мм; координаты до отражения (mirror.js).
export function drawerLightVolume(cell, offset = 0) {
  const { y0, y1, z0, z1 } = cell;
  const top = z1 - PULL_H - DRAWER_LED_DROP;
  return {
    position: [BOX_FRONT - DRAWER_LED_DEPTH - 20 + offset, (y0 + y1) / 2, top - DRAWER_LED_HEIGHT - 10],
    // Запас 2 мм: задняя стенка каркаса лежит ровно на границе объёма.
    min: [CARCASS_BACK - 2, y0 - 2, z0 - 2],
    max: [BOX_FRONT + offset - 0.5, y1 + 2, z1 + 2],
  };
}
