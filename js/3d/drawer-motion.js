// Ход одного ящика: выдвижение перпендикулярно фасаду. Каждый ящик живёт сам по себе,
// поэтому мотор создаётся отдельно для каждого из трёх.

import { translation, identity } from './mat4.js';
import { createMotion } from './motion.js';
import { mirrorMatrix } from './mirror.js';
import { DRAWER_TRAVEL } from './build-drawers.js';

export function createDrawerMotion() {
  const motion = createMotion({ open: DRAWER_TRAVEL, speed: 620 });
  return {
    get isOpen() { return motion.isOpen; },
    get value() { return motion.value; },
    set: (open) => motion.set(open),
    toggle: () => motion.toggle(),
    update: (dt) => motion.update(dt),
    // Сцена отражена, поэтому ящик едет в −X, а не в +X.
    matrix() {
      return motion.value === 0 ? identity() : mirrorMatrix(translation(motion.value, 0, 0));
    },
    // Промежуточное звено телескопа проходит половину пути короба.
    middleMatrix() {
      return motion.value === 0 ? identity() : mirrorMatrix(translation(motion.value / 2, 0, 0));
    },
  };
}
