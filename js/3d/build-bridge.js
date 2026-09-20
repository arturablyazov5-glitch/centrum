// Bridge — одна подъёмная секция входа 60 мм: петля по левой кромке проёма (x = 1050),
// свободный конец лежит на опорном выступе справа. Ход 0…100°.
// Геометрия строится в закрытом положении; поворот задаётся матрицей узла.
//
// Сама плита — лист 20: 793 × 1003 × 60 с зазорами 3 у петли и 4 у выступа.
// В ней выбраны две утопленные ручки (сверху) и два канала под газлифты (снизу);
// фурнитура — в build-bridge-hardware.js.

import {
  SIZE, R_HOLE, LEVEL_1, UNDER_1, ENTRY_X0, LEAF_X0, LEAF_X1, BRIDGE_Y0, arcY,
} from './params.js';
import { addQuad, addPolygon } from './mesh.js';
import { clipPolygon } from './entry-cut.js';
import { PALETTE } from './palette.js';
import { CHANNEL_TOP, CHANNEL_W, CHANNEL_X1, STRUT_Y, REBATE_D, REBATE_W } from './bridge-fittings.js';

const STEPS = 24; // разбиение кромки по дуге отверстия

// Утопленные ручки, лист 20: площадка 200 × 28 у каждой кромки — изнутри стола
// и из комнаты, чтобы секцию можно было поднять с любой стороны. На плане они
// показаны штриховой: выборка идёт снизу, рабочая плоскость остаётся сплошной.
// Пальцы заходят под кромку моста — сверху ручек не видно совсем.
const HANDLE_DEPTH = 25;
const HANDLES = [
  { x: [ENTRY_X0 + 300, ENTRY_X0 + 500], y: [BRIDGE_Y0 + 160, BRIDGE_Y0 + 188] },
  { x: [ENTRY_X0 + 300, ENTRY_X0 + 500], y: [BRIDGE_Y0 + 955, BRIDGE_Y0 + 983] },
];

// Четверть 25 × 3 по нижней кромке свободного конца, лист 23. В неё встают
// накладки POM, и ими секция приземляется на плоскую опорную полосу — сталь
// за счёт этого остаётся простым прокатом без ступеньки.
const REBATE = { x: [LEAF_X1 - REBATE_W, LEAF_X1], y: [0, SIZE] };
const REBATE_Z = UNDER_1 + REBATE_D;

// Каналы под газлифты в нижней грани, лист 20. Канал выходит в кромку у петли —
// это и есть серповидный вырез под кронштейн с листа 22.
const CHANNELS = STRUT_Y.map((y) => ({
  x: [LEAF_X0, CHANNEL_X1],
  y: [y - CHANNEL_W / 2, y + CHANNEL_W / 2],
}));

// Вычитание прямоугольного окна из плоской грани по двум её осям.
function cutOut(poly, axisA, [a0, a1], axisB, [b0, b1]) {
  const before = clipPolygon(poly, axisA, a0, true);
  const after = clipPolygon(poly, axisA, a1, false);
  const band = clipPolygon(clipPolygon(poly, axisA, a0, false), axisA, a1, true);
  return [before, after, clipPolygon(band, axisB, b0, true), clipPolygon(band, axisB, b1, false)]
    .filter((p) => p.length >= 3);
}

// Грань за вычетом набора окон, заданных в плане.
const inPlan = (poly, windows) =>
  windows.reduce((parts, w) => parts.flatMap((part) => cutOut(part, 0, w.x, 1, w.y)), [poly]);

// Кромка секции со стороны отверстия: дуга R600 от петли до опорного выступа.
function frontEdge() {
  const pts = [];
  for (let j = 0; j <= STEPS; j++) {
    const x = LEAF_X0 + (j * (LEAF_X1 - LEAF_X0)) / STEPS;
    pts.push([x, arcY(x, R_HOLE)]);
  }
  return pts;
}

// Стенки и дно выборки: контур в плане, поднятый между двумя отметками.
function pocket(mesh, { x: [x0, x1], y: [y0, y1] }, zFloor, zOpen, color, { openAtX0 = false } = {}) {
  const walls = [
    [[x0, y0], [x1, y0]],
    [[x1, y0], [x1, y1]],
    [[x1, y1], [x0, y1]],
    [[x0, y1], [x0, y0]],
  ];
  for (const [a, b] of walls) {
    if (openAtX0 && a[0] === x0 && b[0] === x0) continue; // канал открыт в кромку у петли
    addQuad(mesh, [a[0], a[1], zFloor], [b[0], b[1], zFloor], [b[0], b[1], zOpen], [a[0], a[1], zOpen], color);
  }
  addPolygon(mesh, [[x0, y0, zFloor], [x1, y0, zFloor], [x1, y1, zFloor], [x0, y1, zFloor]], color);
}

export function buildBridge(mesh) {
  const edge = frontEdge();

  for (let j = 0; j < edge.length - 1; j++) {
    const a = edge[j], b = edge[j + 1];
    // Верх секции: рабочая плоскость 820 без единого выреза.
    addQuad(mesh, [a[0], a[1], LEVEL_1], [b[0], b[1], LEVEL_1], [b[0], SIZE, LEVEL_1], [a[0], SIZE, LEVEL_1], PALETTE.bridge);
    // Низ секции: та же плита за вычетом каналов под газлифты и двух ручек.
    const bottom = [[a[0], a[1], UNDER_1], [b[0], b[1], UNDER_1], [b[0], SIZE, UNDER_1], [a[0], SIZE, UNDER_1]];
    for (const part of inPlan(bottom, [...CHANNELS, ...HANDLES, REBATE])) addPolygon(mesh, part, PALETTE.worktopBottom);
    // Торец по дуге отверстия: в полосе четверти он начинается с отметки 693.
    const arcFace = [[a[0], a[1], UNDER_1], [b[0], b[1], UNDER_1], [b[0], b[1], LEVEL_1], [a[0], a[1], LEVEL_1]];
    for (const part of cutOut(arcFace, 0, REBATE.x, 2, [UNDER_1, REBATE_Z])) addPolygon(mesh, part, PALETTE.bridge);
  }

  // Боковые торцы у петли и у опорного выступа плюс наружный торец секции.
  // У петли в торце открыты каналы газлифтов, поэтому грань собирается с окнами.
  const hinge = [[LEAF_X0, edge[0][1], UNDER_1], [LEAF_X0, SIZE, UNDER_1], [LEAF_X0, SIZE, LEVEL_1], [LEAF_X0, edge[0][1], LEVEL_1]];
  let hingeParts = [hinge];
  for (const y of STRUT_Y)
    hingeParts = hingeParts.flatMap((part) => cutOut(part, 1, [y - CHANNEL_W / 2, y + CHANNEL_W / 2], 2, [UNDER_1, CHANNEL_TOP]));
  for (const part of hingeParts) addPolygon(mesh, part, PALETTE.bridge);

  // Свободный торец: четверть срезает его нижние 3 мм по всей длине.
  const yEnd = edge[edge.length - 1][1];
  addQuad(mesh, [LEAF_X1, yEnd, REBATE_Z], [LEAF_X1, SIZE, REBATE_Z], [LEAF_X1, SIZE, LEVEL_1], [LEAF_X1, yEnd, LEVEL_1], PALETTE.bridge);
  // Наружный торец у входа — с вырезом четверти в углу.
  const outer = [[LEAF_X0, SIZE, UNDER_1], [LEAF_X1, SIZE, UNDER_1], [LEAF_X1, SIZE, LEVEL_1], [LEAF_X0, SIZE, LEVEL_1]];
  for (const part of cutOut(outer, 0, REBATE.x, 2, [UNDER_1, REBATE_Z])) addPolygon(mesh, part, PALETTE.bridge);

  // Сама четверть: потолок на отметке 693 и её внутренняя стенка.
  const [rx0, rx1] = REBATE.x;
  const RSTEPS = 6;
  for (let j = 0; j < RSTEPS; j++) {
    const xa = rx0 + (j * (rx1 - rx0)) / RSTEPS;
    const xb = rx0 + ((j + 1) * (rx1 - rx0)) / RSTEPS;
    addQuad(mesh, [xa, arcY(xa, R_HOLE), REBATE_Z], [xb, arcY(xb, R_HOLE), REBATE_Z],
      [xb, SIZE, REBATE_Z], [xa, SIZE, REBATE_Z], PALETTE.worktopBottom);
  }
  addQuad(mesh, [rx0, arcY(rx0, R_HOLE), UNDER_1], [rx0, SIZE, UNDER_1],
    [rx0, SIZE, REBATE_Z], [rx0, arcY(rx0, R_HOLE), REBATE_Z], PALETTE.worktopBottom);

  // И ручки, и каналы газлифтов выбраны снизу вверх, из нижней грани плиты.
  // Выборка идёт по телу двухсторонне облицованной плиты, поэтому стенки и дно
  // получают тот же нижний шпон, что и сама грань, — а не цвет зазора.
  for (const handle of HANDLES) pocket(mesh, handle, UNDER_1 + HANDLE_DEPTH, UNDER_1, PALETTE.worktopBottom);
  for (const channel of CHANNELS) pocket(mesh, channel, CHANNEL_TOP, UNDER_1, PALETTE.worktopBottom, { openAtX0: true });
}

// Контур секции для линий: верхняя кромка по дуге, бокам и наружному торцу.
export function bridgeEdges() {
  const edge = frontEdge();
  const top = edge.map(([x, y]) => [x, y, LEVEL_1]);
  const outline = [...top, [LEAF_X1, SIZE, LEVEL_1], [LEAF_X0, SIZE, LEVEL_1]];
  const bottom = outline.map(([x, y]) => [x, y, UNDER_1]);
  const handles = HANDLES.map(({ x: [x0, x1], y: [y0, y1] }) =>
    [[x0, y0, UNDER_1], [x1, y0, UNDER_1], [x1, y1, UNDER_1], [x0, y1, UNDER_1]]);
  return { outline, bottom, handles };
}

// Ось поворота секции: лежит в плоскости столешницы у левой кромки проёма.
export const HINGE = [ENTRY_X0, 0, LEVEL_1];
