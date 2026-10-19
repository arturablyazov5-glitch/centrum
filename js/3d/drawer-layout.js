// Ряды на фасаде и переменные панели каркаса для каждого количества ящиков.
// Конфигуратор 3D и смета используют одну и ту же раскладку.

import { PLINTH, UNDER_1, CARCASS_BOTTOM } from './params.js';
import {
  gridCells, Y0, Y1, PANEL_T, CARCASS_SIDE_T, CARCASS_BACK, CARCASS_FRONT,
} from './drawer-geometry.js';

const TOP_Z = UNDER_1 - PANEL_T;
const BOTTOM_Z = PLINTH + CARCASS_BOTTOM;

export function rowCountsFor(count) {
  const rows = Math.min(3, Math.ceil(count / 3));
  const base = Math.floor(count / rows);
  const extra = count % rows;
  return Array.from({ length: rows }, (_, index) => base + (index < extra ? 1 : 0));
}

export const cellsFor = (count) => gridCells(rowCountsFor(count));

// Возвращает точные габариты деталей-перегородок, которые строит 3D-каркас.
export function drawerPartitionPlan(cells) {
  const rows = [];
  for (const cell of cells) (rows[cell.row] ||= []).push(cell);

  const bounds = rows.map((row, r) => [
    r === 0 ? BOTTOM_Z : (rows[r - 1][0].z1 + row[0].z0) / 2,
    r === rows.length - 1 ? TOP_Z : (row[0].z1 + rows[r + 1][0].z0) / 2,
  ]);
  const key = (y) => y.toFixed(3);
  const runs = new Map();

  rows.forEach((row, r) => {
    for (let c = 1; c < row.length; c++) {
      const y = (row[c - 1].y1 + row[c].y0) / 2;
      const id = key(y);
      const list = runs.get(id) || runs.set(id, []).get(id);
      const last = list[list.length - 1];
      if (last && last.r === r - 1) {
        last.z1 = bounds[r][1];
        last.r = r;
      } else {
        list.push({ y, z0: bounds[r][0], z1: bounds[r][1], r });
      }
    }
  });

  const parts = [];
  for (const list of runs.values()) {
    for (const { y, z0, z1 } of list) {
      parts.push({
        kind: 'vertical',
        x0: CARCASS_BACK, x1: CARCASS_FRONT,
        y0: y - PANEL_T / 2, y1: y + PANEL_T / 2,
        z0, z1,
      });
    }
  }

  for (let r = 1; r < rows.length; r++) {
    if (rows[r].length === rows[r - 1].length) continue;
    const z = bounds[r][0];
    parts.push({
      kind: 'shelf',
      x0: CARCASS_BACK, x1: CARCASS_FRONT,
      y0: Y0 + CARCASS_SIDE_T, y1: Y1 - CARCASS_SIDE_T,
      z0: z - PANEL_T / 2, z1: z + PANEL_T / 2,
    });
  }

  return parts;
}
