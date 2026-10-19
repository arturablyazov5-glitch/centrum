// Модули Qi в рабочей поверхности — лист 43 и узел на виде 18. Готовый модуль
// стоит корпусом в отверстии Ø80* снизу, на поверхности — только фланец Ø90*
// высотой 1,5: тёмное стекло над катушкой и тонкий металлический обод.
// Места и число модулей по пакетам — sockets.js.

import { SIZE, LEVEL_1 } from './params.js';
import { addPolygon } from './mesh.js';
import { PALETTE } from './palette.js';
import { QI_D, qiSpots } from './sockets.js';

const FLANGE = 1.5;                    // высота фланца над рабочей поверхностью
const RIM = 3;                         // ширина металлического обода
const SEG = 48;

// Один модуль. Группы отражаются (mirror.js), поэтому точка строится в x → 2700 − x.
function buildModule(mesh, { x, y }) {
  const cx = SIZE - x, top = LEVEL_1 + FLANGE;
  const ring = (r, z) => Array.from({ length: SEG }, (_, i) => {
    const a = (i / SEG) * Math.PI * 2;
    return [cx + r * Math.cos(a), y + r * Math.sin(a), z];
  });
  const outer = ring(QI_D / 2, top), inner = ring(QI_D / 2 - RIM, top), foot = ring(QI_D / 2, LEVEL_1);
  addPolygon(mesh, inner, PALETTE.qi);
  for (let i = 0; i < SEG; i++) {
    const j = (i + 1) % SEG;
    addPolygon(mesh, [inner[i], outer[i], outer[j], inner[j]], PALETTE.steel);
    addPolygon(mesh, [foot[i], foot[j], outer[j], outer[i]], PALETTE.steel);
  }
}

// Отдельная группа на каждое место: Q1 есть во всех пакетах, Q3 — только в MAX.
export const QI_IDS = qiSpots('max').map((q) => q.id);
export const buildQi = (id) => (mesh) => buildModule(mesh, qiSpots('max').find((q) => q.id === id));
