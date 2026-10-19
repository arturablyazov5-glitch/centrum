// Мини-холодильник в угловом модуле наружного фасада: ниша, стеклянная дверь на
// петле по дальней кромке (открывается наружу, как на виде 08), прибор за стеклом,
// съёмный поддон с датчиком воды и сухой электроотсек с розеткой за нишей.

import { SIZE, UNDER_1, PLINTH, CARCASS_BOTTOM, FRIDGE_Y, FRIDGE_DEPTH, FRIDGE_HEIGHT } from './params.js';
import { addQuad, addPrism, addPolygon, addTube } from './mesh.js';
import { PALETTE } from './palette.js';
import { FRIDGE_SOCKET } from './electrics.js';

const X = SIZE;                 // плоскость наружного фасада
const DEPTH = FRIDGE_DEPTH;
const DOOR_T = 34;              // толщина дверной панели; наружная грань заподлицо с фасадом
const [Y0, Y1] = FRIDGE_Y;
const Z0 = PLINTH + CARCASS_BOTTOM; // дно ниши — на дне корпуса над цоколем
const Z1 = Z0 + FRIDGE_HEIGHT;
const DOOR_Z0 = PLINTH;             // дверь, как и фасады ящиков, закрывает кромку дна
const DOOR_Z1 = UNDER_1;            // и две плиты над нишей: проём идёт до низа столешницы

// Ось петли — у дальнего от ящиков края двери, поэтому дверь открывается «от угла».
export const FRIDGE_HINGE = [X - DOOR_T, Y0, 0];
export const FRIDGE_OPEN_DEG = 105;

// Ниша: боковые стенки, дно, потолок, задняя стенка и полки.
export function buildFridgeCavity(mesh) {
  const back = X - DEPTH;
  addQuad(mesh, [back, Y0, Z0], [back, Y1, Z0], [back, Y1, Z1], [back, Y0, Z1], PALETTE.fridge);
  addQuad(mesh, [back, Y0, Z0], [X, Y0, Z0], [X, Y0, Z1], [back, Y0, Z1], PALETTE.fridge);
  addQuad(mesh, [back, Y1, Z0], [X, Y1, Z0], [X, Y1, Z1], [back, Y1, Z1], PALETTE.fridge);
  addQuad(mesh, [back, Y0, Z0], [X, Y0, Z0], [X, Y1, Z0], [back, Y1, Z0], PALETTE.fridge);
  addQuad(mesh, [back, Y0, Z1], [X, Y0, Z1], [X, Y1, Z1], [back, Y1, Z1], PALETTE.fridge);
  // Кромка дна корпуса за дверью: видна, когда дверь открыта.
  const edge = X - DOOR_T - 1;
  addQuad(mesh, [edge, Y0, DOOR_Z0], [edge, Y1, DOOR_Z0], [edge, Y1, Z0], [edge, Y0, Z0], PALETTE.side);
  addQuad(mesh, [edge, Y0, Z0], [X, Y0, Z0], [X, Y1, Z0], [edge, Y1, Z0], PALETTE.fridge);
  // Кромка плит над нишей — так же за дверью.
  addQuad(mesh, [edge, Y0, Z1], [edge, Y1, Z1], [edge, Y1, DOOR_Z1], [edge, Y0, DOOR_Z1], PALETTE.side);
  // Полок в нише нет: её занимает прибор (buildFridgeUnit), полки — у него внутри.
}

// Дверь: стеклянная панель в раме, с вертикальной ручкой у свободной кромки.
export function buildFridgeDoor(mesh) {
  const inner = X - DOOR_T;
  const frame = 30;
  addPrism(mesh, [[inner, Y0], [X, Y0], [X, Y1], [inner, Y1]], DOOR_Z0, DOOR_Z1, PALETTE.glass, { top: true, bottom: true });
  // Рама по периметру: узкие непрозрачные полосы поверх стекла, без нахлёста в углах.
  const strip = (y0, y1, z0, z1) => addQuad(mesh, [X + 1, y0, z0], [X + 1, y1, z0], [X + 1, y1, z1], [X + 1, y0, z1], PALETTE.gap);
  strip(Y0, Y0 + frame, DOOR_Z0 + frame, DOOR_Z1 - frame);
  strip(Y1 - frame, Y1, DOOR_Z0 + frame, DOOR_Z1 - frame);
  strip(Y0, Y1, DOOR_Z0, DOOR_Z0 + frame);
  strip(Y0, Y1, DOOR_Z1 - frame, DOOR_Z1);
  // Вертикальная ручка у кромки, противоположной петле: единственное, что выступает за фасад.
  const handle = (y0, y1, x1) => addPrism(mesh, [[X, y0], [x1, y0], [x1, y1], [X, y1]], 250, 520, PALETTE.gap, { top: true, bottom: true });
  handle(Y1 - 96, Y1 - 58, X + 46);
  // Две стойки, на которых ручка держится: без них она выглядела бы приклеенной.
  for (const z of [268, 502])
    addPrism(mesh, [[X, Y1 - 88], [X + 24, Y1 - 88], [X + 24, Y1 - 66], [X, Y1 - 66]], z, z + 20, PALETTE.gap, { top: true });
}

export function fridgeDoorEdges() {
  return [[[X + 3, Y0, DOOR_Z0], [X + 3, Y1, DOOR_Z0], [X + 3, Y1, DOOR_Z1], [X + 3, Y0, DOOR_Z1]]];
}

// ─── Содержимое ниши — листы 08 и 11 ─────────────────────────────────────────
// Контур прибора условный: модель клиент выбирает сам, «зазоры и площадь решёток —
// по паспорту» (лист 11). Здесь — компактный прибор, который занимает нишу за
// вычетом зазоров: приток спереди снизу, выброс назад-вверх (лист 08, вид 02).
const BACK = X - DEPTH;             // 2240 — задняя стенка ниши
const DOOR_IN = X - DOOR_T;         // 2666 — изнанка стеклянной двери
// Поддон: лист 1,5, борт 25, 4 от стенок ниши и 6 до изнанки двери — вынимается
// спереди при открытой двери. Прибор стоит в нём на своих ножках.
export const FRIDGE_TRAY = { x: [BACK + 4, DOOR_IN - 6], y: [Y0 + 4, Y1 - 4], z: [Z0, Z0 + 25], sheet: 1.5 };
// Прибор: 470 × 302 × 474,5 на ножках 20. Сбоку по 15 от стенок ниши, сзади 90 —
// канал выброса, сверху 116 до потолка ниши, спереди 24 от ручки до стекла.
export const FRIDGE_UNIT = { x: [BACK + 90, DOOR_IN - 34], y: [Y0 + 15, Y1 - 15], z: [Z0 + 1.5 + 20, Z1 - 116] };
// Сухой электроотсек — стальной короб за задней стенкой ниши, выше поддона (лист 08:
// «230 В вне ниши», «розетка и соединения — в отдельном сухом отсеке, выше поддона»).
// Розетка — FRIDGE_SOCKET из electrics.js, линия W3 входит в короб с тыла на +200.
export const FRIDGE_DRY = { x: [BACK - 120, BACK - 2], y: [Y0, Y0 + 150], z: [Z0 + 30, Z0 + 180] };

const cube = (mesh, x0, x1, y0, y1, z0, z1, color) =>
  addPrism(mesh, [[x0, y0], [x1, y0], [x1, y1], [x0, y1]], z0, z1, color, { top: true, bottom: true });
// Круг лицом к +X или −X.
function discX(mesh, x, cy, cz, r, color, facing = 1, n = 24) {
  const pts = Array.from({ length: n }, (_, i) => {
    const t = (i / n) * Math.PI * 2;
    return [x, cy + r * Math.cos(t), cz + r * Math.sin(t)];
  });
  addPolygon(mesh, facing > 0 ? pts : pts.reverse(), color);
}

// Прибор — неподвижная группа: корпус, дверь прибора тёмным стеклом, решётка
// притока внизу, ручка, компрессорный горб сзади, ножки и шнур до ввода в стенке.
export function buildFridgeUnit(mesh) {
  const { x: [x0, x1], y: [y0, y1], z: [z0, z1] } = FRIDGE_UNIT;
  const front = x1 - 18;                     // лицо корпуса: дверь прибора 18 перед ним
  const kick = z0 + 40;                      // решётка притока — 40 снизу
  cube(mesh, x0, front, y0, y1, z0, z1, PALETTE.device);
  cube(mesh, front, x1, y0 + 2, y1 - 2, kick + 2, z1 - 2, PALETTE.bezel);
  cube(mesh, front - 4, x1 - 2, y0 + 5, y1 - 5, z0 + 2, kick, PALETTE.powder);
  for (let y = y0 + 20; y < y1 - 20; y += 12)
    cube(mesh, x1 - 2, x1 - 1.5, y, y + 5, z0 + 8, kick - 6, PALETTE.hardware);
  // Вертикальная ручка у свободной кромки, как у стеклянной двери стола.
  cube(mesh, x1, x1 + 10, y1 - 48, y1 - 36, z0 + 190, z0 + 400, PALETTE.railMiddle);
  // Компрессор и конденсатор — сзади внизу, в канале выброса.
  cube(mesh, x0 - 30, x0, y0 + 110, y1 - 110, z0 + 2, z0 + 122, PALETTE.rail);
  for (const x of [x0 + 30, front - 60]) for (const y of [y0 + 20, y1 - 50])
    cube(mesh, x, x + 30, y, y + 30, Z0 + FRIDGE_TRAY.sheet, z0, PALETTE.buffer);
  // Шнур: из горба назад и вдоль задней стенки к вводу напротив розетки.
  const [, sy, sz] = FRIDGE_SOCKET;
  const path = [[x0 - 30, y1 - 130, sz], [BACK + 8, y1 - 130, sz], [BACK + 8, sy, sz], [BACK, sy, sz]];
  for (let i = 0; i < path.length - 1; i++) addTube(mesh, path[i], path[i + 1], 3.5, PALETTE.cable, { sides: 8 });
}

// Съёмный поддон и датчик воды. Неподвижная группа: поддон вынимают руками, хода
// на направляющих у него нет.
export function buildFridgeTray(mesh) {
  const { x: [x0, x1], y: [y0, y1], z: [z0, z1], sheet: t } = FRIDGE_TRAY;
  const c = PALETTE.railMoving;
  cube(mesh, x0, x1, y0, y1, z0, z0 + t, c);
  cube(mesh, x0, x0 + t, y0, y1, z0, z1, c);
  cube(mesh, x1 - t, x1, y0, y1, z0, z1, c);
  cube(mesh, x0 + t, x1 - t, y0, y0 + t, z0, z1, c);
  cube(mesh, x0 + t, x1 - t, y1 - t, y1, z0, z1, c);
  // Язычок, за который поддон тянут на себя: он у переднего борта, по центру.
  const ym = (y0 + y1) / 2;
  cube(mesh, x1, x1 + 4, ym - 30, ym + 30, z1 - 12, z1, c);
  // Датчик протечки — шайба на дне у переднего угла, куда вода стечёт первой;
  // контакты снизу. Провод уходит в сухой отсек через тот же ввод, что и шнур.
  const sx = x1 - 60, sy = y1 - 40;
  cube(mesh, sx, sx + 40, sy - 15, sy + 15, z0 + t, z0 + t + 9, PALETTE.pom);
  cube(mesh, sx + 8, sx + 32, sy - 3, sy + 3, z0 + t + 9, z0 + t + 9.5, PALETTE.steel);
}

// Сухой электроотсек: закрытый стальной короб за нишей, в нём розетка на стенке
// ниши. В нише видна только резиновая втулка ввода, через неё идут шнур и провод датчика.
export function buildFridgeDry(mesh) {
  const { x: [x0, x1], y: [y0, y1], z: [z0, z1] } = FRIDGE_DRY;
  const t = 1.5;
  const c = PALETTE.powder;
  cube(mesh, x0, x1, y0, y1, z0, z0 + t, c);
  cube(mesh, x0, x1, y0, y1, z1 - t, z1, c);
  cube(mesh, x0, x1, y0, y0 + t, z0 + t, z1 - t, c);
  cube(mesh, x0, x1, y1 - t, y1, z0 + t, z1 - t, c);
  cube(mesh, x0, x0 + t, y0 + t, y1 - t, z0 + t, z1 - t, c);
  cube(mesh, x1 - t, x1, y0 + t, y1 - t, z0 + t, z1 - t, c);
  // Розетка на стенке со стороны ниши, лицом внутрь короба.
  const [sx, sy, sz] = FRIDGE_SOCKET;
  cube(mesh, sx - 11, x1 - t, sy - 22, sy + 22, sz - 22, sz + 22, PALETTE.pom);
  for (const dy of [-9.5, 9.5]) discX(mesh, sx - 11.3, sy + dy, sz, 2.4, PALETTE.audioVoid, -1, 10);
  // Сальник линии W3 в тыльной стенке и втулка ввода в стенке ниши.
  discX(mesh, x0 - 0.3, sy, sz, 9, PALETTE.buffer, -1);
  discX(mesh, BACK + 0.4, sy, sz, 12, PALETTE.buffer, 1);
  discX(mesh, BACK + 0.8, sy, sz, 5, PALETTE.audioVoid, 1, 16);
}
