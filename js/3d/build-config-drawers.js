// Конфигурируемые фасады занимают ту же фиксированную зону хранения, что и
// исходная сетка 3x3. Меняется только деление фасада; габарит корпуса неизменен.

import { createMesh, toBufferData } from './mesh.js';
import { buildDrawer } from './build-drawer.js';
import { gridCells } from './drawer-geometry.js';
import { mirrorBuffers } from './mirror.js';

function rowCounts(count) {
  const rows = Math.min(3, Math.ceil(count / 3));
  const base = Math.floor(count / rows);
  const extra = count % rows;
  return Array.from({ length: rows }, (_, index) => base + (index < extra ? 1 : 0));
}

const cellsFor = (count) => gridCells(rowCounts(count));

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
