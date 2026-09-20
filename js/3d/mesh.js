// Накопитель треугольников с плоским затенением: нормаль берётся от плоскости грани,
// поэтому рёбра корпуса остаются чёткими, как на чертеже, без сглаживания.

export function createMesh() {
  return { position: [], normal: [], color: [] };
}

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const norm = (v) => { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; };
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];

// Нормаль многоугольника по методу Ньюэлла: устойчива к почти вырожденным граням.
export function polygonNormal(pts) {
  let nx = 0, ny = 0, nz = 0;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i], b = pts[(i + 1) % pts.length];
    nx += (a[1] - b[1]) * (a[2] + b[2]);
    ny += (a[2] - b[2]) * (a[0] + b[0]);
    nz += (a[0] - b[0]) * (a[1] + b[1]);
  }
  const l = Math.hypot(nx, ny, nz);
  return l < 1e-9 ? null : [nx / l, ny / l, nz / l];
}

// Плоский выпуклый многоугольник → веер треугольников. Точки без дубликатов и в одном обходе.
export function addPolygon(mesh, pts, color) {
  const clean = [];
  for (const p of pts) {
    const last = clean[clean.length - 1];
    if (!last || Math.hypot(p[0] - last[0], p[1] - last[1], p[2] - last[2]) > 1e-6) clean.push(p);
  }
  if (clean.length >= 2) {
    const first = clean[0], last = clean[clean.length - 1];
    if (Math.hypot(first[0] - last[0], first[1] - last[1], first[2] - last[2]) < 1e-6) clean.pop();
  }
  if (clean.length < 3) return;
  const n = polygonNormal(clean);
  if (!n) return;
  for (let i = 1; i < clean.length - 1; i++) {
    for (const p of [clean[0], clean[i], clean[i + 1]]) {
      mesh.position.push(p[0], p[1], p[2]);
      mesh.normal.push(n[0], n[1], n[2]);
      mesh.color.push(color[0], color[1], color[2]);
    }
  }
}

export const addQuad = (mesh, a, b, c, d, color) => addPolygon(mesh, [a, b, c, d], color);

// Призма по контуру: боковые грани между отметками z0 и z1 плюс, по желанию, крышки.
export function addPrism(mesh, contour, z0, z1, color, { top = false, bottom = false } = {}) {
  for (let i = 0; i < contour.length; i++) {
    const a = contour[i], b = contour[(i + 1) % contour.length];
    addQuad(mesh, [a[0], a[1], z0], [b[0], b[1], z0], [b[0], b[1], z1], [a[0], a[1], z1], color);
  }
  if (top) addPolygon(mesh, contour.map((p) => [p[0], p[1], z1]), color);
  if (bottom) addPolygon(mesh, contour.slice().reverse().map((p) => [p[0], p[1], z0]), color);
}

// Контур со скруглёнными углами: нужен корпусам техники, у которой нет острых рёбер.
export function roundedRect(cx, cy, width, height, radius, steps = 4) {
  const r = Math.min(radius, width / 2, height / 2);
  const x = width / 2 - r, y = height / 2 - r;
  const corners = [[x, y, 0], [-x, y, 90], [-x, -y, 180], [x, -y, 270]];
  const points = [];
  for (const [px, py, start] of corners)
    for (let i = 0; i <= steps; i++) {
      const a = ((start + (i * 90) / steps) * Math.PI) / 180;
      points.push([cx + px + r * Math.cos(a), cy + py + r * Math.sin(a)]);
    }
  return points;
}

// Оболочка по набору контуров: соседние сечения сшиваются полосой четырёхугольников.
// В отличие от стопки призм здесь нет горизонтальных уступов, поэтому форма
// читается как гладкая — так строятся покатые корпуса вроде мыши.
export function addLoft(mesh, sections, color, { cap = true } = {}) {
  for (let s = 0; s < sections.length - 1; s++) {
    const a = sections[s], b = sections[s + 1];
    for (let i = 0; i < a.length; i++) {
      const j = (i + 1) % a.length;
      addQuad(mesh, a[i], a[j], b[j], b[i], color);
    }
  }
  if (cap) addPolygon(mesh, sections[sections.length - 1], color);
}

// Круглый стержень между двумя точками: петля, ригель, шток газлифта, болт.
// Ось задаётся самими точками, поэтому одна и та же функция кладёт трубу
// вдоль любой оси модели и вдоль наклонной оси газлифта.
export function addTube(mesh, a, b, radius, color, { sides = 12, caps = true } = {}) {
  const axis = norm(sub(b, a));
  const guide = Math.abs(axis[2]) < 0.9 ? [0, 0, 1] : [1, 0, 0];
  const u = norm(cross(axis, guide));
  const v = cross(axis, u);
  const ring = (p) => Array.from({ length: sides }, (_, i) => {
    const t = (i / sides) * Math.PI * 2;
    const c = Math.cos(t) * radius, s = Math.sin(t) * radius;
    return [p[0] + c * u[0] + s * v[0], p[1] + c * u[1] + s * v[1], p[2] + c * u[2] + s * v[2]];
  });
  const start = ring(a), end = ring(b);
  for (let i = 0; i < sides; i++) {
    const j = (i + 1) % sides;
    addQuad(mesh, start[i], start[j], end[j], end[i], color);
  }
  if (caps) {
    addPolygon(mesh, start, color);
    addPolygon(mesh, end.slice().reverse(), color);
  }
}

// Прямоугольный брусок по трём интервалам — самая частая форма у фурнитуры.
export const addBox = (mesh, [x0, x1], [y0, y1], [z0, z1], color) =>
  addPrism(mesh, [[x0, y0], [x1, y0], [x1, y1], [x0, y1]], z0, z1, color, { top: true, bottom: true });

export function createLines() {
  return { position: [], color: [] };
}

export function addLine(lines, a, b, color) {
  lines.position.push(a[0], a[1], a[2], b[0], b[1], b[2]);
  lines.color.push(color[0], color[1], color[2], color[0], color[1], color[2]);
}

// Замкнутая или разомкнутая ломаная в пространстве.
export function addPolyline(lines, pts, color, close = false) {
  for (let i = 0; i < pts.length - 1; i++) addLine(lines, pts[i], pts[i + 1], color);
  if (close && pts.length > 2) addLine(lines, pts[pts.length - 1], pts[0], color);
}

export function toBufferData(mesh) {
  const position = new Float32Array(mesh.position);
  // Встроенная геометрия получает единый планарный UV в миллиметрах. Пока он
  // ничего не стоит по памяти на GPU сверх небольшого потока, зато одна и та же
  // древесная карта непрерывно проходит через Sector, верхний уровень и Bridge.
  const uv = new Float32Array((position.length / 3) * 2);
  // Один квадрат изображения покрывает весь габарит 2900 мм: так на большой
  // столешнице нет заметной сетки повторов, а рисунок шпона остаётся цельным.
  const textureSize = 2900;
  for (let i = 0; i < position.length / 3; i++) {
    uv[i * 2] = position[i * 3] / textureSize;
    uv[i * 2 + 1] = position[i * 3 + 1] / textureSize;
  }
  return {
    position,
    normal: new Float32Array(mesh.normal || []),
    color: new Float32Array(mesh.color),
    uv,
    count: mesh.position.length / 3,
  };
}
