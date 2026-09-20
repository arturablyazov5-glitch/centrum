// Сетка блока ящиков и её ячейки. Один источник координат для компонента ящика,
// направляющих и каркаса: поменяв здесь число рядов или колонок, меняешь всё сразу.

import { SIZE, UNDER_1, PLINTH, DRAWERS_Y } from './params.js';

export const X_FACE = SIZE;              // плоскость наружного фасада
export const [Y0, Y1] = DRAWERS_Y;
export const COLUMNS = 3;
export const ROWS = 3;
export const GAP = 10;                   // зазор между фасадами и толщина перегородки

export const CELL_W = (Y1 - Y0 - GAP * (COLUMNS - 1)) / COLUMNS;
export const FRONT_T = 18;               // толщина фасадной панели
// Под деревянной столешницей лежит отдельная серая несущая полка. Она занимает
// тот же конструкционный калибр, что фасад; верхний ящик подходит к ней без
// дополнительной видимой щели, а габарит стола при этом не меняется.
export const TOP_SHELF_T = FRONT_T;
export const TOP_SHELF_Z0 = UNDER_1 - TOP_SHELF_T;
export const DRAWER_TOP = TOP_SHELF_Z0;
export const CELL_H = (DRAWER_TOP - PLINTH - GAP * (ROWS - 1)) / ROWS;

export const BOX_DEPTH = 250;            // глубина короба: помещается в пояс, не заходя в нишу для ног
export const SIDE = 14;                  // толщина стенок короба
export const WALL_H = 110;               // высота бортов
export const RAIL_GAP = 28;              // зазор между стенкой ячейки и коробом — место направляющих
export const DRAWER_TRAVEL = 300;        // рабочий вылет ящика наружу

export const BOX_BACK = X_FACE - FRONT_T - BOX_DEPTH; // задний конец короба и направляющих
export const BOX_FRONT = X_FACE - FRONT_T;
export const CARCASS_BACK = BOX_BACK - 30;            // задняя стенка каркаса

export const DRAWER_COUNT = COLUMNS * ROWS;

// Ячейка сетки: нумерация идёт слева направо и снизу вверх по фасаду.
export function cellAt(index) {
  const column = index % COLUMNS;
  const row = Math.floor(index / COLUMNS);
  const y0 = Y0 + column * (CELL_W + GAP);
  const z0 = PLINTH + row * (CELL_H + GAP);
  return { index, column, row, y0, y1: y0 + CELL_W, z0, z1: z0 + CELL_H };
}

export const CELLS = Array.from({ length: DRAWER_COUNT }, (_, i) => cellAt(i));
