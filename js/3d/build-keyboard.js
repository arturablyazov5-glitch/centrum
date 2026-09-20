// Клавиатура: компактная раскладка 60 % — пять рядов шириной 15U, тёмный корпус
// и светлые колпачки с тёмными модификаторами. Шаг клавиши стандартный, 19,05 мм,
// поэтому размер платы на модели совпадает с реальной.

import { CENTER, LEVEL_1 } from './params.js';
import { addPrism, addQuad, roundedRect } from './mesh.js';
import { PALETTE } from './palette.js';

export const KEYBOARD_Y = 660;   // центр платы: между кромкой отверстия и монитором

const U = 19.05;                 // шаг клавиши
const UNITS = 15;                // ширина раскладки в шагах
const ROWS = 5;
const BEZEL = 9;                 // рамка корпуса вокруг поля клавиш
const CASE_H = 13;               // высота корпуса
const CAP_H = 9;                 // высота колпачка
const GAP = 2.6;                 // зазор между колпачками
const SPACE = 6.25;              // ширина пробела в шагах

// Ширины клавиш по рядам, от дальнего к ближнему. Сумма каждого ряда — ровно 15U.
const LAYOUT = [
  [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 2],
  [1.5, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1.5],
  [1.75, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 2.25],
  [2.25, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 2.75],
  [1.25, 1.25, 1.25, SPACE, 1.25, 1.25, 1.25, 1.25],
];

export const KEYBOARD_W = UNITS * U + BEZEL * 2;
export const KEYBOARD_D = ROWS * U + BEZEL * 2;

// Модификаторы шире одного шага и окрашены темнее — кроме пробела.
const capColor = (width) => (width > 1 && width !== SPACE ? PALETTE.keyDark : PALETTE.key);

export function buildKeyboard(mesh) {
  const caseTop = LEVEL_1 + CASE_H;
  addPrism(mesh, roundedRect(CENTER, KEYBOARD_Y, KEYBOARD_W, KEYBOARD_D, 7, 3), LEVEL_1, caseTop, PALETTE.device, { top: true });

  const far = KEYBOARD_Y - KEYBOARD_D / 2 + BEZEL;   // дальний край поля клавиш
  // Пользователь сидит со стороны больших y, поэтому его левая рука — это большие x.
  const left = CENTER + (UNITS * U) / 2;

  LAYOUT.forEach((row, index) => {
    const y0 = far + index * U;
    let offset = 0;
    for (const width of row) {
      const x1 = left - offset * U;
      const x0 = x1 - width * U;
      offset += width;
      const cap = [
        [x0 + GAP / 2, y0 + GAP / 2], [x1 - GAP / 2, y0 + GAP / 2],
        [x1 - GAP / 2, y0 + U - GAP / 2], [x0 + GAP / 2, y0 + U - GAP / 2],
      ];
      addPrism(mesh, cap, caseTop, caseTop + CAP_H, capColor(width), { top: false });
      // Верх колпачка чуть уже боковин — так читается скос профиля.
      const inset = 1.6;
      addQuad(mesh,
        [cap[0][0] + inset, cap[0][1] + inset, caseTop + CAP_H],
        [cap[1][0] - inset, cap[1][1] + inset, caseTop + CAP_H],
        [cap[2][0] - inset, cap[2][1] - inset, caseTop + CAP_H],
        [cap[3][0] + inset, cap[3][1] - inset, caseTop + CAP_H], capColor(width));
    }
  });
}
