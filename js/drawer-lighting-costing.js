// Предварительная оценка прямых затрат на подсветку: розничные ставки вынесены
// в centrum-config.js, длины берутся из той же раскладки, что и 3D-модель.

import { CENTRUM_CONFIG } from './centrum-config.js';
import { DRAWER_TRAVEL, GAP, Y0, Y1 } from './3d/drawer-geometry.js';
import { cellsFor } from './3d/drawer-layout.js';
import { drawerLedLength } from './3d/build-drawer.js';

const M_PER_MM = 1000;

function rowCount(cells) {
  return new Set(cells.map((cell) => cell.row)).size;
}

export function calculateDrawerLightingCost(drawerCount) {
  const cells = cellsFor(drawerCount);
  const rates = CENTRUM_CONFIG.lighting.drawerLighting.pricing;
  const profileLengthMm = cells.reduce((sum, cell) => sum + drawerLedLength(cell), 0);
  const profileLengthM = profileLengthMm / M_PER_MM;
  const rows = rowCount(cells);

  // В электросхеме: одна шина по ряду и гибкий подвод к каждому выдвижному ящику.
  const rowBusMm = Math.max(0, Y1 - Y0 - 2 * GAP - 20);
  const flexibleWireMm = cells.length * (DRAWER_TRAVEL + rates.movingLeadSlackMm);
  const wireLengthM = (rows * rowBusMm + flexibleWireMm) / M_PER_MM;

  const materials = {
    ledTape: profileLengthM * rates.ledTapePerMeter,
    aluminumProfile: profileLengthM * rates.aluminumProfilePerMeter,
    opalDiffuser: profileLengthM * rates.opalDiffuserPerMeter,
    endCaps: cells.length * rates.endCapSetPerProfile,
    openingSensors: cells.length * rates.openingSensorPerDrawer,
    wire: wireLengthM * rates.flexibleWirePerMeter,
  };
  const directCost = Object.values(materials).reduce((sum, cost) => sum + cost, 0);
  const price = Math.ceil((directCost + rates.targetMarkup) / rates.priceRounding) * rates.priceRounding;

  return {
    drawerCount,
    profileLengthMm,
    profileLengthM,
    rows,
    wireLengthM,
    materials,
    directCost,
    targetMarkup: price - directCost,
    price,
  };
}

export function drawerLightingPrice(drawerCount) {
  return calculateDrawerLightingCost(drawerCount).price;
}
