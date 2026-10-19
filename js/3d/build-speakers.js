// Решётки скрытой акустики 5.1 на внутренней стенке пояса R1150 — виды 24–26
// и acoustics-notes.md. Самих динамиков и кассет 240 × 240 × 150 в модели нет:
// они за стенкой. Снаружи видна только съёмная круглая решётка Ø180 на магнитах,
// облицованная тем же шпоном, что и стенка, с перфорацией Ø6 шаг 10 и чёрной
// акустической тканью за ней. Рисунок дерева идёт сквозь решётку без разрыва.
//
// Решётка повторяет кривизну стенки (стрела ≈3,5 мм на Ø180) и стоит поверх неё:
// лицо на 15 мм от стенки, вровень с рейками; по кромке фаска шириной 2 мм.
// Перфорацию рисует шейдер по цвету PALETTE.grille, в геометрии её нет.

import { CENTER, R_BELT_HIGH, LEVEL_1, LEVEL_2, TOP_THICK } from './params.js';
import { addPolygon, polygonNormal } from './mesh.js';
import { PALETTE } from './palette.js';

export const GRILLE_D = 180;
// Центр решётки — ровно посередине ниши между рабочей поверхностью +820 и низом
// верхней столешницы +1210: +1015. Сетка +925…1105, кассета 240 — +895…1135.
// На видах 24–25 пока стоит предварительная отметка +960*.
export const SPEAKER_Z = (LEVEL_1 + LEVEL_2 - TOP_THICK) / 2;
const PROUD = 15;                      // вровень с SLAT_PROUD в build-acoustic.js
const CHAMFER = 2;                     // фаска кромки по радиусу
const EDGE_GAP = PROUD - 2.5;          // край фаски позади лица решётки
const RINGS = 6;
const SECTORS = 48;

// Каналы относительно направления на экран (−Y), плюс — вправо от сидящего:
// L/R ±30°, C 0°, Ls/Rs ±100°. Раскладка симметрична относительно x = 1350,
// поэтому отражение сцены (mirror.js) её не меняет.
export const SPEAKER_CHANNELS = [
  { id: 'C', deg: 0 },
  { id: 'L', deg: -30 },
  { id: 'R', deg: 30 },
  { id: 'Ls', deg: -100 },
  { id: 'Rs', deg: 100 },
];

// Угол канала вокруг центра: экран лежит под 270°. Какая сторона «правая» после
// отражения — не важно, раскладка симметрична.
export const speakerAngle = (deg) => ((270 - deg) * Math.PI) / 180;

// Точка решётки: r, phi — полярные координаты на развёртке стенки, depth — отступ от стенки внутрь.
function grillePoint(angle, r, phi, depth) {
  const a = angle + (r * Math.cos(phi)) / R_BELT_HIGH;
  const radius = R_BELT_HIGH - depth;
  return [CENTER + radius * Math.cos(a), CENTER + radius * Math.sin(a), SPEAKER_Z + r * Math.sin(phi)];
}

// Все грани смотрят внутрь кольца, к сидящему: так их одинаково читают сайт и Blender.
function addFacing(mesh, pts, inward, color) {
  const n = polygonNormal(pts);
  if (!n) return;
  addPolygon(mesh, n[0] * inward[0] + n[1] * inward[1] >= 0 ? pts : pts.slice().reverse(), color);
}

function buildGrille(mesh, angle) {
  const inward = [-Math.cos(angle), -Math.sin(angle)];
  const face = GRILLE_D / 2 - CHAMFER;
  const phis = Array.from({ length: SECTORS }, (_, i) => (i / SECTORS) * Math.PI * 2);
  const ring = (r, depth) => phis.map((phi) => grillePoint(angle, r, phi, depth));

  let inner = ring(0, PROUD);
  for (let k = 1; k <= RINGS; k++) {
    const outer = ring((face * k) / RINGS, PROUD);
    for (let i = 0; i < SECTORS; i++) {
      const j = (i + 1) % SECTORS;
      if (k === 1) addFacing(mesh, [inner[0], outer[i], outer[j]], inward, PALETTE.grille);
      else addFacing(mesh, [inner[i], outer[i], outer[j], inner[j]], inward, PALETTE.grille);
    }
    inner = outer;
  }
  const foot = ring(GRILLE_D / 2, EDGE_GAP);
  for (let i = 0; i < SECTORS; i++) {
    const j = (i + 1) % SECTORS;
    addFacing(mesh, [inner[i], foot[i], foot[j], inner[j]], inward, PALETTE.grille);
  }
}

export function buildSpeakerGrilles(mesh) {
  for (const channel of SPEAKER_CHANNELS) buildGrille(mesh, speakerAngle(channel.deg));
}
