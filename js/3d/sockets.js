// Электрика рабочей зоны по пакетам BASE / ADVANCED / MAX — лист 43.
// Одно описание на всё: какие рамки стоят на стенке пояса R1150 и где (props.js,
// load-monitor.js), где в стенке отверстия под их гнёзда (build-core.js), где
// рейки акустики расступаются вокруг рамок (build-acoustic.js) и где в рабочей
// поверхности стоят модули Qi (build-qi.js). Состав пакетов сверяется
// с js/centrum-config.js в tools/check-math.mjs.
//
// Два поста — справа и слева от сидящего, по 70° от оси экрана: вне монитора,
// вне решёток 5.1 (L/R ±30°, Ls/Rs ±100°) и в зоне досягаемости. Пост — ряд
// рамок 84 мм. Первая рамка всех пакетов стоит у края, ближнего к монитору;
// пакет постарше добавляет рамки дальше от экрана, к боку. Поэтому отверстия
// в стенке — под рамки MAX, а у младших пакетов лишние закрыты войлоком
// и рейками акустической ленты.
//
// Стенка — цилиндр, поэтому каждая рамка стоит по своей касательной: угол
// соседних рамок отличается на 2·atan(42,5 / 1150) ≈ 4,2°. Задние кромки рамок
// 84 мм при этом сходятся с зазором 1 мм, а не уходят в стенку.
// Центр рамок на 130 мм выше рабочей поверхности.

import { CENTER, LEVEL_1, R_BELT_HIGH } from './params.js';

export const SOCKET_FRAME = 84;       // рамка, мм
export const SOCKET_HOLE = 64;        // квадратное отверстие в стенке под гнездо, мм
export const SOCKET_Z = LEVEL_1 + 130;
const STEP = 2 * Math.atan((SOCKET_FRAME / 2 + 0.5) / R_BELT_HIGH);
const deg = (d) => d * Math.PI / 180;

// Рамки: P — розетка 220 В (power_socket.glb), U — 2 × USB-A Quick Charge 3.0
// и 2 × USB-C до 100 Вт с сенсорной кнопкой подсветки (usb_module.glb),
// C — 2 × USB-C до 100 Вт с той же кнопкой (usb_c_module.glb).
export const FRAME_KINDS = {
  P: { sockets220: 1, usbC: 0, usbA: 0, url: 'assets/3d/power_socket.glb', rootNode: 3 },
  U: { sockets220: 0, usbC: 2, usbA: 2, url: 'assets/3d/usb_module.glb', rootNode: 0 },
  C: { sockets220: 0, usbC: 2, usbA: 0, url: 'assets/3d/usb_c_module.glb', rootNode: 0 },
};

// Посты в мировой системе сцены (после отражения корпуса, см. mirror.js):
// экран под 270°, справа от сидящего — меньшие углы. first — центр первой
// рамки, у монитора; dir — куда пост растёт.
export const POSTS = {
  right: { name: 'справа', first: deg(200) + STEP, dir: -1 },
  left: { name: 'слева', first: deg(340) - STEP, dir: 1 },
};

// Рамки постов от монитора к боку. Число Qi — модули в рабочей поверхности.
export const POWER_PACKAGES = {
  base: { right: 'PPU', left: 'PP', qi: 1 },
  advanced: { right: 'PPPU', left: 'PPPC', qi: 2 },
  max: { right: 'PPPPU', left: 'PPPPCU', qi: 3 },
};
export const PACKAGE_IDS = Object.keys(POWER_PACKAGES);

// Модули Qi в рабочей поверхности, мировые углы и радиус от центра. Q1 —
// под телефоном справа, Q2 — слева, Q3 — справа сбоку; все вне ножки
// монитора, ноутбука, мыши и кружки и в 265 мм от стальных шайб накладки.
export const QI_SPOTS = [
  { id: 'Q1', angle: deg(213), r: 850 },
  { id: 'Q2', angle: deg(350), r: 850 },
  { id: 'Q3', angle: deg(190), r: 850 },
];
export const QI_D = 90;               // фланец модуля на рабочей поверхности, мм
export const QI_CUT = 80;             // отверстие в столешнице под корпус модуля, мм

export function powerFrames(pkg) {
  const layout = POWER_PACKAGES[pkg];
  return Object.entries(POSTS).flatMap(([post, { first, dir }]) => [...layout[post]].map((kind, index) => ({
    post, index, kind, angle: first + dir * index * STEP,
  })));
}

export const qiSpots = (pkg) => QI_SPOTS.slice(0, POWER_PACKAGES[pkg].qi).map((q) => ({
  ...q, x: CENTER + q.r * Math.cos(q.angle), y: CENTER + q.r * Math.sin(q.angle),
}));

// Состав пакета в штуках — то же, что в centrum-config.js.
export function packageCounts(pkg) {
  const sum = { sockets220: 0, usbC: 0, usbA: 0, qi: POWER_PACKAGES[pkg].qi };
  for (const { kind } of powerFrames(pkg)) for (const key of ['sockets220', 'usbC', 'usbA']) sum[key] += FRAME_KINDS[kind][key];
  return sum;
}

// Отверстия в стенке — под все места MAX.
export const SOCKET_ANGLES = powerFrames('max').map((f) => f.angle);

// Полоса поста по дуге: от кромки первой рамки до кромки последней, углы по возрастанию.
export function postSpans(pkg) {
  const half = Math.atan(SOCKET_FRAME / 2 / R_BELT_HIGH);
  return Object.keys(POSTS).map((post) => {
    const angles = powerFrames(pkg).filter((f) => f.post === post).map((f) => f.angle);
    return { post, from: Math.min(...angles) - half, to: Math.max(...angles) + half };
  });
}
