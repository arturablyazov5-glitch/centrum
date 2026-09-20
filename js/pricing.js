import { CENTRUM_CONFIG } from './centrum-config.js';

export function calculatePrice(configuration) {
  const basePrice = CENTRUM_CONFIG.model.basePrice;
  let optionsPrice = CENTRUM_CONFIG.wood[configuration.wood].price;
  const extraDrawers = Math.max(0, configuration.drawers - CENTRUM_CONFIG.drawers.included);
  optionsPrice += extraDrawers * CENTRUM_CONFIG.drawers.additionalDrawerPrice;
  optionsPrice += CENTRUM_CONFIG.electricity[configuration.electricity].price;
  optionsPrice += CENTRUM_CONFIG.lighting[configuration.ledTemperature].price;
  if (configuration.drawerLighting) optionsPrice += CENTRUM_CONFIG.lighting.drawerLighting.price;
  if (configuration.audio51) optionsPrice += CENTRUM_CONFIG.audio.audio51.price;
  if (configuration.monitorArm) optionsPrice += CENTRUM_CONFIG.monitor.arm.price;
  const totalPrice = basePrice + optionsPrice;
  const deposit = Math.round(totalPrice * CENTRUM_CONFIG.model.depositPercent / 100);
  return { basePrice, optionsPrice, totalPrice, deposit };
}

export const formatPrice = (value) => `${new Intl.NumberFormat('ru-RU').format(value)} ₽`;
export const formatPriceDelta = (value) => value === 0 ? 'Входит в стоимость' : `+${formatPrice(value)}`;
