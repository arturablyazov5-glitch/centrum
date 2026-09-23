import { CENTER, SIZE, DRAWERS_Y } from './3d/params.js';

import { createViewer } from './3d/viewer.js?v=20260923-sockets3';

const CAMERA_VIEWS = {
  finish: { azimuth: 3.98, elevation: 0.48, distance: 5900, target: [CENTER, CENTER, 430] },
  storage: { azimuth: 3.22, elevation: 0.26, distance: 3900, target: [360, (DRAWERS_Y[0] + DRAWERS_Y[1]) / 2, 520] },
  electricity: { azimuth: 1.78, elevation: 0.34, distance: 3300, target: [CENTER, 700, 760] },
  lighting: { azimuth: 1.42, elevation: 0.13, distance: 3500, target: [CENTER, 520, 880] },
  techBay: { azimuth: 3.65, elevation: 0.20, distance: 3400, target: [560, 1680, 720] },
  audio: { azimuth: 1.92, elevation: 0.15, distance: 3400, target: [CENTER + 100, 520, 860] },
  monitor: { azimuth: 1.57, elevation: 0.14, distance: 3300, target: [CENTER, 560, 860] },
  summary: { azimuth: 3.98, elevation: 0.48, distance: 6000, target: [CENTER, CENTER, 430] },
};

export const HOTSPOTS = [
  { id: 'fridge', label: 'Холодильник', category: 'storage', point: [110, 510, 510] },
  { id: 'drawers', label: 'Ящики', category: 'storage', point: [120, (DRAWERS_Y[0] + DRAWERS_Y[1]) / 2, 520] },
  { id: 'tech', label: 'Tech Bay', category: 'techBay', point: [480, 1640, 720] },
  { id: 'dock', label: 'Dock', category: 'electricity', point: [CENTER, 700, 920] },
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
      viewer.setLedColor(configuration.ledColor);
    },
    setLed(on) { viewer.setLed(on); },
    setLedColor(color) { viewer.setLedColor(color); },
    focus(category) { viewer.flyTo(CAMERA_VIEWS[category] || CAMERA_VIEWS.finish); },
    reset() { viewer.flyTo(CAMERA_VIEWS.finish); },
    project(point) { return viewer.projectPoint(point); },
  };
}
