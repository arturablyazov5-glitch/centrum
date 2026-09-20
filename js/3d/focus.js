// Полёт камеры к выбранной точке. Точка взгляда и расстояние едут вместе за долю
// секунды: резкий скачок сбивает ориентацию, а мгновенная телепортация к узлу
// не даёт понять, куда именно смотришь.

const DURATION = 0.78;       // секунды на спокойный перелёт конфигуратора
const CLOSE_UP = 620;        // расстояние до узла после фокуса
const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

export function createFocus(camera) {
  let flight = null;

  return {
    // Перелёт к точке. Без второго аргумента камера подходит к узлу крупным планом,
    // с ним — встаёт на заданное расстояние (так работает кадрирование всей модели).
    to(point, distance) {
      flight = {
        t: 0,
        fromTarget: camera.target.slice(),
        toTarget: point.slice(),
        fromDistance: camera.distance,
        toDistance: distance === undefined ? Math.min(camera.distance, CLOSE_UP) : distance,
        fromAzimuth: camera.azimuth,
        toAzimuth: camera.azimuth,
        fromElevation: camera.elevation,
        toElevation: camera.elevation,
      };
    },
    toView(view, fallbackTarget) {
      let delta = view.azimuth - camera.azimuth;
      while (delta > Math.PI) delta -= Math.PI * 2;
      while (delta < -Math.PI) delta += Math.PI * 2;
      flight = {
        t: 0,
        fromTarget: camera.target.slice(),
        toTarget: (view.target || fallbackTarget || camera.target).slice(),
        fromDistance: camera.distance,
        toDistance: view.distance,
        fromAzimuth: camera.azimuth,
        toAzimuth: camera.azimuth + delta,
        fromElevation: camera.elevation,
        toElevation: view.elevation,
      };
    },
    cancel() { flight = null; },
    get active() { return flight !== null; },
    // Возвращает true, пока камера летит.
    update(dt) {
      if (!flight) return false;
      flight.t = Math.min(1, flight.t + dt / DURATION);
      const k = ease(flight.t);
      camera.target = flight.fromTarget.map((v, i) => v + (flight.toTarget[i] - v) * k);
      camera.distance = flight.fromDistance + (flight.toDistance - flight.fromDistance) * k;
      camera.azimuth = flight.fromAzimuth + (flight.toAzimuth - flight.fromAzimuth) * k;
      camera.elevation = flight.fromElevation + (flight.toElevation - flight.fromElevation) * k;
      if (flight.t >= 1) flight = null;
      return true;
    },
  };
}
