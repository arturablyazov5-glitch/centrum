import { createViewer } from './3d/viewer.js?v=20260921-03';

const CAMERA_VIEWS = {
  finish: { azimuth: 3.98, elevation: 0.48, distance: 5900, target: [1450, 1450, 430] },
  storage: { azimuth: 3.22, elevation: 0.26, distance: 3900, target: [360, 1760, 520] },
  electricity: { azimuth: 4.72, elevation: 0.20, distance: 3200, target: [1450, 680, 930] },
  lighting: { azimuth: 4.55, elevation: 0.18, distance: 3600, target: [1450, 820, 1040] },
  techBay: { azimuth: 3.65, elevation: 0.20, distance: 3400, target: [560, 1680, 720] },
  audio: { azimuth: 4.60, elevation: 0.18, distance: 3200, target: [1450, 510, 1040] },
  monitor: { azimuth: 4.68, elevation: 0.22, distance: 3300, target: [1450, 670, 940] },
  summary: { azimuth: 3.98, elevation: 0.48, distance: 6000, target: [1450, 1450, 430] },
};

export const HOTSPOTS = [
  { id: 'fridge', label: 'Холодильник', category: 'storage', point: [110, 510, 510] },
  { id: 'drawers', label: 'Ящики', category: 'storage', point: [120, 1770, 520] },
  { id: 'tech', label: 'Tech Bay', category: 'techBay', point: [480, 1640, 720] },
  { id: 'dock', label: 'Dock', category: 'electricity', point: [1450, 700, 920] },
  { id: 'led', label: 'LED', category: 'lighting', point: [1450, 430, 1230] },
  { id: 'audio', label: 'Акустика', category: 'audio', point: [1550, 470, 1080] },
  { id: 'bridge', label: 'Bridge', category: 'summary', point: [1450, 2660, 840] },
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
      viewer.setLed(true);
    },
    focus(category) { viewer.flyTo(CAMERA_VIEWS[category] || CAMERA_VIEWS.finish); },
    reset() { viewer.flyTo(CAMERA_VIEWS.finish); },
    project(point) { return viewer.projectPoint(point); },
  };
}
