// Шахта Tech Bay (TECH_SHAFT, 220 × 220 за задней стенкой отсека): гребёнка запаса
// кабелей мониторов (лист 48, вид В) и блок розеток Tech Bay (лист 16). Снаружи не
// видно ни того, ни другого даже при открытом отсеке — геометрия для полноты
// модели и для сцены Blender, без движения.

import { TECH_SHAFT, TECH_DEPTH, CENTER, UNDER_1 } from './params.js';
import { TECH_SOCKETS } from './electrics.js';
import { addPolygon, addPrism, addTube } from './mesh.js';
import { PALETTE } from './palette.js';

const box = (mesh, x0, x1, y0, y1, z0, z1, color) =>
  addPrism(mesh, [[x0, y0], [x1, y0], [x1, y1], [x0, y1]], z0, z1, color, { top: true, bottom: true });

// Круг в плоскости, перпендикулярной оси: 'x' — лицом к +X, 'y' — лицом к −Y.
function disc(mesh, [cx, cy, cz], r, axis, color, n = 24) {
  addPolygon(mesh, Array.from({ length: n }, (_, i) => {
    const t = (i / n) * Math.PI * 2;
    return axis === 'x' ? [cx, cy + r * Math.cos(t), cz + r * Math.sin(t)] : [cx + r * Math.cos(t), cy, cz + r * Math.sin(t)];
  }), color);
}

// ─── Гребёнка запаса: 8 роликов Ø120 × 10, шаг 12 ─────────────────────────────
// Четыре стойки × (видео + 230 В) — по ролику на кабель. Сверху ряд неподвижных
// роликов на общей оси, внизу подвижные, каждый в своём ползуне на своей пружине:
// стойки ездят по шине независимо. Запас — 4 ветви × 650 = 2600 на кабель, поэтому
// ползун ходит до 650 ниже неподвижной оси. Оси роликов — вдоль X, ряд стоит в
// силовой половине шахты у стороны угла (x до 336), мимо стояка 230 В (y = 715)
// и блока розеток у дальней стенки (y ≥ 760). Плита гребёнки — на тыльной стороне
// задней стенки отсека, ниже неё в шахту выходит щель кабельного рычага (251…301).
export const COMB = {
  rollers: 8, d: 120, t: 10, pitch: 12,
  x0: TECH_SHAFT.x[0] + 13,        // 229 — первый ролик, 1 мм от щеки
  y: TECH_DEPTH + 75,              // 640 — ось роликов, от плиты 69 = радиус 60 + зазор 9
  fixedZ: 1060,                    // неподвижная ось: верх ролика 1120, под лотком данных Л-Д на +1150
  travel: 650,                     // одна ветвь запаса
  plate: { y: [TECH_DEPTH + 2, TECH_DEPTH + 5], z: [330, 1130] },
};
// В базе одна стойка (build-model.js, monitorPost): её кабели — на роликах 1 и 2,
// видео и 230 В. Пустые ролики ждут докупленные стойки, их ползуны пружина держит
// внизу, на полном ходе. Высоты занятых — где их оставил переезд стойки: лишь
// положение в модели.
export const COMB_STANDS = 1;
// Канавка в листе стенки пояса за гребёнкой (решение владельца 28.09.2026,
// docs/monitor-mount п. 7). Ряд роликов стоит в поясе, а лист стенки кончается
// на R1212 (params.js, BELT_WALL): кабель последнего ролика сходит вниз вдоль
// листа в 3 мм от него. С тыла листа — канавка 40 × 8 на всю высоту листа до верха
// роликов с кабелем; лист там 10. Центр — на ветви последнего ролика. В 3D
// стенка — одна грань, канавка в модель не входит; её держит check-math.
export const COMB_GROOVE = {
  deg: Math.atan2(COMB.y + COMB.d / 2 - CENTER, COMB.x0 + (COMB.rollers - 1) * COMB.pitch + COMB.t / 2 - CENTER) * 180 / Math.PI + 90,
  w: 40, depth: 8, z: [UNDER_1, 1130],
};
const MOVING_DROP = [420, 470, 650, 650, 650, 650, 650, 650];
const COMB_X1 = COMB.x0 + (COMB.rollers - 1) * COMB.pitch + COMB.t; // 323
const CHEEK = [[COMB.x0 - 7, COMB.x0 - 1], [COMB_X1 + 1, COMB_X1 + 7]];
const BOTTOM_Z = COMB.fixedZ - COMB.travel - COMB.d / 2 - 12;   // 338 — упор пружин, над щелью рычага

function buildComb(mesh) {
  const { y, fixedZ, d, t, pitch, plate } = COMB;
  const r = d / 2;
  // Плита из оцинкованной стали и щёки неподвижной оси.
  box(mesh, CHEEK[0][0], CHEEK[1][1], ...plate.y, ...plate.z, PALETTE.steel);
  for (const [a, b] of CHEEK) box(mesh, a, b, plate.y[1], y + 14, fixedZ - 22, fixedZ + 22, PALETTE.steel);
  addTube(mesh, [CHEEK[0][0], y, fixedZ], [CHEEK[1][1], y, fixedZ], 4, PALETTE.steelDark, { sides: 12 });
  // Упорная планка пружин внизу.
  box(mesh, CHEEK[0][0], CHEEK[1][1], plate.y[1], y + 10, BOTTOM_Z - 8, BOTTOM_Z, PALETTE.steel);
  for (let i = 0; i < COMB.rollers; i++) {
    const x0 = COMB.x0 + i * pitch, x1 = x0 + t, xm = (x0 + x1) / 2;
    const z = fixedZ - MOVING_DROP[i];
    // Ролики — чёрный POM, ступица на оси.
    addTube(mesh, [x0, y, fixedZ], [x1, y, fixedZ], r, PALETTE.pom, { sides: 32 });
    addTube(mesh, [x0, y, z], [x1, y, z], r, PALETTE.pom, { sides: 32 });
    addTube(mesh, [x0 - 0.5, y, z], [x1 + 0.5, y, z], 5, PALETTE.steelDark, { sides: 12 });
    // Ползун: паз на плите и лапка к оси нижнего ролика.
    box(mesh, xm - 2, xm + 2, plate.y[1], plate.y[1] + 3, BOTTOM_Z, fixedZ - r - 6, PALETTE.rail);
    box(mesh, xm - 1.5, xm + 1.5, plate.y[1] + 3, y, z - 8, z + 8, PALETTE.rail);
    // Пружина — от оси нижнего ролика вниз к упору.
    addTube(mesh, [xm, y, z - 5], [xm, y, BOTTOM_Z], 2.2, PALETTE.steelDark, { sides: 8 });
  }
}

// ─── Кабели на роликах ────────────────────────────────────────────────────────
// Кабель приходит сверху, из окна пояса, по передней стороне ряда, огибает снизу
// нижний ролик, поднимается по задней стороне, огибает сверху верхний и делает
// второй такой же виток — это и есть 4 ветви. Второй виток сдвинут по оси на 5:
// в ширине ролика 10 лежат два витка кабеля Ø4,6. Из гребёнки кабель выходит сверху
// по задней стороне и спускается у дальней стенки шахты: 230 В — к блоку розеток,
// видео — вниз под плиту гребёнки и через щель кабельного рычага к ПК.
const CABLE_R = 2.3;
const WRAP = COMB.d / 2 + CABLE_R;               // 62,3 — ось кабеля от оси ролика
const FRONT = COMB.y - WRAP, REAR = COMB.y + WRAP;
const DROP_Y = TECH_SOCKETS.y[0] - 20;          // 740 — спуск у дальней стенки
const TOP_Z = 1190;                              // окно пояса над шахтой (+1196)
const ARM_SLOT_Z = 276;                          // середина щели кабельного рычага (251…301)
const SOCKET_STEP = (TECH_SOCKETS.z[1] - TECH_SOCKETS.z[0]) / TECH_SOCKETS.places;
// Места в блоке: экраны — сверху вниз, экран 1 в верхнем гнезде (линия W5 в
// electrics.js, +450), под ними резерв, внизу ПК (W6, +210).
const socketZ = (stand) => TECH_SOCKETS.z[1] - SOCKET_STEP * (stand + 0.5);
const PLUG = { r: 17, depth: 28 };

function polyTube(mesh, pts, r, color) {
  for (let i = 0; i < pts.length - 1; i++) addTube(mesh, pts[i], pts[i + 1], r, color, { sides: 10 });
}
// Полувиток вокруг оси (COMB.y, zc): снизу — спереди назад, сверху — сзади вперёд;
// x плавно идёт от xa к xb.
function halfTurn(zc, below, xa, xb, n = 16) {
  return Array.from({ length: n + 1 }, (_, i) => {
    const f = Math.PI * i / n;
    const x = xa + (xb - xa) * i / n;
    return below ? [x, COMB.y - WRAP * Math.cos(f), zc - WRAP * Math.sin(f)]
      : [x, COMB.y + WRAP * Math.cos(f), zc + WRAP * Math.sin(f)];
  });
}

function combCable(mesh, roller, tail) {
  const xm = COMB.x0 + roller * COMB.pitch + COMB.t / 2;
  const [xa, xb] = [xm - 2.5, xm + 2.5];
  const zm = COMB.fixedZ - MOVING_DROP[roller];
  const path = [
    [xa, FRONT, TOP_Z],
    ...halfTurn(zm, true, xa, xa),
    ...halfTurn(COMB.fixedZ, false, xa, xb),
    ...halfTurn(zm, true, xb, xb),
    [xb, REAR, COMB.fixedZ + 40], [xb, (REAR + DROP_Y) / 2, COMB.fixedZ + 62], [xb, DROP_Y, COMB.fixedZ + 50],
    ...tail(xb),
  ];
  polyTube(mesh, path, CABLE_R, PALETTE.cable);
}

function buildCombCables(mesh) {
  for (let stand = 0; stand < COMB_STANDS; stand++) {
    // Видео — к ПК: вниз под упорную планку и вперёд в щель рычага.
    combCable(mesh, 2 * stand, (x) => [[x, DROP_Y, ARM_SLOT_Z + 20], [x, DROP_Y - 20, ARM_SLOT_Z], [x, TECH_DEPTH + 1, ARM_SLOT_Z]]);
    // 230 В — в своё место блока розеток: над вилкой к оси гнезда и вниз в вилку.
    const zs = socketZ(stand), xs = (TECH_SOCKETS.x[0] + TECH_SOCKETS.x[1]) / 2;
    const yPlug = TECH_SOCKETS.y[0] - PLUG.depth / 2;
    combCable(mesh, 2 * stand + 1, (x) => [[x, DROP_Y, zs + PLUG.r + 40], [xs, yPlug, zs + PLUG.r + 20], [xs, yPlug, zs + PLUG.r]]);
    // Вилка в гнезде.
    addTube(mesh, [xs, TECH_SOCKETS.y[0] - PLUG.depth, zs], [xs, TECH_SOCKETS.y[0] - 0.8, zs], PLUG.r, PALETTE.pom, { sides: 24 });
  }
}

// ─── Блок розеток Tech Bay: 6 мест ────────────────────────────────────────────
// Лист 16: ПК, четыре экрана, резерв. Координаты — TECH_SOCKETS (electrics.js):
// вертикальная колодка 60 × 25 × 340 у дальней стенки шахты, в половине 230 В;
// гнёзда смотрят в шахту (−Y), шаг по высоте 340 / 6.
function buildSockets(mesh) {
  const { x: [x0, x1], y: [y0, y1], z: [z0, z1], places } = TECH_SOCKETS;
  box(mesh, x0, x1, y0, y1, z0, z1, PALETTE.hardware);
  const xm = (x0 + x1) / 2;
  const step = (z1 - z0) / places;
  for (let i = 0; i < places; i++) {
    const zm = z0 + step * (i + 0.5);
    disc(mesh, [xm, y0 - 0.3, zm], 19, 'y', PALETTE.pom, 32);         // гнездо Ø38
    for (const dx of [-9.5, 9.5]) disc(mesh, [xm + dx, y0 - 0.6, zm], 2.4, 'y', PALETTE.audioVoid, 10);
    for (const dz of [-17, 17]) box(mesh, xm - 4, xm + 4, y0 - 1, y0 - 0.4, zm + dz - 1.5, zm + dz + 1.5, PALETTE.steel); // заземляющие скобы
  }
}

export function buildTechBayShaft(mesh) {
  buildComb(mesh);
  buildCombCables(mesh);
  buildSockets(mesh);
}
