// Схема электрики в 3D — «рентген» поверх корпуса, по слою на систему:
// 230 В (с уравниванием потенциалов), 24 В, звук 5.1 и данные. Всё берётся
// из electrics.js — тех же чисел, что на листах 12, 16 и 50.
//
// Слой рисуется поверх корпуса со своей глубиной (renderer.js, xray), чистым
// цветом. Чтобы коробки и кабели читались объёмными, цвет каждой грани
// заранее притемнён по её нормали — свет в схему не приходит.
//
// Цвета заданы здесь, а не в palette.js: палитра входит в отпечаток сцены
// Blender, а схема в Blender не едет (siteOnly).

import { addBox, addTube, addPrism, polygonNormal } from './mesh.js';
import {
  at, lines, TRAYS, BELT_JOINTS, EO, PANEL, PSU_LIGHT, PSU_TECH, CTRL_LIGHT, CTRL_TECH, TECH_SOCKETS,
  FRIDGE_SOCKET, RECEIVER, RECEIVER_SOCKETS, SUB, SPEAKERS, CASSETTE, POST_FRAMES, QI, LED_FEEDS, LED_R, LED_Z, arc,
} from './electrics.js';
import { SOCKET_FRAME, SOCKET_Z, QI_D } from './sockets.js';
import { SPEAKER_Z } from './build-speakers.js';
import { CENTER, LEVEL_1 } from './params.js';
import { MIC_HATCH, MIC_CONDUIT, micConduitPath, micSleeve } from './mic-hatch.js';
import { AUDIO_ROUTE, audioTubePath, audioRoutePath } from './audio-routes.js';
import { HP_HUB, DOCK_R } from './electrics.js';
import { AUDIO_PANELS } from './audio-panels.js';

const hex = (s) => [1, 3, 5].map((i) => parseInt(s.slice(i, i + 2), 16) / 255);
export const ELEC_COLORS = {
  '230': hex('#e5484d'),
  pe: hex('#b8d43a'),
  '24': hex('#f2a33a'),
  audio: hex('#3fbf8f'),
  data: hex('#4ea3e6'),
};
const dim = (c, k) => c.map((v) => v * k);
const RADIUS = { '230': 6, pe: 3.5, '24': 4.5, audio: 4.5, data: 5.5 };

// Слои и что в них: у силового — ещё жёлто-зелёный PE.
export const ELEC_LAYERS = [
  { id: '230', name: '230 В', systems: ['230', 'pe'] },
  { id: '24', name: '24 В', systems: ['24'] },
  { id: 'audio', name: 'Звук 5.1', systems: ['audio'] },
  { id: 'data', name: 'Данные', systems: ['data'] },
];

// Коробка вдоль радиуса: от r0 до r1, по дуге ±half, по высоте z0…z1.
function radialBox(mesh, a, [r0, r1], half, [z0, z1], color) {
  const rad = [Math.cos(a * Math.PI / 180), Math.sin(a * Math.PI / 180)];
  const tan = [-rad[1], rad[0]];
  const p = (r, t) => [CENTER + rad[0] * r + tan[0] * t, CENTER + rad[1] * r + tan[1] * t];
  addPrism(mesh, [p(r0, -half), p(r1, -half), p(r1, half), p(r0, half)], z0, z1, color, { top: true, bottom: true });
}
const box = (mesh, b, color) => addBox(mesh, b.x, b.y, b.z, color);
const cube = (mesh, [x, y, z], s, color) => addBox(mesh, [x - s, x + s], [y - s, y + s], [z - s, z + s], color);

function polyline(mesh, path, radius, color) {
  for (let i = 0; i < path.length - 1; i++) {
    if (Math.hypot(...path[i + 1].map((v, k) => v - path[i][k])) < 0.5) continue;
    addTube(mesh, path[i], path[i + 1], radius, color, { sides: 8 });
  }
}

// Корпус отсека — рёбрами, чтобы внутри было видно щит и блоки.
function frame(mesh, b, radius, color) {
  const [x0, x1] = b.x, [y0, y1] = b.y, [z0, z1] = b.z;
  for (const [y, z] of [[y0, z0], [y1, z0], [y0, z1], [y1, z1]]) addTube(mesh, [x0, y, z], [x1, y, z], radius, color, { sides: 6 });
  for (const [x, z] of [[x0, z0], [x1, z0], [x0, z1], [x1, z1]]) addTube(mesh, [x, y0, z], [x, y1, z], radius, color, { sides: 6 });
  for (const [x, y] of [[x0, y0], [x1, y0], [x0, y1], [x1, y1]]) addTube(mesh, [x, y, z0], [x, y, z1], radius, color, { sides: 6 });
}

// Лоток — корытце под кабелями: дно и два борта по дуге, на стыках пояса — разъёмы.
function tray(mesh, t, color) {
  const pts = arc(t, t.from, t.to);
  const step = (t.to - t.from) / (pts.length - 1);
  for (let i = 0; i < pts.length - 1; i++) {
    const a = t.from + step * (i + 0.5);
    const half = (t.r * Math.abs(step) * Math.PI) / 360 + 0.5;
    radialBox(mesh, a, [t.r - 22, t.r + 22], half, [t.z - 12, t.z - 9], color);
    radialBox(mesh, a, [t.r - 22, t.r - 19], half, [t.z - 12, t.z + 8], color);
    radialBox(mesh, a, [t.r + 19, t.r + 22], half, [t.z - 12, t.z + 8], color);
  }
  for (const a of BELT_JOINTS.filter((j) => j > t.from && j < t.to)) radialBox(mesh, a, [t.r - 16, t.r + 16], 30, [t.z - 8, t.z + 14], dim(color, 0.7));
}

// Притемнение граней по нормали: верх светлее, низ темнее, бока — по стороне.
const LIGHT = (() => { const l = [0.35, -0.45, 0.82]; const n = Math.hypot(...l); return l.map((v) => v / n); })();
function shade(mesh) {
  for (let i = 0; i < mesh.position.length; i += 9) {
    const tri = [0, 3, 6].map((o) => mesh.position.slice(i + o, i + o + 3));
    const n = polygonNormal(tri) || [0, 0, 1];
    const k = 0.62 + 0.38 * Math.abs(n[0] * LIGHT[0] + n[1] * LIGHT[1] + n[2] * LIGHT[2]);
    for (let j = i; j < i + 9; j++) mesh.color[j] *= k;
  }
}

function buildSystem(mesh, system) {
  const c = ELEC_COLORS[system];
  const device = dim(c, 0.62);
  if (system === '230') {
    frame(mesh, EO, 3, device);
    box(mesh, PANEL, device);
    box(mesh, TECH_SOCKETS, device);
    cube(mesh, FRIDGE_SOCKET, 22, device);
    box(mesh, RECEIVER_SOCKETS, device);
    // Подрозетники постов — под все места MAX, как отверстия в стенке.
    const half = SOCKET_FRAME / 2 - 4;
    for (const f of POST_FRAMES) radialBox(mesh, f.a, [1152, 1197], half, [SOCKET_Z - half, SOCKET_Z + half], f.kind === 'P' ? device : dim(ELEC_COLORS['24'], 0.62));
    tray(mesh, TRAYS.power, dim(c, 0.45));
  }
  if (system === '24') {
    for (const b of [PSU_LIGHT, PSU_TECH, CTRL_LIGHT, CTRL_TECH]) box(mesh, b, device);
    for (const f of LED_FEEDS) cube(mesh, at(LED_R, f.a, LED_Z - 4), 14, device);
    for (const q of QI) addTube(mesh, at(q.r, q.a, LEVEL_1 - 45), at(q.r, q.a, LEVEL_1 + 2), QI_D / 2, device, { sides: 20 });
    tray(mesh, TRAYS.low, dim(c, 0.45));
  }
  if (system === 'audio') {
    box(mesh, RECEIVER, device);
    box(mesh, SUB, device);
    for (const s of SPEAKERS) radialBox(mesh, s.a, [CASSETTE.r, CASSETTE.r + CASSETTE.depth], CASSETTE.w / 2, [SPEAKER_Z - CASSETTE.w / 2, SPEAKER_Z + CASSETTE.w / 2], device);
  }
  if (system === 'data') {
    tray(mesh, TRAYS.data, dim(c, 0.45));
    cube(mesh, at(DOCK_R, 270, TRAYS.data.z), 20, device);
    // Микрофон (mic-hatch.js, лист 51): закладные трубы в сотах кольца от люков,
    // камера и гильза в Tech Bay, дальше кабель клиента по задней стенке к рычагу.
    const tube = dim(c, 0.55);
    for (const theta of MIC_HATCH.angles) polyline(mesh, micConduitPath(theta), MIC_CONDUIT.tube[0] / 2, tube);
    const [top, bottom] = micSleeve();
    addTube(mesh, top, bottom, MIC_CONDUIT.sleeve[0] / 2, tube, { sides: 12 });
    polyline(mesh, [bottom, [bottom[0], bottom[1], 700], [bottom[0], 540, 700], [300, 540, 700]], RADIUS.data, c);
    cube(mesh, [300, 540, 700], RADIUS.data + 5, dim(c, 0.8));
    // Жгуты панелей для наушников (audio-routes.js): трубы в сотах кольца и дальше
    // по корпусу, поясу и шахте к распределителю в Tech Bay.
    for (const { id } of AUDIO_PANELS) {
      polyline(mesh, audioTubePath(id).slice(2), AUDIO_ROUTE.tube[0] / 2, tube);
      polyline(mesh, audioRoutePath(id), AUDIO_ROUTE.harness / 2, c);
    }
    cube(mesh, AUDIO_ROUTE.distributor, 30, device);
    { const [x, y, z] = HP_HUB.at, [a, b, h] = HP_HUB.size; addBox(mesh, [x - a / 2, x + a / 2], [y - b / 2, y + b / 2], [z - h / 2, z + h / 2], device); }
  }
  for (const line of lines().filter((l) => l.system === system)) {
    polyline(mesh, line.path, RADIUS[system], c);
    cube(mesh, line.path.at(-1), RADIUS[system] + 5, dim(c, 0.8));
  }
}

export const buildElectrics = (layer) => (mesh) => {
  for (const system of ELEC_LAYERS.find((l) => l.id === layer).systems) buildSystem(mesh, system);
  shade(mesh);
};
