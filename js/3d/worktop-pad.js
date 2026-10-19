// Контур по уточнению пользователя 23.09.2026: вся неподвижная рабочая
// поверхность вокруг отверстия + отдельная накладка на весь Bridge.
// План номинальный, материал/толщина/технологические зазоры не назначены.
// В 3D — build-worktop-pad.js (опция); координаты как в исходных чертежах.
//
// Отступы у петли (24.09.2026): мост поворачивается на 100° вокруг оси X=950
// в плоскости 820. При толщине 4 мм накладки от самой оси задевают друг друга
// на ходе; с отступами 3 (неподвижная) и 8 (мост) наименьший зазор ~3,3 мм.
//
// Крепление (24.09.2026): в столешнице всегда стоят стальные шайбы, скрытые
// под шпоном; магниты — только в накладке. Точки идут по контуру в 35 мм от края.
import { CENTER, SIZE, R_HOLE, EDGE_R, R_BELT_HIGH, ENTRY_W, ENTRY_X0, ENTRY_X1, LEAF_X1, arcY } from './params.js';

export const PAD_HINGE_MAIN = 3;   // срез неподвижной накладки от оси петли
export const PAD_HINGE_BRIDGE = 8; // край накладки моста от оси петли

export const PAD = Object.freeze({
  cx: CENTER, cy: CENTER,
  innerRadius: R_HOLE + EDGE_R,
  outerRadius: R_BELT_HIGH,
  entryHalf: ENTRY_W / 2,
  mainX0: ENTRY_X0 - PAD_HINGE_MAIN, mainX1: ENTRY_X1, // срезы у прохода: у петли и у выступа
  bridgeX0: ENTRY_X0 + PAD_HINGE_BRIDGE, bridgeX1: LEAF_X1,
  bridgeEndY: SIZE - EDGE_R,
  pieces: 2,
});

export const MAGNET = Object.freeze({
  inset: 35,        // от края накладки до центра точки
  stepMain: 400,    // неподвижная накладка: реже, её держит и собственный вес
  stepBridge: 300,  // мост: чаще, накладка висит при подъёме на 100°
  magnet: 'Ø20×2 N42',
  washer: 'Ø30×2,5',
});

// Срезы относительно центра: слева (у петли) и справа (у выступа).
const cuts = () => [PAD.mainX0 - PAD.cx, PAD.mainX1 - PAD.cx];

export function padPath() {
  const {innerRadius:r, outerRadius:R}=PAD, [a,b]=cuts();
  const y=(rad,x)=>Math.sqrt(rad*rad-x*x);
  return `M ${a} ${y(R,a)} A ${R} ${R} 0 1 1 ${b} ${y(R,b)} L ${b} ${y(r,b)} A ${r} ${r} 0 1 0 ${a} ${y(r,a)} Z`;
}
export function bridgePadPath() {
  const {bridgeX0:a,bridgeX1:b,bridgeEndY:y,innerRadius:r}=PAD;
  return `M ${a} ${arcY(a,r)} A ${r} ${r} 0 0 0 ${b} ${arcY(b,r)} L ${b} ${y} L ${a} ${y} Z`;
}
export function padMetrics() {
  const {innerRadius:r,outerRadius:R,bridgeX0:a,bridgeX1:b,bridgeEndY:y}=PAD, [c0,c1]=cuts();
  const integral=(rad,x)=>(x*Math.sqrt(rad*rad-x*x)+rad*rad*Math.asin(x/rad))/2;
  const cut=(rad)=>integral(rad,c1)-integral(rad,c0);
  return {
    width:2*R, depth:R+Math.sqrt(R*R-Math.min(c0*c0,c1*c1)),
    area:(Math.PI*(R*R-r*r)-cut(R)+cut(r))/1e6,
    bridgeWidth:b-a, bridgeDepth:y-Math.min(arcY(a,r),arcY(b,r)),
    bridgeArea:((b-a)*(y-CENTER)-integral(r,b-CENTER)+integral(r,a-CENTER))/1e6,
  };
}

// ─── Точки крепления ─────────────────────────────────────────────────────────
const arcPts = (rad, a0, a1, n) => Array.from({length:n+1}, (_, i) => {
  const t = a0+(a1-a0)*i/n; return [PAD.cx+rad*Math.cos(t), PAD.cy+rad*Math.sin(t)];
});
// Стороны контура, отступившего внутрь на d, в абсолютных координатах.
function mainSides(d) {
  const R=PAD.outerRadius-d, r=PAD.innerRadius+d, xl=PAD.mainX0-PAD.cx-d, xr=PAD.mainX1-PAD.cx+d;
  const ang=(rad,x)=>Math.atan2(Math.sqrt(rad*rad-x*x),x);
  const outer=arcPts(R, ang(R,xr), ang(R,xl)-2*Math.PI, 400);
  const inner=arcPts(r, ang(r,xl)-2*Math.PI, ang(r,xr), 200);
  return [outer, [outer.at(-1), inner[0]], inner, [inner.at(-1), outer[0]]];
}
function bridgeSides(d) {
  const x0=PAD.bridgeX0+d, x1=PAD.bridgeX1-d, y=PAD.bridgeEndY-d, r=PAD.innerRadius+d;
  const front=Array.from({length:101}, (_, i) => { const x=x0+(x1-x0)*i/100; return [x, arcY(x,r)]; });
  return [front, [front.at(-1), [x1,y]], [[x1,y],[x0,y]], [[x0,y], front[0]]];
}
const polyLen = (p) => p.slice(1).reduce((s,q,i) => s+Math.hypot(q[0]-p[i][0], q[1]-p[i][1]), 0);
function pointAt(p, t) {
  for (let i=1; i<p.length; i++) {
    const l=Math.hypot(p[i][0]-p[i-1][0], p[i][1]-p[i-1][1]);
    if (t<=l) return [p[i-1][0]+(p[i][0]-p[i-1][0])*t/l, p[i-1][1]+(p[i][1]-p[i-1][1])*t/l];
    t-=l;
  }
  return p.at(-1);
}
// Углы контура — всегда точка; стороны делятся поровну с шагом не больше step.
function spread(sides, step) {
  return sides.flatMap((s) => {
    const L=polyLen(s), n=Math.max(1, Math.ceil(L/step));
    return Array.from({length:n}, (_, i) => pointAt(s, L*i/n));
  });
}
export const padOutline = () => ({ main: mainSides(0), bridge: bridgeSides(0), mainInset: mainSides(MAGNET.inset), bridgeInset: bridgeSides(MAGNET.inset) });
export function padMagnets() {
  return { main: spread(mainSides(MAGNET.inset), MAGNET.stepMain), bridge: spread(bridgeSides(MAGNET.inset), MAGNET.stepBridge) };
}
