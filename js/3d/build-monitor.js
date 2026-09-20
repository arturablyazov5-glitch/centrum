// Монитор на кронштейне. Кронштейн крепится к внутренней стенке второго уровня —
// туда же, где на виде 05 показаны закладные, — и выносит экран над Sector.
// Экран смотрит в сторону входа: пользователь сидит в центральном отверстии.

import { CENTER, LEVEL_1 } from './params.js';
import { addPrism, addQuad, roundedRect } from './mesh.js';
import { PALETTE } from './palette.js';

const WALL_Y = 205;          // внутренняя грань пояса перед пользователем
const SCREEN_Y = 278;        // экран почти вплотную к стенке пояса
const SCREEN_W = 620;        // 27″ по диагонали
const SCREEN_H = 350;
const SCREEN_T = 24;         // толщина панели
const BEZEL = 14;            // рамка вокруг матрицы
const TOP = 1230;            // верх экрана: чуть выше второго уровня
const ARM_Z = LEVEL_1 + 265; // ось выноса кронштейна

const bottom = TOP - SCREEN_H;

export function buildMonitor(mesh) {
  // Крепление к стенке: площадка на закладных и короткий переходник до панели.
  // Стенка пояса — цилиндр R1250, поэтому у краёв экрана зазор меньше, чем по центру.
  addPrism(mesh, [[CENTER - 100, WALL_Y], [CENTER + 100, WALL_Y], [CENTER + 100, WALL_Y + 22], [CENTER - 100, WALL_Y + 22]],
    ARM_Z - 120, ARM_Z + 120, PALETTE.arm, { top: true, bottom: true });
  addPrism(mesh, [[CENTER - 60, WALL_Y + 22], [CENTER + 60, WALL_Y + 22], [CENTER + 60, SCREEN_Y - SCREEN_T], [CENTER - 60, SCREEN_Y - SCREEN_T]],
    ARM_Z - 60, ARM_Z + 60, PALETTE.arm, { top: true, bottom: true });

  // Корпус панели.
  const body = roundedRect(CENTER, SCREEN_Y - SCREEN_T / 2, SCREEN_W, SCREEN_T, 6, 2);
  addPrism(mesh, body, bottom, TOP, PALETTE.bezel, { top: true, bottom: true });

  // Матрица: тёмная плоскость внутри рамки, обращённая к пользователю.
  const face = SCREEN_Y + 0.6;
  addQuad(mesh,
    [CENTER - SCREEN_W / 2 + BEZEL, face, bottom + BEZEL],
    [CENTER + SCREEN_W / 2 - BEZEL, face, bottom + BEZEL],
    [CENTER + SCREEN_W / 2 - BEZEL, face, TOP - BEZEL],
    [CENTER - SCREEN_W / 2 + BEZEL, face, TOP - BEZEL], PALETTE.screen);
}
