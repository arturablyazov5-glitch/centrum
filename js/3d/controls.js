// Навигация по сцене. Раскладка не выдумана: взяты две общепринятые схемы сразу,
// они не конфликтуют между собой.
//
// Как в three.js OrbitControls (стандарт для 3D в вебе):
//   ЛКМ                 — орбита
//   ПКМ                 — панорама
//   Средняя, колесо     — наезд
//
// Как в Cinema 4D:
//   Alt + ЛКМ           — орбита
//   Alt + средняя       — панорама
//   Alt + ПКМ           — наезд
//   1 / 2 / 3 + тянуть  — панорама / наезд / орбита
//   S                   — кадрировать деталь под курсором
//   H                   — кадрировать всю модель
//
// Плюс два привычных модификатора для тех, у кого мышь без лишних кнопок:
//   Shift + ЛКМ         — панорама (так же в Blender и большинстве CAD)
//   Cmd/Ctrl + ЛКМ      — наезд
//
// Пальцы: один — орбита, два — панорама и щипок.
// Короткое нажатие без сдвига — тычок по детали, он уходит в onTap.

import { clampCamera, panCamera, dollyCamera } from './camera.js';

const ROTATE_SPEED = 0.0075;
const DOLLY_SPEED = 0.006;
const WHEEL_SPEED = 0.0012;
const DAMPING = 0.9;
const TAP_SLOP = 6;      // пикселей, дальше — это уже навигация
const TAP_TIME = 600;    // миллисекунд, дольше — тоже не тычок

const ORBIT = 'orbit', PAN = 'pan', DOLLY = 'dolly';

// Режимы, назначенные на клавиши 1 / 2 / 3, — как в Cinema 4D.
const KEY_MODES = { 1: PAN, 2: DOLLY, 3: ORBIT };

export function attachControls(element, camera, onChange, { onTap, onHover, onFrame, onFrameAll } = {}) {
  const pointers = new Map();
  let pinch = 0;
  let pinchCenter = null;
  let velocity = { azimuth: 0, elevation: 0 };
  let dragging = false;
  let mode = ORBIT;
  let tap = null;
  let heldMode = null;                 // режим, удерживаемый клавишей 1 / 2 / 3
  let cursor = { x: 0, y: 0 };         // последнее положение курсора — для клавиши S

  const apply = () => { clampCamera(camera); onChange(); };
  const height = () => element.clientHeight || 1;

  // Кнопка мыши и модификаторы → режим навигации.
  function modeFor(event) {
    if (heldMode) return heldMode;
    if (event.button === 2) return event.altKey ? DOLLY : PAN;
    if (event.button === 1) return event.altKey ? PAN : DOLLY;
    if (event.shiftKey) return PAN;
    if (event.ctrlKey || event.metaKey) return DOLLY;
    return ORBIT;
  }

  const onDown = (event) => {
    element.setPointerCapture(event.pointerId);
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    dragging = true;
    velocity = { azimuth: 0, elevation: 0 };
    mode = modeFor(event);
    tap = pointers.size === 1 && mode === ORBIT && event.button === 0
      ? { x: event.clientX, y: event.clientY, time: event.timeStamp, moved: 0 }
      : null;
    element.classList.add('is-dragging');
  };

  const onMove = (event) => {
    cursor = { x: event.clientX, y: event.clientY };
    const previous = pointers.get(event.pointerId);
    if (!previous) {
      if (!dragging && onHover) onHover(event.clientX, event.clientY);
      return;
    }
    if (tap) tap.moved = Math.max(tap.moved, Math.hypot(event.clientX - tap.x, event.clientY - tap.y));
    const dx = event.clientX - previous.x, dy = event.clientY - previous.y;
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });

    if (pointers.size >= 2) {
      // Два пальца: расстояние между ними — наезд, их середина — панорама.
      const [a, b] = [...pointers.values()];
      const distance = Math.hypot(a.x - b.x, a.y - b.y);
      const center = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      if (pinch) dollyCamera(camera, pinch / (distance || 1));
      if (pinchCenter) panCamera(camera, center.x - pinchCenter.x, center.y - pinchCenter.y, height());
      pinch = distance;
      pinchCenter = center;
      apply();
      return;
    }

    if (mode === PAN) panCamera(camera, dx, dy, height());
    else if (mode === DOLLY) dollyCamera(camera, Math.exp(dy * DOLLY_SPEED));
    else {
      velocity = { azimuth: -dx * ROTATE_SPEED, elevation: dy * ROTATE_SPEED };
      camera.azimuth += velocity.azimuth;
      camera.elevation += velocity.elevation;
    }
    apply();
  };

  const onUp = (event) => {
    pointers.delete(event.pointerId);
    if (pointers.size < 2) { pinch = 0; pinchCenter = null; }
    if (!pointers.size) { dragging = false; element.classList.remove('is-dragging'); }
    if (tap && onTap && tap.moved <= TAP_SLOP && event.timeStamp - tap.time <= TAP_TIME) {
      // Модель не двигали — значит, по ней ткнули.
      velocity = { azimuth: 0, elevation: 0 };
      onTap(event.clientX, event.clientY);
    }
    tap = null;
  };

  element.addEventListener('pointerdown', onDown);
  element.addEventListener('pointermove', onMove);
  element.addEventListener('pointerup', onUp);
  element.addEventListener('pointercancel', (event) => { tap = null; onUp(event); });
  element.addEventListener('pointerleave', () => { if (onHover) onHover(null, null); });
  // Правая кнопка занята панорамой, системное меню тут только мешает.
  element.addEventListener('contextmenu', (event) => event.preventDefault());
  // Колесо наезжает ровно вдоль взгляда: увод кадра вслед за курсором читался как отдача.
  element.addEventListener('wheel', (event) => {
    event.preventDefault();
    dollyCamera(camera, Math.exp(event.deltaY * WHEEL_SPEED));
    apply();
  }, { passive: false });

  element.addEventListener('keydown', (event) => {
    if (KEY_MODES[event.key]) { heldMode = KEY_MODES[event.key]; return; }
    const key = event.key.toLowerCase();
    if (key === 's' && onFrame) { event.preventDefault(); onFrame(cursor.x, cursor.y); return; }
    if (key === 'h' && onFrameAll) { event.preventDefault(); onFrameAll(); return; }

    // Стрелки — то же управление без мыши: Shift панорамирует, Alt ускоряет.
    const step = event.altKey ? 0.24 : 0.08;
    const shift = event.altKey ? 90 : 30;
    const moves = {
      ArrowLeft: () => (event.shiftKey ? panCamera(camera, -shift, 0, height()) : (camera.azimuth -= step)),
      ArrowRight: () => (event.shiftKey ? panCamera(camera, shift, 0, height()) : (camera.azimuth += step)),
      ArrowUp: () => (event.shiftKey ? panCamera(camera, 0, -shift, height()) : (camera.elevation += step)),
      ArrowDown: () => (event.shiftKey ? panCamera(camera, 0, shift, height()) : (camera.elevation -= step)),
      '+': () => dollyCamera(camera, 0.88),
      '=': () => dollyCamera(camera, 0.88),
      '-': () => dollyCamera(camera, 1.14),
    };
    if (!moves[event.key]) return;
    event.preventDefault();
    moves[event.key]();
    apply();
  });
  element.addEventListener('keyup', (event) => { if (KEY_MODES[event.key]) heldMode = null; });
  element.addEventListener('blur', () => { heldMode = null; });

  // Затухание после броска: вызывается из кадра рендера и касается только орбиты.
  return function step() {
    if (dragging) return false;
    if (Math.abs(velocity.azimuth) < 1e-4 && Math.abs(velocity.elevation) < 1e-4) return false;
    camera.azimuth += velocity.azimuth;
    camera.elevation += velocity.elevation;
    velocity.azimuth *= DAMPING;
    velocity.elevation *= DAMPING;
    clampCamera(camera);
    return true;
  };
}
