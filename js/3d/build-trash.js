// Мусорный модуль в углу К6 — листы 07, 08 (разрез 03), 32, 35, 39. Ниша в корпусе и
// выдвижной блок: накладной фасад, рама на направляющих полного выдвижения, в раме
// моющийся поддон, в поддоне ведро с крышкой. Блок выезжает вбок, в проход.
//
// Координаты — до отражения (mirror.js): фасад стоит в стенке прохода x = 950, блок
// едет в +x, вдоль фасада — y. Размеры и откуда они взялись — в params.js (TRASH_*).
//
// Внутри файла всё, кроме фасада, строится в осях (u, v): u — поперёк хода (настоящий
// y), v — вдоль хода (настоящий x). Так направляющие, рама и ведро читаются так же,
// как узел ящика, а в конце оси меняются местами (swapped).

import {
  UNDER_1, PLINTH, ENTRY_X0,
  TRASH_X, TRASH_Y, TRASH_Z0, TRASH_HEIGHT, TRASH_GAP, TRASH_FRONT_T,
  TRASH_TRAVEL, TRASH_FRAME_DEPTH, TRASH_SLIDE_Z, TRASH_BIN,
} from './params.js';
import { createMesh, addBox, addQuad } from './mesh.js';
import { buildBin, BAG_OUT } from './build-trash-bin.js';
import { buildFingerPullFacade, pullProfile } from './build-drawer.js';
import { PALETTE } from './palette.js';

const [U0, U1] = TRASH_Y;                     // 2360…2684 — ниша поперёк хода
const PLANE = ENTRY_X0;                       // 950 — плоскость фасада, стенка прохода
const Z0 = TRASH_Z0, Z1 = TRASH_Z0 + TRASH_HEIGHT; // 116…728
const BACK = TRASH_X[0];                      // 565 — задняя стенка ниши (торцевая стенка К6)
const INNER = PLANE - TRASH_FRONT_T;          // 932 — изнанка фасада

// Фасад — как у ящиков: в проёме с зазором 3 со всех сторон, низ на +103 закрывает
// кромку дна, верх — под столешницей (лист 29). Настоящие оси: y — вдоль фасада.
export const TRASH_FACADE = { y: [U0 + TRASH_GAP, U1 - TRASH_GAP], z: [PLINTH + TRASH_GAP, UNDER_1 - TRASH_GAP] };

// Ручка — вырез в верхней кромке, как у ящиков, но шире и глубже: три четверти ширины
// фасада и 64 мм вглубь. Пальцы проходят в окно между низом выреза (693) и потолком ниши
// (728) и упираются в тыл фасада; за ним воздух не меньше TRASH_FINGER_GAP — ведро
// отодвинуто назад. Накладная ручка тут невозможна: фасад стоит в стенке прохода.
export const TRASH_PULL = { width: 0.72, depth: 64 };

// Направляющие: шариковый телескоп 300 × 45 × 12,7 на стенках ниши, как у ящиков
// (build-slides.js), ход здесь по x.
const SLIDE_T = 12.7, SLIDE_H = 45;
const SLIDE_LEN = TRASH_TRAVEL;
const FIXED_V = [INNER - 2 - SLIDE_LEN, INNER - 2];   // 630…930 — упор с доводчиком
const MIDDLE_V = [FIXED_V[0] + 30, FIXED_V[1] - 2];
const INNER_V = [INNER - SLIDE_LEN, INNER];
const SIDES = [{ wall: U0, dir: 1 }, { wall: U1, dir: -1 }];
const ZS = [TRASH_SLIDE_Z, TRASH_SLIDE_Z + SLIDE_H];

// Рама между внутренними звеньями: боковины 2 × 45, поперечины 20 × 45, дно — лист 1,5.
const FRAME_U = [U0 + SLIDE_T, U1 - SLIDE_T];         // 2372,7…2671,3
const FRAME_V = [INNER - TRASH_FRAME_DEPTH, INNER];   // 622…932
const BAR = 20, SHEET = 1.5, WALL = 2;
// Поддон — в раме между поперечинами, борт 25.
// Ведро стоит ближе к задней стенке: между ним и фасадом остаётся воздух под пальцы.
const BIN_C = [(FRAME_U[0] + FRAME_U[1]) / 2, TRASH_BIN.centerV];
const TRAY = { u: [FRAME_U[0] + 4, FRAME_U[1] - 4], v: [BIN_C[1] - TRASH_BIN.bottom[1] / 2 - 8, BIN_C[1] + TRASH_BIN.bottom[1] / 2 + 8], z: [ZS[0] + SHEET, ZS[0] + SHEET + 25] };
// Стойки фасада: две стальные полосы 30 × 4 от передней поперечины рамы до верха фасада.
// Держат его за тыл винтами и несут тяжесть, когда за вырез тянут блок с полным ведром.
const POST = { w: 30, t: 4, top: UNDER_1 - TRASH_GAP - 22 };

// Блок строится в осях (u, v) и поворачивается на свою грань: u ↔ y, v ↔ x. Это
// отражение, поэтому обход треугольников разворачивается, иначе нормали смотрели
// бы внутрь детали.
function swapped(target, build) {
  const tmp = createMesh();
  build(tmp);
  const { position: p, normal: n, color: c } = tmp;
  for (let i = 0; i < p.length; i += 9)
    for (const k of [0, 6, 3]) {
      target.position.push(p[i + k + 1], p[i + k], p[i + k + 2]);
      target.normal.push(n[i + k + 1], n[i + k], n[i + k + 2]);
      target.color.push(c[i + k], c[i + k + 1], c[i + k + 2]);
    }
}

// Ниша: стенки, дно, потолок, задняя стенка; кромки дна и плит за фасадом, как
// у холодильника (build-fridge.js). Ниша прямоугольная: угол у торца прохода
// в 1092 от центра — за закладными У4 (params.js, TRASH_CLEAR_R).
export function buildTrashCavity(mesh) {
  swapped(mesh, (m) => {
    const c = PALETTE.fridge;
    addQuad(m, [U0, BACK, Z0], [U1, BACK, Z0], [U1, BACK, Z1], [U0, BACK, Z1], c);
    addQuad(m, [U0, BACK, Z0], [U0, PLANE, Z0], [U0, PLANE, Z1], [U0, BACK, Z1], c);
    addQuad(m, [U1, BACK, Z0], [U1, PLANE, Z0], [U1, PLANE, Z1], [U1, BACK, Z1], c);
    addQuad(m, [U0, BACK, Z0], [U1, BACK, Z0], [U1, PLANE, Z0], [U0, PLANE, Z0], c);
    addQuad(m, [U0, BACK, Z1], [U1, BACK, Z1], [U1, PLANE, Z1], [U0, PLANE, Z1], c);
    const edge = INNER - 1;
    addQuad(m, [U0, edge, PLINTH], [U1, edge, PLINTH], [U1, edge, Z0], [U0, edge, Z0], PALETTE.side);
    addQuad(m, [U0, edge, Z1], [U1, edge, Z1], [U1, edge, UNDER_1], [U0, edge, UNDER_1], PALETTE.side);
  });
}

// Неподвижные звенья направляющих и две головки М8 прижима П1 в потолке ниши
// (лист 37, поз. 11): их крутят изнутри К6, вынув ведро. Координаты головок — (x, y).
export const P1_BOLTS = [[900, 2549], [900, 2650]];
export function buildTrashSlidesFixed(mesh) {
  swapped(mesh, (m) => {
    for (const { wall, dir } of SIDES) {
      const u = (a, b) => [Math.min(wall + dir * a, wall + dir * b), Math.max(wall + dir * a, wall + dir * b)];
      addBox(m, u(0, 1.2), FIXED_V, ZS, PALETTE.rail);
      addBox(m, u(0, 11), FIXED_V, [ZS[1] - 1.2, ZS[1]], PALETTE.rail);
      addBox(m, u(0, 11), FIXED_V, [ZS[0], ZS[0] + 1.2], PALETTE.rail);
      addBox(m, u(1.2, 9.6), [FIXED_V[0], FIXED_V[0] + 28], [ZS[0] + 6, ZS[1] - 6], PALETTE.pom);
      for (const t of [0.12, 0.5, 0.88])
        addBox(m, u(1.2, 2.6), [FIXED_V[0] + t * SLIDE_LEN - 3.6, FIXED_V[0] + t * SLIDE_LEN + 3.6], [ZS[0] + 19, ZS[0] + 26], PALETTE.bolt);
    }
    // Шайба 16 и головка DIN 912 М8 (Ø13 × 8).
    for (const [x, y] of P1_BOLTS) {
      addBox(m, [y - 8, y + 8], [x - 8, x + 8], [Z1 - 1.6, Z1], PALETTE.bolt);
      addBox(m, [y - 6.5, y + 6.5], [x - 6.5, x + 6.5], [Z1 - 9.6, Z1 - 1.6], PALETTE.bolt);
    }
  });
}

// Промежуточное звено: идёт на полхода.
export function buildTrashSlideMiddle(mesh) {
  swapped(mesh, (m) => {
    for (const { wall, dir } of SIDES) {
      const u = (a, b) => [Math.min(wall + dir * a, wall + dir * b), Math.max(wall + dir * a, wall + dir * b)];
      addBox(m, u(4, 5), MIDDLE_V, [ZS[0] + 5.5, ZS[1] - 5.5], PALETTE.railMiddle);
      addBox(m, u(2.2, 10.5), MIDDLE_V, [ZS[1] - 6.5, ZS[1] - 5.5], PALETTE.railMiddle);
      addBox(m, u(2.2, 10.5), MIDDLE_V, [ZS[0] + 5.5, ZS[0] + 6.5], PALETTE.railMiddle);
    }
  });
}

// Фасад: та же плита с вырезом, что у ящиков, но на плоскости прохода и с широкой ручкой.
// Оси ящика совпадают с настоящими (лицо смотрит в +x), поворачивать не нужно.
export function buildTrashFront(mesh) {
  const [y0, y1] = TRASH_FACADE.y, [z0, z1] = TRASH_FACADE.z;
  buildFingerPullFacade(mesh, { y0, y1, z0, z1, plane: PLANE, pullW: TRASH_PULL.width, pullH: TRASH_PULL.depth });
}

export function trashFrontEdges() {
  const [y0, y1] = TRASH_FACADE.y, [z0, z1] = TRASH_FACADE.z;
  const f = PLANE + 2;
  return [[[f, y0, z0], [f, y1, z0], [f, y1, z1],
    ...pullProfile(y0, y1, z1, TRASH_PULL.width, TRASH_PULL.depth).slice().reverse().map(([y, z]) => [f, y, z]), [f, y0, z1]]];
}

// Всё, что едет с фасадом: внутренние звенья, рама, поддон, ведро и крышка.
export function buildTrashBin(mesh) {
  swapped(mesh, (m) => {
    for (const { wall, dir } of SIDES) {
      const u = (a, b) => [Math.min(wall + dir * a, wall + dir * b), Math.max(wall + dir * a, wall + dir * b)];
      addBox(m, u(SLIDE_T - 1, SLIDE_T), INNER_V, [ZS[0] + 11, ZS[1] - 11], PALETTE.railMoving);
      addBox(m, u(6.5, SLIDE_T), INNER_V, [ZS[1] - 12, ZS[1] - 11], PALETTE.railMoving);
      addBox(m, u(6.5, SLIDE_T), INNER_V, [ZS[0] + 11, ZS[0] + 12], PALETTE.railMoving);
      // Рычаг расцепления: блок снимается целиком, не разбирая направляющие.
      addBox(m, u(7.2, SLIDE_T - 1), [INNER_V[1] - 46, INNER_V[1] - 10], [ZS[0] + 15, ZS[0] + 30], PALETTE.pom);
    }
    const [fu0, fu1] = FRAME_U, [fv0, fv1] = FRAME_V;
    const steel = PALETTE.powder;
    addBox(m, [fu0, fu0 + WALL], FRAME_V, ZS, steel);
    addBox(m, [fu1 - WALL, fu1], FRAME_V, ZS, steel);
    addBox(m, [fu0 + WALL, fu1 - WALL], [fv1 - BAR, fv1], ZS, steel);
    addBox(m, [fu0 + WALL, fu1 - WALL], [fv0, fv0 + BAR], ZS, steel);
    addBox(m, [fu0 + WALL, fu1 - WALL], [fv0 + BAR, fv1 - BAR], [ZS[0], ZS[0] + SHEET], steel);

    // Поддон: открытая ванночка, стенка 2 — вынимается и моется.
    const { u: [tu0, tu1], v: [tv0, tv1], z: [tz0, tz1] } = TRAY;
    const tray = PALETTE.pom;
    addBox(m, [tu0, tu1], [tv0, tv1], [tz0, tz0 + WALL], tray);
    addBox(m, [tu0, tu0 + WALL], [tv0, tv1], [tz0 + WALL, tz1], tray);
    addBox(m, [tu1 - WALL, tu1], [tv0, tv1], [tz0 + WALL, tz1], tray);
    addBox(m, [tu0 + WALL, tu1 - WALL], [tv0, tv0 + WALL], [tz0 + WALL, tz1], tray);
    addBox(m, [tu0 + WALL, tu1 - WALL], [tv1 - WALL, tv1], [tz0 + WALL, tz1], tray);

    // Стойки фасада: у боковин рамы, вне выреза в кромке (вырез занимает 72% ширины).
    for (const u0 of [fu0 + WALL + 2, fu1 - WALL - 2 - POST.w])
      addBox(m, [u0, u0 + POST.w], [INNER - POST.t, INNER], [ZS[1], POST.top], steel);

    // Ведро — отдельным построителем: сталь, бортик, основание и мешок.
    buildBin(m, BIN_C, TRASH_BIN);
  });
}

// Габариты частей для проверки (tools/check-math.mjs), в осях (u, v) — см. начало файла.
// binFront — самая передняя точка ведра с мешком: от неё до изнанки фасада воздух под пальцы.
export const TRASH_PARTS = {
  FRAME_U, FRAME_V, TRAY, BIN_C, BACK, INNER, FIXED_V, POST,
  binTop: TRASH_BIN.z[1] + TRASH_BIN.rim + TRASH_BIN.bag,
  binFront: BIN_C[1] + TRASH_BIN.top[1] / 2 + BAG_OUT,
};
