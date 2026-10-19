// Дверца аудиомодуля АМ (опция 5.1) на левом боку, в хвосте К7 — лист 16,
// «дверца с решёткой». Проём и сама дверца — по RECEIVER_DOOR из electrics.js
// (грань x = 0, координаты до отражения, mirror.js).
//
// Дверца — глухая панель заподлицо со стенкой, снимается целиком, держится на
// магнитах, как решётки динамиков (решено 28.09.2026, лист 16, вид 06).
// Лицо панели — графитовая панель корпуса с перфорацией Ø6 шаг 10 в шахматном
// порядке: через неё выходят звук и тепло ресивера. Перфорацию рисует шейдер
// по метке цвета PALETTE.receiverGrille (renderer.js, update-graphite-metal-geometry.py),
// в геометрии отверстий нет — тот же приём, что у решёток 5.1 (build-speakers.js).
// Без опции в проёме стоит такая же панель без перфорации — заглушка.

import { addPrism, addQuad } from './mesh.js';
import { PALETTE } from './palette.js';
import { RECEIVER_DOOR, RECEIVER } from './electrics.js';

export const DOOR_GAP = 1.5;           // зазор по контуру — тень, как у швов корпуса (seams.js)
export const DOOR_T = 16;              // толщина панели
export const GRILLE_MARGIN = 20;       // сплошной край от кромки дверцы до поля перфорации
export const HOLE_D = 6, HOLE_PITCH = 10;

// Панель внутри проёма с зазором по контуру.
export const DOOR_PANEL = {
  y: [RECEIVER_DOOR.y[0] + DOOR_GAP, RECEIVER_DOOR.y[1] - DOOR_GAP],
  z: [RECEIVER_DOOR.z[0] + DOOR_GAP, RECEIVER_DOOR.z[1] - DOOR_GAP],
};
// Поле перфорации: центр и полуразмеры по y и z (мм).
export const GRILLE_FIELD = {
  center: [(DOOR_PANEL.y[0] + DOOR_PANEL.y[1]) / 2, (DOOR_PANEL.z[0] + DOOR_PANEL.z[1]) / 2],
  half: [(DOOR_PANEL.y[1] - DOOR_PANEL.y[0]) / 2 - GRILLE_MARGIN, (DOOR_PANEL.z[1] - DOOR_PANEL.z[0]) / 2 - GRILLE_MARGIN],
};

// Откосы проёма в стенке — до лица ресивера (RECEIVER.x[0]); глубже — ниша АМ.
// Строятся в корпусе: проём есть в каждом столе, с опцией и без.
export function buildReceiverJambs(mesh) {
  const [y0, y1] = RECEIVER_DOOR.y, [z0, z1] = RECEIVER_DOOR.z;
  const x1 = RECEIVER.x[0];
  const c = PALETTE.side;
  addQuad(mesh, [0, y0, z0], [x1, y0, z0], [x1, y1, z0], [0, y1, z0], c);
  addQuad(mesh, [0, y1, z1], [x1, y1, z1], [x1, y0, z1], [0, y0, z1], c);
  addQuad(mesh, [0, y0, z1], [x1, y0, z1], [x1, y0, z0], [0, y0, z0], c);
  addQuad(mesh, [0, y1, z0], [x1, y1, z0], [x1, y1, z1], [0, y1, z1], c);
  // Дно ниши за дверцей — тёмное лицо ресивера, в зазор виден только он.
  addQuad(mesh, [x1, y0, z0], [x1, y0, z1], [x1, y1, z1], [x1, y1, z0], PALETTE.hardware);
}

// Панель дверцы: grille — с перфорацией (опция 5.1), иначе глухая заглушка.
export const buildReceiverDoor = (grille) => (mesh) => {
  const [y0, y1] = DOOR_PANEL.y, [z0, z1] = DOOR_PANEL.z;
  addPrism(mesh, [[0, y0], [DOOR_T, y0], [DOOR_T, y1], [0, y1]], z0, z1,
    grille ? PALETTE.receiverGrille : PALETTE.side, { top: true, bottom: true });
};

// Контур дверцы для линейного слоя сайта — как у фасадов ящиков, в 2 мм перед гранью.
export function receiverDoorEdges() {
  const [y0, y1] = DOOR_PANEL.y, [z0, z1] = DOOR_PANEL.z;
  return [[[-2, y0, z0], [-2, y1, z0], [-2, y1, z1], [-2, y0, z1]]];
}
