// Ход Tech Bay: фасад из двух панелей уходит вверх в пустоту пояса, затем
// поддон с ПК выезжает наружу на TECH_TRAY_TRAVEL. Закрывается в обратном порядке.
// Значение хода 0…2,3: 0…0,3 — панели отходят внутрь, каждая на свою направляющую;
// 0,3…1,3 — поднимаются (нижняя вдвое дальше и встаёт за верхнюю); 1,3…2,3 — поддон.
// Сдвиги идут вдоль y и z, отражение сцены (mirror.js) их не меняет.

import { translation } from './mat4.js';
import { mirrorMatrix } from './mirror.js';
import { createMotion } from './motion.js';
import { TECH_TRAY_TRAVEL } from './params.js';
import { TECH_TRACKS, TECH_LIFT, techBayArm, techBayStrapMatrix } from './build-techbay.js?v=20260926-vent';

const ease = (t) => t * t * (3 - 2 * t);
const STEP = 0.3, LIFT = 1, TRAY = 1;

export function createTechBayMotion() {
  const motion = createMotion({ open: STEP + LIFT + TRAY, speed: 1.5 });
  const phase = (start, length) => ease(Math.min(1, Math.max(0, (motion.value - start) / length)));
  const panel = (track, lift) => translation(0, track * phase(0, STEP), lift * phase(STEP, LIFT));
  return {
    get isOpen() { return motion.isOpen; },
    set: (open) => motion.set(open),
    update: (dt) => motion.update(dt),
    topMatrix: () => panel(TECH_TRACKS[0], TECH_LIFT.top),
    bottomMatrix: () => panel(TECH_TRACKS[1], TECH_LIFT.bottom),
    // Каретки только поднимаются; ленты укорачиваются к валу.
    carriageMatrix: (panel) => translation(0, 0, TECH_LIFT[panel] * phase(STEP, LIFT)),
    strapMatrix: (panel) => techBayStrapMatrix(panel, TECH_LIFT[panel] * phase(STEP, LIFT)),
    // Подсветка разгорается, пока панели отходят внутрь, и гаснет при закрытии.
    lightLevel: () => phase(0, STEP),
    trayOffset: () => -phase(STEP + LIFT, TRAY) * TECH_TRAY_TRAVEL,
    // Среднее звено направляющих — половина хода поддона.
    slideMatrix: () => translation(0, -phase(STEP + LIFT, TRAY) * TECH_TRAY_TRAVEL / 2, 0),
    // Звенья кабельного рычага поворачиваются: в отражённой сцене — зеркально.
    armMatrices() {
      const { a, b } = techBayArm(phase(STEP + LIFT, TRAY) * TECH_TRAY_TRAVEL);
      return { a: mirrorMatrix(a), b: mirrorMatrix(b) };
    },
  };
}
