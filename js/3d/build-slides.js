// Направляющие ящиков — телескоп полного выдвижения из трёх звеньев.
//
// Наружный швеллер привинчен к стенке ячейки и стоит неподвижно. Промежуточный
// идёт на половину хода, внутренний привинчен к коробу и идёт на весь ход.
// При полном выдвижении звенья остаются в зацеплении, поэтому направляющая
// читается как одна деталь, а не как отдельные бруски.
//
// Все три функции берут одну и ту же ячейку сетки, что и компонент ящика.

import { addPrism, addQuad } from './mesh.js';
import { PALETTE } from './palette.js';
import { CELLS, BOX_BACK, BOX_FRONT } from './drawer-geometry.js';

const LIFT = 40;     // отметка низа направляющей над низом ячейки
const H = 40;        // высота наружного звена
const WEB = 3;       // толщина стенки и полок профиля
const BOLTS = 3;     // точки крепления наружного звена к стенке ячейки

// Сечения звеньев: отступ от стенки ячейки, глубина полки, поджатие по высоте.
const MEMBERS = {
  fixed: { offset: 0, flange: 10, inset: 0, color: PALETTE.rail },
  middle: { offset: 9, flange: 9, inset: 3.5, color: PALETTE.railMiddle },
  inner: { offset: 17, flange: 9, inset: 7, color: PALETTE.railMoving },
};

// Стороны ячейки: базовая отметка по Y и направление вглубь проёма.
const sidesOf = (cell) => [{ base: cell.y0, dir: 1 }, { base: cell.y1, dir: -1 }];

const span = (a, b) => (a < b ? [a, b] : [b, a]);

const bar = (mesh, x0, x1, ya, yb, z0, z1, color) => {
  const [y0, y1] = span(ya, yb);
  addPrism(mesh, [[x0, y0], [x1, y0], [x1, y1], [x0, y1]], z0, z1, color, { top: true, bottom: true });
};

// Швеллер: стенка у края ячейки и две полки, охватывающие соседнее звено.
function channel(mesh, side, member, z0, z1) {
  const { base, dir } = side;
  const { offset, flange, color } = member;
  const y = base + dir * offset;
  bar(mesh, BOX_BACK, BOX_FRONT, y, y + dir * WEB, z0, z1, color);
  bar(mesh, BOX_BACK, BOX_FRONT, y, y + dir * flange, z1 - WEB, z1, color);
  bar(mesh, BOX_BACK, BOX_FRONT, y, y + dir * flange, z0, z0 + WEB, color);
}

// Отметки звена по высоте: каждое следующее чуть поджато внутрь предыдущего.
const levels = (cell, member) => [cell.z0 + LIFT + member.inset, cell.z0 + LIFT + H - member.inset];

// Наружное звено одной ячейки: неподвижно, привинчено к стенкам.
export function buildFixedSlide(mesh, cell) {
  const [z0, z1] = levels(cell, MEMBERS.fixed);
  for (const side of sidesOf(cell)) {
    channel(mesh, side, MEMBERS.fixed, z0, z1);
    // Головки крепежа на верхней полке — видно, чем звено держится за каркас.
    for (let b = 0; b < BOLTS; b++) {
      const x = BOX_BACK + 30 + (b * (BOX_FRONT - BOX_BACK - 60)) / (BOLTS - 1);
      const [ya, yb] = span(side.base + side.dir * 1.5, side.base + side.dir * 8.5);
      addQuad(mesh, [x - 7, ya, z1 + 0.5], [x + 7, ya, z1 + 0.5], [x + 7, yb, z1 + 0.5], [x - 7, yb, z1 + 0.5], PALETTE.bolt);
    }
  }
}

// Промежуточное звено: идёт на половину хода, поэтому живёт отдельной группой.
export function buildMiddleSlide(mesh, cell) {
  const [z0, z1] = levels(cell, MEMBERS.middle);
  for (const side of sidesOf(cell)) channel(mesh, side, MEMBERS.middle, z0, z1);
}

// Внутреннее звено: привинчено к коробу и едет вместе с ним на весь ход.
export function buildInnerSlide(mesh, cell) {
  const [z0, z1] = levels(cell, MEMBERS.inner);
  for (const side of sidesOf(cell)) channel(mesh, side, MEMBERS.inner, z0, z1);
}

// Все неподвижные звенья блока.
export function buildFixedSlides(mesh) {
  for (const cell of CELLS) buildFixedSlide(mesh, cell);
}
