// Электрика CENTRUM целиком — листы 12, 16 и 50. Одно описание на всё: где стоят
// щит, блоки питания, ресивер и блок розеток, по каким лоткам идут линии, какой
// у каждой группы автомат и нагрузка. Из него строится схема проводки в 3D
// (build-electrics.js), а tools/check-math.mjs сверяет с ним числа на листах.
//
// Координаты — как у всех строителей корпуса, до отражения (mirror.js): Tech Bay
// в углу x = 0, y = 0, холодильник и ящики на грани x = 2700, экран на оси y = 0.
// Так же нарисованы планы на листах: экран вверху, левая рука сидящего — слева.
// Угол a — от центра стола, 270° — ось экрана, 270° + φ — φ вправо от сидящего.
//
// Почему магистраль идёт в поясе, а не по корпусу. Под рабочим кольцом корпус
// занят на всю глубину: ящики у оси y = 1350 доходят задней стенкой до R1050,
// а Tech Bay с шахтой — до скоса у R1070. Сплошного хода по корпусу нет.
// Пустота пояса над первым уровнем (+776…+1210, от стенки R1150 до фасада)
// идёт непрерывно от спуска слева до спуска справа, поэтому три лотка лежат там:
// силовой и слаботочный внизу, под кассетами динамиков, данные — над ними.

import {
  CENTER, R_BELT_HIGH, BELT_WALL, LEVEL_1, LEVEL_2, TOP_THICK, PLINTH, CARCASS_BOTTOM,
  TECH_SHAFT, TECH_TRAY_Z, FRIDGE_Y,
} from './params.js';
import { LED_END_Y, LED_JOINT_GAP } from './build-led.js';
import { CELLS, CELL_W, RAIL_GAP, SIDE } from './drawer-geometry.js';
import { POSTS, SOCKET_Z, powerFrames, qiSpots } from './sockets.js';
import { SPEAKER_CHANNELS, SPEAKER_Z } from './build-speakers.js';

const D = Math.PI / 180;
// Точка на радиусе r под углом a (градусы) на отметке z.
export const at = (r, a, z) => [CENTER + r * Math.cos(a * D), CENTER + r * Math.sin(a * D), z];
// Мировой угол sockets.js и build-speakers.js → угол до отражения.
const pre = (worldRad) => (((180 - worldRad / D) % 360) + 360) % 360;
// Угол от оси экрана, плюс — вправо от сидящего.
export const phi = (a) => a - 270;

// ─── Где стоит оборудование ─────────────────────────────────────────────────
// Коробка — [x0, x1], [y0, y1], [z0, z1].
const Z_FLOOR = PLINTH + CARCASS_BOTTOM;  // 116 — дно модулей корпуса

// ЭО — сухой электроотсек в К2, за экраном, дверца на наружной грани y = 0.
// Глубина К2 у оси — 300 (до стенки ниши R1050), отсек занимает 250 из них.
export const EO = { x: [1150, 1550], y: [16, 266], z: [Z_FLOOR, 744] };
export const EO_DOOR = { x: [1160, 1540], z: [140, 720] };
// Винты У6 (лист 38: М8 × 40 изнутри модуля корпуса вверх, во втулку пояса)
// крутят на месте, после установки каждой части пояса (шаг 9, лист 42): до
// монтажа пояса их не во что крутить. В К2 к ним добираются через сервисные
// панели в стенке ниши ног у концов К2 (лист 35), не через дверцу ЭО.
// Всё оборудование ЭО крепится к задней стенке отсека y = 266 (решение владельца
// 28.09.2026): спереди в плоскости y = 16 теперь проём дверцы, держаться там не на чем.
// От дверцы до лица щита — 140, до лица блоков — ≈ 200: рука и отвёртка проходят.
export const EO_BACK = EO.y[1];
const onBack = (depth) => [EO_BACK - depth, EO_BACK];
// Щит на DIN-рейке, 12 модулей: ввод, УЗО, пять автоматов, реле, шина PE.
export const PANEL = { x: [1200, 1500], y: onBack(110), z: [470, 720] };
// БП-1 — 24 В 240 Вт (класса HLG-240H-24, 244 × 68 × 39): LED, ящики, Qi.
export const PSU_LIGHT = { x: [1180, 1424], y: onBack(39), z: [380, 448] };
// БП-2 — 24 В 150 Вт (класса HLG-150H-24, 199 × 63 × 39): приводы Tech Bay.
export const PSU_TECH = { x: [1180, 1379], y: onBack(39), z: [290, 353] };
// КС — контроллер света: две зоны L/R, белый или RGB, вход сенсорных кнопок.
export const CTRL_LIGHT = { x: [1440, 1540], y: onBack(40), z: [380, 448] };
// КТ — контроллер Tech Bay: последовательность, концевики, ток моторов, кнопка.
export const CTRL_TECH = { x: [1400, 1540], y: onBack(40), z: [290, 360] };
// Ввод из комнаты: снизу через выемку цоколя, сальник в дне К2.
export const INLET = [1300, 60, PLINTH];

// Масса начинки ЭО (28.09.2026, лист 32: «модуль К2 без ЭО» — вот довесок).
// При переезде снимается отдельно (мелкая деталь, лист 32 «до 15 кг»), поэтому
// к массе разбираемого модуля К2 (23 кг) не прибавляется — учтена отдельно.
export const EO_MASS_KG = {
  panel: 2.0,   // щит DIN 12 модулей: автоматы, УЗО, реле, шина PE, рейка
  psuLight: 0.7, // БП-1, класс HLG-240H-24
  psuTech: 0.5,  // БП-2, класс HLG-150H-24
  controllers: 0.3, // КС + КТ
  wiring: 0.5,   // жгуты, разъёмы GST18, крепёж
  get total() { return this.panel + this.psuLight + this.psuTech + this.controllers + this.wiring; },
};

// Блок розеток Tech Bay — на дне шахты, в половине 230 В: ПК, четыре экрана, резерв.
export const TECH_SOCKETS = { x: [TECH_SHAFT.x[0] + 14, TECH_SHAFT.x[0] + 74], y: [TECH_SHAFT.y[1] - 25, TECH_SHAFT.y[1]], z: [150, 490], places: 6 };

// Розетка холодильника — на задней стенке ниши, у верхнего угла со стороны К2.
export const FRIDGE_SOCKET = [2225, FRIDGE_Y[0] + 60, 200];

// АМ — аудиомодуль 5.1 (опция) в хвосте К7, на левом боку: ресивер на выдвижной
// полке, лицом к грани x = 0. Ниша 440 × 330 × 160 — компактный AV-ресивер;
// за ним 40 под разъёмы. Дверца с решёткой на грани, сабвуфер — снаружи на полу.
export const RECEIVER = { x: [30, 360], y: [1950, 2390], z: [150, 310] };
export const RECEIVER_DOOR = { y: [1930, 2410], z: [130, 330] };
export const RECEIVER_SOCKETS = { x: [370, 400], y: [1960, 2060], z: [160, 260], places: 2 };
export const SUB = { x: [-560, -260], y: [2200, 2500], z: [0, 350] };   // место по замеру

// Хаб правой панели для наушников (audio-routes.js, опция «Боковые панели»):
// USB 2.0 держит 5 м от порта хаба до устройства, а жгут от распределителя в
// Tech Bay до правой панели идёт через пояс — 4,5 м трассы. Второй хаб с питанием
// стоит в поясе над стояком ящиков, над лотками: до панели от него около 1 м.
// Коробка 90 × 60 × 25, питание 24 В прямо от БП-1 (не через КС: хаб включён всегда),
// внутри преобразователь на 5 В; доступ — через съёмную наружную панель пояса.
// Ближний угол коробки — за стенкой пояса R1150…1212 (params.js, BELT_WALL).
export const HP_HUB = { at: [2524, 840, 850], size: [90, 60, 25], w: 6 };

// Кассеты динамиков 240 × 240 × 150 за стенкой, центр на +1015 (виды 24–26).
// Лицо кассеты — сразу за решёткой и кольцом, в круге Ø186, где войлок вырезан
// (вид 28; динамик не утапливать, вид 25). Кассета стоит в пазу стенки и
// проходит её лист насквозь; зад на R1316 — до фасада у оси экрана 18.
export const CASSETTE = { w: 240, depth: 150, r: R_BELT_HIGH + 16 };
// Всё, что идёт вдоль стенки пояса, — за её листом (R1212) с запасом 8:
// сквозь стенку кабель проходит только поперёк, к своему прибору.
export const BEHIND_WALL = R_BELT_HIGH + BELT_WALL + 8;   // 1220
// Dock монитора — коробка за листом стенки у оси экрана, на отметке лотка данных.
export const DOCK_R = BEHIND_WALL + 15;
export const SPEAKERS = SPEAKER_CHANNELS.map(({ id, deg }) => ({ id, a: 270 + deg }));

// ─── Лотки в поясе ──────────────────────────────────────────────────────────
// Радиус — ось лотка, дуга — от угла from до to через ось экрана. Лоток 44 в ширину:
// Л-230 — вплотную за стенкой пояса (R1212, запас 6), Л-24 — за ним через 6.
// Слева всё кончается у стояка в К7 (160°), справа силовой — за постом П (355°),
// слаботочный — у Rs (370° = 10°). Пересечения стыков пояса — разъёмы (вид 40).
export const TRAYS = {
  power: { id: 'Л-230', r: 1240, z: 800, from: 160, to: 355 },
  low: { id: 'Л-24', r: 1290, z: 800, from: 160, to: 370 },
  data: { id: 'Л-Д', r: 1250, z: TECH_TRAY_Z, from: 160, to: 270 },
};
// Стыки пояса по углу: ±15°, ±60° от оси и поперечные y = 1750 на спусках.
const DESCENT_JOINT = Math.asin((1750 - CENTER) / 1200) / D;
export const BELT_JOINTS = [180 - DESCENT_JOINT, 210, 255, 285, 330, 360 + DESCENT_JOINT];
// Шахта Tech Bay — угол её центра; через неё все линии уходят вниз к ПК.
export const SHAFT_A = Math.atan2((TECH_SHAFT.y[0] + TECH_SHAFT.y[1]) / 2 - CENTER, (TECH_SHAFT.x[0] + TECH_SHAFT.x[1]) / 2 - CENTER) / D + 360;
// Стояк в К7 к аудиомодулю — у y ≈ 1770, где пустота пояса ещё +776…+1110.
export const K7_RISER_A = 160;

// Посты розеток и места Qi — из sockets.js (рамки MAX, отверстия под них).
export const POST_FRAMES = powerFrames('max').map((f) => ({ ...f, a: pre(f.angle) }));
export const QI = qiSpots('max').map((q) => ({ ...q, a: pre(q.angle) }));

// LED: подводы к вставкам — по одному на часть пояса (вид 40): В1 — L1 + R1 у оси,
// В3 — L2 + L3, В2 — R2 + R3 на их стыках, В5 и В4 — L4 и R4 у верхнего конца.
export const LED_FEEDS = [
  { id: 'В1', a: 270 }, { id: 'В3', a: 232.5 }, { id: 'В2', a: 307.5 }, { id: 'В5', a: 205 }, { id: 'В4', a: 335 },
];
export const LED_R = R_BELT_HIGH - 30;                   // ось паза: 18 + 24 / 2 от стенки
export const LED_Z = LEVEL_2 - TOP_THICK;

// ─── Нагрузки ───────────────────────────────────────────────────────────────
// Лента: от конца спуска слева через ось экрана до конца спуска справа, минус
// семь перегородок между вставками. Считается от тех же чисел, что и build-led.js.
const LED_END_A = Math.asin((LED_END_Y - CENTER) / R_BELT_HIGH) / D;   // ≈32,5° за ось x
export const LED_LENGTH = ((180 + 2 * LED_END_A) / 180) * Math.PI * LED_R - 7 * LED_JOINT_GAP; // ≈4,76 м
export const LED_W_PER_M = 14.4;                         // 24 В, CRI ≥ 90; RGB — та же мощность
// Профиль ящика: ширина короба между стенками минус отступы (build-drawer.js).
export const DRAWER_LED_LENGTH = CELL_W - 2 * (RAIL_GAP + SIDE + 10);
export const DRAWER_LED_W_PER_M = 9.6;
export const QI_W = 20;                                  // потребление модуля 15 Вт на выходе

const round = (v, step = 1) => Math.round(v / step) * step;
export const LOADS_24 = {
  light: [
    { id: 'LED пояса', w: round(LED_LENGTH / 1000 * LED_W_PER_M) },
    { id: 'LED ящиков · 9', w: round(CELLS.length * DRAWER_LED_LENGTH / 1000 * DRAWER_LED_W_PER_M), option: 'drawerLighting' },
    { id: 'Qi · 3', w: QI.length * QI_W },
    // два порта по 0,5 А при 5 В — 5 Вт, преобразователь 85 % — около 6 Вт
    { id: 'хаб наушников справа', w: HP_HUB.w, option: 'headphoneSides' },
  ],
  // Приводы работают по очереди (вид 49): отход кареток, подъём, поддон.
  // Блок считается по самому тяжёлому шагу с пусковым током ×2.
  tech: [
    { id: 'подъём фасада', w: 60 },
    { id: 'поддон', w: 40 },
    { id: 'отход кареток · 2 из 4', w: 24 },
  ],
};
export const PSU = {
  light: { id: 'БП-1', w: 240, box: PSU_LIGHT },
  tech: { id: 'БП-2', w: 150, box: PSU_TECH },
};
export const psuLoad = (key) => key === 'light'
  ? LOADS_24.light.reduce((s, l) => s + l.w, 0)
  : 2 * Math.max(...LOADS_24.tech.map((l) => l.w));

// Группы 230 В. Ввод — вилка 16 А (или подключение электриком), дифавтомат 16 А
// 30 мА тип A; дальше пять автоматов. w — расчётная мощность группы.
export const INPUT = { amps: 16, rcd: 30 };
export const GROUPS = [
  { id: 'QF1', amps: 10, name: 'Tech Bay: ПК и экраны', w: 650 + 4 * 90, parts: 'ПК до 650 · 4 экрана по 90' },
  { id: 'QF2', amps: 10, name: 'посты П и Л', w: 1500, parts: 'ноутбук, лампа, зарядки; USB-модули' },
  { id: 'QF3', amps: 6, name: 'холодильник', w: 70, parts: 'пуск ≈ 500' },
  { id: 'QF4', amps: 6, name: 'звук 5.1 · опция', w: 250 + 150, parts: 'ресивер 250 · сабвуфер 150', option: 'audio51' },
  { id: 'QF5', amps: 6, name: 'БП-1 и БП-2 · 24 В', w: 240 + 150, parts: 'по номиналу блоков' },
];
export const totalW = () => GROUPS.reduce((s, g) => s + g.w, 0);

// ─── Трассы ─────────────────────────────────────────────────────────────────
// Дуга лотка между углами a0 и a1, по точке на каждые ≤ 5°.
export function arc(tray, a0, a1, { r = tray.r, z = tray.z } = {}) {
  const n = Math.max(1, Math.ceil(Math.abs(a1 - a0) / 5));
  return Array.from({ length: n + 1 }, (_, i) => at(r, a0 + ((a1 - a0) * i) / n, z));
}
const T = TRAYS;
const mid = ([a, b]) => (a + b) / 2;
const shaftPower = [TECH_SHAFT.x[0] + 44, TECH_SHAFT.y[0] + 150];  // половина 230 В — к углу стола
// Данные — к центру, за перегородкой, у задней стенки: выше +760 стояк за стенкой пояса (r 1226).
const shaftData = [TECH_SHAFT.x[0] + 184, TECH_SHAFT.y[0] + 10];
export const SHAFT_DATA = shaftData;
// Стояк подсветки ящиков — в зазоре 30 за коробами (x = 2416), у первого ряда.
export const DRAWER_RISER = [2416, CELLS[0].y0 + 10];
const k7 = (tray) => at(tray.r, K7_RISER_A, tray.z);
const RISER_230 = [1350, 110];   // из ЭО вверх в пояс: у оси экрана r = 1240
const RISER_24 = [1330, 60];     // r = 1290
const RISER_DATA = [1370, 100];  // r = 1250
const RAIL_WINDOW_Z = 1196;      // каналы кабелей за верхней шиной (виды 46, 48)

// Линия: система, откуда, куда, кабель, трасса. Длина считается по трассе.
// Системы: 230 — силовая, 24 — постоянный ток и кнопки, audio — акустика,
// data — видео, USB и сеть, pe — уравнивание потенциалов.
export function lines() {
  const out = [];
  const add = (system, id, from, to, cable, path, extra = {}) => out.push({ system, id, from, to, cable, path, ...extra });

  // От щита на задней стенке — вперёд под потолком ЭО к стоякам у передней стенки.
  const fromPanel = [[RISER_230[0], PANEL.y[0], PANEL.z[1]], [RISER_230[0], RISER_230[1], PANEL.z[1]]];

  // 230 В
  add('230', 'W0', 'щит помещения', 'ЭО', 'ПВСнг(А)-LS 3 × 2,5, вилка 16 А', [[1300, -900, 0], [1300, -60, 0], [1300, 60, 0], INLET, [1300, 60, PANEL.z[0]], [1300, PANEL.y[0], PANEL.z[0]]], { fixed: 3 });
  add('230', 'W1', 'ЭО · QF1', 'блок розеток Tech Bay', 'ПВСнг(А)-LS 3 × 1,5', [
    ...fromPanel, [RISER_230[0], RISER_230[1], T.power.z], ...arc(T.power, 270, SHAFT_A),
    [...shaftPower, T.power.z], [...shaftPower, TECH_SOCKETS.z[1]], [mid(TECH_SOCKETS.x), mid(TECH_SOCKETS.y), TECH_SOCKETS.z[1]]], { span: [270, SHAFT_A] });
  const [right, left] = ['right', 'left'].map((post) => POST_FRAMES.filter((f) => f.post === post));
  for (const [post, frames, id] of [['П', right, 'W2.1'], ['Л', left, 'W2.2']]) {
    const as = frames.map((f) => f.a).sort((p, q) => p - q);
    const aMid = mid([as[0], as.at(-1)]);
    add('230', id, 'ЭО · QF2', `пост ${post}`, 'ПВСнг(А)-LS 3 × 1,5', [
      ...fromPanel, [RISER_230[0], RISER_230[1], T.power.z], ...arc(T.power, 270, aMid),
      at(BEHIND_WALL, aMid, T.power.z), at(BEHIND_WALL, aMid, SOCKET_Z - 30), ...arc(T.power, as[0], as.at(-1), { r: BEHIND_WALL, z: SOCKET_Z - 30 })], { span: [270, aMid] });
  }
  add('230', 'W3', 'ЭО · QF3', 'холодильник', 'ПВСнг(А)-LS 3 × 1,5', [
    [1420, PANEL.y[0], PANEL.z[0]], [1420, 150, PANEL.z[0]], [1420, 150, 200], [2000, 150, 200], [2000, FRIDGE_SOCKET[1], 200], FRIDGE_SOCKET]);
  add('230', 'W4', 'ЭО · QF4', 'розетки АМ: ресивер и сабвуфер', 'ПВСнг(А)-LS 3 × 1,5', [
    ...fromPanel, [RISER_230[0], RISER_230[1], T.power.z], ...arc(T.power, 270, K7_RISER_A),
    k7({ ...T.power, z: 340 }), [385, 1900, 340], [385, mid(RECEIVER_SOCKETS.y), 340], [385, mid(RECEIVER_SOCKETS.y), RECEIVER_SOCKETS.z[1]]], { option: 'audio51', span: [270, K7_RISER_A] });
  // Экраны: шнур 230 В каждой стойки — по своей дорожке за верхней шиной к шахте (лист 48).
  add('230', 'W5', 'блок розеток Tech Bay', 'экран 1 · стойка', 'шнур стойки 8 м', [
    [mid(TECH_SOCKETS.x), mid(TECH_SOCKETS.y), TECH_SOCKETS.z[1] - 40], [...shaftPower, TECH_SOCKETS.z[1] - 40], [...shaftPower, RAIL_WINDOW_Z],
    ...arc(T.power, SHAFT_A, 270, { r: BEHIND_WALL, z: RAIL_WINDOW_Z }), at(1108, 270, RAIL_WINDOW_Z)], { fixed: 8 });
  add('230', 'W6', 'блок розеток Tech Bay', 'ПК', 'шнур ПК', [
    [mid(TECH_SOCKETS.x), mid(TECH_SOCKETS.y), TECH_SOCKETS.z[0] + 60], [250, TECH_SHAFT.y[0] + 10, 270], [250, 480, 270]], { fixed: null });

  // 24 В: подсветка, Qi, ящики — от БП-1 через КС; Tech Bay — от БП-2 через КТ.
  const up24 = [[RISER_24[0], CTRL_LIGHT.y[0], CTRL_LIGHT.z[1]], [RISER_24[0], RISER_24[1], CTRL_LIGHT.z[1]], [RISER_24[0], RISER_24[1], T.low.z]];
  for (const f of LED_FEEDS) add('24', `H${LED_FEEDS.indexOf(f) + 1}`, 'ЭО · КС', `LED · подвод ${f.id}`, '2 × 1,5', [
    ...up24, ...arc(T.low, 270, f.a), at(BEHIND_WALL, f.a, T.low.z), at(BEHIND_WALL, f.a, LED_Z - 20), at(LED_R, f.a, LED_Z - 4)], { span: [270, f.a] });
  for (const q of QI) add('24', q.id, 'ЭО · КС', `Qi ${q.id}`, '2 × 0,75', [
    ...up24, ...arc(T.low, 270, q.a), at(BEHIND_WALL, q.a, T.low.z), at(1140, q.a, LEVEL_1 - 50), at(q.r, q.a, LEVEL_1 - 50), at(q.r, q.a, LEVEL_1)], { span: [270, q.a] });
  // Кнопки подсветки в рамках U и C — один сигнальный кабель на пост, шлейфом по рамкам.
  for (const [post, name, id] of [['right', 'П', 'S1'], ['left', 'Л', 'S2']]) {
    const as = POST_FRAMES.filter((f) => f.post === post && f.kind !== 'P').map((f) => f.a);
    const far = as.reduce((p, q) => (Math.abs(q - 270) > Math.abs(p - 270) ? q : p));
    add('24', id, `кнопки поста ${name}`, 'ЭО · КС', '4 × 0,22', [
      ...up24, ...arc(T.low, 270, far), at(1260, far, SOCKET_Z - 20), at(1190, far, SOCKET_Z - 20)], { span: [270, far] });
  }
  // Хаб правой панели для наушников — прямо от БП-1, мимо КС, по лотку до стояка ящиков.
  {
    const [hx, hy, hz] = HP_HUB.at;
    const hubA = Math.atan2(hy - CENTER, hx - CENTER) / D + 360;
    add('24', 'H7', 'ЭО · БП-1', 'хаб наушников справа', '2 × 0,75', [
      ...up24, ...arc(T.low, 270, hubA), [hx, hy, T.low.z], [hx, hy, hz - HP_HUB.size[2] / 2]], { option: 'headphoneSides', span: [270, hubA] });
  }
  // Ящики: стояк в зазоре 30 за коробами, по ряду — шина, к ящику — плоский шлейф.
  const [DRAWER_X, DRAWER_Y] = DRAWER_RISER;
  const rowZ = [...new Set(CELLS.map((c) => c.z1 - 48))];
  const drawerA = Math.atan2(DRAWER_Y - CENTER, DRAWER_X - CENTER) / D + 360;
  add('24', 'H6', 'ЭО · КС', 'LED ящиков · стояк', '2 × 1,0', [
    ...up24, ...arc(T.low, 270, drawerA), [DRAWER_X, DRAWER_Y, T.low.z], [DRAWER_X, DRAWER_Y, rowZ[0]]], { option: 'drawerLighting', span: [270, drawerA] });
  rowZ.forEach((z, i) => add('24', `H6.${i + 1}`, 'стояк ящиков', `ряд ${i + 1} · 3 ящика`, 'шина 2 × 0,5 + шлейфы',
    [[DRAWER_X, DRAWER_Y, z], [DRAWER_X, CELLS.at(-1).y1 - 10, z]], { option: 'drawerLighting' }));

  // Tech Bay: жгут из КТ через К2 вправо, вверх в пояс над отсеком, к моторам.
  const trunk = [[1545, 250, CTRL_TECH.z[1]], [1545, 250, 725], [760, 250, 725], [760, 120, 725]];
  add('24', 'T1', 'ЭО · КТ', 'кнопка отсека', '4 × 0,22', [...trunk, [760, 12, 725], [776, 12, 620]]);
  add('24', 'T2', 'ЭО · КТ', 'мотор подъёма фасада', '2 × 1,0 + датчик', [...trunk, [760, 120, 1100], [180, 120, 1100], [180, 60, 1115]]);
  add('24', 'T3', 'ЭО · КТ', 'приводы кареток · правые', 'спиральный 2 × 0,5', [...trunk, [760, 120, 1100], [740, 40, 1100], [720, 35, 700]]);
  add('24', 'T4', 'ЭО · КТ', 'приводы кареток · левые', 'спиральный 2 × 0,5', [...trunk, [760, 120, 1100], [180, 120, 1100], [200, 40, 1100], [212, 35, 700]]);
  add('24', 'T5', 'ЭО · КТ', 'мотор поддона', '2 × 1,0 + концевики', [
    ...trunk, [760, 120, 1100], [180, 120, 1100], [175, 645, 1100], [175, 645, 200], [205, 645, 200], [205, 522, 200], [226, 522, 200]]);

  // Звук 5.1: ресивер в К7 — вверх стояком в пояс, по слаботочному лотку к кассетам.
  const fromReceiver = (z) => [[RECEIVER.x[1] + 20, mid(RECEIVER.y), z], [385, 1900, z]];
  for (const s of SPEAKERS) add('audio', `A${SPEAKERS.indexOf(s) + 1}`, 'ресивер', `динамик ${s.id}`, '2 × 1,5', [
    ...fromReceiver(360), k7({ ...T.low, z: 360 }), k7({ ...T.low, z: T.low.z + 12 }),
    ...arc({ ...T.low, z: T.low.z + 12 }, K7_RISER_A, s.a), at(1320, s.a, T.low.z + 12), at(1320, s.a, SPEAKER_Z), at(1300, s.a, SPEAKER_Z)], { option: 'audio51', span: [K7_RISER_A, s.a] });
  add('audio', 'A6', 'ресивер', 'сабвуфер', 'RCA и шнур 230 В', [
    [RECEIVER.x[0], RECEIVER.y[1] - 40, RECEIVER.z[0] + 20], [-10, RECEIVER.y[1] - 40, 110], [-40, RECEIVER.y[1] - 40, 0], [SUB.x[1], mid(SUB.y), 0]], { option: 'audio51', fixed: null });

  // Данные: ПК → шахта → лоток данных; видео экранов — по дорожкам за верхней шиной.
  add('data', 'D1', 'ПК', 'лоток данных', 'пучок ПК', [[272, 480, 280], [272, TECH_SHAFT.y[0] + 30, 280], [...shaftData, 280], [...shaftData, T.data.z], at(T.data.r, SHAFT_A, T.data.z)], { fixed: null });
  add('data', 'D2', 'ПК', 'экран 1 · стойка', 'оптический HDMI 2.1, 8 м', [
    [...shaftData, 300], [...shaftData, RAIL_WINDOW_Z], ...arc(T.data, SHAFT_A, 270, { r: BEHIND_WALL + 15, z: RAIL_WINDOW_Z }), at(1108, 270, RAIL_WINDOW_Z)], { fixed: 8 });
  add('data', 'D3', 'ПК', 'Dock', 'USB-C и RJ45', [...arc(T.data, SHAFT_A, 270), at(DOCK_R, 270, T.data.z)]);
  add('data', 'D4', 'ПК', 'ресивер', 'оптический HDMI 2.1, 5 м', [
    ...arc(T.data, SHAFT_A, K7_RISER_A), k7({ ...T.data, z: 380 }), [385, 1900, 380], [RECEIVER.x[1] + 20, mid(RECEIVER.y) + 60, 380]], { option: 'audio51', fixed: 5 });
  add('data', 'D5', 'сеть помещения', 'ПК', 'Cat 6', [
    [1400, -900, 0], [1400, 60, 0], [1400, 60, PLINTH], [RISER_DATA[0], RISER_DATA[1], PLINTH + 60], [RISER_DATA[0], RISER_DATA[1], T.data.z]]);

  // PE: шина в ЭО → шины мониторов (перемычки на стыках, вид 47) и металл Tech Bay.
  // Вверх — за листом стенки, к шинам — отводами сквозь лист на +840 и +1196.
  add('pe', 'PE1', 'ЭО · PE', 'шины мониторов', 'ПуГВ 1 × 4', [[1480, PANEL.y[0], PANEL.z[0]], [1480, 120, PANEL.z[0]], [1480, 120, 840], at(BEHIND_WALL, 270, 840), at(BEHIND_WALL, 270, 1196), at(R_BELT_HIGH, 270, 1196)]);
  add('pe', 'PE2', 'ЭО · PE', 'металл Tech Bay', 'ПуГВ 1 × 4', [[1520, PANEL.y[0] + 40, PANEL.z[0]], [1520, 250, 700], [720, 250, 700], [720, 120, 700]]);
  return out;
}

export const pathLength = (path) => path.slice(1).reduce((s, p, i) => s + Math.hypot(...p.map((v, k) => v - path[i][k])), 0);
// Длина в журнал: по трассе + 10 % + по 300 на разделку с обеих сторон, вверх до 0,5 м.
// Шнуры в комплекте (стойки, ввод) — своей длины; кабели клиента (ПК, сабвуфер) — без длины.
export const cableLength = (path) => Math.ceil((pathLength(path) * 1.1 + 600) / 500) / 2;
export const journalLength = (line) => (line.fixed !== undefined ? line.fixed : cableLength(line.path));

// Сколько разъёмов на стыках пояса нужно каждому лотку: столько стыков лежит на его дуге.
export const trayJoints = (tray) => BELT_JOINTS.filter((a) => a > tray.from && a < tray.to).length;

// Какие стыки пояса пересекает участок линии по лотку.
export const crossed = ([a0, a1]) => BELT_JOINTS.filter((j) => j > Math.min(a0, a1) && j < Math.max(a0, a1));
// Разъёмы на стыках пояса. 230 В — пара GST18 на каждую цепь на каждом стыке:
// цепи разных автоматов в одну колодку не сводим. 24 В с кнопками и акустика —
// по одной многоконтактной колодке на стык, который пересекает хоть одна линия.
// Данные не рвутся: кабель протягивают целиком через окна в торцах частей.
export function jointConnectors() {
  const all = lines().filter((l) => l.span);
  const perJoint = (system) => new Set(all.filter((l) => l.system === system).flatMap((l) => crossed(l.span))).size;
  return {
    '230': all.filter((l) => l.system === '230').reduce((n, l) => n + crossed(l.span).length, 0),
    '24': perJoint('24'),
    audio: perJoint('audio'),
  };
}
