// Сборка всех частей CENTRUM в набор групп. Группа — это то, что можно отдельно
// показать, погасить или подвинуть: пол, корпус, ниши, LED, Bridge, дверь и ящики.

import { CENTER, LEVEL_1 } from './params.js';
import { createMesh, createLines, addPolyline, toBufferData } from './mesh.js';
import { clearOfEntry } from './entry-cut.js';
import { buildCore, coreEdges } from './build-core.js?v=20260921-03';
import { buildBridge, bridgeEdges } from './build-bridge.js';
import { buildBridgeFrame, buildBridgeFittings, buildStrutTube, buildStrutRod } from './bridge-fittings.js';
import { buildFridgeCavity, buildFridgeDoor, fridgeDoorEdges } from './build-fridge.js';
import { buildDrawerCarcass, CELLS } from './build-drawers.js';
import { buildDrawer, drawerEdges } from './build-drawer.js';
import { buildFixedSlides, buildMiddleSlide } from './build-slides.js';
import { buildLed } from './build-led.js';
import { buildFloor, floorGrid } from './build-floor.js?v=20260908-17';
import { PALETTE } from './palette.js?v=20260908-17';
import { mirrorBuffers } from './mirror.js';

// Кольцевой контур рисуется по частям: отрезки внутри прохода пропускаются.
function addRingEdges(lines, ring, color) {
  for (let i = 0; i < ring.length - 1; i++) {
    const seg = [ring[i], ring[i + 1]];
    if (clearOfEntry(seg)) addPolyline(lines, seg, color);
  }
}

function group(name, build, buildLines) {
  const mesh = createMesh();
  const lines = createLines();
  build(mesh);
  if (buildLines) buildLines(lines);
  // Пол симметричен, а предметы на столе построены уже в готовой сцене —
  // отражается только сам стол.
  const mirror = name !== 'floor';
  const buffers = toBufferData(mesh);
  const edges = toBufferData(lines);
  return { name, mesh: mirror ? mirrorBuffers(buffers) : buffers, lines: mirror ? mirrorBuffers(edges) : edges };
}

const outlines = (rects, color = PALETTE.ink) => (lines) => {
  for (const rect of rects) addPolyline(lines, rect, color, true);
};

export function buildModel() {
  const core = group('core', buildCore, (lines) => {
    for (const ring of coreEdges()) addRingEdges(lines, ring, PALETTE.ink);
  });

  const bridge = group('bridge', buildBridge, (lines) => {
    const { outline, bottom, handles } = bridgeEdges();
    addPolyline(lines, outline, PALETTE.ink, true);
    addPolyline(lines, bottom, PALETTE.inkSoft, true);
    for (const handle of handles) addPolyline(lines, handle, PALETTE.inkSoft, true);
  });

  // Фурнитура узла: опорный выступ и петля стоят на месте, проушины газлифтов
  // едут вместе с секцией, а корпус и шток газлифта — каждый по своей матрице.
  const bridgeFrame = group('bridge-frame', buildBridgeFrame);
  const bridgeFittings = group('bridge-fittings', buildBridgeFittings);
  const strutTube = group('bridge-strut-tube', buildStrutTube);
  const strutRod = group('bridge-strut-rod', buildStrutRod);

  const cavities = group('cavities', (mesh) => {
    buildFridgeCavity(mesh);
    buildDrawerCarcass(mesh);
    buildFixedSlides(mesh);
  });

  const fridgeDoor = group('fridge-door', buildFridgeDoor, outlines(fridgeDoorEdges()));

  // Каждый ящик сетки — отдельная подвижная группа, но геометрия у всех одна и та же.
  const drawers = [];
  const slides = [];
  for (const cell of CELLS) {
    drawers.push(group(`drawer-${cell.index}`, (mesh) => buildDrawer(mesh, cell), outlines(drawerEdges(cell))));
    slides.push(group(`slide-${cell.index}`, (mesh) => buildMiddleSlide(mesh, cell)));
  }

  // Та же единственная лента из паза: она светится сама и освещает рабочую
  // зону, но новой геометрии или второй ветви здесь не появляется.
  const led = { ...group('led', buildLed), emissive: 1, castShadow: false };
  // Пол только принимает тени. Все остальные текущие и будущие группы получают
  // castShadow=true автоматически в renderer.prepare().
  const floor = { ...group('floor', buildFloor, floorGrid), castShadow: false };

  return {
    // Центр вращения: середина пятна чуть выше пола — так модель целиком попадает в кадр.
    pivot: [CENTER, CENTER, LEVEL_1 * 0.3],
    groups: [floor, core, cavities, led, ...slides, ...drawers, fridgeDoor,
      bridgeFrame, bridge, bridgeFittings, strutTube, strutRod],
  };
}
