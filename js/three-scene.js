import { CENTER, SIZE, DRAWERS_Y, TECH_X, TECH_Z0, TECH_HEIGHT, R_BELT_HIGH } from './3d/params.js';
import { POSTS, SOCKET_Z, QI_SPOTS } from './3d/sockets.js';

// Tech Bay построен до отражения (mirror.js) в углу x = 0: в сцене он у x = 2700.
const TECH_MID_X = SIZE - (TECH_X[0] + TECH_X[1]) / 2;
const TECH_MID_Z = TECH_Z0 + TECH_HEIGHT / 2;

import { createViewer } from './3d/viewer.js?v=20260926-phones';

const CAMERA_VIEWS = {
  finish: { azimuth: 0.84, elevation: 0.48, distance: 5900, target: [CENTER, CENTER, 430] },
  storage: { azimuth: 3.22, elevation: 0.26, distance: 3900, target: [360, (DRAWERS_Y[0] + DRAWERS_Y[1]) / 2, 520] },
  // Подсветка ящиков: ящики выдвинуты, смотрим чуть сверху, чтобы был виден свет в коробах.
  drawerLight: { azimuth: 3.22, elevation: 0.5, distance: 3300, target: [200, (DRAWERS_Y[0] + DRAWERS_Y[1]) / 2, 420] },
  electricity: { azimuth: 1.78, elevation: 0.34, distance: 3300, target: [CENTER, 700, 760] },
  lighting: { azimuth: 1.42, elevation: 0.13, distance: 3500, target: [CENTER, 520, 880] },
  // Снаружи на угол: фасад с притоком на грани y = 0 и выброс на боковой грани.
  techBay: { azimuth: 5.25, elevation: 0.32, distance: 3700, target: [TECH_MID_X + 150, 250, TECH_MID_Z] },
  audio: { azimuth: 1.92, elevation: 0.15, distance: 3400, target: [CENTER + 100, 520, 860] },
  // Панель для наушников под кромкой у клавиатуры: снизу, из отверстия (audio-panels.js).
  headphones: { azimuth: 1.66, elevation: -0.1, distance: 760, target: [CENTER, 845, 780] },
  // Накладка лежит на всей рабочей плоскости: смотрим сверху, чтобы был виден весь контур.
  worktopPad: { azimuth: 0.84, elevation: 0.95, distance: 5400, target: [CENTER, CENTER, 820] },
  monitor: { azimuth: 1.57, elevation: 0.38, distance: 4300, target: [CENTER, 700, 1000] },
  summary: { azimuth: 0.84, elevation: 0.48, distance: 6000, target: [CENTER, CENTER, 430] },
};

export const HOTSPOTS = [
  { id: 'fridge', label: 'Холодильник', category: 'storage', point: [110, 510, 510] },
  { id: 'drawers', label: 'Ящики', category: 'storage', point: [120, (DRAWERS_Y[0] + DRAWERS_Y[1]) / 2, 520] },
  { id: 'tech', label: 'Tech Bay', category: 'techBay', point: [TECH_MID_X, 0, TECH_MID_Z] },
  { id: 'dock', label: 'Dock', category: 'electricity', point: [CENTER, 700, 920] },
  // Посты розеток — у первой рамки, она есть во всех пакетах; Qi — место Q1 (sockets.js).
  ...Object.entries(POSTS).map(([post, { first }]) => ({ id: `sockets-${post}`, label: 'Розетки и USB', category: 'electricity',
    point: [CENTER + (R_BELT_HIGH - 20) * Math.cos(first), CENTER + (R_BELT_HIGH - 20) * Math.sin(first), SOCKET_Z] })),
  { id: 'qi', label: 'Qi', category: 'electricity',
    point: [CENTER + QI_SPOTS[0].r * Math.cos(QI_SPOTS[0].angle), CENTER + QI_SPOTS[0].r * Math.sin(QI_SPOTS[0].angle), 822] },
  { id: 'led', label: 'LED', category: 'lighting', point: [CENTER, 430, 1230] },
  { id: 'audio', label: 'Акустика', category: 'audio', point: [CENTER + 100, 470, 1080] },
  { id: 'bridge', label: 'Bridge', category: 'summary', point: [CENTER, SIZE - 240, 840] },
];

export function createConfiguratorScene(canvas) {
  const viewer = createViewer(canvas, { productOnly: true });
  if (!viewer) return null;
  return {
    viewer,
    update(configuration) {
      viewer.setWoodTint(configuration.woodTint);
      viewer.setDrawerCount(configuration.drawers);
      viewer.setDrawerLighting(Boolean(configuration.drawerLighting));
      viewer.setElectricity(configuration.electricity);
      viewer.setLedColor(configuration.ledColor);
      viewer.setSpeakers(Boolean(configuration.audio51));
      viewer.setAudioSides(Boolean(configuration.headphoneSides));
      viewer.setWorktopPad(Boolean(configuration.worktopPad));
      viewer.setMonitors(configuration.monitors, Boolean(configuration.audio51));
    },
    setLed(on) { viewer.setLed(on); },
    // Тумблер подсветки ящиков: камера к ящикам, ящики выдвигаются, свет загорается.
    showDrawerLighting(on) {
      viewer.setConfigDrawersOpen(on);
      if (on) viewer.flyTo(CAMERA_VIEWS.drawerLight);
    },
    closeDrawers() { viewer.setConfigDrawersOpen(false); },
    setTechBayOpen(open) { viewer.setTechBayOpen(open); },
    setTechBayLayers(layers) { viewer.setTechBayLayers(layers); },
    setTechBayPc(size, fits) { viewer.setTechBayPc(size, fits); },
    setLedColor(color) { viewer.setLedColor(color); },
    showHeadphones() { viewer.flyTo(CAMERA_VIEWS.headphones); },
    focus(category) { viewer.flyTo(CAMERA_VIEWS[category] || CAMERA_VIEWS.finish); },
    reset() { viewer.flyTo(CAMERA_VIEWS.finish); },
    project(point) { return viewer.projectPoint(point); },
    isOccluded(point) { return viewer.isOccluded(point); },
  };
}
