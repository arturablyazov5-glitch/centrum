// Предметы на столе: монитор, клавиатура и мышь. Собраны в одну группу,
// чтобы их можно было показать или убрать одним переключателем.
//
// В отличие от корпуса эти предметы строятся уже в готовой сцене и не отражаются:
// стол симметричен относительно оси x = 1450, а вот мышь должна остаться
// с правильной стороны от клавиатуры.

import { buildMonitor } from './build-monitor.js';
import { buildKeyboard } from './build-keyboard.js';
import { buildMouse } from './build-mouse.js';

export function buildInterior(mesh) {
  buildMonitor(mesh);
  buildKeyboard(mesh);
  buildMouse(mesh);
}
