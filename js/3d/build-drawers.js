// Блок ящиков на наружном фасаде: сетка 3 × 3 на участке шириной 1600.
// Сам ящик описан один раз в build-drawer.js — здесь только его размещение.

import { UNDER_1, PLINTH, CARCASS_BOTTOM } from './params.js';
import { addQuad, addPrism } from './mesh.js';
import { PALETTE } from './palette.js';
import {
  X_FACE as X, Y0, Y1, PANEL_T, CARCASS_SIDE_T as SIDE_T,
  CARCASS_BACK, CARCASS_FRONT, OPENING_TOP, CELLS,
} from './drawer-geometry.js';
import { drawerPartitionPlan } from './drawer-layout.js';

export { DRAWER_COUNT, DRAWER_TRAVEL, CELLS } from './drawer-geometry.js';

const TOP_Z = UNDER_1 - PANEL_T;
const BOTTOM_Z = PLINTH + CARCASS_BOTTOM;

const box = (mesh, x0, x1, y0, y1, z0, z1) =>
  addPrism(mesh, [[x0, y0], [x1, y0], [x1, y1], [x0, y1]], z0, z1, PALETTE.side, { top: true, bottom: true });

// Каркас блока: задняя стенка, перегородки, дно и верх. Фасады накладные,
// поэтому весь каркас стоит за ними, а между ящиками видна только теневая щель
// GAP. В сетке 3 × 3 полок между рядами нет: неподвижные звенья направляющих
// привинчены к перегородкам и боковинам.
export function buildDrawerCarcass(mesh) {
  buildDrawerShell(mesh);
  buildDrawerPartitions(mesh, CELLS);
}

// Корпус блока без перегородок: задняя стенка, верх, дно, боковины, откосы.
export function buildDrawerShell(mesh) {
  // Задняя стенка видна, когда ящик выдвинут: та же серая облицовка, что боковины.
  addQuad(mesh, [CARCASS_BACK, Y0, PLINTH], [CARCASS_BACK, Y1, PLINTH],
    [CARCASS_BACK, Y1, UNDER_1], [CARCASS_BACK, Y0, UNDER_1], PALETTE.side);

  // Верх корпуса — под столешницей, кромкой за верхним рядом фасадов.
  box(mesh, CARCASS_BACK, CARCASS_FRONT, Y0, Y1, TOP_Z, UNDER_1);
  // Дно корпуса лежит на цоколе (лист 29): от +100 до +116, кромкой за фасадами.
  // Ниже +100 — только утопленная панель цоколя, плита в выемку не выходит.
  box(mesh, CARCASS_BACK, CARCASS_FRONT, Y0, Y1, PLINTH, BOTTOM_Z);

  // Боковины: за фасадами — панель до оси крайней щели, у стенки — откос проёма.
  box(mesh, CARCASS_BACK, CARCASS_FRONT, Y0, Y0 + SIDE_T, BOTTOM_Z, TOP_Z);
  box(mesh, CARCASS_BACK, CARCASS_FRONT, Y1 - SIDE_T, Y1, BOTTOM_Z, TOP_Z);
  addQuad(mesh, [CARCASS_FRONT, Y0, PLINTH], [X, Y0, PLINTH], [X, Y0, OPENING_TOP], [CARCASS_FRONT, Y0, OPENING_TOP], PALETTE.side);
  addQuad(mesh, [X, Y1, PLINTH], [CARCASS_FRONT, Y1, PLINTH], [CARCASS_FRONT, Y1, OPENING_TOP], [X, Y1, OPENING_TOP], PALETTE.side);
}

// Перегородки под любое деление фасада. Каждая стоит по оси щели между
// фасадами своего ряда; если у соседних рядов щель на той же оси, перегородка
// идёт сквозь них одной панелью. Где число колонок в соседних рядах разное,
// между рядами встаёт полка — иначе перегородке верхнего ряда не на чем стоять.
export function buildDrawerPartitions(mesh, cells) {
  for (const part of drawerPartitionPlan(cells)) {
    box(mesh, part.x0, part.x1, part.y0, part.y1, part.z0, part.z1);
  }
}
