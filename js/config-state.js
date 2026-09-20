import { DEFAULT_CONFIGURATION } from './centrum-config.js';

export const configuration = { ...DEFAULT_CONFIGURATION };

export function updateConfiguration(patch) {
  Object.assign(configuration, patch);
  return configuration;
}

export function resetConfiguration() {
  Object.assign(configuration, DEFAULT_CONFIGURATION);
  return configuration;
}
