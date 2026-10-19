// Сетка блока ящиков и её ячейки. Один источник координат для компонента ящика,
// направляющих и каркаса: поменяв здесь число рядов или колонок, меняешь всё сразу.

import { SIZE, UNDER_1, PLINTH, DRAWERS_Y } from './params.js';

export const X_FACE = SIZE;              // плоскость наружного фасада
export const [Y0, Y1] = DRAWERS_Y;
export const COLUMNS = 3;
export const ROWS = 3;
export const GAP = 3;                    // зазор между фасадами и от фасада до стенки, как у обычной мебели

export const FRONT_T = 18;               // толщина фасадной панели
// Проём идёт от цоколя до низа столешницы: полосы стенки над верхним рядом нет,
// верх корпуса стоит за фасадами, и над ними остаётся только зазор GAP.
export const OPENING_TOP = UNDER_1;
export const DRAWER_TOP = OPENING_TOP;
// Фасады накладные: они стоят в проёме с зазором GAP со всех сторон, а каркас
// (верх, дно, перегородки) спрятан за ними. Полок между рядами нет: направляющие
// держатся за перегородки. Перегородки толщиной PANEL_T стоят по оси зазора,
// поэтому ниша ящика уже фасада на NICHE_INSET с каждой стороны.
export const PANEL_T = 16;
export const NICHE_INSET = (PANEL_T - GAP) / 2;
export const CARCASS_SIDE_T = GAP + PANEL_T / 2 - GAP / 2;
export const CARCASS_RECESS = 2;         // отступ фронта каркаса от тыльной стороны фасада

export const CELL_W = (Y1 - Y0 - GAP * (COLUMNS + 1)) / COLUMNS;
export const CELL_H = (DRAWER_TOP - PLINTH - GAP * (ROWS + 1)) / ROWS;

export const BOX_DEPTH = 250;            // глубина короба: помещается в пояс, не заходя в нишу для ног
export const SIDE = 14;                  // толщина стенок короба
export const WALL_H = 110;               // высота бортов
// Направляющая крепится прямо к перегородке, короб — прямо к направляющей:
// зазор между стенкой ниши и бортом короба равен толщине направляющей, 12,7 мм,
// как требует производитель. От края фасада до короба — ещё отступ ниши.
export const SLIDE_T = 12.7;
export const RAIL_GAP = NICHE_INSET + SLIDE_T;
// Полное выдвижение: ход равен глубине короба. Задняя стенка короба остаётся
// в проёме на толщину фасада — ящик не выходит из корпуса и не висит на одних
// направляющих, как было при ходе 300.
export const DRAWER_TRAVEL = BOX_DEPTH;

export const BOX_BACK = X_FACE - FRONT_T - BOX_DEPTH; // задний конец короба и направляющих
export const BOX_FRONT = X_FACE - FRONT_T;
export const CARCASS_BACK = BOX_BACK - 30;            // задняя стенка каркаса
export const CARCASS_FRONT = BOX_FRONT - CARCASS_RECESS; // фронт полок и перегородок

export const DRAWER_COUNT = COLUMNS * ROWS;

// Фасады сетки: rows — число колонок в каждом ряду снизу вверх. Нумерация идёт
// слева направо и снизу вверх; зазор GAP стоит и между фасадами, и у стенки проёма.
export function gridCells(rows) {
  const height = (DRAWER_TOP - PLINTH - GAP * (rows.length + 1)) / rows.length;
  const cells = [];
  rows.forEach((columns, row) => {
    const width = (Y1 - Y0 - GAP * (columns + 1)) / columns;
    for (let column = 0; column < columns; column++) {
      const y0 = Y0 + GAP + column * (width + GAP);
      const z0 = PLINTH + GAP + row * (height + GAP);
      cells.push({ index: cells.length, column, row, y0, y1: y0 + width, z0, z1: z0 + height });
    }
  });
  return cells;
}

export const CELLS = gridCells(Array(ROWS).fill(COLUMNS));
