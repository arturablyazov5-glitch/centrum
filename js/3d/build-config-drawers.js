// Конфигурируемые фасады занимают ту же фиксированную зону хранения, что и
// исходная сетка 3x3. Меняется только деление фасада; габарит корпуса неизменен.

import { createMesh, toBufferData } from './mesh.js';
import { buildDrawer, buildDrawerLed } from './build-drawer.js';
import { buildDrawerPartitions } from './build-drawers.js';
import { buildFixedSlide, buildMiddleSlide, buildInnerSlide } from './build-slides.js';
import { cellsFor } from './drawer-layout.js';
import { mirrorBuffers } from './mirror.js';
import { DRAWER_LED_COLOR } from './palette.js';

export function buildConfigDrawerGroups() {
  return Array.from({ length: 9 }, (_, index) => {
    const count = index + 1;
    const mesh = createMesh();
    // Короб с внутренним звеном направляющей: они едут вместе на весь ход.
    for (const cell of cellsFor(count)) { buildDrawer(mesh, cell); buildInnerSlide(mesh, cell); }
    return {
      name: `config-drawers-${count}`,
      mesh: mirrorBuffers(toBufferData(mesh)),
      lines: null,
      visible: count === 3,
    };
  });
}

// Каркас под каждый вариант деления: перегородки, полки между рядами с разным
// числом колонок и неподвижные звенья направляющих на них. Стоит на месте.
export function buildConfigCarcassGroups() {
  return Array.from({ length: 9 }, (_, index) => {
    const count = index + 1;
    const mesh = createMesh();
    const cells = cellsFor(count);
    buildDrawerPartitions(mesh, cells);
    for (const cell of cells) buildFixedSlide(mesh, cell);
    return { name: `config-drawers-carcass-${count}`, mesh: mirrorBuffers(toBufferData(mesh)), lines: null };
  });
}

// Промежуточные звенья с сепараторами: идут на половину хода ящиков.
export function buildConfigMiddleSlideGroups() {
  return Array.from({ length: 9 }, (_, index) => {
    const count = index + 1;
    const mesh = createMesh();
    for (const cell of cellsFor(count)) buildMiddleSlide(mesh, cell);
    return { name: `config-slides-middle-${count}`, mesh: mirrorBuffers(toBufferData(mesh)), lines: null };
  });
}

// Подсветка к каждому варианту деления: светится, только когда опция включена
// и ящики выдвинуты (viewer.js, setDrawerLighting).
export function buildConfigDrawerLedGroups() {
  return Array.from({ length: 9 }, (_, index) => {
    const count = index + 1;
    const mesh = createMesh();
    for (const cell of cellsFor(count)) buildDrawerLed(mesh, cell);
    return {
      name: `config-drawer-led-${count}`,
      mesh: mirrorBuffers(toBufferData(mesh)),
      lines: null,
      emissive: 0,
      emissiveColor: DRAWER_LED_COLOR,
      castShadow: false,
    };
  });
}
