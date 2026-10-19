// Дверца ЭО — сухого электроотсека в К2 (лист 16, electrics.js). Снаружи на
// грани y = 0 за экраном: панель в проёме заподлицо с фасадом, теневая щель
// по контуру — как у Tech Bay и ящиков. Лист 16: «тепло БП ≈ 30 Вт — щели
// сверху и снизу дверцы» — ряд сквозных прорезей у верхней и нижней кромки.
// Держится на четырёх невыпадающих винтах М4 по углам (build-k2-service.js):
// петель, магнитов и замка нет (решение владельца 28.09.2026). За ней — тёмная ниша: в щелях видна она, а не пустота корпуса.
// Щит, БП и контроллеры внутри — слой «Электрика» (build-electrics.js).

import { EO, EO_DOOR } from './electrics.js';
import { addQuad } from './mesh.js';
import { PALETTE } from './palette.js';

const PANEL = 16;             // панель дверцы, как у фасада Tech Bay
export const EO_GAP = 3;      // теневая щель по контуру, как у остальных фасадов
// Проём в стенке — дверца плюс щель со всех сторон (openings.js).
export const EO_OPENING = {
  x: [EO_DOOR.x[0] - EO_GAP, EO_DOOR.x[1] + EO_GAP],
  z: [EO_DOOR.z[0] - EO_GAP, EO_DOOR.z[1] + EO_GAP],
};

// Прорези (решение владельца 28.09.2026: примерно вдвое больше прежних 7 × (36 × 8)):
// у каждой кромки два ряда по 7 прорезей 36 × 8, шаг 48, ряды через 16.
// Площадь у кромки 2 × 7 × 36 × 8 = 4032 мм², сверху и снизу поровну.
// Расчёт на 30 Вт блоков питания проверяет инженер (лист 16).
// Ряды отступают от кромки на 30: в углах, в 16 от кромок, — невыпадающие
// винты М4 дверцы (build-k2-service.js).
export const EO_SLOT = Object.freeze({ n: 7, w: 36, h: 8, pitch: 48, rows: 2, rowPitch: 16, inset: 30 });
const SLOT = EO_SLOT;
const [X0, X1] = EO_DOOR.x;
const [Z0, Z1] = EO_DOOR.z;
const SLOT_X0 = (X0 + X1 - (SLOT.n - 1) * SLOT.pitch - SLOT.w) / 2;
const rowsFrom = (edge, dir) => Array.from({ length: SLOT.rows }, (_, k) => {
  const near = edge + dir * (SLOT.inset + k * SLOT.rowPitch);
  return dir > 0 ? [near, near + SLOT.h] : [near - SLOT.h, near];
});
export const EO_SLOT_ROWS = [...rowsFrom(Z0, 1), ...rowsFrom(Z1, -1).reverse()];
export const eoSlotArea = () => SLOT.n * SLOT.w * SLOT.h * SLOT.rows;   // у одной кромки, мм²

// Полотно без внутренних торцов: лицо и тыл — плоские куски, торцы только по
// контуру и в прорезях. Стопка коробок давала торцы внутри панели, и шейдер
// скругления кромок рисовал на лице светлые полосы по их стыкам.
function slab(mesh, x0, x1, z0, z1, y, color) {
  const q = [[x0, y, z0], [x1, y, z0], [x1, y, z1], [x0, y, z1]];
  addQuad(mesh, ...(y === 0 ? q : q.reverse()), color);
}
// Торец по отрезку (a → b) в плоскости xz, нормаль — влево от направления.
function edge(mesh, [ax, az], [bx, bz], color) {
  addQuad(mesh, [ax, 0, az], [bx, 0, bz], [bx, PANEL, bz], [ax, PANEL, az], color);
}

export function buildEoDoor(mesh) {
  const c = PALETTE.drawer;
  const cuts = [Z0, ...EO_SLOT_ROWS.flat(), Z1];
  for (let i = 0; i < cuts.length - 1; i++) {
    const [z0, z1] = [cuts[i], cuts[i + 1]];
    const spans = [];
    if (i % 2 === 0) spans.push([X0, X1]);
    else {
      // Полоса прорезей: перемычки между ними, у каждой прорези — четыре стенки.
      let x = X0;
      for (let k = 0; k < SLOT.n; k++) {
        const s = SLOT_X0 + k * SLOT.pitch;
        spans.push([x, s]);
        x = s + SLOT.w;
        edge(mesh, [s, z0], [s, z1], c);
        edge(mesh, [x, z1], [x, z0], c);
        edge(mesh, [x, z0], [s, z0], c);
        edge(mesh, [s, z1], [x, z1], c);
      }
      spans.push([x, X1]);
    }
    for (const [a, b] of spans) for (const y of [0, PANEL]) slab(mesh, a, b, z0, z1, y, c);
  }
  // Контур полотна.
  edge(mesh, [X0, Z0], [X1, Z0], c);
  edge(mesh, [X1, Z0], [X1, Z1], c);
  edge(mesh, [X1, Z1], [X0, Z1], c);
  edge(mesh, [X0, Z1], [X0, Z0], c);
}

export const eoDoorEdges = () => [[[X0, -1, Z0], [X1, -1, Z0], [X1, -1, Z1], [X0, -1, Z1]]];

// Ниша за дверцей: откосы проёма в толще стенки и тёмный задник на отступе
// перед оборудованием (щит и блоки — от y = 30).
const BACK_Y = 28;
export function buildEoNiche(mesh) {
  const [x0, x1] = EO_OPENING.x, [z0, z1] = EO_OPENING.z;
  const c = PALETTE.powder;
  addQuad(mesh, [x0, BACK_Y, z0], [x1, BACK_Y, z0], [x1, BACK_Y, z1], [x0, BACK_Y, z1], c);
  addQuad(mesh, [x0, 0, z0], [x1, 0, z0], [x1, BACK_Y, z0], [x0, BACK_Y, z0], c);
  addQuad(mesh, [x0, BACK_Y, z1], [x1, BACK_Y, z1], [x1, 0, z1], [x0, 0, z1], c);
  addQuad(mesh, [x0, BACK_Y, z0], [x0, BACK_Y, z1], [x0, 0, z1], [x0, 0, z0], c);
  addQuad(mesh, [x1, 0, z0], [x1, 0, z1], [x1, BACK_Y, z1], [x1, BACK_Y, z0], c);
}

// Ниша не выходит за стенки отсека.
if (EO_OPENING.x[0] < EO.x[0] || EO_OPENING.x[1] > EO.x[1] || EO_OPENING.z[0] < EO.z[0] || EO_OPENING.z[1] > EO.z[1])
  throw new Error('Проём ЭО выходит за отсек');
