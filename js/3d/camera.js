// Орбитальная камера: положение задаётся азимутом, наклоном и расстоянием до точки взгляда.
// Ось Z в модели направлена вверх, поэтому вектор «вверх» для камеры — это [0, 0, 1].

import { perspective, lookAt, normalize } from './mat4.js';
import { mirrorAzimuth } from './mirror.js';

// Наклон ограничен только у самых полюсов: там взгляд совпал бы с осью «вверх»
// и картинка провернулась бы рывком. В остальном модель крутится целиком, снизу тоже.
export const MIN_ELEVATION = -1.52;
export const MAX_ELEVATION = 1.52;
// Наезд не ограничен: можно упереться носом в головку крепежа и отойти на всю комнату.
// Остаются только страховки от вырожденной матрицы проекции.
export const MIN_DISTANCE = 1;
export const MAX_DISTANCE = 400000;

// Точку взгляда тоже почти не ограничиваем — только чтобы не улететь в бесконечность.
const TARGET_RANGE = 60000;

// Стартовое положение — тот же ракурс «Изометрия», что и по кнопке.
// Отдельных чисел здесь нет намеренно: иначе первый кадр разъезжается с пресетом.
export function createCamera(target) {
  return { ...VIEWS.iso, target: target.slice() };
}

// Ширина кадра зависит от пропорций холста, высота — нет. На узком экране
// камера отходит, чтобы пятно 2900 × 2900 не срезалось по краям.
const REFERENCE_ASPECT = 2;
export function fitDistance(base, aspect) {
  if (!aspect || aspect >= REFERENCE_ASPECT) return base;
  return base * Math.pow(REFERENCE_ASPECT / Math.max(aspect, 0.5), 0.7);
}

export function clampCamera(camera) {
  camera.elevation = Math.max(MIN_ELEVATION, Math.min(MAX_ELEVATION, camera.elevation));
  camera.distance = Math.max(MIN_DISTANCE, Math.min(MAX_DISTANCE, camera.distance));
  const [cx, cy] = [1450, 1450];
  camera.target[0] = Math.max(cx - TARGET_RANGE, Math.min(cx + TARGET_RANGE, camera.target[0]));
  camera.target[1] = Math.max(cy - TARGET_RANGE, Math.min(cy + TARGET_RANGE, camera.target[1]));
  camera.target[2] = Math.max(-1500, Math.min(6000, camera.target[2]));
}

// Полоса растворения перед камерой. Внутри неё грани дизерингом сходят на нет,
// иначе, залетев внутрь корпуса, упираешься носом в сплошную стенку.
// Полоса физическая, но не длиннее того, на что камера смотрит, — иначе
// растворялась бы и сама деталь, к которой подлетели.
export const FADE_RANGE = 420;
export const fadeDistance = (camera) => Math.min(FADE_RANGE, camera.distance * 0.8);

const sub3 = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross3 = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];

// Базис камеры: куда для неё «вправо» и «вверх» в мировых координатах.
export function cameraBasis(camera) {
  const forward = normalize(sub3(camera.target, eyePosition(camera)));
  const right = normalize(cross3(forward, [0, 0, 1]));
  return { forward, right, up: cross3(right, forward) };
}

// Панорама: точка взгляда едет в плоскости экрана, поэтому сцена следует за курсором
// один в один независимо от того, насколько камера отошла.
export function panCamera(camera, dxPixels, dyPixels, viewportHeight) {
  const { right, up } = cameraBasis(camera);
  const scale = (2 * Math.tan(FOV_Y / 2) * camera.distance) / Math.max(viewportHeight, 1);
  for (let i = 0; i < 3; i++)
    camera.target[i] += (-dxPixels * right[i] + dyPixels * up[i]) * scale;
  clampCamera(camera);
}

// Наезд вдоль взгляда: камера подходит к точке взгляда и отходит от неё,
// сам кадр при этом не уезжает вбок.
export function dollyCamera(camera, factor) {
  camera.distance = Math.max(MIN_DISTANCE, Math.min(MAX_DISTANCE, camera.distance * factor));
  clampCamera(camera);
}

export function eyePosition(camera) {
  const { azimuth: a, elevation: e, distance: d, target: t } = camera;
  return [
    t[0] + d * Math.cos(e) * Math.cos(a),
    t[1] + d * Math.cos(e) * Math.sin(a),
    t[2] + d * Math.sin(e),
  ];
}

export const viewMatrix = (camera) => lookAt(eyePosition(camera), camera.target, [0, 0, 1]);

export const FOV_Y = 0.56; // вертикальный угол обзора; им же строится луч выбора детали

// Плоскости отсечения привязаны к расстоянию до цели: вплотную к детали ближняя
// граница уходит к долям миллиметра, издалека — отодвигается. Иначе при снятом
// ограничении зума модель либо срезается вблизи, либо теряет точность глубины.
export function projectionMatrix(aspect, distance = 6000) {
  const near = Math.max(0.5, Math.min(distance / 120, 60));
  const far = Math.max(distance * 30, 40000);
  return perspective(FOV_Y, aspect, near, far);
}

// Готовые ракурсы: те же, что и на листах чертежей.
// Ракурсы заданы по чертежам и разворачиваются тем же отражением, что и модель.
const SHEET_VIEWS = {
  iso: { azimuth: -0.87, elevation: 0.5, distance: 6200 },
  front: { azimuth: -Math.PI / 2, elevation: 0.36, distance: 5600 },
  side: { azimuth: 0, elevation: 0.36, distance: 5600 },
  entry: { azimuth: Math.PI / 2.2, elevation: 0.32, distance: 5800 },
  top: { azimuth: -Math.PI / 2, elevation: 1.42, distance: 6600 },
  // Камера из центральной зоны смотрит на переднюю внутреннюю стенку, где стоит экран.
  // Точка взгляда чуть смещена влево по рабочей дуге: после разнесения техники
  // в кадр целиком входят монитор, MacBook и лежащие ещё левее наушники.
  tech: { azimuth: Math.PI / 2, elevation: 0.25, distance: 2700, target: [1600, 560, 980] },
};

export const VIEWS = Object.fromEntries(Object.entries(SHEET_VIEWS)
  .map(([name, view]) => [name, { ...view, azimuth: mirrorAzimuth(view.azimuth) }]));
