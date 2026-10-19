// Направляющие ящиков — шариковый телескоп полного выдвижения, 45 × 12,7 мм,
// из трёх вложенных звеньев оцинкованной стали.
//
// Наружное звено привинчено прямо к перегородке и стоит неподвижно;
// сзади на нём пластиковый упор с доводчиком. Промежуточное звено идёт на
// половину хода и несёт сепараторы с шариками. Внутреннее привинчено к борту
// короба и идёт на весь ход; спереди на нём рычаг расцепления.
// При полном выдвижении звенья остаются в зацеплении: промежуточное перекрывает
// наружное на 113 мм, внутреннее — промежуточное на 121 мм.
//
// Все функции берут ту же ячейку сетки, что и компонент ящика. Координаты — до
// отражения (mirror.js): x — наружу, к фасаду; y — вдоль фасада; z — вверх.

import { addPrism, addQuad, addPolygon } from './mesh.js';
import { PALETTE } from './palette.js';
import { CELLS, BOX_BACK, BOX_FRONT, NICHE_INSET, SLIDE_T, CARCASS_BACK, CARCASS_FRONT } from './drawer-geometry.js';

export const SLIDE_H = 45;          // высота направляющей
const LIFT = 40;                    // низ направляющей над низом ячейки

// Длины по x. Наружное и промежуточное звенья длиннее короба: они уходят за
// его заднюю стенку до задней панели каркаса: так звенья остаются в зацеплении
// с запасом больше 100 мм на всём ходе.
const FIXED_X = [CARCASS_BACK + 2, CARCASS_FRONT];
// Промежуточное начинается за упором-доводчиком наружного звена.
const MIDDLE_X = [CARCASS_BACK + 40, CARCASS_FRONT - 2];
const INNER_X = [BOX_BACK, BOX_FRONT];

const STEEL = PALETTE.steel;
const POM = PALETTE.pom;
const SCREW = PALETTE.bolt;

// Стороны ниши: перегородка стоит на NICHE_INSET внутрь от края фасада,
// направление — вглубь проёма, к коробу.
const sidesOf = (cell) => [{ base: cell.y0 + NICHE_INSET, dir: 1 }, { base: cell.y1 - NICHE_INSET, dir: -1 }];

// Брусок в координатах направляющей: u — от перегородки к коробу (0…12,7),
// h — от низа направляющей вверх (0…45).
function block(mesh, side, zb, [x0, x1], [u0, u1], [h0, h1], color) {
  const ya = side.base + side.dir * u0, yb = side.base + side.dir * u1;
  const y0 = Math.min(ya, yb), y1 = Math.max(ya, yb);
  addPrism(mesh, [[x0, y0], [x1, y0], [x1, y1], [x0, y1]], zb + h0, zb + h1, color, { top: true, bottom: true });
}

// Винт с полукруглой головкой: восьмигранник по оси u.
function screw(mesh, side, zb, x, h, u0, u1) {
  const s = side.base;
  const r = 3.6;
  const ring = Array.from({ length: 8 }, (_, i) => {
    const a = (i + 0.5) * Math.PI / 4;
    return [x + r * Math.cos(a), zb + h + r * Math.sin(a)];
  });
  const [ya, yb] = [s + side.dir * u0, s + side.dir * u1];
  for (let i = 0; i < 8; i++) {
    const [ax, az] = ring[i], [bx, bz] = ring[(i + 1) % 8];
    addQuad(mesh, [ax, ya, az], [bx, ya, bz], [bx, yb, bz], [ax, yb, az], SCREW);
  }
  // Шлиц крестом не рисуем: при 3,6 мм он мельче пикселя на любом кадре.
  addPolygon(mesh, ring.map(([x, z]) => [x, yb, z]), SCREW);
  addPolygon(mesh, ring.slice().reverse().map(([x, z]) => [x, ya, z]), SCREW);
}

const levelOf = (cell) => cell.z0 + LIFT;

// Наружное звено с винтами и задним упором — неподвижно.
export function buildFixedSlide(mesh, cell) {
  const zb = levelOf(cell);
  for (const side of sidesOf(cell)) {
    // Швеллер: стенка 1,2 мм, полки на всю глубину пакета и загнутые дорожки качения.
    block(mesh, side, zb, FIXED_X, [0, 1.2], [0, SLIDE_H], STEEL);
    block(mesh, side, zb, FIXED_X, [0, 11], [SLIDE_H - 1.2, SLIDE_H], STEEL);
    block(mesh, side, zb, FIXED_X, [0, 11], [0, 1.2], STEEL);
    block(mesh, side, zb, FIXED_X, [9.8, 11], [SLIDE_H - 4.5, SLIDE_H - 1.2], STEEL);
    block(mesh, side, zb, FIXED_X, [9.8, 11], [1.2, 4.5], STEEL);
    // Три винта через стенку звена в перегородку.
    for (const t of [0.12, 0.5, 0.88]) screw(mesh, side, zb, FIXED_X[0] + t * (FIXED_X[1] - FIXED_X[0]), SLIDE_H / 2, 1.2, 2.6);
    // Задний упор с доводчиком: пластиковый корпус в хвосте звена.
    block(mesh, side, zb, [FIXED_X[0], MIDDLE_X[0] - 2], [1.2, 9.6], [6, SLIDE_H - 6], POM);
    // Передний резиновый отбойник на нижней полке.
    block(mesh, side, zb, [FIXED_X[1] - 10, FIXED_X[1]], [1.2, 6], [1.2, 5], POM);
  }
}

// Промежуточное звено с сепараторами: идёт на половину хода.
export function buildMiddleSlide(mesh, cell) {
  const zb = levelOf(cell);
  for (const side of sidesOf(cell)) {
    block(mesh, side, zb, MIDDLE_X, [4, 5], [5.5, 39.5], STEEL);
    block(mesh, side, zb, MIDDLE_X, [2.2, 10.5], [38.5, 39.5], STEEL);
    block(mesh, side, zb, MIDDLE_X, [2.2, 10.5], [5.5, 6.5], STEEL);
    block(mesh, side, zb, MIDDLE_X, [9.5, 10.5], [34.5, 38.5], STEEL);
    block(mesh, side, zb, MIDDLE_X, [9.5, 10.5], [6.5, 10.5], STEEL);
    // Сепараторы: пластиковая обойма и шарики Ø3,5 с шагом 9 мм. Верхняя и нижняя
    // пары — между наружным и промежуточным звеньями и между промежуточным и внутренним.
    const cages = [
      { u: [5.4, 9.4], h: [39.8, 43.5] }, { u: [5.4, 9.4], h: [1.5, 5.2] },
      { u: [6.9, 9.2], h: [34.2, 38.3] }, { u: [6.9, 9.2], h: [6.7, 10.8] },
    ];
    for (const { u, h } of cages) {
      const x0 = MIDDLE_X[1] - 96, x1 = MIDDLE_X[1] - 6;
      block(mesh, side, zb, [x0, x1], [u[0], u[0] + 0.8], h, POM);
      for (let x = x0 + 5; x + 3.5 <= x1 - 2; x += 9) block(mesh, side, zb, [x, x + 3.5], [u[0] + 0.8, u[1]], [h[0] + 0.2, h[0] + 3.7], STEEL);
    }
  }
}

// Внутреннее звено: привинчено к борту короба, идёт с ним на весь ход.
export function buildInnerSlide(mesh, cell) {
  const zb = levelOf(cell);
  for (const side of sidesOf(cell)) {
    block(mesh, side, zb, INNER_X, [SLIDE_T - 1, SLIDE_T], [11, 34], STEEL);
    block(mesh, side, zb, INNER_X, [6.5, SLIDE_T], [33, 34], STEEL);
    block(mesh, side, zb, INNER_X, [6.5, SLIDE_T], [11, 12], STEEL);
    // Два винта в борт короба.
    for (const t of [0.2, 0.8]) screw(mesh, side, zb, INNER_X[0] + t * (INNER_X[1] - INNER_X[0]), 22.5, SLIDE_T - 2.4, SLIDE_T - 1);
    // Рычаг расцепления — снять ящик, не разбирая направляющую.
    block(mesh, side, zb, [INNER_X[1] - 46, INNER_X[1] - 10], [7.2, SLIDE_T - 1], [15, 30], POM);
    block(mesh, side, zb, [INNER_X[1] - 18, INNER_X[1] - 10], [5, 7.2], [18, 27], POM);
  }
}

// Все неподвижные звенья блока 3 × 3.
export function buildFixedSlides(mesh, cells = CELLS) {
  for (const cell of cells) buildFixedSlide(mesh, cell);
}
