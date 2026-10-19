// Tech Bay — листы 09–10: отсек под компьютер клиента в углу x = 0, y = 0.
// Снаружи видны съёмный фасад с решёткой притока на грани y = 0 и решётка
// выброса на боковой грани x = 0. Внутри — отсек со срезанным задним углом,
// поддон на направляющих и условный корпус ПК предельного размера.

import {
  CENTER, PLINTH, UNDER_1, TECH_X, TECH_FACADE, TECH_DEPTH, TECH_HEIGHT, TECH_Z0, TECH_CHAMFER,
  TECH_PC, TECH_TRAY_H, TECH_PC_FRONT, TECH_PLENUM, TECH_INTAKE, TECH_EXHAUST, TECH_SHAFT, TECH_TRAY_R, TECH_TRAY_Z, TECH_TRAY_TRAVEL,
  TECH_TRAY_BACK, TECH_TRAY_SHEET, TECH_DRIVE_SIDE,
} from './params.js';
import { addQuad, addPolygon, addPrism, addTube, polygonNormal } from './mesh.js';
import { multiply, translation, rotationZ, scaling } from './mat4.js';
import { PALETTE } from './palette.js';

const [X0, X1] = TECH_X;
const Z0 = TECH_Z0;
const Z1 = TECH_Z0 + TECH_HEIGHT;
const PANEL = 16;              // панель фасада
// Фасад — две панели, которые уходят вверх в пустоту пояса над отсеком
// (760…1210, второй уровень): сначала обе отходят внутрь, каждая на свою
// направляющую, потом поднимаются и встают стопкой. Направляющие — в зоне
// 0…54 за наружной гранью; кромки плит и дно отсека начинаются за ней.
export const TECH_TRACKS = [18, 36];    // отход верхней и нижней панели внутрь
const TRACK_ZONE = 54;
const GAP = 3;                 // теневая щель вокруг фасада, как у ящиков

// План отсека: прямоугольник 500 × 565 без заднего внутреннего угла.
const PLAN = [[X0, 0], [X1, 0], TECH_CHAMFER[1], TECH_CHAMFER[0], [X0, TECH_DEPTH]];
const box = (mesh, x0, x1, y0, y1, z0, z1, color) =>
  addPrism(mesh, [[x0, y0], [x1, y0], [x1, y1], [x0, y1]], z0, z1, color, { top: true, bottom: true });

// ─── Вентиляция: приток в фасаде, плениум, переходник, выброс в боку ────────
// Воздух входит через решётку 380 × 160 в нижней панели фасада и фильтр за ней,
// поднимается по зазорам вокруг ПК в плениум над ним и уходит через окно в
// левой стенке отсека, переходник в толще корпуса и жалюзи в боковой грани
// x = 0. Плениум и переходник изнутри облицованы пеной: шум ПК гаснет в
// них, а не выходит в комнату. Выброс смещён от отсека назад (TECH_EXHAUST —
// за скруглением угла), поэтому переходник косой.
const [EY0, EY1] = TECH_EXHAUST.y;
const [EZ0, EZ1] = TECH_EXHAUST.z;
const PLENUM_Y0 = TECH_DEPTH - 440;              // плениум 500 × 440, до задней стенки
const SKEW = 70;                                  // сдвиг переходника к отсеку
const OUTLET_Y = [EY0 - SKEW, EY1 - SKEW];        // окно в левой стенке отсека
const LINING = 12;                                // пена в плениуме и переходнике
const SHEET = 1.5;                                // сталь плениума и переходника
const SKIRT_Z0 = EZ0 + 4;                         // низ бортов плениума над верхом ПК

// Выпуклое тело: грани разворачиваются наружу от центра — для ламелей, лопаток
// и полос, у которых обход в профиле неудобно держать руками.
function convexSolid(mesh, faces, color) {
  const pts = faces.flat();
  const c = [0, 1, 2].map((k) => pts.reduce((s, p) => s + p[k], 0) / pts.length);
  for (const face of faces) {
    const n = polygonNormal(face);
    if (!n) continue;
    const f = face[0];
    addPolygon(mesh, n[0] * (f[0] - c[0]) + n[1] * (f[1] - c[1]) + n[2] * (f[2] - c[2]) < 0 ? face.slice().reverse() : face, color);
  }
}
// Призма по выпуклому профилю, вытянутая вдоль оси axis от a0 до a1.
// Профиль — пары координат двух других осей в порядке x, y, z.
function extrude(mesh, profile, axis, [a0, a1], color) {
  const put = ([u, v], a) => { const p = [u, v]; p.splice(axis, 0, a); return p; };
  const faces = [profile.map((q) => put(q, a0)), profile.map((q) => put(q, a1))];
  for (let i = 0; i < profile.length; i++) {
    const q0 = profile[i], q1 = profile[(i + 1) % profile.length];
    faces.push([put(q0, a0), put(q1, a0), put(q1, a1), put(q0, a1)]);
  }
  convexSolid(mesh, faces, color);
}
// Выпуклый многоугольник, сдвинутый внутрь на d (обход против часовой).
function inset(poly, d) {
  const lines = poly.map((a, i) => {
    const b = poly[(i + 1) % poly.length];
    const l = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const n = [-(b[1] - a[1]) / l, (b[0] - a[0]) / l];
    return [[a[0] + n[0] * d, a[1] + n[1] * d], [b[0] - a[0], b[1] - a[1]]];
  });
  return lines.map((cur, i) => {
    const [[px, py], [dx, dy]] = lines[(i - 1 + lines.length) % lines.length];
    const [[qx, qy], [ex, ey]] = cur;
    const t = ((qx - px) * ey - (qy - py) * ex) / (dx * ey - dy * ex);
    return [px + dx * t, py + dy * t];
  });
}
// План плениума: отсек от PLENUM_Y0 до задней стенки, со скосом.
const PLENUM_PLAN = [[X0, PLENUM_Y0], [X1, PLENUM_Y0], TECH_CHAMFER[1], TECH_CHAMFER[0], [X0, TECH_DEPTH]];

// Отсек и окно плениума в левой стенке — неподвижная часть в группе ниш.
export function buildTechBay(mesh) {
  const c = PALETTE.side;
  const inner = PLAN.map(([x, y]) => [x, Math.max(y, TRACK_ZONE)]);
  addPolygon(mesh, inner.map(([x, y]) => [x, y, Z0]), c);
  addPolygon(mesh, inner.slice().reverse().map(([x, y]) => [x, y, Z1]), c);
  for (let i = 1; i < inner.length - 1; i++) {
    const a = inner[i], b = inner[i + 1];
    addQuad(mesh, [a[0], a[1], Z0], [b[0], b[1], Z0], [b[0], b[1], Z1], [a[0], a[1], Z1], c);
  }
  // Левая стенка x = X0 — с окном плениума во всю его высоту, под потолком отсека.
  const wall = (ya, yb, za, zb) => addQuad(mesh, [X0, ya, za], [X0, yb, za], [X0, yb, zb], [X0, ya, zb], c);
  wall(TECH_DEPTH, TRACK_ZONE, Z0, EZ0);
  wall(TECH_DEPTH, OUTLET_Y[1], EZ0, Z1);
  wall(OUTLET_Y[0], TRACK_ZONE, EZ0, Z1);
  // Откосы проёма и кромки дна и плит над отсеком — за фасадом, видны в щели.
  const T = TRACK_ZONE;
  for (const x of [X0, X1]) addQuad(mesh, [x, 0, PLINTH], [x, T, PLINTH], [x, T, UNDER_1], [x, 0, UNDER_1], PALETTE.side);
  addQuad(mesh, [X0, T, PLINTH], [X1, T, PLINTH], [X1, T, Z0], [X0, T, Z0], PALETTE.side);
  addQuad(mesh, [X0, T, Z1], [X1, T, Z1], [X1, T, UNDER_1], [X0, T, UNDER_1], PALETTE.side);
}

const MID = (X0 + X1) / 2;
const [PC_W, PC_D, PC_H] = TECH_PC;
const PC_Y0 = TECH_PC_FRONT;
const PC_Z0 = Z0 + TECH_TRAY_H;

// Панели фасада: нижняя — с решёткой притока, верхняя — глухая. Шов между
// ними — та же теневая щель GAP. Подъём каждой — до низа пустоты пояса.
const SPLIT = (PLINTH + UNDER_1) / 2;
export const TECH_PANELS = {
  bottom: { z: [PLINTH + GAP, SPLIT - GAP / 2] },
  top: { z: [SPLIT + GAP / 2, UNDER_1 - GAP] },
};
export const TECH_LIFT = {
  top: UNDER_1 - TECH_PANELS.top.z[0],
  bottom: UNDER_1 - TECH_PANELS.bottom.z[0],
};
// Точка, от которой корпус ПК меняет размер: низ, перед и середина по ширине.
export const TECH_PC_ANCHOR = [MID, PC_Y0, PC_Z0];

// ─── Выдвижной поддон: направляющие, привод, кабели ─────────────────────────
// Поддон — гнутый стальной лист 2 мм с бортами 50: борта держат направляющие
// и работают балками, лист не прогибается под ПК 15 кг. Высота узла та же, что
// у прежнего поддона, TECH_TRAY_H = 20: зазор над дном 4 + лист 2 + опоры 14.
// Направляющие — пара телескопов полного выдвижения 400 мм на шариках, класс
// нагрузки 45 кг на пару: втрое больше ПК с поддоном. Звенья как у ящиков:
// наружное на стенке отсека, среднее идёт на половину хода, внутреннее — на борту.
// Привод — мотор-редуктор 24 В на задней стойке и зубчатый ремень в профиле на
// левой стенке; каретка ремня держит борт поддона. Мотор останавливается по
// концевикам и по росту тока, если поддон во что-то упёрся; без питания ремень
// отпускается муфтой, и поддон выдвигается рукой за передний борт.
// Кабели идут от разъёмов ПК к стойке на заднем борту, оттуда — по складному
// рычагу из двух звеньев (как в серверной стойке) к щели в задней стенке и в шахту.
const TRAY_GAP = 4;
const TRAY_SHEET = TECH_TRAY_SHEET;
const TRAY_WALL = 50;          // борт поддона
const SLIDE_T = 13;            // толщина направляющей с зазором, на сторону
const SLIDE_LEN = 400;
const SLIDE_Y = TECH_PC_FRONT + 6; // перед направляющих — за направляющими фасада
const TRAY_X = [X0 + SLIDE_T, X1 - SLIDE_T];
const TRAY_Y = [TRACK_ZONE + 2, TECH_TRAY_BACK];
const TRAY_Z = Z0 + TRAY_GAP;
const SLIDE_Z = [TRAY_Z + 5, TRAY_Z + TRAY_WALL - 4];
const TRAY_TOP = TRAY_Z + TRAY_SHEET;

// Направляющая поддона — швеллер вдоль y. dir: +1 от левой стенки, −1 от правой.
const SLIDE_MEMBERS = {
  fixed: { offset: 0, flange: 12, inset: 0, color: PALETTE.rail },
  middle: { offset: 4, flange: 8, inset: 3, color: PALETTE.railMiddle },
  inner: { offset: 8, flange: 4, inset: 6, color: PALETTE.railMoving },
};
function slideMember(mesh, member) {
  const { offset, flange, inset, color } = member;
  const [z0, z1] = [SLIDE_Z[0] + inset, SLIDE_Z[1] - inset];
  const [y0, y1] = [SLIDE_Y, SLIDE_Y + SLIDE_LEN];
  for (const [base, dir] of [[X0, 1], [X1, -1]]) {
    const x = base + dir * offset;
    const span = (a, b) => (a < b ? [a, b] : [b, a]);
    box(mesh, ...span(x, x + dir * 1.5), y0, y1, z0, z1, color);
    box(mesh, ...span(x, x + dir * flange), y0, y1, z0, z0 + 1.5, color);
    box(mesh, ...span(x, x + dir * flange), y0, y1, z1 - 1.5, z1, color);
  }
}

// Ременной привод на левой стенке: алюминиевый профиль 20 × 38 с ремнём внутри,
// у заднего конца — мотор-редуктор поперёк профиля, у переднего — натяжной шкив.
const DRIVE_Z = [SLIDE_Z[1] + 12, SLIDE_Z[1] + 50];
const DRIVE_Y = [TRACK_ZONE + 2, 545];
const DRIVE_X = [X0, X0 + TECH_DRIVE_SIDE - 10]; // профиль 20, каретка ещё 10
const MOTOR_R = 18;
const MOTOR_Y = 522;
const CARRIAGE = 30;           // длина каретки по y
// Каретка стоит у заднего края борта: при выдвижении на 400 она у переднего шкива.
const CARRIAGE_Y = TRAY_Y[1] - CARRIAGE - 4;

// Складной рычаг: неподвижная ось на задней стенке у щели в шахту, подвижная —
// на стойке поддона. Два звена по ARM_L, одно над другим: складываются без касания.
const ARM_L = 235;
const ARM_W = 20;              // ширина лотка звена в плане
const ARM_PIVOT = [252, TECH_DEPTH - 20];       // ось на задней стенке
const ARM_MOVING = [252, TRAY_Y[1] + 15];       // ось на стойке поддона, закрытое положение
const ARM_A_Z = [Z0 + 140, Z0 + 170];
const ARM_B_Z = [Z0 + 172, Z0 + 202];
const POST = { x: [240, 266], y: [TRAY_Y[1], TRAY_Y[1] + 6], z: [TRAY_Z, ARM_B_Z[1] + 12] };
const SLOT = { x: [230, 295], z: [Z0 + 135, Z0 + 185] }; // щель в задней стенке в шахту
const CABLE_R = [4.5, 3.5];    // питание 230 В и пучок данных

// Положение рычага при выдвижении s: ось A, колено E и углы звеньев.
function armPose(s) {
  const [fx, fy] = ARM_PIVOT;
  const mx = ARM_MOVING[0], my = ARM_MOVING[1] - s;
  const d = Math.hypot(fx - mx, fy - my);
  const h = Math.sqrt(Math.max(0, ARM_L ** 2 - (d / 2) ** 2));
  // Колено уходит к середине отсека (+x), перпендикулярно линии осей.
  const nx = -(my - fy) / d, ny = (mx - fx) / d;
  const sign = nx >= 0 ? 1 : -1;
  const ex = (fx + mx) / 2 + sign * nx * h, ey = (fy + my) / 2 + sign * ny * h;
  return { e: [ex, ey], a: Math.atan2(ey - fy, ex - fx), b: Math.atan2(my - ey, mx - ex) };
}

// Звенья построены в закрытом положении. При выдвижении s — матрицы сдвига
// звеньев A и B от закрытого положения (без отражения сцены).
export function techBayArm(s) {
  const p = armPose(s), p0 = armPose(0);
  const [fx, fy] = ARM_PIVOT;
  const a = multiply(translation(fx, fy, 0), multiply(rotationZ(p.a - p0.a), translation(-fx, -fy, 0)));
  const b = multiply(translation(p.e[0], p.e[1], 0), multiply(rotationZ(p.b - p0.b), translation(-p0.e[0], -p0.e[1], 0)));
  return { a, b };
}

// Звено рычага в своих осях: от оси x = 0 до оси x = ARM_L, лоток открыт сверху,
// в лотке — оба кабеля. Шарниры — вертикальные втулки на концах.
function armLink(mesh, [z0, z1]) {
  const w = ARM_W / 2, t = 1.5;
  box(mesh, 0, ARM_L, -w, w, z0, z0 + t, PALETTE.hardware);
  box(mesh, 0, ARM_L, -w, -w + t, z0, z1, PALETTE.hardware);
  box(mesh, 0, ARM_L, w - t, w, z0, z1, PALETTE.hardware);
  for (const x of [0, ARM_L]) addTube(mesh, [x, 0, z0 - 1], [x, 0, z1 + 1], 11, PALETTE.hardware, { sides: 16 });
  // Кабели лежат в лотке и прихвачены липучками на каждом звене.
  addTube(mesh, [12, -4, z0 + 6], [ARM_L - 12, -4, z0 + 6], CABLE_R[0], PALETTE.cable, { sides: 8 });
  addTube(mesh, [12, 4, z0 + 5], [ARM_L - 12, 4, z0 + 5], CABLE_R[1], PALETTE.cable, { sides: 8 });
  for (const x of [ARM_L * 0.35, ARM_L * 0.7]) box(mesh, x - 6, x + 6, -w + t, w - t, z0 + 12, z0 + 14, PALETTE.buffer);
}
// Звено ставится на место поворотом вокруг z и сдвигом в плане.
function placed(mesh, build, [ox, oy], angle) {
  const local = { position: [], normal: [], color: [] };
  build(local);
  const c = Math.cos(angle), s = Math.sin(angle);
  for (let i = 0; i < local.position.length; i += 3) {
    const [x, y, z] = local.position.slice(i, i + 3), [nx, ny, nz] = local.normal.slice(i, i + 3);
    mesh.position.push(ox + c * x - s * y, oy + s * x + c * y, z);
    mesh.normal.push(c * nx - s * ny, s * nx + c * ny, nz);
  }
  mesh.color.push(...local.color);
}
export const buildTechBayArmA = (mesh) => placed(mesh, (m) => armLink(m, ARM_A_Z), ARM_PIVOT, armPose(0).a);
export const buildTechBayArmB = (mesh) => placed(mesh, (m) => armLink(m, ARM_B_Z), armPose(0).e, armPose(0).b);

// Кабель ломаной: трубка по отрезкам с шаровыми «коленями» из коротких трубок.
function cable(mesh, points, r) {
  for (let i = 0; i < points.length - 1; i++) addTube(mesh, points[i], points[i + 1], r, PALETTE.cable, { sides: 8 });
}

// Неподвижная часть узла: наружные звенья направляющих, профиль привода с мотором
// и концевиками, ось рычага на задней стенке, щель в шахту и вход кабелей в неё.
export function buildTechBayDrive(mesh) {
  slideMember(mesh, SLIDE_MEMBERS.fixed);
  box(mesh, ...DRIVE_X, ...DRIVE_Y, ...DRIVE_Z, PALETTE.rail);
  // Паз ремня на лицевой грани профиля.
  const zm = (DRIVE_Z[0] + DRIVE_Z[1]) / 2;
  addQuad(mesh, [DRIVE_X[1] + 0.5, DRIVE_Y[0] + 20, zm - 5], [DRIVE_X[1] + 0.5, DRIVE_Y[1] - 20, zm - 5],
    [DRIVE_X[1] + 0.5, DRIVE_Y[1] - 20, zm + 5], [DRIVE_X[1] + 0.5, DRIVE_Y[0] + 20, zm + 5], PALETTE.buffer);
  // Мотор-редуктор Ø36: ось поперёк профиля, корпус уходит в задний зазор.
  addTube(mesh, [DRIVE_X[1], MOTOR_Y, zm], [DRIVE_X[1] + 30, MOTOR_Y, zm], MOTOR_R + 4, PALETTE.rail, { sides: 20 });
  addTube(mesh, [DRIVE_X[1] + 30, MOTOR_Y, zm], [DRIVE_X[1] + 95, MOTOR_Y, zm], MOTOR_R, PALETTE.gasTube, { sides: 20 });
  // Концевики «открыто» и «закрыто» — на верхней грани профиля, над ходом каретки.
  for (const y of [DRIVE_Y[0] + 4, DRIVE_Y[1] - 60]) box(mesh, ...DRIVE_X, y, y + 14, DRIVE_Z[1], DRIVE_Z[1] + 8, PALETTE.buffer);
  // Кронштейн оси рычага на задней стенке.
  const [fx, fy] = ARM_PIVOT;
  box(mesh, fx - 14, fx + 14, fy + 8, TECH_DEPTH, ARM_A_Z[0] - 6, ARM_A_Z[0] - 2, PALETTE.hardware);
  box(mesh, fx - 14, fx + 14, TECH_DEPTH - 3, TECH_DEPTH, ARM_A_Z[0] - 20, ARM_A_Z[1] + 4, PALETTE.hardware);
  // Щель в шахту: тёмный проём со щёткой.
  const y = TECH_DEPTH - 0.6;
  addPolygon(mesh, [[SLOT.x[0], y, SLOT.z[0]], [SLOT.x[1], y, SLOT.z[0]], [SLOT.x[1], y, SLOT.z[1]], [SLOT.x[0], y, SLOT.z[1]]], PALETTE.buffer);
  // Кабели от оси рычага в щель: питание ниже, данные выше — дальше в шахте они за перегородкой.
  const zc = ARM_A_Z[0] + 6;
  cable(mesh, [[fx - 4, fy, zc], [fx - 4, fy + 8, zc], [fx - 12, TECH_DEPTH + 30, SLOT.z[0] + 12]], CABLE_R[0]);
  cable(mesh, [[fx + 4, fy, zc], [fx + 4, fy + 8, zc + 10], [fx + 20, TECH_DEPTH + 30, SLOT.z[1] - 12]], CABLE_R[1]);
}

// Среднее звено направляющих: идёт на половину хода поддона.
export const buildTechBaySlideMiddle = (mesh) => slideMember(mesh, SLIDE_MEMBERS.middle);

// Поддон с внутренними звеньями направляющих, кареткой ремня, упругими полосами
// под ПК, стойкой кабелей и кабелями от стойки к разъёмам ПК. Выезжает на TECH_TRAY_TRAVEL.
export function buildTechBayTray(mesh) {
  const [tx0, tx1] = TRAY_X, [ty0, ty1] = TRAY_Y;
  const t = TRAY_SHEET, top = TRAY_Z + TRAY_WALL;
  box(mesh, tx0, tx1, ty0, ty1, TRAY_Z, TRAY_TOP, PALETTE.hardware);
  box(mesh, tx0, tx0 + t, ty0, ty1, TRAY_Z, top, PALETTE.hardware);
  box(mesh, tx1 - t, tx1, ty0, ty1, TRAY_Z, top, PALETTE.hardware);
  box(mesh, tx0, tx1, ty1 - t, ty1, TRAY_Z, top, PALETTE.hardware);
  // Передний борт низкий, ниже ПК: упор и ручка на случай ручного выдвижения.
  box(mesh, tx0, tx1, ty0, ty0 + t, TRAY_Z, PC_Z0 - 2, PALETTE.hardware);
  slideMember(mesh, SLIDE_MEMBERS.inner);
  // Упругие полосы под ПК: ПК → опора → поддон, без жёсткого контакта (лист 11, вид 04).
  for (const x of [MID - 100, MID + 70]) box(mesh, x, x + 30, PC_Y0 + 20, PC_Y0 + PC_D - 20, TRAY_TOP, PC_Z0, PALETTE.buffer);
  // Каретка ремня и кронштейн к левому борту.
  const cy = CARRIAGE_Y;
  box(mesh, DRIVE_X[1], X0 + TECH_DRIVE_SIDE, cy, cy + CARRIAGE, DRIVE_Z[0] + 3, DRIVE_Z[1] - 3, PALETTE.steel);
  box(mesh, tx0 + t, X0 + TECH_DRIVE_SIDE, cy, cy + CARRIAGE, top - 14, DRIVE_Z[0] + 3, PALETTE.steel);
  // Стойка кабелей на заднем борту и кронштейн подвижной оси рычага.
  box(mesh, ...POST.x, ...POST.y, ...POST.z, PALETTE.hardware);
  const [mx, my] = ARM_MOVING;
  box(mesh, mx - 12, mx + 12, POST.y[1], my, ARM_B_Z[0] - 6, ARM_B_Z[0] - 2, PALETTE.hardware);
  // Кабели от рычага вниз по стойке (прихвачены) и к разъёмам на тыльной стороне ПК:
  // питание — к блоку питания внизу, данные — к видеокарте и материнской плате.
  const back = PC_Y0 + PC_D + 1, px = POST.x[1] + 4, py = POST.y[0] - 4;
  cable(mesh, [[mx - 4, my - 6, ARM_B_Z[0] + 6], [px - 16, py, ARM_B_Z[0] + 6], [px - 16, py, PC_Z0 + 60],
    [MID - 70, back + 6, PC_Z0 + 50], [MID - 70, back, PC_Z0 + 50]], CABLE_R[0]);
  cable(mesh, [[mx + 4, my - 6, ARM_B_Z[0] + 5], [px - 6, py, ARM_B_Z[0] + 5], [px - 6, py, PC_Z0 + 140],
    [MID - 20, back + 10, PC_Z0 + 170], [MID - 20, back, PC_Z0 + 170]], CABLE_R[1]);
  for (const z of [PC_Z0 + 80, PC_Z0 + 150]) box(mesh, POST.x[0] - 2, POST.x[1] + 2, py - 8, POST.y[0], z, z + 10, PALETTE.buffer);
}

// Корпус ПК на упругих опорах, по оси отсека, построен в предельном размере.
// На сайте его масштабируют под введённый покупателем корпус; color — обычный
// или «не встанет».
export const buildTechBayPc = (color, face) => (mesh) => {
  box(mesh, MID - PC_W / 2, MID + PC_W / 2, PC_Y0, PC_Y0 + PC_D, PC_Z0, PC_Z0 + PC_H, color);
  // Лицевая панель корпуса другим тоном: видно, где у ПК перед.
  addQuad(mesh, [MID - PC_W / 2 + 20, PC_Y0 - 0.5, PC_Z0 + 20], [MID + PC_W / 2 - 20, PC_Y0 - 0.5, PC_Z0 + 20],
    [MID + PC_W / 2 - 20, PC_Y0 - 0.5, PC_Z0 + PC_H - 20], [MID - PC_W / 2 + 20, PC_Y0 - 0.5, PC_Z0 + PC_H - 20], face);
};

// ─── Схема трёх трактов (лист 10) — стрелки поверх модели ───────────────────
const R_PIPE = 9;
const vsub = (a, b) => a.map((v, k) => v - b[k]);
const vlen = (a) => Math.hypot(...a);

// Конус наконечника: основание в base, вершина в tip.
function cone(mesh, base, tip, radius, color, sides = 16) {
  const axis = vsub(tip, base).map((v) => v / vlen(vsub(tip, base)));
  const guide = Math.abs(axis[2]) < 0.9 ? [0, 0, 1] : [1, 0, 0];
  const cr = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const u0 = cr(axis, guide), ul = vlen(u0), u = u0.map((v) => v / ul), v = cr(axis, u);
  const ring = Array.from({ length: sides }, (_, i) => {
    const t = (i / sides) * Math.PI * 2;
    return base.map((b, k) => b + radius * (Math.cos(t) * u[k] + Math.sin(t) * v[k]));
  });
  for (let i = 0; i < sides; i++) addPolygon(mesh, [ring[i], ring[(i + 1) % sides], tip], color);
  addPolygon(mesh, ring.slice().reverse(), color);
}

// Ломаная трубкой со стрелкой на конце.
function arrow(mesh, points, color) {
  const head = 70;
  const last = points[points.length - 1], prev = points[points.length - 2];
  const dir = vsub(last, prev), len = vlen(dir);
  const base = last.map((v, k) => v - (dir[k] / len) * head);
  const path = [...points.slice(0, -1), base];
  for (let i = 0; i < path.length - 1; i++) addTube(mesh, path[i], path[i + 1], R_PIPE, color, { sides: 10 });
  cone(mesh, base, last, R_PIPE * 3.2, color);
}

export function buildTechBayAir(mesh) {
  const c = PALETTE.techAir;
  const zIn = (TECH_INTAKE.z[0] + TECH_INTAKE.z[1]) / 2;
  const zPlenum = Z1 - TECH_PLENUM / 2;
  // Приток из комнаты через фильтр в фасаде.
  arrow(mesh, [[MID, -420, zIn], [MID, 30, zIn]], c);
  // Подъём в боковых зазорах 120 и в заднем зазоре 100.
  for (const x of [(X0 + MID - PC_W / 2) / 2, (X1 + MID + PC_W / 2) / 2])
    arrow(mesh, [[x, 260, zIn - 80], [x, 260, zPlenum - 40]], c);
  arrow(mesh, [[MID, PC_Y0 + PC_D + 50, zIn - 80], [MID, PC_Y0 + PC_D + 50, zPlenum - 40]], c);
  // Плениум → решётка выброса в боковой грани → в комнату.
  const yOut = (TECH_EXHAUST.y[0] + TECH_EXHAUST.y[1]) / 2;
  arrow(mesh, [[MID, 300, zPlenum], [X0 + 40, yOut, zPlenum], [-420, yOut, zPlenum]], c);
}

export function buildTechBayCables(mesh) {
  const c = PALETTE.techCable;
  const sx = (TECH_SHAFT.x[0] + TECH_SHAFT.x[1]) / 2, sy = (TECH_SHAFT.y[0] + TECH_SHAFT.y[1]) / 2;
  const z = PC_Z0 + PC_H * 0.55;
  // От разъёмов на тыльной стороне ПК в шахту, вверх в лоток и по дуге пояса к Dock.
  const start = Math.atan2(sy - CENTER, sx - CENTER);
  const end = -Math.PI / 2;
  const arc = [];
  for (let i = 0; i <= 16; i++) {
    const a = start + ((end - start) * i) / 16;
    arc.push([CENTER + TECH_TRAY_R * Math.cos(a), CENTER + TECH_TRAY_R * Math.sin(a), TECH_TRAY_Z]);
  }
  arrow(mesh, [[MID, PC_Y0 + PC_D + 10, z], [sx, sy, z], [sx, sy, TECH_TRAY_Z - 40], ...arc], c);
}

export function buildTechBayService(mesh) {
  const c = PALETTE.techService;
  // Фасад уходит вверх, поддон выезжает наружу на 400: обслуживание только из комнаты.
  arrow(mesh, [[MID, -30, PC_Z0 + PC_H + 40], [MID, -30 - TECH_TRAY_TRAVEL - 120, PC_Z0 + PC_H + 40]], c);
}


// ─── Подъём фасада: рейки в пазах стенок, каретки, ленты на барабанах ──────
// Каждая панель висит на двух каретках — по одной в пазу левой и правой стенки
// проёма. Каретки бегут по вертикальным рейкам, стоящим на своих отметках
// направляющих фасада (TECH_TRACKS). Поднимает их один мотор-редуктор 24 В с
// червячной передачей над отсеком, в пустоте пояса: вал поперёк проёма, на нём
// барабаны с лентами. Барабаны нижней панели вдвое больше — лента наматывается
// вдвое быстрее, и нижняя панель проходит вдвое больший путь, как и нужно для
// стопки. Червяк не проворачивается под весом: без питания панели стоят.
// Вниз панели идут своим весом, лента только отпускается.
// Отход внутрь на 18 / 36 до подъёма делают малые линейные приводы 24 В в
// каретках: шток тянет кронштейн панели по горизонтальной направляющей каретки.
const RAIL_X = [205, 209];          // рейка в пазу стенки, левая сторона
const CAR_X = [209, 215];           // каретка
const BRACKET_X = [215, X0 + GAP];  // кронштейн панели через теневую щель
const SHAFT = { y: 22, z: 1115, r: 5 };
// Лента сходит с тыльной стороны барабана: отметка ленты = ось вала + радиус.
const DRUM_R = { top: 10, bottom: 20 };
const LIFT_PARTS = Object.fromEntries(['top', 'bottom'].map((panel, i) => {
  const y = TECH_TRACKS[i] + PANEL / 2;          // ось панели на своей направляющей
  const [z0, z1] = TECH_PANELS[panel].z;
  return [panel, {
    rail: [y - 3, y + 3],
    car: [y - 5, y + 5],
    // Нижняя панель едет вдвое быстрее и догоняет верхнюю. Каретки держат
    // нижнюю панель у низа, верхнюю — у верха: их кронштейны в одной полосе
    // паза, но по высоте расходятся на всём ходу (проверка в check-math).
    carZ: panel === 'top' ? [z1 - 68, z1 - 8] : [z0 + 8, z0 + 68],
    strapY: SHAFT.y + DRUM_R[panel],
    drumX: panel === 'top' ? [209, 212] : [212, 215],
    railZ: [panel === 'top' ? z0 : PLINTH, SHAFT.z - 15],
    track: TECH_TRACKS[i],
  }];
}));
const mirrorX = ([a, b]) => [X0 + X1 - b, X0 + X1 - a];
const bothSides = (fn) => { fn((r) => r); fn(mirrorX); };

export function buildTechBayLift(mesh) {
  for (const p of Object.values(LIFT_PARTS)) {
    bothSides((m) => box(mesh, ...m(RAIL_X), ...p.rail, ...p.railZ, PALETTE.rail));
    bothSides((m) => {
      const [x0, x1] = m(p.drumX);
      addTube(mesh, [x0, SHAFT.y, SHAFT.z], [x1, SHAFT.y, SHAFT.z], p.strapY - SHAFT.y, PALETTE.steelDark, { sides: 24 });
    });
  }
  addTube(mesh, [RAIL_X[0], SHAFT.y, SHAFT.z], [X0 + X1 - RAIL_X[0], SHAFT.y, SHAFT.z], SHAFT.r, PALETTE.steel, { sides: 12 });
  // Мотор-редуктор с червяком — за левым пазом, в пустоте пояса.
  addTube(mesh, [RAIL_X[0] - 30, SHAFT.y, SHAFT.z], [RAIL_X[0], SHAFT.y, SHAFT.z], 22, PALETTE.rail, { sides: 20 });
  addTube(mesh, [RAIL_X[0] - 30, SHAFT.y, SHAFT.z], [RAIL_X[0] - 30, SHAFT.y + 70, SHAFT.z], 17, PALETTE.gasTube, { sides: 20 });
}

// Каретки одной панели с малым приводом отхода внутри: ходят только вверх-вниз.
// Щель в торце каретки — горизонтальная направляющая кронштейна панели.
export const buildTechBayCarriage = (panel) => (mesh) => {
  const p = LIFT_PARTS[panel];
  bothSides((m) => box(mesh, ...m(CAR_X), ...p.car, ...p.carZ, PALETTE.steel));
};

// Ленты от барабана до каретки. Построены в закрытом положении; при подъёме
// лента укорачивается — матрица сжимает её к оси вала (techBayStrapMatrix).
export const buildTechBayStrap = (panel) => (mesh) => {
  const p = LIFT_PARTS[panel];
  bothSides((m) => box(mesh, ...m(p.drumX), p.strapY - 0.6, p.strapY + 0.6, p.carZ[1], SHAFT.z, PALETTE.buffer));
};
export const TECH_LIFT_CARRIAGE_Z = Object.fromEntries(Object.entries(LIFT_PARTS).map(([k, p]) => [k, p.carZ]));
export const TECH_SHAFT_Z = SHAFT.z;
export function techBayStrapMatrix(panel, lift) {
  const top = LIFT_PARTS[panel].carZ[1];
  const k = (SHAFT.z - top - lift) / (SHAFT.z - top);
  return multiply(translation(0, 0, SHAFT.z), multiply(scaling(1, 1, k), translation(0, 0, -SHAFT.z)));
}

// Кронштейны панели: вдоль торца панели назад, в горизонтальную направляющую
// каретки. Отходят внутрь вместе с панелью, поэтому длина — на весь ход.
function panelBrackets(mesh, panel) {
  const p = LIFT_PARTS[panel];
  const zm = (p.carZ[0] + p.carZ[1]) / 2;
  bothSides((m) => box(mesh, ...m(BRACKET_X), 4, PANEL + p.track + 6, zm - 8, zm + 8, PALETTE.hardware));
}

// Кнопка отсека — на неподвижной стенке в 60 от проёма со стороны середины
// фасада (на листах — справа, в изделии отражено), не на панели: панели
// уезжают вверх, а закрывать отсек тоже надо. Сенсорная, заподлицо, Ø22 в
// стальном кольце, на высоте руки стоящего человека. Нажатие открывает, второе —
// закрывает, нажатие во время хода — останавливает.
export const TECH_BUTTON = { x: X1 + 60, z: 620, r: 11 };
export function buildTechBayButton(mesh) {
  const { x, z, r } = TECH_BUTTON;
  const ring = (radius, y, color) => {
    const pts = Array.from({ length: 32 }, (_, i) => {
      const t = (i / 32) * Math.PI * 2;
      return [x + radius * Math.cos(t), y, z + radius * Math.sin(t)];
    });
    addPolygon(mesh, pts, color);
  };
  ring(r + 3, -0.4, PALETTE.steel);
  ring(r, -0.8, PALETTE.hardware);
}

// Панели фасада — отдельные группы: каждая движется по своей матрице.
export function buildTechBayFrontBottom(mesh) {
  const [z0, z1] = TECH_PANELS.bottom.z;
  const [ix0, ix1] = TECH_INTAKE.x, [iz0, iz1] = TECH_INTAKE.z;
  // Панель — рамкой вокруг сквозного проёма притока; решётка и фильтр в проёме —
  // отдельная группа (buildTechBayIntake), едет вместе с панелью.
  box(mesh, X0 + GAP, ix0, 0, PANEL, z0, z1, PALETTE.drawer);
  box(mesh, ix1, X1 - GAP, 0, PANEL, z0, z1, PALETTE.drawer);
  box(mesh, ix0, ix1, 0, PANEL, z0, iz0, PALETTE.drawer);
  box(mesh, ix0, ix1, 0, PANEL, iz1, z1, PALETTE.drawer);
  panelBrackets(mesh, 'bottom');
}

export function buildTechBayFrontTop(mesh) {
  const [z0, z1] = TECH_PANELS.top.z;
  box(mesh, X0 + GAP, X1 - GAP, 0, PANEL, z0, z1, PALETTE.drawer);
  panelBrackets(mesh, 'top');
}

const panelEdge = ([z0, z1]) => [[X0 + GAP, -1, z0], [X1 - GAP, -1, z0], [X1 - GAP, -1, z1], [X0 + GAP, -1, z1]];
export const techBayFrontEdges = (panel) => () => [panelEdge(TECH_PANELS[panel].z)];

// ─── Приток: решётка и кассета фильтра в проёме нижней панели ───────────────
// Лист 11, вид 03: снять решётку → вытянуть кассету → очистить. Всё — в толще
// панели 16: за ней при отходе внутрь до ПК остаётся 8, места для глубокой
// кассеты нет. Решётка — вставка из чёрного анодированного алюминия на
// магнитах: рамка 5 заподлицо с лицом панели и вертикальные ламели клином,
// чуть утопленные. За ней кассета: алюминиевая рамка и складчатый фильтр,
// складки поперёк ламелей — сквозь щели видна их светотень.
const INTAKE_GAP = 0.5;                  // зазор вставки в проёме
const GRILLE_RIM = 5;
const GRILLE_Y = [0.8, 7];
const BLADE_Y = [1.8, 7];
const BLADE = 4;                         // ламель по лицу; к тылу сужается до 2
const CASSETTE_Y = [8, 15.5];
const CASSETTE_RIM = 6;
const PLEAT = 6;                         // шаг складок фильтра

export function buildTechBayIntake(mesh) {
  const [x0, x1] = [TECH_INTAKE.x[0] + INTAKE_GAP, TECH_INTAKE.x[1] - INTAKE_GAP];
  const [z0, z1] = [TECH_INTAKE.z[0] + INTAKE_GAP, TECH_INTAKE.z[1] - INTAKE_GAP];
  const rim = (r, [y0, y1], color) => {
    box(mesh, x0, x1, y0, y1, z0, z0 + r, color);
    box(mesh, x0, x1, y0, y1, z1 - r, z1, color);
    box(mesh, x0, x0 + r, y0, y1, z0 + r, z1 - r, color);
    box(mesh, x1 - r, x1, y0, y1, z0 + r, z1 - r, color);
  };
  rim(GRILLE_RIM, GRILLE_Y, PALETTE.hardware);
  // Ламели с равными щелями, шаг около 20.
  const [u0, u1] = [x0 + GRILLE_RIM, x1 - GRILLE_RIM];
  const n = Math.round((u1 - u0) / 20) - 1;
  const gap = (u1 - u0 - n * BLADE) / (n + 1);
  for (let i = 0; i < n; i++) {
    const a = u0 + gap + i * (BLADE + gap), m = a + BLADE / 2;
    extrude(mesh, [[a, BLADE_Y[0]], [a + BLADE, BLADE_Y[0]], [m + 1, BLADE_Y[1]], [m - 1, BLADE_Y[1]]], 2,
      [z0 + GRILLE_RIM, z1 - GRILLE_RIM], PALETTE.hardware);
  }
  // Кассета: рамка и складки фильтра гармошкой по высоте, с двух сторон.
  rim(CASSETTE_RIM, CASSETTE_Y, PALETTE.railMiddle);
  const [fx0, fx1] = [x0 + CASSETTE_RIM, x1 - CASSETTE_RIM];
  const [fz0, fz1] = [z0 + CASSETTE_RIM, z1 - CASSETTE_RIM];
  const [yf, yb] = [CASSETTE_Y[0] + 1, CASSETTE_Y[1] - 1];
  const count = Math.round((fz1 - fz0) / PLEAT);
  const step = (fz1 - fz0) / count / 2;
  for (let k = 0; k < count * 2; k++) {
    const [za, zb] = [fz0 + k * step, fz0 + (k + 1) * step];
    const [ya, yb2] = k % 2 ? [yb, yf] : [yf, yb];
    const face = [[fx0, ya, za], [fx1, ya, za], [fx1, yb2, zb], [fx0, yb2, zb]];
    addPolygon(mesh, face, PALETTE.filter);
    addPolygon(mesh, face.slice().reverse(), PALETTE.filter);
  }
}

// ─── Плениум, переходник и жалюзи выброса — неподвижная часть ───────────────
// Плениум — съёмный колпак из стали 1,5 с бортами до верха ПК, изнутри пена 12.
// Со стороны окна в левой стенке борта нет: колпак прижат к стенке через
// резиновый уплотнитель по контуру окна. Держится на двух невыпадающих винтах
// с потайной головкой в переднем борту: головка чёрная, в выдавке листа почти
// заподлицо, винт идёт в заклёпочную гайку уголка под потолком. Снимается
// спереди шестигранником, когда поддон выдвинут.
// Переходник — косой короб из той же стали в толще корпуса, от окна отсека до
// окна в боковой грани, изнутри тоже пена. В окне грани — жалюзи из чёрного
// анодированного алюминия: накладная рамка, гильза по откосам и пять лопаток
// под наклоном — наружный край ниже внутреннего. Сверху, с высоты стоящего
// человека, сквозь них не видно пены: взгляд упирается в лопатки.
// Вытяжка — три вентилятора 80 × 80 × 25 на стальной перегородке поперёк
// переходника, ближе к отсеку: после них ещё пена, он гасит их шум. Тянут из
// плениума и держат отсек под лёгким разрежением — воздух входит только через
// фильтр. Одна естественная тяга (≈0,1 Па) фильтр и повороты не пройдёт, а
// вентиляторы ПК гоняют воздух внутри отсека, а не через него. Питание — 24 В
// отсека через плату управления с понижением до 12 В; обороты — ШИМ по датчику
// температуры в плениуме: в простое стоят или еле крутятся.
const FAN = 80;
const FAN_X = [X0 - 70, X0 - 45];       // выход (к жалюзи) и вход (к отсеку)
const FAN_PITCH = 130;                   // между осями вентиляторов по y
const FAN_CLEAR = 12;                    // пена не доходит до вентилятора
// Винт М5 с потайной головкой Ø10 в выдавке листа 1,5: лист продавлен конусом
// 90° от Ø17 на лице до Ø10,4 на глубине, головка утоплена на 0,3 от лица.
const SCREW_DIMPLE = 11;                 // половина квадратного окна в борту
const SCREW = { r: 5, dimple: 8.5, seat: 5.2, depth: 1.6, sink: 0.3, hex: 1.6, hexDepth: 2.5 };
const LOUVRE_DEPTH = 26;                 // гильза жалюзи в толще грани
const LOUVRE_FLANGE = 8;
const BLADES = 5;

export function buildTechBayVent(mesh) {
  // Сталь плениума и переходника — чёрная порошковая краска, матовая.
  const hw = PALETTE.powder, felt = PALETTE.foam;
  // Плениум: крышка под потолком, пена под ней, борты по контуру кроме левого.
  const plan0 = inset(PLENUM_PLAN, 2);
  const plan1 = inset(PLENUM_PLAN, 2 + SHEET);
  const plan2 = inset(PLENUM_PLAN, 2 + SHEET + LINING);
  addPrism(mesh, plan0, Z1 - SHEET, Z1, hw, { top: true, bottom: true });
  addPrism(mesh, plan1, Z1 - SHEET - LINING, Z1 - SHEET, felt, { top: true, bottom: true });
  const strip = (outer, inner, i) => {
    const j = (i + 1) % outer.length;
    return [outer[i], outer[j], inner[j], inner[i]];
  };
  // Рёбра плана: 0 — перед, 1 — правое, 2 — скос, 3 — зад, 4 — левое (окно).
  const zs = (SKIRT_Z0 + Z1) / 2, yf = plan0[0][1];
  const screws = [X0 + 70, X1 - 70];
  // Передний борт — с квадратными окнами под выдавки винтов.
  {
    const [fx0, fx1] = [plan0[0][0], plan0[1][0]], [y0, y1] = [yf, yf + SHEET], q = SCREW_DIMPLE;
    const [za, zb] = [SKIRT_Z0, Z1 - SHEET];
    box(mesh, fx0, fx1, y0, y1, za, zs - q, hw);
    box(mesh, fx0, fx1, y0, y1, zs + q, zb, hw);
    const cuts = [fx0, ...screws.flatMap((x) => [x - q, x + q]), fx1];
    for (let k = 0; k < cuts.length; k += 2) box(mesh, cuts[k], cuts[k + 1], y0, y1, zs - q, zs + q, hw);
    for (const x of screws) flushScrew(mesh, x, yf, zs);
  }
  for (const i of [0, 1, 2, 3]) {
    if (i > 0) addPrism(mesh, strip(plan0, plan1, i), SKIRT_Z0, Z1 - SHEET, hw, { bottom: true });
    addPrism(mesh, strip(plan1, plan2, i), SKIRT_Z0 + 4, Z1 - SHEET - LINING, felt, { bottom: true });
  }
  // Подвёрнутая кромка бортов снизу — жёсткость и мягкий край под рукой.
  for (const i of [0, 1, 2, 3]) addPrism(mesh, strip(plan0, inset(PLENUM_PLAN, 2 + SHEET + 5), i), SKIRT_Z0, SKIRT_Z0 + SHEET, hw, { top: true, bottom: true });
  // Уплотнитель по контуру окна плениума на левой стенке.
  const [oy0, oy1] = OUTLET_Y, g = 7;
  box(mesh, X0, X0 + 4, oy0 - g, oy0, EZ0 - g, Z1, PALETTE.buffer);
  box(mesh, X0, X0 + 4, oy1, oy1 + g, EZ0 - g, Z1, PALETTE.buffer);
  box(mesh, X0, X0 + 4, oy0, oy1, EZ0 - g, EZ0, PALETTE.buffer);

  // Переходник: косой короб от окна грани (x = 0) до окна отсека (x = X0).
  const yAt = (x, y) => y - (SKEW * x) / X0;
  const duct = (x0, x1, d, color) => {
    // Короб толщиной t: четыре стенки, каждая — выпуклая косая пластина.
    const t = d === 0 ? SHEET : LINING;
    const o = d === 0 ? 0 : SHEET;
    const ya = (x) => yAt(x, EY0) + o, yb = (x) => yAt(x, EY1) - o;
    const za = EZ0 + o, zb = EZ1 - o;
    const plate = (pts) => {
      const [p0, p1, p2, p3] = pts;
      const inward = (p) => [p[0], p[1] + p[3], p[2] + p[4]];
      convexSolid(mesh, [
        [p0, p1, p2, p3].map((p) => p.slice(0, 3)),
        [p0, p1, p2, p3].map(inward),
        ...[0, 1, 2, 3].map((k) => {
          const a = pts[k], b = pts[(k + 1) % 4];
          return [a.slice(0, 3), b.slice(0, 3), inward(b), inward(a)];
        }),
      ], color);
    };
    // Точки: x, y, z и сдвиг внутрь короба по y и z.
    plate([[x0, ya(x0), za, 0, t], [x1, ya(x1), za, 0, t], [x1, yb(x1), za, 0, t], [x0, yb(x0), za, 0, t]]);
    plate([[x0, ya(x0), zb, 0, -t], [x1, ya(x1), zb, 0, -t], [x1, yb(x1), zb, 0, -t], [x0, yb(x0), zb, 0, -t]]);
    plate([[x0, ya(x0), za + t, t, 0], [x1, ya(x1), za + t, t, 0], [x1, ya(x1), zb - t, t, 0], [x0, ya(x0), zb - t, t, 0]]);
    plate([[x0, yb(x0), za + t, -t, 0], [x1, yb(x1), za + t, -t, 0], [x1, yb(x1), zb - t, -t, 0], [x0, yb(x0), zb - t, -t, 0]]);
  };
  duct(LOUVRE_DEPTH, X0, 0, hw);
  // Пена прерывается у перегородки с вентиляторами: 80 не помещается в 63 между облицовкой.
  duct(LOUVRE_DEPTH + 4, FAN_X[0] - FAN_CLEAR, 1, felt);
  duct(FAN_X[1] + FAN_CLEAR, X0, 1, felt);
  exhaustFans(mesh, yAt);
  lining(mesh);

  // Жалюзи: накладная рамка на грани, гильза по откосам окна, лопатки и две
  // стойки — чёрный анодированный алюминий.
  const al = PALETTE.hardware;
  const f = LOUVRE_FLANGE;
  box(mesh, -1.5, 0, EY0 - f, EY1 + f, EZ0 - f, EZ0, al);
  box(mesh, -1.5, 0, EY0 - f, EY1 + f, EZ1, EZ1 + f, al);
  box(mesh, -1.5, 0, EY0 - f, EY0, EZ0, EZ1, al);
  box(mesh, -1.5, 0, EY1, EY1 + f, EZ0, EZ1, al);
  const s = 1.2, D = LOUVRE_DEPTH;
  box(mesh, 0, D, EY0, EY1, EZ0, EZ0 + s, al);
  box(mesh, 0, D, EY0, EY1, EZ1 - s, EZ1, al);
  box(mesh, 0, D, EY0, EY0 + s, EZ0 + s, EZ1 - s, al);
  box(mesh, 0, D, EY1 - s, EY1, EZ0 + s, EZ1 - s, al);
  // Лопатка — пластина 1,6 под 38°: наружный край ниже внутреннего.
  const rise = 15, run = 19, th = 1.6;
  const pitch = (EZ1 - EZ0 - 2 * s - rise - th) / (BLADES - 1);
  for (let k = 0; k < BLADES; k++) {
    const zc = EZ0 + s + (rise + th) / 2 + pitch * k - th / 2;
    extrude(mesh, [[2, zc - rise / 2], [2 + run, zc + rise / 2], [2 + run, zc + rise / 2 + th], [2, zc - rise / 2 + th]], 1,
      [EY0 + s, EY1 - s], al);
  }
  for (const y of [EY0 + (EY1 - EY0) / 3, EY0 + (2 * (EY1 - EY0)) / 3]) box(mesh, 1, D - 2, y - 1.5, y + 1.5, EZ0 + s, EZ1 - s, al);
}

// Вентилятор 80 × 80 × 25 в осях отсека: ось вдоль x, выход — к меньшему x.
// Рамка — две пластины с круглым окном Ø76, стойки по углам и обечайка; на
// выходе — крестовина с мотором, семь лопастей с закруткой по ходу воздуха.
function fan(mesh, [xa, xb], yc, zc) {
  const black = PALETTE.pom, h = FAN / 2, R = 38, seg = 8;
  const both = (pts, color) => { addPolygon(mesh, pts, color); addPolygon(mesh, pts.slice().reverse(), color); };
  const at = (x, r, t) => [x, yc + r * Math.cos(t), zc + r * Math.sin(t)];
  // Пластина рамки: четверть квадрата без круга — веер от угла к дуге окна
  // и к серединам сторон квадрата.
  const plate = (x) => {
    for (let q = 0; q < 4; q++) {
      const t0 = (q * Math.PI) / 2, t1 = t0 + Math.PI / 2;
      const corner = at(x, h * Math.SQRT2, t0 + Math.PI / 4);
      both([corner, at(x, h, t0), at(x, R, t0)], black);
      for (let k = 0; k < seg; k++) both([corner, at(x, R, t0 + ((t1 - t0) * k) / seg), at(x, R, t0 + ((t1 - t0) * (k + 1)) / seg)], black);
      both([corner, at(x, R, t1), at(x, h, t1)], black);
    }
  };
  const p = 3;                             // толщина пластин рамки
  for (const x of [xa, xa + p, xb - p, xb]) plate(x);
  for (const [sy, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
    const [y0, y1] = sy < 0 ? [yc - h, yc - h + 7] : [yc + h - 7, yc + h];
    const [z0, z1] = sz < 0 ? [zc - h, zc - h + 7] : [zc + h - 7, zc + h];
    box(mesh, xa, xb, y0, y1, z0, z1, black);
    // Резиновые пистоны вместо винтов — вибрация не уходит в перегородку.
    addTube(mesh, [xa - 4, (y0 + y1) / 2, (z0 + z1) / 2], [xa + 1, (y0 + y1) / 2, (z0 + z1) / 2], 2.6, PALETTE.buffer, { sides: 10 });
  }
  addTube(mesh, [xa + p, yc, zc], [xb - p, yc, zc], R, black, { sides: 40, caps: false });
  // Мотор и крестовина на выходе.
  addTube(mesh, [xa + 1, yc, zc], [xa + 9, yc, zc], 14, black, { sides: 28 });
  addTube(mesh, [xa + 9, yc, zc], [xb - 5, yc, zc], 15, black, { sides: 28 });
  for (let k = 0; k < 4; k++) {
    const t = Math.PI / 4 + (k * Math.PI) / 2, w = 1.6;
    const n = [-Math.sin(t) * w, Math.cos(t) * w];
    const r0 = [Math.cos(t) * 14, Math.sin(t) * 14], r1 = [Math.cos(t) * (R + 1), Math.sin(t) * (R + 1)];
    const q = (r, s2, x) => [x, yc + r[0] + s2 * n[0], zc + r[1] + s2 * n[1]];
    convexSolid(mesh, [
      [q(r0, -1, xa + 1), q(r1, -1, xa + 1), q(r1, 1, xa + 1), q(r0, 1, xa + 1)],
      [q(r0, -1, xa + 4), q(r1, -1, xa + 4), q(r1, 1, xa + 4), q(r0, 1, xa + 4)],
      [q(r0, -1, xa + 1), q(r1, -1, xa + 1), q(r1, -1, xa + 4), q(r0, -1, xa + 4)],
      [q(r0, 1, xa + 1), q(r1, 1, xa + 1), q(r1, 1, xa + 4), q(r0, 1, xa + 4)],
    ], black);
  }
  // Лопасти: входная кромка у входа (больший x), выходная — у выхода, с
  // закруткой: у ступицы круче, к концу положе, и серповидным выносом.
  const radii = [15.5, 21, 27, 32, 36.5];
  for (let b = 0; b < 7; b++) {
    const t0 = (b * 2 * Math.PI) / 7;
    const edge = radii.map((r, i) => {
      const sweep = 0.12 * i;                       // вынос по ходу вращения к концу лопасти
      const span = 0.55 + 0.1 * i;                  // лопасть шире к концу
      const drop = 15 - 2 * i;                      // осевой ход лопасти: к концу положе
      const xm = (xa + xb) / 2 + 1;
      return [at(xm + drop / 2, r, t0 + sweep), at(xm - drop / 2, r, t0 + sweep + span)];
    });
    for (let i = 0; i < radii.length - 1; i++) both([edge[i][0], edge[i + 1][0], edge[i + 1][1], edge[i][1]], black);
  }
}

function exhaustFans(mesh, yAt) {
  const [xa, xb] = FAN_X;
  const zc = (EZ0 + EZ1) / 2;
  // Перегородка на выходной стороне вентиляторов, по внутреннему сечению короба.
  const x0 = xa - SHEET, x1 = xa;
  const ya = yAt(x1, EY0) + SHEET, yb = yAt(x1, EY1) - SHEET;
  const za = EZ0 + SHEET, zb = EZ1 - SHEET;
  const ym = (ya + yb) / 2, h = FAN / 2;
  const centres = [-FAN_PITCH, 0, FAN_PITCH].map((d) => ym + d);
  box(mesh, x0, x1, ya, yb, za, zc - h, PALETTE.powder);
  box(mesh, x0, x1, ya, yb, zc + h, zb, PALETTE.powder);
  const cuts = [ya, ...centres.flatMap((y) => [y - h, y + h]), yb];
  for (let i = 0; i < cuts.length; i += 2) box(mesh, x0, x1, cuts[i], cuts[i + 1], zc - h, zc + h, PALETTE.powder);
  for (const y of centres) fan(mesh, [xa, xb], y, zc);
}

// ─── Облицовка стенок отсека ────────────────────────────────────────────────
// Чёрная меламиновая пена 12 на клею — негорючая, как в плениуме и переходнике,
// и той же толщины, что в тихих корпусах ПК: гул вентиляторов на сотнях герц не
// гасит и 20, а верхи 12 берёт. Лицо профилированное: основание 5 и клинья 7 с
// шагом 24 вдоль высоты — рельеф рассеивает отражения, клинья видны и глазу.
// Открытые кромки — в чёрном анодированном уголке 1,2: пену не крошат руки при
// обслуживании. Боковые стенки — выше направляющих поддона (справа) и привода
// с мотором (слева), до окна плениума; ещё задняя стенка и скос. На задней
// стенке — полоса без облицовки под кабельным рычагом, его осью и щелью в шахту.
const FOAM_BASE = 5;
const FOAM_RIDGE = 7;                           // основание и клин — всего LINING
const FOAM_PITCH = 24;
const TRIM = 1.2;                               // уголок кромки
const TRIM_LIP = 8;                             // полка уголка на лице пены
const LINING_Y0 = TRACK_ZONE + 6;               // за направляющими фасада
const LINING_TOP = EZ0 - 11;                    // под уплотнителем окна плениума
const LINING_Z = { left: 230, right: 180 };     // над приводом и над бортом поддона
const ARM_BAND = [230, 340];                    // рычаг, ось и щель в шахту

// Лист пены на стенке: o — начало на поверхности стенки, u — единичный вектор
// вдоль стенки, n — внутрь отсека; L — длина, z — высота. trim — какие кромки
// закрыты уголком: start (торец u = 0), bottom, top.
function foamPanel(mesh, { o, u, n, L, z: [z0, z1], trim = {} }) {
  const p = (a, d) => [o[0] + u[0] * a + n[0] * d, o[1] + u[1] * a + n[1] * d];
  const slab = (a0, a1, d0, d1, za, zb, color) => extrude(mesh, [p(a0, d0), p(a1, d0), p(a1, d1), p(a0, d1)], 2, [za, zb], color);
  const foam = PALETTE.foam, T = FOAM_BASE + FOAM_RIDGE;
  slab(0, L, 0, FOAM_BASE, z0, z1, foam);
  const count = Math.floor(L / FOAM_PITCH);
  const m = (L - count * FOAM_PITCH) / 2;
  for (let k = 0; k < count; k++) {
    const a = m + k * FOAM_PITCH, c = a + FOAM_PITCH / 2;
    extrude(mesh, [p(a + 1, FOAM_BASE), p(a + FOAM_PITCH - 1, FOAM_BASE), p(c + 1, T), p(c - 1, T)], 2, [z0, z1], foam);
  }
  const hw = PALETTE.hardware;
  if (trim.start) {
    slab(-TRIM, 0, 0, T + TRIM, z0, z1, hw);
    slab(-TRIM, TRIM_LIP, T, T + TRIM, z0, z1, hw);
  }
  if (trim.bottom) {
    slab(trim.start ? -TRIM : 0, L, 0, T + TRIM, z0 - TRIM, z0, hw);
    slab(trim.start ? -TRIM : 0, L, T, T + TRIM, z0, z0 + TRIM_LIP, hw);
  }
  if (trim.top) {
    slab(0, L, 0, T + TRIM, z1, z1 + TRIM, hw);
    slab(0, L, T, T + TRIM, z1 - TRIM_LIP, z1, hw);
  }
}

function lining(mesh) {
  const [[cx, cy], [ex, ey]] = TECH_CHAMFER;
  const back = TECH_DEPTH - LINING;
  foamPanel(mesh, { o: [X0, LINING_Y0], u: [0, 1], n: [1, 0], L: back - LINING_Y0, z: [LINING_Z.left, LINING_TOP], trim: { start: true, bottom: true } });
  foamPanel(mesh, { o: [X1, LINING_Y0], u: [0, 1], n: [-1, 0], L: ey - LINING_Y0, z: [LINING_Z.right, LINING_TOP], trim: { start: true, bottom: true } });
  // Задняя стенка: ниже и выше полосы рычага; кромки у полосы — в уголке.
  const backPanel = { o: [X0 + LINING, TECH_DEPTH], u: [1, 0], n: [0, -1], L: cx - X0 - LINING };
  foamPanel(mesh, { ...backPanel, z: [Z0, ARM_BAND[0]], trim: { top: true } });
  foamPanel(mesh, { ...backPanel, z: [ARM_BAND[1], LINING_TOP], trim: { bottom: true } });
  const l = Math.hypot(ex - cx, ey - cy);
  foamPanel(mesh, { o: [cx, cy], u: [(ex - cx) / l, (ey - cy) / l], n: [(ey - cy) / l, -(ex - cx) / l], L: l,
    z: [LINING_Z.right, LINING_TOP], trim: { bottom: true } });
}

// ─── Подсветка отсека ───────────────────────────────────────────────────────
// Профиль 17 × 8 из чёрного анодированного алюминия с молочным рассеивателем —
// на потолке отсека у переднего края, между направляющими фасада и плениумом.
// Светит вниз: на ПК, поддон, разъёмы и кабели. Включается вместе с открытием
// отсека и гаснет, когда фасад закрыт; свет тот же 3000 K, что у ящиков.
export const TECH_LED = { x: [X0 + LINING + 8, X1 - LINING - 8], y: [TRACK_ZONE + 8, TRACK_ZONE + 25], h: 8 };

export function buildTechBayLed(mesh) {
  const { x: [x0, x1], y: [y0, y1], h } = TECH_LED;
  const w = 1.2;                                 // стенки профиля вокруг рассеивателя
  addPrism(mesh, [[x0, y0], [x1, y0], [x1, y1], [x0, y1]], Z1 - h, Z1, PALETTE.hardware);
  addPolygon(mesh, [[x0, y0, Z1 - h], [x1, y0, Z1 - h], [x1, y0 + w, Z1 - h], [x0, y0 + w, Z1 - h]].reverse(), PALETTE.hardware);
  addPolygon(mesh, [[x0, y1 - w, Z1 - h], [x1, y1 - w, Z1 - h], [x1, y1, Z1 - h], [x0, y1, Z1 - h]].reverse(), PALETTE.hardware);
  // Рассеиватель утоплен на 1 в профиль.
  const d = Z1 - h + 1;
  addPolygon(mesh, [[x0 + w, y0 + w, d], [x1 - w, y0 + w, d], [x1 - w, y1 - w, d], [x0 + w, y1 - w, d]].reverse(), PALETTE.techLed);
  for (const y of [y0 + w, y1 - w]) addQuad(mesh, [x0, y, Z1 - h], [x1, y, Z1 - h], [x1, y, d], [x0, y, d], PALETTE.hardware);
}

// Свет профиля для рендера сайта (как у ящиков, build-drawer.js): точка под
// рассеивателем и объём — отсек и место перед ним, куда выезжает поддон.
// Координаты до отражения (mirror.js).
export function techBayLightVolume() {
  const { x, y, h } = TECH_LED;
  return {
    position: [(x[0] + x[1]) / 2, (y[0] + y[1]) / 2, Z1 - h - 10],
    min: [X0 - 2, -TECH_TRAY_TRAVEL - 60, PLINTH],
    max: [X1 + 2, TECH_DEPTH + 2, Z1 + 2],
  };
}

// Выдавка и потайная головка в переднем борту плениума. Ось винта вдоль y,
// лицо борта — плоскость y = yf, внутрь плениума — +y.
function flushScrew(mesh, x, yf, z) {
  const { r, dimple, seat, depth, sink, hex, hexDepth } = SCREW;
  const hw = PALETTE.powder, head = PALETTE.bolt, n = 40;
  const at = (rad, y, t) => [x + rad * Math.cos(t), y, z + rad * Math.sin(t)];
  const t = (k) => (k / n) * 2 * Math.PI;
  // Грань разворачивается нормалью к стороне, откуда её видно: want — вектор
  // этой стороны (по умолчанию к лицу борта, −y).
  const face = (pts, color, want = [0, -1, 0]) => {
    const nrm = polygonNormal(pts);
    if (!nrm) return;
    addPolygon(mesh, nrm[0] * want[0] + nrm[1] * want[1] + nrm[2] * want[2] < 0 ? pts.slice().reverse() : pts, color);
  };
  const radial = (a, sgn) => [sgn * Math.cos(a), 0, sgn * Math.sin(a)];
  const q = SCREW_DIMPLE;
  // Лицо квадрата вокруг выдавки: веер от углов к окружности.
  for (let k = 0; k < n; k++) {
    const a = t(k), b = t(k + 1), m = (a + b) / 2;
    const cx = x + Math.sign(Math.cos(m)) * q, cz = z + Math.sign(Math.sin(m)) * q;
    face([[cx, yf, cz], at(dimple, yf, b), at(dimple, yf, a)], hw);
  }
  // Стороны квадрата, где веер не дотягивается до середин сторон.
  for (let s4 = 0; s4 < 4; s4++) {
    const a = (s4 * Math.PI) / 2;
    const mid = [x + Math.round(Math.cos(a)) * q, yf, z + Math.round(Math.sin(a)) * q];
    const near = at(dimple, yf, a);
    for (const side of [-1, 1]) {
      const corner = [x + Math.sign(Math.cos(a + side * Math.PI / 4)) * q, yf, z + Math.sign(Math.sin(a + side * Math.PI / 4)) * q];
      const tri = side < 0 ? [mid, near, corner] : [mid, corner, near];
      face(tri, hw);
    }
  }
  // Конус выдавки и дно под головкой.
  for (let k = 0; k < n; k++) {
    const a = t(k), b = t(k + 1);
    face([at(dimple, yf, a), at(dimple, yf, b), at(seat, yf + depth, b), at(seat, yf + depth, a)], hw);
    face([at(seat, yf + depth, a), at(seat, yf + depth, b), at(r, yf + depth, b), at(r, yf + depth, a)], hw);
  }
  // Головка: боковая кромка, лицо кольцом вокруг шестигранника, гнездо.
  const hy = yf + sink;
  for (let k = 0; k < n; k++) {
    const a = t(k), b = t(k + 1);
    face([at(r, hy, a), at(r, hy, b), at(r, yf + depth, b), at(r, yf + depth, a)], head, radial((a + b) / 2, 1));
  }
  const hexPt = (i, y) => at(hex / Math.cos(Math.PI / 6), y, (i * Math.PI) / 3 + Math.PI / 6);
  for (let i = 0; i < 6; i++) {
    const a0 = (i * Math.PI) / 3 + Math.PI / 6, a1 = a0 + Math.PI / 3, steps = 7;
    for (let k = 0; k < steps; k++) {
      const u = a0 + ((a1 - a0) * k) / steps, v = a0 + ((a1 - a0) * (k + 1)) / steps;
      // Кольцо лица головки от стороны шестигранника до окружности.
      const lerp = (w) => { const p0 = hexPt(i, hy), p1 = hexPt(i + 1, hy); return p0.map((c, j) => c + (p1[j] - c) * w); };
      face([lerp(k / steps), at(r, hy, u), at(r, hy, v), lerp((k + 1) / steps)], head);
    }
    face([hexPt(i, hy), hexPt(i + 1, hy), hexPt(i + 1, hy + hexDepth), hexPt(i, hy + hexDepth)], PALETTE.buffer,
      radial((i + 0.5) * Math.PI / 3 + Math.PI / 6, -1));
  }
  face(Array.from({ length: 6 }, (_, i) => hexPt(i, hy + hexDepth)), PALETTE.buffer);
}
