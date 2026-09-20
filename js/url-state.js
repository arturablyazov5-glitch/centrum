import { CENTRUM_CONFIG, DEFAULT_CONFIGURATION } from './centrum-config.js';

const truthy = (value) => value === '1';

export function readConfigurationFromURL(search = window.location.search) {
  const params = new URLSearchParams(search);
  const drawers = Number(params.get('drawers'));
  return {
    ...DEFAULT_CONFIGURATION,
    wood: Object.hasOwn(CENTRUM_CONFIG.wood, params.get('wood')) ? params.get('wood') : DEFAULT_CONFIGURATION.wood,
    drawers: Number.isInteger(drawers) && drawers >= CENTRUM_CONFIG.drawers.min && drawers <= CENTRUM_CONFIG.drawers.max ? drawers : DEFAULT_CONFIGURATION.drawers,
    electricity: Object.hasOwn(CENTRUM_CONFIG.electricity, params.get('power')) ? params.get('power') : DEFAULT_CONFIGURATION.electricity,
    ledTemperature: Object.hasOwn(CENTRUM_CONFIG.lighting, params.get('light')) && params.get('light') !== 'drawerLighting' ? params.get('light') : DEFAULT_CONFIGURATION.ledTemperature,
    drawerLighting: truthy(params.get('drawerLight')),
    audio51: truthy(params.get('audio')),
    monitorArm: truthy(params.get('arm')),
  };
}

export function updateURL(configuration) {
  const params = new URLSearchParams();
  params.set('wood', configuration.wood);
  params.set('drawers', configuration.drawers);
  params.set('power', configuration.electricity);
  params.set('light', configuration.ledTemperature);
  if (configuration.drawerLighting) params.set('drawerLight', '1');
  if (configuration.audio51) params.set('audio', '1');
  if (configuration.monitorArm) params.set('arm', '1');
  history.replaceState(null, '', `${location.pathname}?${params}`);
}

export async function copyConfigurationURL() {
  await navigator.clipboard.writeText(location.href);
}
