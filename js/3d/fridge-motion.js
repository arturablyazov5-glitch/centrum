// Ход стеклянной двери холодильника: поворот наружу вокруг вертикальной петли
// у дальней кромки двери. Открытая дверь не заходит в проход и в нишу для ног.

import { multiply, translation, rotationZ, identity } from './mat4.js';
import { createMotion } from './motion.js';
import { mirrorMatrix } from './mirror.js';
import { FRIDGE_HINGE, FRIDGE_OPEN_DEG } from './build-fridge.js';

export function createFridgeMotion() {
  const motion = createMotion({ open: FRIDGE_OPEN_DEG, speed: 130 });
  const [hx, hy] = FRIDGE_HINGE;
  return {
    get isOpen() { return motion.isOpen; },
    get value() { return motion.value; },
    set: (open) => motion.set(open),
    toggle: () => motion.toggle(),
    update: (dt) => motion.update(dt),
    matrix() {
      if (motion.value === 0) return identity();
      // Сцена отражена, поэтому узел движется зеркально относительно чертежа.
      // Знак минус разворачивает дверь наружу от корпуса, а не внутрь ниши.
      const rad = (-motion.value * Math.PI) / 180;
      return mirrorMatrix(multiply(translation(hx, hy, 0), multiply(rotationZ(rad), translation(-hx, -hy, 0))));
    },
  };
}
