// Оценка прямых затрат на переменную часть хранения.
// Ставки публичные; конфигурация и границы оценки см. docs/drawers/price-policy.md.

import { CENTRUM_CONFIG } from './centrum-config.js';
import { BOX_DEPTH, RAIL_GAP, WALL_H } from './3d/drawer-geometry.js';
import { cellsFor, drawerPartitionPlan } from './3d/drawer-layout.js';
import { pullProfile } from './3d/build-drawer.js';

const MILLIMETERS_PER_METER = 1000;
const SQUARE_MILLIMETERS_PER_SQUARE_METER = MILLIMETERS_PER_METER ** 2;

const panelAreaM2 = (widthMm, heightMm) => widthMm * heightMm / SQUARE_MILLIMETERS_PER_SQUARE_METER;
const panelCutMeters = (widthMm, heightMm) => (widthMm + heightMm) / MILLIMETERS_PER_METER;

function facadeShape(cell) {
  const profile = pullProfile(cell.y0, cell.y1, cell.z1);
  let removedAreaMm2 = 0;
  let curvedEdgeMm = 0;
  for (let i = 0; i < profile.length - 1; i++) {
    const [y0, z0] = profile[i];
    const [y1, z1] = profile[i + 1];
    removedAreaMm2 += (y1 - y0) * (cell.z1 - (z0 + z1) / 2);
    curvedEdgeMm += Math.hypot(y1 - y0, z1 - z0);
  }
  const pullWidthMm = profile.at(-1)[0] - profile[0][0];
  const edgeLengthMm = cell.y1 - cell.y0
    + 2 * (cell.z1 - cell.z0)
    + (cell.y1 - cell.y0 - pullWidthMm)
    + curvedEdgeMm;
  return {
    areaM2: panelAreaM2(cell.y1 - cell.y0, cell.z1 - cell.z0) - removedAreaMm2 / SQUARE_MILLIMETERS_PER_SQUARE_METER,
    cutMeters: panelCutMeters(cell.y1 - cell.y0, cell.z1 - cell.z0),
    edgeMeters: edgeLengthMm / MILLIMETERS_PER_METER,
  };
}

function panelPlan(count) {
  const cells = cellsFor(count);
  const panels16 = [];
  const facades = [];
  let edge16Mm = 0;

  for (const cell of cells) {
    const cellWidth = cell.y1 - cell.y0;
    const cellHeight = cell.z1 - cell.z0;
    const boxWidth = cellWidth - 2 * RAIL_GAP;
    const boxHeight = Math.min(WALL_H, cellHeight - 30);

    // Детали короба: дно, задняя стенка и две боковины.
    panels16.push({ a: boxWidth, b: BOX_DEPTH, edgeMm: boxWidth + 2 * BOX_DEPTH });
    panels16.push({ a: boxWidth, b: boxHeight, edgeMm: 0 });
    panels16.push({ a: BOX_DEPTH, b: boxHeight, edgeMm: 2 * BOX_DEPTH });
    panels16.push({ a: BOX_DEPTH, b: boxHeight, edgeMm: 0 });

    facades.push(facadeShape(cell));
  }

  for (const part of drawerPartitionPlan(cells)) {
    const depth = part.x1 - part.x0;
    if (part.kind === 'vertical') {
      const height = part.z1 - part.z0;
      panels16.push({ a: depth, b: height, edgeMm: height });
    } else {
      const width = part.y1 - part.y0;
      panels16.push({ a: depth, b: width, edgeMm: width });
    }
  }

  const bodyAreaM2 = panels16.reduce((sum, panel) => sum + panelAreaM2(panel.a, panel.b), 0);
  const bodyCutMeters = panels16.reduce((sum, panel) => sum + panelCutMeters(panel.a, panel.b), 0);
  edge16Mm = panels16.reduce((sum, panel) => sum + panel.edgeMm, 0);
  const facadeAreaM2 = facades.reduce((sum, facade) => sum + facade.areaM2, 0);
  const facadeCutMeters = facades.reduce((sum, facade) => sum + facade.cutMeters, 0);
  const facadeEdgeMeters = facades.reduce((sum, facade) => sum + facade.edgeMeters, 0);

  return {
    cells,
    bodyAreaM2,
    bodyCutMeters,
    bodyEdgeMeters: edge16Mm / MILLIMETERS_PER_METER,
    facadeAreaM2,
    facadeCutMeters,
    facadeEdgeMeters,
  };
}

export function calculateDrawerDirectCost(count) {
  const { costing } = CENTRUM_CONFIG.drawers;
  const plan = panelPlan(count);
  const bodyMaterial = plan.bodyAreaM2 * costing.bodySheet.sheetPrice / costing.bodySheet.sheetAreaM2;
  const facadeMaterial = plan.facadeAreaM2 * costing.facadeSheet.sheetPrice / costing.facadeSheet.sheetAreaM2;
  const cutting = plan.bodyCutMeters * costing.cuttingPerMeter[costing.bodySheet.thicknessMm]
    + plan.facadeCutMeters * costing.cuttingPerMeter[costing.facadeSheet.thicknessMm];
  const edgeMeters = plan.bodyEdgeMeters + plan.facadeEdgeMeters;
  const edgeMaterial = edgeMeters * costing.edgeTapePerMeter;
  const edgeBanding = edgeMeters * costing.edgeBandingPerMeter
    + count * costing.curvedEdgebandingPerFacade;
  const facadeMachining = count * costing.curvedMillingPerFacade;
  const drilling = count * costing.modeledRailHolesPerDrawer * costing.drillPerHole;
  const rails = count * costing.softCloseRailSetPrice;
  const assembly = count * costing.assemblyPerDrawer;
  const total = bodyMaterial + facadeMaterial + cutting + edgeMaterial + edgeBanding
    + facadeMachining + drilling + rails + assembly;

  return {
    count,
    bodyMaterial,
    facadeMaterial,
    cutting,
    edgeMaterial,
    edgeBanding,
    facadeMachining,
    drilling,
    rails,
    assembly,
    total,
    dimensions: plan.cells.map((cell) => ({
      widthMm: Math.round(cell.y1 - cell.y0),
      heightMm: Math.round(cell.z1 - cell.z0),
      boxWidthMm: Math.round(cell.y1 - cell.y0 - 2 * RAIL_GAP),
      boxDepthMm: BOX_DEPTH,
      boxWallHeightMm: Math.round(Math.min(WALL_H, cell.z1 - cell.z0 - 30)),
    })),
    variablePartitionCount: drawerPartitionPlan(plan.cells).length,
    fixedOuterCarcassExcluded: true,
  };
}

export function drawerPriceDeltaFromCost(count) {
  const { included, targetMarginPerAddedDrawer } = CENTRUM_CONFIG.drawers;
  const costDifference = calculateDrawerDirectCost(count).total - calculateDrawerDirectCost(included).total;
  return Math.round(costDifference + Math.max(0, count - included) * targetMarginPerAddedDrawer);
}
