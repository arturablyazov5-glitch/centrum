// Фурнитура Bridge — листы 20–23. Всё, чем секция держится, поднимается и упирается:
// опорный выступ с накладками POM, скрытые петли, кронштейны с упором, газлифты.
//
// Части разнесены по трём наборам, потому что движутся они по-разному:
//   frame     — привёрнуто к корпусу и стоит на месте (выступ, корпуса петель в П1, кронштейны);
//   fittings  — сидит в секции и едет вместе с ней (корпуса петель в торце, проушины газлифтов);
//   strut     — газлифт: корпус поворачивается вокруг кронштейна, шток ещё и выдвигается.
//
// Детали нарисованы так, как их делают: гнутая сталь 3 мм с радиусами, винты
// с потайной головкой, газлифт с завальцовкой и резьбовыми наконечниками.
// Поднятый мост смотрит нижней гранью прямо на человека у входа, и брусок
// вместо кронштейна там читается сразу.

import {
  SIZE, LEVEL_1, UNDER_1, ENTRY_X0, ENTRY_X1, LEAF_X0, LEAF_X1, BRIDGE_Y0,
} from './params.js';
import { addBox, addLathe, addPlateXZ, addPrism, addPolygon, addQuad, roundedRect } from './mesh.js';
import { PALETTE } from './palette.js';

// ─── Общее с плитой секции (лист 20) ────────────────────────────────────────
export const STRUT_Y = [BRIDGE_Y0 + 330, BRIDGE_Y0 + 830]; // оси двух газлифтов
export const CHANNEL_W = 34;                 // ширина канала в нижней грани (30 + зазор)
export const CHANNEL_X1 = ENTRY_X0 + 265;    // канал кончается в 265 от оси петли
export const CHANNEL_TOP = UNDER_1 + 40;     // 800 — потолок канала, над ним 20 мм плиты
// Снизу канал открыт только у петли: там газлифт на ходу опускается ниже
// нижней грани (до 747 в 37 от торца). Дальше его низ не опускается ниже 769,
// и канал закрыт крышкой 6 в четверти заподлицо с нижней гранью — зазор до
// газлифта не меньше 3. Крышка — вырезанный кусок самой нижней обшивки,
// простроганный с изнанки до 6: рисунок шпона совпадает. Держится на магнитах
// в плечах четверти и снимается за торец, выходящий в открытую часть, — под
// ней проушина B газлифта.
export const COVER_X0 = ENTRY_X0 + 120;      // 1070 — начало крышки, 117 от торца секции
export const COVER_T = 6;                    // толщина крышки
export const COVER_LIP = 7;                  // крышка шире канала на четверть 7 с каждой стороны
export const COVER_SEAM = 0.8;               // шов вокруг крышки

// ─── Опорный выступ, лист 23 ────────────────────────────────────────────────
//
// Как узел держится. Полоса — простой плоский лист, винтами прижатый к нижней
// грани столешницы Sector; между ними ничего нет. Место под накладку POM даёт
// не ступенька в стали, а четверть 25 × 3 в нижней кромке самой секции: сталь
// остаётся плоским прокатом, а выборку делает фреза по дереву на детали, которая
// и так идёт через станок ради дуги, ручек и каналов газлифтов. Заподлицо мост
// выводится подбором толщины накладки (2,5 / 3 / 3,5).
//
// Винт M6 с потайной головкой идёт снизу через полосу в заклёпочную гайку
// в нижней стенке стальной трубы П2 (вид 37): наверх, в рабочую плоскость,
// крепёж не выходит, а в соты столешницы не ставится вовсе. Нагрузка идёт
// накладка → полоса → П2, то есть в сжатие, а винт работает только когда
// секцию тянут вверх. Это и записано на листе 23: «нагрузка сверху сжимает узел».
// Вылет — единственное, что у этого узла вообще видно: полоса выходит из-под
// столешницы в проём. Спрятать её целиком нельзя, на неё садится мост, поэтому
// вылет ужат до минимума, при котором опора остаётся вменяемой, а сама полоса
// уведена в тень кромки моста и не выходит на линию стенки.
const LEDGE_OUT = 20;                  // вылет полосы в проём
const LEDGE_IN = 30;                   // часть под Sector: место под винт с зенковкой
const LEDGE_T = 6;
const LEDGE_X0 = ENTRY_X1 - LEDGE_OUT;
const LEDGE_X1 = ENTRY_X1 + LEDGE_IN;
// По длине полоса не доходит 30 мм до обеих кромок: у входа её торец иначе
// выходил бы на наружную грань стола и был бы виден с порога, а со стороны
// отверстия — на кромку проёма. Накладки лежат далеко внутри этих 30 мм.
const LEDGE_END = 30;
export const LEDGE_Y0 = BRIDGE_Y0 + LEDGE_END;
export const LEDGE_Y1 = SIZE - LEDGE_END;

// Четверть в нижней кромке секции и накладки в ней. Четверть на 4 мм шире
// накладки: секция гуляет в проёме в пределах зазоров, и её внутренний угол
// не должен наезжать на кромку полосы.
export const REBATE_D = 3;             // глубина четверти = толщина накладки
export const REBATE_W = 24;
const POM_W = 16;                      // накладка 16 × 100 × 3, 3 шт по длине
const POM_LEN = 100;
const POM_Y = [1 / 6, 1 / 2, 5 / 6].map((ratio) => BRIDGE_Y0 + (SIZE - BRIDGE_Y0) * ratio);
const FIX_PITCH = 250;                 // шаг крепежа полосы
const FIX_X = ENTRY_X1 + 18;           // 1868 — ось винта под телом Sector
const SCREW_R = 3;                     // винт M6
const SCREW_HEAD_R = 6;                // потайная головка, утоплена в полосу заподлицо
const INSERT_DEPTH = 12;               // заклёпочная гайка в стенке П2

// Полоса идёт по всей длине 1050, и на последних 372 мм рядом с ней встаёт
// боковая стенка прохода — она идёт вдоль полосы, а не поперёк. Поэтому в торце
// стенки выбран паз на толщину полосы: сверху вниз идёт столешница, полоса,
// стенка — без промежуточного слоя, который было бы нечем нести.
export const LEDGE_BOTTOM = UNDER_1 - LEDGE_T; // 754 — дно паза в торце стенки

// ─── Петли и кронштейны, лист 22 ────────────────────────────────────────────
// Ось поворота — на отметке 820 в шве, как на листах 20 и 22: только так
// секция при подъёме уходит от столешницы, а не упирается в неё. Раньше ось
// давала сплошная петля Ø10, и половина её торчала над рабочей плоскостью
// чёрным валиком по всему шву. Теперь это три скрытые петли с регулировкой
// 3D: у них ось виртуальная, в самом шве, а корпуса утоплены в кромки —
// в полость трубы П1 (лист 37) и в торец секции. В закрытом положении сверху
// виден только шов 3 мм; лицевые планки петель видны, лишь когда мост поднят.
export const HINGE_Z = LEVEL_1;
// Петли по длине — между каналами газлифтов (330 и 830 от начала секции)
// и с отступом от обеих кромок. Позиции уточняются по шаблону петли.
const HINGE_Y = [120, 580, 930].map((offset) => BRIDGE_Y0 + offset);
const HINGE_LEN = 120;                 // корпус петли по длине шва
const HINGE_DEPTH = 28;                // глубина корпуса в кромку, каждая сторона
const HINGE_Z0 = LEVEL_1 - 44;         // корпус по высоте 24 — внутри плоского торца
const HINGE_Z1 = LEVEL_1 - 20;         // между валами R8 сверху и снизу
const HINGE_PLATE = 0.4;               // лицевая планка корпуса: выступ над кромкой
const PIVOT = [ENTRY_X0 + 30, UNDER_1];// ось газлифта на кронштейне: 30 в проём, 60 вниз

// ─── Газлифт, лист 22 ───────────────────────────────────────────────────────
// Ø15 / 6, ход ≈ 90: длина по осям шарниров 174 закрыто → 264 открыто.
export const STRUT_A = [PIVOT[0], PIVOT[1]];      // [x, z] — ось на кронштейне корпуса
export const STRUT_B = [ENTRY_X0 + 200, LEVEL_1 - 25]; // [x, z] — проушина в секции
const TUBE_R = 7.5;                    // корпус Ø15
const ROD_R = 3;                       // шток Ø6
const EYE_W = 6;                       // проушины наконечников по ширине
const EYE_A_R = 6.5;                   // наконечник корпуса на оси кронштейна
const EYE_B_R = 4.8;                   // наконечник штока: над ним 0,2 до потолка канала
const PIN_R = 2.5;                     // оси Ø5 в проушинах

// Корпус газлифта по оси от шарнира A: наконечник, донце, гильза, завальцовка.
// Гильза 124 вмещает ход 90 и поршень с направляющей, при закрытой секции
// снаружи остаются 22 мм штока.
const BODY_T0 = 12;                    // донце гильзы
const BODY_T1 = 136;                   // торец завальцовки, выход штока
const ROD_T0 = 30;                     // конец штока в гильзе: открыто он всё ещё внутри
const ROD_END_T = 12;                  // наконечник штока до оси B

// Кронштейн A — гнутая сталь 3 мм: полка на 2 × М6 в заклёпочные гайки нижней
// стенки трубы П1 (вид 37) и вилка из двух ушей вокруг проушины газлифта.
// Прилив вокруг оси не ниже 8 под 760. Шаровые опоры здесь не годятся: у
// проушины B до потолка канала 5 мм, а головке шаровой опоры нужно 7,5.
const BRACKET_T = 3;
const BRACKET_X0 = ENTRY_X0 - 58;      // полка привёрнута к низу трубы П1
const EAR_R = 8;
const EAR_GAP = EYE_W / 2 + 0.5;       // уши охватывают проушину с зазором 0,5

// Кольцо плоских граней — к нему и крепёжные головки.
const disc = (mesh, c, axis, r, h, color) => {
  const b = c.map((v, k) => v + axis[k] * h);
  addLathe(mesh, c, b, [[0, 0], [0, r * 0.82], [h * 0.35, r], [h, r], [h, 0]], color, { sides: 20 });
};

// Потайной винт: видна только головка заподлицо с деталью, со шлицем Torx
// в виде тёмного пятна в центре.
function screwHead(mesh, c, axis, r) {
  disc(mesh, c, axis, r, 0.35, PALETTE.bolt);
  disc(mesh, c.map((v, k) => v + axis[k] * 0.35), axis, r * 0.38, 0.05, PALETTE.buffer);
}

// Контур в плане со скруглёнными углами → плоская деталь по Z.
const plateZ = (mesh, cx, cy, w, h, r, z0, z1, color) =>
  addPrism(mesh, roundedRect(cx, cy, w, h, r, 4), z0, z1, color, { top: true, bottom: true });

// Ухо кронштейна: от полки под столешницей к приливу вокруг оси газлифта.
function ear(mesh, y0, y1) {
  const [px, pz] = PIVOT;
  const arc = [];
  for (let k = 0; k <= 10; k++) {
    const a = (150 - (260 * k) / 10) * Math.PI / 180;
    arc.push([px + EAR_R * Math.cos(a), pz + EAR_R * Math.sin(a)]);
  }
  addPlateXZ(mesh, [[BRACKET_X0 + 30, UNDER_1 - 1], [ENTRY_X0 + 1, UNDER_1 - 1], ...arc, [ENTRY_X0 - 6, UNDER_1 - 13], [BRACKET_X0 + 30, UNDER_1 - 7]],
    [y0, y1], PALETTE.hardware);
}

// Опорный выступ, половины петель в П1 и кронштейны — всё это привёрнуто к корпусу и не движется.
export function buildBridgeFrame(mesh) {
  // Полоса 50 × 6 — один плоский лист, прижатый к низу кромочного профиля Sector.
  // Чернёная: единственное, что от узла видно из прохода, и блестеть ему незачем.
  // Торцы и рёбра сняты фаской 1 мм — рубленый прокат так не оставляют.
  const ledge = roundedRect((LEDGE_X0 + LEDGE_X1) / 2, (LEDGE_Y0 + LEDGE_Y1) / 2, LEDGE_X1 - LEDGE_X0, LEDGE_Y1 - LEDGE_Y0, 3, 3);
  addPrism(mesh, ledge, LEDGE_BOTTOM, UNDER_1, PALETTE.steelDark, { top: true, bottom: true });
  for (let y = BRIDGE_Y0 + FIX_PITCH / 2; y < SIZE; y += FIX_PITCH) {
    // Винт M6 снизу через полосу в футорку столешницы. Головка утоплена
    // в зенковку: под полосой ничего не торчит, снизу видны только её кружки.
    addLathe(mesh, [FIX_X, y, LEDGE_BOTTOM], [FIX_X, y, UNDER_1 + INSERT_DEPTH], [[0, 0], [0, SCREW_R], [LEDGE_T + INSERT_DEPTH, SCREW_R], [LEDGE_T + INSERT_DEPTH, 0]], PALETTE.bolt, { sides: 12 });
    screwHead(mesh, [FIX_X, y, LEDGE_BOTTOM - 0.3], [0, 0, 1], SCREW_HEAD_R);
  }

  // Корпуса скрытых петель в полости П1: внутри не видны, наружу выходит только
  // лицевая планка с прорезью под рычаги и четырьмя винтами.
  for (const y of HINGE_Y) {
    addBox(mesh, [ENTRY_X0 - HINGE_DEPTH, ENTRY_X0 - 0.5], [y - HINGE_LEN / 2, y + HINGE_LEN / 2], [HINGE_Z0, HINGE_Z1], PALETTE.steel);
    hingePlate(mesh, ENTRY_X0, 1, y);
  }

  for (const y of STRUT_Y) {
    // Полка 55 × 36 × 3 под П1, два потайных М6 в заклёпочные гайки.
    plateZ(mesh, BRACKET_X0 + 27.5, y, 55, 36, 4, UNDER_1 - BRACKET_T, UNDER_1, PALETTE.hardware);
    for (const dy of [-10, 10]) screwHead(mesh, [BRACKET_X0 + 16, y + dy, UNDER_1 - BRACKET_T - 0.3], [0, 0, 1], 5.5);
    // Вилка: два уха по сторонам проушины газлифта.
    ear(mesh, y - EAR_GAP - BRACKET_T, y - EAR_GAP);
    ear(mesh, y + EAR_GAP, y + EAR_GAP + BRACKET_T);
    // Ось Ø5 с буртиком и колпачковой гайкой по сторонам вилки.
    const pinY0 = y - EAR_GAP - BRACKET_T - 1.8, pinY1 = y + EAR_GAP + BRACKET_T + 2.2;
    addLathe(mesh, [PIVOT[0], pinY0, PIVOT[1]], [PIVOT[0], pinY1, PIVOT[1]],
      [[0, 0], [0, 4.4], [0.4, 4.8], [1.8, 4.8], [1.8, PIN_R], [pinY1 - pinY0 - 2.2, PIN_R], [pinY1 - pinY0 - 2.2, 4.2], [pinY1 - pinY0 - 0.6, 4.2], [pinY1 - pinY0, 2.6], [pinY1 - pinY0, 0]],
      PALETTE.steel, { sides: 16 });
    // Упор 100°: резиновый буфер на перемычке вилки. В ту же обойму убрана
    // защёлка от 92°.
    plateZ(mesh, ENTRY_X0 + 12, y, 10, 2 * (EAR_GAP + BRACKET_T), 1.5, UNDER_1 - 9, UNDER_1 - 6, PALETTE.hardware);
    addLathe(mesh, [ENTRY_X0 + 12, y, UNDER_1 - 6], [ENTRY_X0 + 12, y, UNDER_1 + 2],
      [[0, 0], [0, 3.6], [6.5, 3.6], [8, 2.6], [8, 0]], PALETTE.buffer, { sides: 16 });
  }
}

// Лицевая планка скрытой петли в торце: стальная, заподлицо с кромкой, с
// прорезью, в которую уходят рычаги, и двумя потайными М4 (вид 37): в П1 —
// в заклёпочные гайки, в секции — в футорки фанерной рамки.
// dir — куда смотрит торец: +1 у Sector (в проём), −1 у секции.
function hingePlate(mesh, x, dir, y) {
  const face = x + dir * HINGE_PLATE;
  const zc = (HINGE_Z0 + HINGE_Z1) / 2;
  const rim = roundedRect(y, zc, HINGE_LEN, HINGE_Z1 - HINGE_Z0, 5, 4);
  const at = (pts, xx) => pts.map(([py, pz]) => [xx, py, pz]);
  const plate = at(rim, face);
  addPolygon(mesh, dir > 0 ? plate : plate.slice().reverse(), PALETTE.steel);
  for (let i = 0; i < rim.length; i++) {
    const a = rim[i], b = rim[(i + 1) % rim.length];
    addQuad(mesh, [x, a[0], a[1]], [x, b[0], b[1]], [face, b[0], b[1]], [face, a[0], a[1]], PALETTE.steel);
  }
  // Прорезь под рычаги: тёмная, чуть глубже планки.
  const slot = at(roundedRect(y, zc, HINGE_LEN - 36, 9, 4.5, 4), face + dir * 0.05);
  addPolygon(mesh, dir > 0 ? slot : slot.slice().reverse(), PALETTE.buffer);
  for (const dy of [-HINGE_LEN / 2 + 9, HINGE_LEN / 2 - 9]) screwHead(mesh, [face, y + dy, zc], [dir, 0, 0], 3.6);
}

// Что сидит в самой секции и едет вместе с ней.
//
// Ригелей Ø10 в гнёздах выступа здесь нет, хотя на листах 20 и 23 они были.
// Задумывались они как держатель закрытой секции от подъёма, но работать так
// не могут: ось ригеля стоит в 796 от петли, и при повороте он идёт не вдоль
// гнезда, а поперёк — почти вертикально вверх. Круглый штырь в круглом гнезде
// такое движение не пускает вовсе, то есть секция просто не открывается.
// Держать её закрытой нечем и не нужно: собственный вес 14 кг даёт около 55 Н·м
// на закрывание против примерно 42 Н·м от двух сжатых газлифтов (F₁ ≈ 250 Н,
// в сжатом положении ≈ 325 Н) — прижим около 13 Н·м, на ручке ≈ 16 Н.
export function buildBridgeFittings(mesh) {
  // Три накладки POM в четверти по кромке: ими секция и приземляется на полосу.
  // Чёрный полиацеталь со скруглёнными концами — в поднятом мосту их видно
  // по кромке, и белые прямоугольники читались бы наклейками.
  for (const y of POM_Y)
    plateZ(mesh, LEAF_X1 - POM_W / 2 - 1, y, POM_W, POM_LEN, POM_W / 2 - 0.5, UNDER_1 + 0.4, UNDER_1 + REBATE_D, PALETTE.pom);

  // Ответные корпуса петель в торце секции: едут вместе с ней вокруг оси 820.
  for (const y of HINGE_Y) {
    addBox(mesh, [LEAF_X0 + 0.5, LEAF_X0 + HINGE_DEPTH], [y - HINGE_LEN / 2, y + HINGE_LEN / 2], [HINGE_Z0, HINGE_Z1], PALETTE.steel);
    hingePlate(mesh, LEAF_X0, -1, y);
  }

  // Проушина B газлифта: вилка на пластине, привёрнутой к потолку канала
  // 4 × М4 в футорки фанерной закладной, 200 от оси петли, ось на 25 ниже плоскости.
  for (const y of STRUT_Y) {
    plateZ(mesh, STRUT_B[0], y, 44, CHANNEL_W - 6, 4, CHANNEL_TOP - BRACKET_T, CHANNEL_TOP - 0.05, PALETTE.hardware);
    for (const dx of [-15, 15]) for (const dy of [-8, 8])
      screwHead(mesh, [STRUT_B[0] + dx, y + dy, CHANNEL_TOP - BRACKET_T - 0.3], [0, 0, 1], 3.8);
    const lug = [];
    for (let k = 0; k <= 8; k++) {
      const a = Math.PI + (Math.PI * k) / 8;
      lug.push([STRUT_B[0] + 6 * Math.cos(a), STRUT_B[1] + 6 * Math.sin(a)]);
    }
    const earOutline = [[STRUT_B[0] + 6, CHANNEL_TOP - BRACKET_T], [STRUT_B[0] - 6, CHANNEL_TOP - BRACKET_T], ...lug];
    addPlateXZ(mesh, earOutline, [y - EAR_GAP - 2.5, y - EAR_GAP], PALETTE.hardware);
    addPlateXZ(mesh, earOutline, [y + EAR_GAP, y + EAR_GAP + 2.5], PALETTE.hardware);
    addLathe(mesh, [STRUT_B[0], y - EAR_GAP - 3.8, STRUT_B[1]], [STRUT_B[0], y + EAR_GAP + 3.8, STRUT_B[1]],
      [[0, 0], [0, 3.6], [1.3, 3.6], [1.3, 2], [2 * EAR_GAP + 6.3, 2], [2 * EAR_GAP + 6.3, 3.6], [2 * EAR_GAP + 7.6, 3.6], [2 * EAR_GAP + 7.6, 0]],
      PALETTE.steel, { sides: 14 });
  }
}

// Ось газлифта в закрытом положении и её длина: от них считается вся кинематика.
const AXIS0 = [STRUT_B[0] - STRUT_A[0], STRUT_B[1] - STRUT_A[1]];
export const STRUT_ANGLE_0 = Math.atan2(AXIS0[1], AXIS0[0]);
export const STRUT_LEN_0 = Math.hypot(AXIS0[0], AXIS0[1]);

const along = (t, y) => [
  STRUT_A[0] + Math.cos(STRUT_ANGLE_0) * t,
  y,
  STRUT_A[1] + Math.sin(STRUT_ANGLE_0) * t,
];

// Проушина наконечника: кольцо поперёк оси газлифта, вокруг оси шарнира.
function eye(mesh, c, r, color) {
  addLathe(mesh, [c[0], c[1] - EYE_W / 2, c[2]], [c[0], c[1] + EYE_W / 2, c[2]],
    [[0, PIN_R + 0.2], [0, r - 0.6], [0.6, r], [EYE_W - 0.6, r], [EYE_W, r - 0.6], [EYE_W, PIN_R + 0.2]], color, { sides: 20 });
}

// Корпус газлифта: наконечник на оси кронштейна, гильза с донцем, кольцевой
// накаткой и завальцовкой у выхода штока.
export function buildStrutTube(mesh) {
  for (const y of STRUT_Y) {
    eye(mesh, along(0, y), EYE_A_R, PALETTE.steel);
    addLathe(mesh, along(EYE_A_R - 1, y), along(BODY_T0 + 1, y), [[0, 0], [0, 3.4], [BODY_T0 - EYE_A_R + 2, 3.4], [BODY_T0 - EYE_A_R + 2, 0]], PALETTE.steel, { sides: 12 });
    const L = BODY_T1 - BODY_T0;
    addLathe(mesh, along(BODY_T0, y), along(BODY_T1, y), [
      [0, 0], [0, 4.2], [0.8, 6.2], [2.4, TUBE_R],
      [L - 12, TUBE_R], [L - 11.4, TUBE_R - 0.5], [L - 10.2, TUBE_R - 0.5], [L - 9.6, TUBE_R],
      [L - 1.6, TUBE_R], [L - 0.4, TUBE_R - 1.2], [L, 4.8], [L, ROD_R + 0.4], [L - 1, ROD_R + 0.2],
    ], PALETTE.gasTube, { sides: 28 });
  }
}

// Шток и его наконечник: в закрытом положении шток почти целиком в гильзе,
// наружу выходит ход. Резьбовая втулка наконечника — под ключ, с фаской.
export function buildStrutRod(mesh) {
  const tip = STRUT_LEN_0 - ROD_END_T;
  for (const y of STRUT_Y) {
    addLathe(mesh, along(ROD_T0, y), along(tip, y), [[0, 0], [0, ROD_R], [tip - ROD_T0, ROD_R], [tip - ROD_T0, 0]], PALETTE.gasRod, { sides: 20 });
    addLathe(mesh, along(tip - 1, y), along(STRUT_LEN_0 - EYE_B_R + 1, y),
      [[0, 0], [0, 3.8], [0.6, 4.2], [ROD_END_T - EYE_B_R + 2, 4.2], [ROD_END_T - EYE_B_R + 2, 0]], PALETTE.steel, { sides: 12 });
    eye(mesh, along(STRUT_LEN_0, y), EYE_B_R, PALETTE.steel);
  }
}

// Положение газлифта при угле подъёма секции: насколько повернулась ось и
// насколько выдвинулся шток. Проушина B едет вместе с секцией вокруг петли.
export function strutPose(deg) {
  const rad = (deg * Math.PI) / 180;
  const c = Math.cos(rad), s = Math.sin(rad);
  const rx = STRUT_B[0] - ENTRY_X0, rz = STRUT_B[1] - LEVEL_1;
  const bx = ENTRY_X0 + c * rx - s * rz;
  const bz = LEVEL_1 + s * rx + c * rz;
  const dx = bx - STRUT_A[0], dz = bz - STRUT_A[1];
  return {
    turn: Math.atan2(dz, dx) - STRUT_ANGLE_0,
    extend: Math.hypot(dx, dz) - STRUT_LEN_0,
  };
}
