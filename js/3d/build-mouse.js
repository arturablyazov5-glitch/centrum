// Мышь справа от клавиатуры. Пользователь сидит в отверстии лицом к монитору,
// поэтому его правая рука — это сторона меньших x.
// Корпус собран как гладкая оболочка по сечениям, а не стопкой коробок.

import { CENTER, LEVEL_1 } from './params.js';
import { addLoft, roundedRect } from './mesh.js';
import { PALETTE } from './palette.js';
import { KEYBOARD_Y } from './build-keyboard.js';

const X = CENTER - 340;      // правее клавиатуры с точки зрения сидящего
const Y = KEYBOARD_Y + 40;
const WIDTH = 66;
const DEPTH = 118;
const HEIGHT = 40;
const STEPS = 10;            // сечений по высоте

export function buildMouse(mesh) {
  const sections = [];
  for (let i = 0; i <= STEPS; i++) {
    const t = i / STEPS;
    // Профиль по четверти косинуса: у стола корпус почти отвесный, к верху заваливается.
    const shrink = 1 - Math.cos((Math.PI / 2) * t);
    const z = LEVEL_1 + HEIGHT * Math.sin((Math.PI / 2) * t);
    // Спинка выше и полнее носа, поэтому центр сечения смещается назад к пользователю.
    const contour = roundedRect(X, Y + shrink * 10, WIDTH - shrink * WIDTH * 0.92, DEPTH - shrink * DEPTH * 0.72, 26, 6);
    sections.push(contour.map(([x, y]) => [x, y, z]));
  }
  addLoft(mesh, sections, PALETTE.device);
}
