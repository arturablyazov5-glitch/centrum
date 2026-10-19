// Люки под штангу микрофона — docs/mic-mount, лист 51. Решение 26.09.2026,
// низ люка и трасса кабеля — 27.09.2026.
//
// Свою штангу не делаем: клиент ставит ту, что у него есть. Все продаются со
// струбциной, а кромки стола — 60 мм (с накладкой 64), струбцины берут до 50…70.
// Поэтому в рабочем кольце два люка Ø80, как отверстие Qi: снизу вокруг люка плита
// выбрана до 40 мм и усилена стальным кольцом, за край люка хватается любая
// струбцина, сквозь люк проходит грометный крепёж и уходит кабель. Сверху —
// графитовый фланец заподлицо и крышка на магните; в накладке — отверстие Ø100.
//
// Кольцо — сотовая панель: обшивка 8 + соты 44 + обшивка 8 (лист 33). Резать
// нижнюю обшивку пазом нельзя — она несёт консоль. Поэтому у люка в соты вклеена
// фанерная вставка (в ней выборка и отверстие), а кабель идёт закладной трубой
// внутри сот: из стенки отверстия — к краю кольца над корпусом и по дуге в камеру
// над Tech Bay, оттуда гильзой вниз в отсек, за поддон. Под столом не видно ничего.
//
// Места: ±34,8° от оси экрана, R900 — между клавиатурой и стенкой, в стороне от
// мыши. Люк стоит посередине между кронштейнами кольца ±26,7° и ±43° (лист 34):
// прежний кронштейн на ±37° попадал болтом в отверстие. Шаг кронштейнов ≤ 300
// по R1050, до стыков модулей корпуса (±31,6° на стенке) ≥ 70.
// Координаты — как у корпуса до отражения (mirror.js); θ — от оси экрана, плюс —
// вправо от сидящего.

import { CENTER, UNDER_1, LEVEL_1 } from './params.js';

export const MIC_HATCH = Object.freeze({
  angles: [34.8, -34.8],
  r: 900,
  hole: 80,          // отверстие в плите, фреза Qi
  flange: 96,        // графитовый фланец сверху
  lid: 78,           // крышка внутри фланца, зазор 1
  padHole: 100,      // отверстие в накладке
  slab: 40,          // плита у люка после выборки снизу
  pocket: 200,       // выборка снизу
  insert: 210,       // фанерная вставка в сотах: в ней выборка, отверстие и канал
  steel: [84, 196, 3], // стальное кольцо: внутренний Ø, наружный Ø, толщина
});
export const POCKET_TOP = LEVEL_1 - MIC_HATCH.slab;   // +780 — потолок выборки

// Стык A переднего рабочего кольца (листы 32–34): ±50°.
export const RING_JOINTS = [50, -50];
// Стыки модулей корпуса на стенке ниши: x = 800 и 1900 (лист 32) — около ±31,6°.
export const MODULE_JOINTS_X = [800, 1900];

const D = Math.PI / 180;
export const hatchCenter = (theta, r = MIC_HATCH.r) => [CENTER + r * Math.sin(theta * D), CENTER - r * Math.cos(theta * D)];

// ── Закладной канал ──────────────────────────────────────────────────────────
// Сотовая часть кольца: обшивки 8, между ними соты 44 (+768…+812).
export const RING_CORE = [UNDER_1 + 8, LEVEL_1 - 8];
export const MIC_CONDUIT = Object.freeze({
  mouth: [32, 28],   // окно в стенке отверстия и канал во вставке, ш × в: вилка XLR Ø20 проходит
  mouthZ: 798,       // ось канала во вставке: над выборкой 4 мм дерева и сталь
  tube: [32, 26],    // труба в сотах, наружный / внутренний Ø
  tubeZ: 790,        // ось трубы: +774…+806 внутри сот
  bend: 40,          // радиус поворота канала во вставке
  offset: 80,        // ось трубы от оси люка в сторону Tech Bay
  arc: { right: 1125, left: 1088 }, // дуги над корпусом, за концами рёбер R1066: правая — снаружи, левая — внутри
  // Камера над Tech Bay — полость в фанерной вставке сот, над корпусом за концами
  // рёбер: в неё приходят трубы обоих люков и центральной панели для наушников
  // (audio-routes.js). Гильза — по центру камеры, в Tech Bay за поддоном.
  chamber: { theta: -41.8, r: 1110, span: [-36.5, -44], rIn: 1066, rOut: 1146 },
  sleeve: [50, 44],  // гильза вниз в Tech Bay: XLR Ø20 + кабель микрофона + жгут наушников
  bayCeiling: 726,   // потолок Tech Bay (TECH_Z0 + TECH_HEIGHT)
});

const pt = (theta, r, z) => [CENTER + r * Math.sin(theta * D), CENTER - r * Math.cos(theta * D), z];
const ang = ([x, y]) => Math.atan2(x - CENTER, CENTER - y) / D;
const rad = ([x, y]) => Math.hypot(x - CENTER, y - CENTER);
const bezier = (a, b, c, n) => Array.from({ length: n }, (_, i) => {
  const t = (i + 1) / n, u = 1 - t;
  return a.map((v, k) => u * u * v + 2 * u * t * b[k] + t * t * c[k]);
});
const arcPts = (r, a0, a1, z) => {
  const n = Math.max(2, Math.ceil(Math.abs(a1 - a0)));
  return Array.from({ length: n + 1 }, (_, i) => pt(a0 + ((a1 - a0) * i) / n, r, z));
};

// Ось канала от окна в стенке отверстия до камеры над Tech Bay, точки [x, y, z].
// Канал уходит из люка в сторону Tech Bay (к −θ): у правого люка — к экрану,
// у левого — от экрана.
export function micConduitPath(theta) {
  const k = MIC_CONDUIT, h = MIC_HATCH;
  const [cx, cy] = hatchCenter(theta);
  const out = [Math.sin(theta * D), -Math.cos(theta * D)];
  const tg = [Math.cos(theta * D), Math.sin(theta * D)];
  const local = (x, t, z) => [cx + out[0] * x + tg[0] * t, cy + out[1] * x + tg[1] * t, z];
  const pts = [local(0, -h.hole / 2, k.mouthZ)];
  // поворот R40 во вставке: от окна вдоль −касательной к оси вдоль радиуса
  for (let i = 1; i <= 8; i++) {
    const a = (i / 8) * Math.PI / 2;
    pts.push(local(k.bend - k.bend * Math.cos(a), -h.hole / 2 - k.bend * Math.sin(a), k.mouthZ));
  }
  // из вставки — труба; ось опускается к +790
  const xEdge = Math.sqrt((h.insert / 2) ** 2 - k.offset ** 2);
  pts.push(local(xEdge, -k.offset, k.mouthZ), local(xEdge + 40, -k.offset, k.tubeZ));
  const R = theta > 0 ? k.arc.right : k.arc.left;
  const xAt = (r) => Math.sqrt(r * r - k.offset ** 2) - h.r;
  const corner = local(xAt(R), -k.offset, k.tubeZ);
  const a0 = ang(corner) - 60 / R / D;
  pts.push(local(xAt(R - 60), -k.offset, k.tubeZ));
  pts.push(...bezier(pts.at(-1), corner, pt(a0, R, k.tubeZ), 6));
  const { theta: ac, r: rc } = k.chamber;
  const end = pt(ac, rc, k.tubeZ);
  if (R === rc) pts.push(...arcPts(R, a0, ac, k.tubeZ).slice(1));
  else {
    // дуга до камеры, последний отрезок — плавно на радиус камеры
    const a1 = ac + Math.sign(a0 - ac) * 50 / R / D;
    pts.push(...arcPts(R, a0, a1, k.tubeZ).slice(1));
    pts.push(...bezier(pts.at(-1), pt(ac, R, k.tubeZ), end, 5));
  }
  return pts;
}

// Гильза: из камеры вниз сквозь нижнюю обшивку и крышку модуля в Tech Bay.
export const micSleeve = () => {
  const { theta, r } = MIC_CONDUIT.chamber;
  return [pt(theta, r, MIC_CONDUIT.tubeZ), pt(theta, r, MIC_CONDUIT.bayCeiling)];
};

export const pathLength = (pts) => pts.slice(1).reduce((s, p, i) => s + Math.hypot(...p.map((v, j) => v - pts[i][j])), 0);
// Длина канала от окна в люке до потолка Tech Bay.
export const micConduitLength = (theta) => pathLength(micConduitPath(theta)) + (MIC_CONDUIT.tubeZ - MIC_CONDUIT.bayCeiling);

// Рёбра под кронштейнами кончаются у стенки ниши (R1050 + панель 16).
export const RIB_END = 1066;
// Где труба пересекает луч ребра: радиусы точек пересечения (ось трубы).
export function ribCrossings(theta, ribs) {
  const pts = micConduitPath(theta);
  const out = [];
  for (let i = 1; i < pts.length; i++) {
    const a0 = ang(pts[i - 1]), a1 = ang(pts[i]);
    for (const b of ribs) if ((a0 - b) * (a1 - b) < 0) {
      const t = (b - a0) / (a1 - a0);
      out.push({ b, r: rad(pts[i - 1].map((v, k) => v + (pts[i][k] - v) * t)) });
    }
  }
  return out;
}
export { ang as conduitAngle, rad as conduitRadius };
