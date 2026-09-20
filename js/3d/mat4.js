// Минимальная матричная математика 4×4 для WebGL. Матрицы — column-major Float32Array(16),
// как их ожидает gl.uniformMatrix4fv. Мира достаточно: перспектива, взгляд, поворот, перенос.

export const identity = () => new Float32Array([1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1]);

export function perspective(fovY, aspect, near, far) {
  const f = 1 / Math.tan(fovY / 2), nf = 1 / (near - far);
  return new Float32Array([
    f / aspect, 0, 0, 0,
    0, f, 0, 0,
    0, 0, (far + near) * nf, -1,
    0, 0, 2 * far * near * nf, 0,
  ]);
}

// Ортографическая проекция для направленного студийного света. В отличие от
// перспективной камеры она не меняет масштаб тени по мере удаления от света.
export function orthographic(left, right, bottom, top, near, far) {
  const lr = 1 / (left - right), bt = 1 / (bottom - top), nf = 1 / (near - far);
  return new Float32Array([
    -2 * lr, 0, 0, 0,
    0, -2 * bt, 0, 0,
    0, 0, 2 * nf, 0,
    (left + right) * lr, (top + bottom) * bt, (far + near) * nf, 1,
  ]);
}

export function multiply(a, b) {
  const out = new Float32Array(16);
  for (let c = 0; c < 4; c++)
    for (let r = 0; r < 4; r++) {
      let sum = 0;
      for (let k = 0; k < 4; k++) sum += a[k * 4 + r] * b[c * 4 + k];
      out[c * 4 + r] = sum;
    }
  return out;
}

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export function normalize(v) {
  const l = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / l, v[1] / l, v[2] / l];
}

// Взгляд из eye в target; up задаёт крен. Ось Z в модели направлена вверх.
export function lookAt(eye, target, up) {
  const z = normalize(sub(eye, target));
  const x = normalize(cross(up, z));
  const y = cross(z, x);
  return new Float32Array([
    x[0], y[0], z[0], 0,
    x[1], y[1], z[1], 0,
    x[2], y[2], z[2], 0,
    -dot(x, eye), -dot(y, eye), -dot(z, eye), 1,
  ]);
}

export function translation(x, y, z) {
  const m = identity();
  m[12] = x; m[13] = y; m[14] = z;
  return m;
}

// Поворот в плоскости X–Z (ось петли Bridge направлена вдоль Y).
export function rotationXZ(rad) {
  const c = Math.cos(rad), s = Math.sin(rad);
  const m = identity();
  m[0] = c; m[2] = s;
  m[8] = -s; m[10] = c;
  return m;
}

export function scaling(x, y, z) {
  const m = identity();
  m[0] = x; m[5] = y; m[10] = z;
  return m;
}

// Поворот вокруг вертикали (ось Z) — так открывается дверь холодильника.
export function rotationZ(rad) {
  const c = Math.cos(rad), s = Math.sin(rad);
  const m = identity();
  m[0] = c; m[1] = s;
  m[4] = -s; m[5] = c;
  return m;
}

// Матрица нормалей: для поворотов и переносов достаточно верхнего блока 3×3.
export function normalMatrix3(m) {
  return new Float32Array([m[0], m[1], m[2], m[4], m[5], m[6], m[8], m[9], m[10]]);
}
