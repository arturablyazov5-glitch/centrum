// Сервисный доступ в К2 (решения владельца 28.09.2026, лист 35).
//
// Стыки К1|К2 и К2|К3 тянут изнутри К2 тремя винтами М6. Раньше к ним подходили
// через съёмный Bay, теперь его нет, а через дверцу ЭО не достать (342 вбок).
// Поэтому у каждого конца К2 в стенке ниши ног R1050 — съёмная панель ≈ 174 × 410:
// θ 20…29,5° от оси экрана, +160…+570. Верх на 20 ниже полки кронштейна
// У4 ±26,7° (+590…+760), край в ≈ 21 от торца К2, колени сидящего — у оси,
// ≈ ±12°. Панель вровень со стенкой и того же цвета: снаружи видны только шов 3
// по контуру и четыре невыпадающих винта М4. Через неё же — винты У6 у концов К2.
//
// Дверца ЭО (build-eo-door.js) держится так же: четыре невыпадающих винта М4
// по углам — предложение в духе панелей, петель, магнитов и замка нет.
//
// θ — от оси экрана, плюс вправо от сидящего, как у люков микрофона (mic-hatch.js).
// Координаты — до отражения (mirror.js).

import { CENTER, R_BELT_LOW } from './params.js';
import { EO_DOOR } from './electrics.js';
import { addPolygon, polygonNormal } from './mesh.js';
import { PALETTE } from './palette.js';

const D = Math.PI / 180;

export const NICHE_PANEL = Object.freeze({
  theta: [20, 29.5],   // по модулю: у стыка 1 — минус, у стыка 2 — плюс
  z: [160, 570],
  seam: 3,             // шов по контуру, как у фасадов
  screwInset: 20,      // оси винтов от кромок панели
});
export const SCREW_HEAD_D = 7;   // головка невыпадающего винта М4 под шестигранник
export const EO_SCREW_INSET = 16;

// Длина панели по дуге R1050.
export const nichePanelArc = () => (NICHE_PANEL.theta[1] - NICHE_PANEL.theta[0]) * D * R_BELT_LOW;

// Точка на стенке ниши: радиус r, угол θ от оси экрана, высота z.
const onWall = (r, theta, z) => [CENTER + r * Math.sin(theta * D), CENTER - r * Math.cos(theta * D), z];
const R_FACE = R_BELT_LOW - 0.8;   // чуть перед гранями стенки: прогиб хорды 128 граней ≈ 0,3
const R_HEAD = R_BELT_LOW - 1.4;

// Многоугольник лицом к нужной стороне.
function facing(mesh, pts, want, color) {
  const n = polygonNormal(pts);
  if (!n) return;
  addPolygon(mesh, n[0] * want[0] + n[1] * want[1] + n[2] * want[2] < 0 ? pts.reverse() : pts, color);
}
const toCenter = (theta) => [-Math.sin(theta * D), Math.cos(theta * D), 0];

// Полоса по дуге между θa и θb на высотах z0…z1, мелкими шагами — не отходит от стенки.
function arcBand(mesh, ta, tb, z0, z1, color) {
  const n = Math.max(1, Math.ceil(Math.abs(tb - ta) / 0.5));
  for (let i = 0; i < n; i++) {
    const a = ta + ((tb - ta) * i) / n, b = ta + ((tb - ta) * (i + 1)) / n;
    facing(mesh, [onWall(R_FACE, a, z0), onWall(R_FACE, b, z0), onWall(R_FACE, b, z1), onWall(R_FACE, a, z1)], toCenter((a + b) / 2), color);
  }
}

function disc(center, radius, normal, [u, v], color, mesh) {
  const pts = Array.from({ length: 20 }, (_, i) => {
    const t = (i / 20) * Math.PI * 2;
    return center.map((c, k) => c + radius * (Math.cos(t) * u[k] + Math.sin(t) * v[k]));
  });
  facing(mesh, pts, normal, color);
}

// Головка винта: чёрное кольцо и шестигранное гнездо темнее.
function screwHead(mesh, center, normal, axes) {
  disc(center, SCREW_HEAD_D / 2, normal, axes, PALETTE.hardware, mesh);
  disc(center.map((c, k) => c + normal[k] * 0.2), 1.6, normal, axes, PALETTE.audioVoid, mesh);
}

// Две сервисные панели: шов по контуру и четыре головки винтов.
export function buildNichePanels(mesh) {
  const { theta: [t0, t1], z: [z0, z1], seam, screwInset } = NICHE_PANEL;
  const dt = (seam / R_BELT_LOW) / D;
  const di = (screwInset / R_BELT_LOW) / D;
  for (const s of [-1, 1]) {
    const [a, b] = s < 0 ? [-t1, -t0] : [t0, t1];
    const c = PALETTE.audioVoid;
    arcBand(mesh, a - dt, b + dt, z0 - seam, z0, c);
    arcBand(mesh, a - dt, b + dt, z1, z1 + seam, c);
    arcBand(mesh, a - dt, a, z0, z1, c);
    arcBand(mesh, b, b + dt, z0, z1, c);
    for (const th of [a + di, b - di]) for (const z of [z0 + screwInset, z1 - screwInset]) {
      const n = toCenter(th);
      screwHead(mesh, onWall(R_HEAD, th, z), n, [[Math.cos(th * D), Math.sin(th * D), 0], [0, 0, 1]]);
    }
  }
}

// Винты дверцы ЭО — по углам, лицом наружу (грань y = 0).
export const eoDoorScrews = () => {
  const [x0, x1] = EO_DOOR.x, [z0, z1] = EO_DOOR.z, i = EO_SCREW_INSET;
  return [[x0 + i, z0 + i], [x1 - i, z0 + i], [x0 + i, z1 - i], [x1 - i, z1 - i]];
};
export function buildEoDoorScrews(mesh) {
  for (const [x, z] of eoDoorScrews()) screwHead(mesh, [x, -0.4, z], [0, -1, 0], [[1, 0, 0], [0, 0, 1]]);
}
