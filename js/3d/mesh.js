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

// Тело вращения вокруг оси a→b по профилю [[t, r], …]: отступ вдоль оси и радиус.
// По окружности нормали гладкие, вдоль профиля у каждого участка свои — так
// корпус газлифта читается круглым, а завальцовка, фаски и уступы остаются чёткими.
export function addLathe(mesh, a, b, profile, color, { sides = 24 } = {}) {
  const axis = norm(sub(b, a));
  const guide = Math.abs(axis[2]) < 0.9 ? [0, 0, 1] : [1, 0, 0];
  const u = norm(cross(axis, guide));
  const v = cross(axis, u);
  const dirs = Array.from({ length: sides }, (_, i) => {
    const t = (i / sides) * Math.PI * 2;
    return [Math.cos(t) * u[0] + Math.sin(t) * v[0], Math.cos(t) * u[1] + Math.sin(t) * v[1], Math.cos(t) * u[2] + Math.sin(t) * v[2]];
  });
  const at = (t, r, d) => [a[0] + axis[0] * t + d[0] * r, a[1] + axis[1] * t + d[1] * r, a[2] + axis[2] * t + d[2] * r];
  const push = (p, n) => {
    mesh.position.push(p[0], p[1], p[2]);
    mesh.normal.push(n[0], n[1], n[2]);
    mesh.color.push(color[0], color[1], color[2]);
  };
  const tri = (pa, pb, pc, na, nb, nc) => {
    const face = cross(sub(pb, pa), sub(pc, pa));
    if (Math.hypot(face[0], face[1], face[2]) < 1e-9) return;
    // Обход по нормали наружу: Blender сглаживает по ней, а не по цвету.
    if (face[0] * na[0] + face[1] * na[1] + face[2] * na[2] < 0) { push(pa, na); push(pc, nc); push(pb, nb); return; }
    push(pa, na); push(pb, nb); push(pc, nc);
  };
  for (let k = 0; k < profile.length - 1; k++) {
    const [t0, r0] = profile[k], [t1, r1] = profile[k + 1];
    const len = Math.hypot(t1 - t0, r1 - r0);
    if (len < 1e-9) continue;
    const nt = -(r1 - r0) / len, nr = (t1 - t0) / len;
    const normal = (d) => norm([axis[0] * nt + d[0] * nr, axis[1] * nt + d[1] * nr, axis[2] * nt + d[2] * nr]);
    for (let i = 0; i < sides; i++) {
      const di = dirs[i], dj = dirs[(i + 1) % sides];
      const ni = normal(di), nj = normal(dj);
      tri(at(t0, r0, di), at(t1, r1, di), at(t1, r1, dj), ni, ni, nj);
      tri(at(t0, r0, di), at(t1, r1, dj), at(t0, r0, dj), ni, nj, nj);
    }
  }
}

// Плоская деталь по контуру в плоскости X–Z, толщиной вдоль Y: уши кронштейнов,
// проушины. Контур выпуклый, в любом обходе.
export function addPlateXZ(mesh, contour, [y0, y1], color) {
  let area = 0;
  for (let i = 0; i < contour.length; i++) {
    const [ax, az] = contour[i], [bx, bz] = contour[(i + 1) % contour.length];
    area += ax * bz - bx * az;
  }
  const ring = area < 0 ? contour.slice().reverse() : contour;
  const face = (y) => ring.map(([x, z]) => [x, y, z]);
  for (let i = 0; i < ring.length; i++) {
    const [ax, az] = ring[i], [bx, bz] = ring[(i + 1) % ring.length];
    addQuad(mesh, [ax, y1, az], [bx, y1, bz], [bx, y0, bz], [ax, y0, az], color);
  }
  addPolygon(mesh, face(y0), color);
  addPolygon(mesh, face(y1).reverse(), color);
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
  // Один квадрат изображения — 2900 мм, с запасом на весь стол 2700: так на
  // большой столешнице нет заметной сетки повторов, а рисунок шпона цельный.
  // Это масштаб текстуры, а не габарит: смена числа меняет размер волокна.
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
