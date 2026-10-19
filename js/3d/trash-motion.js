// Ход мусорного блока: фасад, рама, поддон и ведро выезжают вбок, в проход, перпендикулярно
// его стенке x = 950, промежуточное звено направляющих — на полхода, как у ящиков.

import { translation, identity } from './mat4.js';
import { createMotion } from './motion.js';
import { mirrorMatrix } from './mirror.js';
import { TRASH_TRAVEL } from './params.js';

export function createTrashMotion() {
  const motion = createMotion({ open: TRASH_TRAVEL, speed: 620 });
  // Блок едет по x, как ящик: в отражённой сцене (mirror.js) это тот же ход к центру
  // прохода, матрица проходит через mirrorMatrix, как у всех подвижных узлов.
  const at = (x) => (x === 0 ? identity() : mirrorMatrix(translation(x, 0, 0)));
  return {
    get isOpen() { return motion.isOpen; },
    get value() { return motion.value; },
    set: (open) => motion.set(open),
    toggle: () => motion.toggle(),
    update: (dt) => motion.update(dt),
    matrix: () => at(motion.value),
    middleMatrix: () => at(motion.value / 2),
  };
}
