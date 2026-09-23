// Блок ящиков на наружном фасаде: сетка 3 × 3 на участке шириной 1600.
// Сам ящик описан один раз в build-drawer.js — здесь только его размещение.

import { UNDER_1, PLINTH, CARCASS_BOTTOM } from './params.js';
import { addQuad, addPrism } from './mesh.js';
import { PALETTE } from './palette.js';
import {
  X_FACE as X, Y0, Y1, GAP, PANEL_T, CARCASS_BACK, CARCASS_FRONT, OPENING_TOP, CELLS, COLUMNS, ROWS,
} from './drawer-geometry.js';

export { DRAWER_COUNT, DRAWER_TRAVEL, CELLS } from './drawer-geometry.js';

const box = (mesh, x0, x1, y0, y1, z0, z1) =>
  addPrism(mesh, [[x0, y0], [x1, y0], [x1, y1], [x0, y1]], z0, z1, PALETTE.side, { top: true, bottom: true });

// Каркас блока: задняя стенка, перегородки, полки, дно и верх. Фасады накладные,
// поэтому весь каркас стоит за ними: между ящиками видна только теневая щель
// GAP, а не торцы полок. Панели стоят по оси щели и держат неподвижные звенья
// направляющих.
export function buildDrawerCarcass(mesh) {
  // Задняя стенка видна, когда ящик выдвинут: та же серая облицовка, что боковины.
  addQuad(mesh, [CARCASS_BACK, Y0, PLINTH], [CARCASS_BACK, Y1, PLINTH],
    [CARCASS_BACK, Y1, UNDER_1], [CARCASS_BACK, Y0, UNDER_1], PALETTE.side);

  // Перегородки между колонками и полки между рядами — по оси щели между фасадами.
  for (let c = 1; c < COLUMNS; c++) {
    const y = (CELLS[c - 1].y1 + CELLS[c].y0) / 2;
    box(mesh, CARCASS_BACK, CARCASS_FRONT, y - PANEL_T / 2, y + PANEL_T / 2, PLINTH, OPENING_TOP - GAP / 2 - PANEL_T / 2);
  }
  for (let r = 1; r < ROWS; r++) {
    const z = (CELLS[(r - 1) * COLUMNS].z1 + CELLS[r * COLUMNS].z0) / 2;
    box(mesh, CARCASS_BACK, CARCASS_FRONT, Y0, Y1, z - PANEL_T / 2, z + PANEL_T / 2);
  }

  // Верх: за фасадами панель по оси верхней щели, а над ней, до плоскости
  // стенки, — заполнение под полосой стенки над проёмом. Нижняя грань этого
  // заполнения и есть верхний откос проёма, видимый в щели.
  const topZ = OPENING_TOP - GAP / 2 - PANEL_T / 2;
  box(mesh, CARCASS_BACK, CARCASS_FRONT, Y0, Y1, topZ, UNDER_1);
  box(mesh, CARCASS_FRONT, X - 1, Y0, Y1, OPENING_TOP, UNDER_1);
  // Дно корпуса лежит на цоколе (лист 29): от +100 до +116, кромкой за фасадами.
  // Ниже +100 — только утопленная панель цоколя, плита в выемку не выходит.
  box(mesh, CARCASS_BACK, CARCASS_FRONT, Y0, Y1, PLINTH, PLINTH + CARCASS_BOTTOM);

  // Боковины: за фасадами — панель до оси крайней щели, у стенки — откос проёма.
  const sideT = CELLS[0].y0 - Y0 + PANEL_T / 2 - GAP / 2;
  box(mesh, CARCASS_BACK, CARCASS_FRONT, Y0, Y0 + sideT, PLINTH, topZ);
  box(mesh, CARCASS_BACK, CARCASS_FRONT, Y1 - sideT, Y1, PLINTH, topZ);
  addQuad(mesh, [CARCASS_FRONT, Y0, PLINTH], [X, Y0, PLINTH], [X, Y0, OPENING_TOP], [CARCASS_FRONT, Y0, OPENING_TOP], PALETTE.side);
  addQuad(mesh, [X, Y1, PLINTH], [CARCASS_FRONT, Y1, PLINTH], [CARCASS_FRONT, Y1, OPENING_TOP], [X, Y1, OPENING_TOP], PALETTE.side);
}
