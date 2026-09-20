// Крышка MacBook вращается вокруг реальной оси шарнира исходной GLB-модели.
// Вершины уже перенесены и повёрнуты загрузчиком, поэтому матрица движения
// строится сразу в мировых координатах CENTRUM.

import { identity, multiply, rotationZ, translation } from './mat4.js';
import { createMotion } from './motion.js';
import { LAPTOP_HINGE, LAPTOP_TURN } from './load-monitor.js';

// Ось шарнира и разворот приходят из загрузчика: там же задан offset модели,
// и держать их здесь отдельными числами нельзя — они разъезжаются молча.
const HINGE = LAPTOP_HINGE;
const MODEL_TURN = LAPTOP_TURN;
// Угол закрытия. На нём крышка ложится плашмя ровно на верх базы; проверено
// прогоном геометрии, при -112° и дальше она начинает проваливаться в корпус.
const CLOSED_DEG = -110.2913467252;

function rotationX(rad) {
  const c = Math.cos(rad), s = Math.sin(rad);
  return new Float32Array([
    1, 0, 0, 0,
    0, c, s, 0,
    0, -s, c, 0,
    0, 0, 0, 1,
  ]);
}

export function createLaptopMotion() {
  const motion = createMotion({ open: 0, closed: CLOSED_DEG, initial: 0, speed: 145 });
  return {
    get isOpen() { return motion.isOpen; },
    get value() { return motion.value; },
    set: (open) => motion.set(open),
    toggle: () => motion.toggle(),
    update: (dt) => motion.update(dt),
    matrix() {
      if (Math.abs(motion.value) < 1e-4) return identity();
      const rad = motion.value * Math.PI / 180;
      const aroundTurnedHinge = multiply(rotationZ(MODEL_TURN),
        multiply(rotationX(rad), rotationZ(-MODEL_TURN)));
      return multiply(translation(...HINGE),
        multiply(aroundTurnedHinge, translation(-HINGE[0], -HINGE[1], -HINGE[2])));
    },
  };
}
