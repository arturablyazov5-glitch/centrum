// Проверка всего луча по кусочно-линейному профилю низа гнутой плиты.
// Разность двух линейных функций достигает минимума на границах интервалов:
// проверка каждого пересечённого узла не оставляет пропусков между пробами.
import { TRANS_FAR, TRANS_LEN, underAt } from './params.js';
export const LED_CEILING = Array.from({ length: 49 }, (_, i) => {
  const y = TRANS_FAR - TRANS_LEN + TRANS_LEN * i / 48;
  return [y, underAt(y)];
});
export const CEILING_MARGIN = 0.25;
const num = (v) => v.toFixed(6);
export function ledCeilingAt(y) {
  if (y <= LED_CEILING[0][0]) return LED_CEILING[0][1] - CEILING_MARGIN;
  for (let i = 1; i < LED_CEILING.length; i++) {
    const [a, z0] = LED_CEILING[i - 1], [b, z1] = LED_CEILING[i];
    if (y <= b) return z0 + (z1 - z0) * (y - a) / (b - a) - CEILING_MARGIN;
  }
  return LED_CEILING.at(-1)[1] - CEILING_MARGIN;
}
export function ledPlateVisible(source, point) {
  const clear = (t) => source[2] + (point[2] - source[2]) * t <= ledCeilingAt(source[1] + (point[1] - source[1]) * t);
  if (!clear(0) || !clear(1)) return false;
  if (Math.abs(point[1] - source[1]) < 0.0001) return true;
  return LED_CEILING.every(([y]) => {
    const t = (y - source[1]) / (point[1] - source[1]);
    return t <= 0 || t >= 1 || clear(t);
  });
}
export const LED_CEILING_GLSL = `
float ledCeilingAt(float y) {
  if (y <= ${num(LED_CEILING[0][0])}) return ${num(LED_CEILING[0][1] - CEILING_MARGIN)};
  ${LED_CEILING.slice(1).map(([b, z1], i) => {
    const [a, z0] = LED_CEILING[i];
    return `if (y <= ${num(b)}) return ${num(z0 - CEILING_MARGIN)} + (y - ${num(a)}) * ${num((z1 - z0) / (b - a))};`;
  }).join('\n')}
  return ${num(LED_CEILING.at(-1)[1] - CEILING_MARGIN)};
}
float ledPlateVisible(vec3 source, vec3 p) {
  if (source.z > ledCeilingAt(source.y) || p.z > ledCeilingAt(p.y)) return 0.0;
  float dy = p.y - source.y;
  if (abs(dy) < 0.0001) return 1.0;
  float t;
  ${LED_CEILING.map(([y, z]) => `t = (${num(y)} - source.y) / dy;
  if (t > 0.0 && t < 1.0 && mix(source.z, p.z, t) > ${num(z - CEILING_MARGIN)}) return 0.0;`).join('\n')}
  return 1.0;
}`;
