// Ход подъёмной секции Bridge: 0° — закрыто, 100° — упор. Секция поворачивается
// вокруг оси петли, лежащей в плоскости столешницы у левой кромки проёма.
// Газлифты живут по своей кинематике: корпус только поворачивается вокруг
// кронштейна на корпусе, а шток вдобавок выдвигается на разницу длин.

import { multiply, translation, rotationXZ, identity } from './mat4.js';
import { createMotion } from './motion.js';
import { mirrorMatrix } from './mirror.js';
import { HINGE } from './build-bridge.js';
import { STRUT_A, STRUT_ANGLE_0, strutPose } from './bridge-fittings.js';
import { BRIDGE_OPEN_DEG } from './params.js';

// Поворот вокруг оси, заданной точкой в плоскости X–Z.
const turnAround = ([x, z], rad) =>
  multiply(translation(x, 0, z), multiply(rotationXZ(rad), translation(-x, 0, -z)));

export function createBridgeMotion() {
  const motion = createMotion({ open: BRIDGE_OPEN_DEG, speed: 105 });
  return {
    get isOpen() { return motion.isOpen; },
    get value() { return motion.value; },
    set: (open) => motion.set(open),
    toggle: () => motion.toggle(),
    update: (dt) => motion.update(dt),
    matrix() {
      if (motion.value === 0) return identity();
      // Сцена отражена, поэтому узел движется зеркально относительно чертежа.
      const rad = (motion.value * Math.PI) / 180;
      return mirrorMatrix(turnAround([HINGE[0], HINGE[2]], rad));
    },
    // kind: 'tube' — только поворот вокруг кронштейна; 'rod' — поворот и выдвижение.
    strut(kind) {
      if (motion.value === 0) return identity();
      const { turn, extend } = strutPose(motion.value);
      const swing = turnAround(STRUT_A, turn);
      if (kind === 'tube') return mirrorMatrix(swing);
      const angle = STRUT_ANGLE_0 + turn;
      const slide = translation(Math.cos(angle) * extend, 0, Math.sin(angle) * extend);
      return mirrorMatrix(multiply(slide, swing));
    },
  };
}
