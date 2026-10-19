// Расстановка покупных предметов — одно описание на сайт и на Blender.
//
// Сайт читает его в load-monitor.js, Blender получает его же через выгрузку
// tools/export-premium-core.mjs (поле props в geometry.json) и ставит предметы
// скриптом tools/update-props.py. Переставить предмет — значит поменять числа
// здесь и запустить tools/render.sh; больше нигде их нет.
//
// Преобразование точки модели (в координатах GLB после матриц её узлов) в мм
// CENTRUM идёт в таком порядке: axis (+ base) → flipX → turn → scale → offset.
//   axis   — 3×3 по строкам: перекладывает оси GLB в систему CENTRUM (Z вверх);
//   base   — сдвиг сразу после axis, в единицах модели (центровка кресла);
//   flipX  — переворот на 180° вокруг X;
//   turn   — разворот вокруг вертикали, рад;
//   scale  — число или [x, y, z];
//   offset — точка установки, мм.
// Blender ставит предметы той же матрицей; ничего своего для него здесь нет.

import { CENTER, LEVEL_1, LEVEL_2, R_BELT_HIGH } from './params.js';
import { FRAME_KINDS, PACKAGE_IDS, SOCKET_FRAME, SOCKET_Z, powerFrames } from './sockets.js';
import { PAD_THICK } from './build-worktop-pad.js';

// onPad — предмет стоит на рабочей поверхности внутри контура накладки. Когда
// накладка включена, такие предметы поднимаются на её толщину, иначе они
// утонули бы в коже; сайт (viewer.js) и Blender (render-all-premium-cameras.py)
// берут подъём отсюда.
export const PAD_LIFT = PAD_THICK;

const I = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
const XZ_NEGY = [[1, 0, 0], [0, 0, 1], [0, -1, 0]]; // [x, z, -y]
const XZY = [[1, 0, 0], [0, 0, 1], [0, 1, 0]];      // [x, z, y]
const X_NEGZ_Y = [[1, 0, 0], [0, 0, -1], [0, 1, 0]]; // [x, -z, y] — поворот, не зеркало
const deg = (d) => d * Math.PI / 180;

// MacBook экспортирован в условных единицах: ширина корпуса 2,99. Масштаб ниже
// даёт паспортные 356 мм. Ноутбук отнесён от монитора по дуге, на 100 мм ближе
// к человеку, и слегка развернут
// к человеку; дальний угол крышки остаётся перед внутренней стенкой R1150
// с зазором около 37 мм. Разворот — одно значение на загрузчик и анимацию крышки.
const LAPTOP = {
  name: 'laptop', url: 'assets/3d/apple_macbook_pro_16_inch_2021.glb',
  scale: 356 / 2.99, offset: [CENTER + 565, 775, LEVEL_1 - 0.2], axis: XZY, turn: deg(18), onPad: true,
};

// Кружка экспортирована в метрах, но узел Sketchfab дополнительно увеличивает её
// в 2,15 раза. Масштаб 1000 / 2,1499 возвращает реальные Ø82 × 95 мм и пробковую
// подставку Ø100 × 6 мм; её низ — ноль модели, он ложится на рабочую поверхность.
// Место — справа от мыши, перед монитором, вне ножки его подставки, внутри
// кольца R500…R1150 (ось на R≈905, ручка и подставка до R≈990). Ручка развёрнута
// к правой руке сидящего. Вместо исходного зелёного — тёмно-серая глазурь (sRGB).
export const MUG_COLOR = [0.2, 0.205, 0.21];

export const PROPS = [
  // Модель скачана в сантиметровой сцене Sketchfab. 72 переводит её в мм и даёт
  // реалистичную ширину ~772 мм. Монитор висит на руке стойки кольцевой шины
  // (build-monitor-rail.js): лицо на R840, спинка с VESA на R931, центр VESA
  // на +1094, верх экрана на +1269 — вровень с верхней полкой.
  // Высота в файле лежит по -Y; flipX ставит низ вниз, turn π — экран к человеку.
  // clip: подставку из модели убираем — всё ниже +915 и ближе к стенке, чем y = 415
  // (сайт — load-monitor.js, Blender — update-props.py).
  { name: 'monitor', url: 'assets/3d/ultrawide_monitor.glb',
    scale: 72, offset: [CENTER, 500, LEVEL_1 + 274], axis: XZ_NEGY, flipX: true, turn: Math.PI,
    clip: { minZ: LEVEL_1 + 95, minY: 415 } },

  LAPTOP,

  // Наушники на подставке — облегчённая копия Sketchfab-модели: метры, реальный
  // размер (высота 320 мм, основание Ø184), центр основания в нуле, низ на нуле.
  // Левый передний угол второго уровня, зеркально растению: ось основания на
  // R≈1420 по диагонали −45°, до кромки выступа R1090 больше 230 мм. Разворот
  // 225° — лицом к сидящему, кабель уходит к наружной кромке.
  { name: 'headphones', url: 'assets/3d/headphone_stand.glb',
    scale: 1000, offset: [CENTER + 1004, CENTER - 1004, LEVEL_2], axis: X_NEGZ_Y, turn: deg(225) },

  // Горшок на втором уровне напротив ноутбука. Масштаб 500 даёт крону около 383 мм,
  // высоту 491 мм и основание около 170 мм. Низ модели на −0,49011; смещение
  // ставит его точно на второй уровень, листья могут нависать.
  { name: 'plant', url: 'assets/3d/potted_plant.glb',
    scale: 500, offset: [480, 450, LEVEL_2 + 0.4901100099 * 500], axis: I, turn: deg(18) },

  // Независимый масштаб даёт реальные 278,9 × 114,9 × 4,1–10,9 мм по спецификации
  // Apple. Верх и низ в исходнике экспортированы наоборот — отсюда flipX.
  // Буквы в исходной текстуре светло-серые (~0,75) и тоньше пикселя кадра: в
  // рендере клавиши выходили чистыми. keyboard-keys.png — та же раскладка UV,
  // вдвое крупнее, буквы утолщены и затемнены.
  { name: 'keyboard', url: 'assets/3d/apple_magic_keyboard.glb',
    scale: [56.25, 72, 142.83], offset: [CENTER, 660, LEVEL_1 + 3.5], axis: XZ_NEGY, flipX: true, turn: Math.PI, onPad: true,
    textureOverrides: { Keys: 'assets/textures/keyboard-keys.png' } },

  // В исходнике мышь лежит поперёк. Разворот 270° ставит её вдоль руки,
  // масштаб доводит габарит до 62 × 117 мм.
  { name: 'mouse', url: 'assets/3d/computer_mouse_low-poly.glb',
    scale: 33, offset: [CENTER - 340, 700, LEVEL_1], axis: XZY, turn: deg(270), onPad: true },

  // Кресло в условных сантиметрах: масштаб 2,55 даёт около 717 × 642 × 1152 мм.
  // base центрирует исходную геометрию (её центр сдвинут, колёса на Y=34,537)
  // и ставит кресло в центр отверстия колёсами на пол. Перед кресла в исходнике
  // по +Z; разворот π направляет его к монитору.
  { name: 'chair', url: 'assets/3d/gaming_chair_free_download.glb',
    scale: 2.55, offset: [CENTER, CENTER, 0], axis: XZY, base: [-0.4471421242, -93.4203135333, -34.5369549429], turn: Math.PI },

  // iPhone в метрах: масштаб 1000 даёт корпус 73 × 150 мм. Лежит экраном вниз;
  // стекло на локальном −4,375 мм ложится точно на рабочую поверхность. Все углы
  // остаются между кромкой отверстия R500 и внутренней стенкой R1150.
  { name: 'iphone', url: 'assets/3d/iphone_17_pro.glb',
    scale: 1000, offset: [CENTER - 710, CENTER - 470, LEVEL_1 + 0.0043750028 * 1000], axis: I, turn: deg(152), onPad: true,
    // Frosted_glass полагается на стандартный белый baseColorFactor glTF.
    colorOverrides: { Frosted_glass: [1, 1, 1] } },

  // Bambu Lab A1 mini: реальные 347 × 315 × 365 мм. Правая часть рабочей
  // поверхности, ближе к боковой стенке, вне зоны прохода и Bridge.
  // Фронт в исходнике по −Z, после axis — к человеку.
  { name: 'printer', url: 'assets/3d/bambu_lab_a1_mini.glb',
    scale: [490.4, 430.8, 510.3], offset: [449, CENTER + 250, LEVEL_1 - 0.6], axis: XZY, turn: 0, onPad: true },

  { name: 'mug', url: 'assets/3d/coffee_mug.glb',
    scale: 1000 / 2.149899959564209, offset: [CENTER - 650, 720, LEVEL_1], axis: X_NEGZ_Y, turn: deg(-60), onPad: true,
    colorOverrides: { Mug_AppleGreen_Export: MUG_COLOR } },

];

// Рамки постов электрики (места и состав пакетов — sockets.js, лист 45).
// Розетка — правая рамка power_socket.glb (узел 3); модули USB — пустая рамка
// того же файла с гнёздами (usb_module.glb, usb_c_module.glb, узел 0). Все —
// в системе своего узла: рамка 2 × 2 единицы, X — вертикаль, Y — горизонталь,
// Z — наружу, задняя плоскость на Z = 0. У каждой рамки своя касательная
// к цилиндру R1150: X рамки — вверх, Y — по касательной, Z — по нормали внутрь.
// Одно место в разных пакетах может занимать рамка другого вида, поэтому
// предмет — это пара «место + вид»; packages — в каких пакетах он стоит.
// Имена трёх рамок правого поста BASE — прежние: под ними они уже в сцене Blender.
// Рамка и вставка в исходных моделях чисто чёрные (0,008 и 0): на шпоне при LED
// они читались провалами. Антрацит, sRGB — рамка чуть светлее вставки.
export const SOCKET_COLORS = { material: [0.24, 0.24, 0.25], material_1: [0.15, 0.15, 0.16] };
const LEGACY_SOCKET_NAMES = { right0P: 'socket-2', right1P: 'socket-1', right2U: 'socket-usb' };
export const SOCKET_PROPS = (() => {
  const byKey = new Map();
  for (const pkg of PACKAGE_IDS) for (const { post, index, kind, angle } of powerFrames(pkg)) {
    const key = `${post}${index}${kind}`;
    if (!byKey.has(key)) {
      const c = Math.cos(angle), s = Math.sin(angle);
      byKey.set(key, {
        name: LEGACY_SOCKET_NAMES[key] || `socket-${post}-${index}-${kind.toLowerCase()}`,
        url: FRAME_KINDS[kind].url, rootNode: FRAME_KINDS[kind].rootNode,
        scale: SOCKET_FRAME / 2, offset: [CENTER + R_BELT_HIGH * c, CENTER + R_BELT_HIGH * s, SOCKET_Z],
        axis: [[0, -s, -c], [0, c, -s], [1, 0, 0]], turn: 0, packages: [], colorOverrides: SOCKET_COLORS,
      });
    }
    byKey.get(key).packages.push(pkg);
  }
  return [...byKey.values()];
})();

// Сцена Blender и рендеры показывают пакет BASE — он в базовой цене.
PROPS.push(...SOCKET_PROPS.filter((p) => p.packages.includes('base')));

export const prop = (name) => PROPS.find((p) => p.name === name) || SOCKET_PROPS.find((p) => p.name === name);

// Матрица 4×4 (по столбцам, как в WebGL): точка модели → мм CENTRUM.
export function propMatrix({ axis, base = [0, 0, 0], flipX = false, turn = 0, scale, offset }) {
  const [sx, sy, sz] = Array.isArray(scale) ? scale : [scale, scale, scale];
  const f = flipX ? -1 : 1;
  const c = Math.cos(turn), s = Math.sin(turn);
  // Строки после flip: x, f·y, f·z; после turn: [c·x − s·y, s·x + c·y, z].
  const flipped = [axis[0], axis[1].map((v) => v * f), axis[2].map((v) => v * f)];
  const b = [base[0], base[1] * f, base[2] * f];
  const rows = [
    flipped[0].map((v, k) => (c * v - s * flipped[1][k]) * sx),
    flipped[0].map((v, k) => (s * v + c * flipped[1][k]) * sy),
    flipped[2].map((v) => v * sz),
  ];
  const t = [(c * b[0] - s * b[1]) * sx + offset[0], (s * b[0] + c * b[1]) * sy + offset[1], b[2] * sz + offset[2]];
  return [
    rows[0][0], rows[1][0], rows[2][0], 0,
    rows[0][1], rows[1][1], rows[2][1], 0,
    rows[0][2], rows[1][2], rows[2][2], 0,
    t[0], t[1], t[2], 1,
  ];
}

// Ось шарнира крышки MacBook, замерена по нижней кромке узлов 17–23 в осях
// CENTRUM (уже после axis), в единицах модели. В мир переводится теми же
// turn/scale/offset, что и сам ноутбук, поэтому переживает и подъём уровней,
// и смену масштаба.
export const LAPTOP_TURN = LAPTOP.turn;
export const LAPTOP_HINGE = (() => {
  const m = propMatrix({ ...LAPTOP, axis: I });
  const [x, y, z] = [0, -1.0392, 0.0838];
  return [0, 1, 2].map((r) => m[r] * x + m[4 + r] * y + m[8 + r] * z + m[12 + r]);
})();
