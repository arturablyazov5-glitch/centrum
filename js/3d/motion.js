// Общий механизм для всего, что открывается и закрывается: угол петли, вылет ящика.
// Значение едет от closed к open с постоянной скоростью и само сообщает, нужен ли новый кадр.

export function createMotion({ open, closed = 0, initial = closed, speed }) {
  let value = initial;
  let target = initial;

  return {
    get isOpen() { return target !== closed; },
    get value() { return value; },
    set(next) { target = next ? open : closed; },
    toggle() { target = target === closed ? open : closed; },
    // Возвращает true, пока положение меняется.
    update(dt) {
      if (Math.abs(target - value) < 1e-3) { value = target; return false; }
      value += Math.sign(target - value) * Math.min(speed * dt, Math.abs(target - value));
      return true;
    },
  };
}
