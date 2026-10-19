import { CENTRUM_CONFIG } from './centrum-config.js';
import { drawerPriceDeltaFromCost } from './drawer-costing.js';
import { drawerLightingPrice } from './drawer-lighting-costing.js';

export function calculatePrice(configuration) {
  const basePrice = CENTRUM_CONFIG.model.basePrice;
  let optionsPrice = CENTRUM_CONFIG.wood[configuration.wood].price;
  optionsPrice += drawerPriceDelta(configuration.drawers);
  optionsPrice += CENTRUM_CONFIG.electricity[configuration.electricity].price;
  optionsPrice += CENTRUM_CONFIG.lighting[configuration.ledTemperature].price;
  if (configuration.drawerLighting) optionsPrice += drawerLightingPrice(configuration.drawers);
  if (configuration.audio51) optionsPrice += CENTRUM_CONFIG.audio.audio51.price;
  if (configuration.headphoneSides) optionsPrice += CENTRUM_CONFIG.audio.headphoneSides.price;
  optionsPrice += Math.max(0, configuration.monitors - CENTRUM_CONFIG.monitor.included) * CENTRUM_CONFIG.monitor.post.price;
  const pendingPadPrice = configuration.worktopPad && CENTRUM_CONFIG.worktopPad.price === null;
  if (configuration.worktopPad && !pendingPadPrice) optionsPrice += CENTRUM_CONFIG.worktopPad.price;
  const totalPrice = basePrice + optionsPrice;
  const deposit = Math.round(totalPrice * CENTRUM_CONFIG.model.depositPercent / 100);
  return { basePrice, optionsPrice, totalPrice, deposit, pendingPadPrice: Boolean(pendingPadPrice), estimated: Boolean(configuration.worktopPad && CENTRUM_CONFIG.worktopPad.estimated) };
}

export function drawerPriceDelta(drawerCount) {
  return drawerPriceDeltaFromCost(drawerCount);
}

export const formatPrice = (value) => `${new Intl.NumberFormat('ru-RU').format(value)} ₽`;
export const formatPriceDelta = (value) => value === null ? 'Стоимость по запросу' : value === 0 ? 'Входит в стоимость' : value < 0 ? `−${formatPrice(-value)}` : `+${formatPrice(value)}`;
