// Конфигурируемые фасады занимают ту же фиксированную зону хранения, что и
// исходная сетка 3x3. Меняется только деление фасада; габарит корпуса неизменен.

import { createMesh, toBufferData } from './mesh.js';
import { buildDrawer } from './build-drawer.js';
import { Y0, Y1, GAP, DRAWER_TOP } from './drawer-geometry.js';
import { PLINTH } from './params.js';
import { mirrorBuffers } from './mirror.js';

function rowCounts(count) {
  const rows = Math.min(3, Math.ceil(count / 3));
  const base = Math.floor(count / rows);
  const extra = count % rows;
  return Array.from({ length: rows }, (_, index) => base + (index < extra ? 1 : 0));
}

function cellsFor(count) {
  const rows = rowCounts(count);
  const height = (DRAWER_TOP - PLINTH - GAP * (rows.length - 1)) / rows.length;
  const cells = [];
  rows.forEach((columns, row) => {
    const width = (Y1 - Y0 - GAP * (columns - 1)) / columns;
    for (let column = 0; column < columns; column++) {
      const y0 = Y0 + column * (width + GAP);
      const z0 = PLINTH + row * (height + GAP);
      cells.push({ index: cells.length, column, row, y0, y1: y0 + width, z0, z1: z0 + height });
    }
  });
  return cells;
}

export function buildConfigDrawerGroups() {
  return Array.from({ length: 9 }, (_, index) => {
    const count = index + 1;
    const mesh = createMesh();
    for (const cell of cellsFor(count)) buildDrawer(mesh, cell);
    return {
      name: `config-drawers-${count}`,
      mesh: mirrorBuffers(toBufferData(mesh)),
      lines: null,
      visible: count === 3,
    };
  });
}
