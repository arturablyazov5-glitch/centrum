import { CENTRUM_CONFIG } from './centrum-config.js';
import { configuration, updateConfiguration, resetConfiguration } from './config-state.js';
import { calculatePrice } from './pricing.js';
import { readConfigurationFromURL, updateURL } from './url-state.js';
import { createConfiguratorScene, HOTSPOTS } from './three-scene.js?v=20260926-phones';
import { renderNavigation, renderPanel, updatePriceBar, updateModalSummary, getHumanSummary, techBayView, resetTechBayView } from './ui.js?v=20260928-drawer-lighting';
import { submitPreorder } from './preorder.js';

const nav = document.querySelector('#category-nav');
const panel = document.querySelector('#options-panel');
const priceBar = document.querySelector('#price-bar');
const canvas = document.querySelector('#centrum-canvas');
const modal = document.querySelector('#preorder-modal');
const toast = document.querySelector('#toast');
const hotspotsRoot = document.querySelector('#hotspots');
const scene = createConfiguratorScene(canvas);
// ?step=<id шага> открывает конфигуратор сразу на нужном шаге.
const requestedStep = new URLSearchParams(location.search).get('step');
let activeCategory = CENTRUM_CONFIG.categories.some((c) => c.id === requestedStep) ? requestedStep : 'finish';

window.lucide?.createIcons();

Object.assign(configuration, readConfigurationFromURL());

function notify(message) {
  toast.textContent = message;
  toast.hidden = false;
  clearTimeout(notify.timer);
  notify.timer = setTimeout(() => { toast.hidden = true; }, 2400);
}

// Отсек и схемы трактов показываются только на своём шаге: уходя, закрываем.
function applyTechBay(view) {
  scene?.setTechBayOpen(view.open);
  scene?.setTechBayLayers(view.layers);
  // Сверху размер ограничен физическим пределом ниши ещё в поле ввода.
  scene?.setTechBayPc(view.pc ? view.pc.size.map((v) => Math.max(v, 20)) : null, view.pc ? view.pc.fits : true);
}

function navigate(category, { focus = true } = {}) {
  if (category !== 'techBay' && activeCategory === 'techBay') { resetTechBayView(); applyTechBay(techBayView); }
  // Ящики, выдвинутые для показа подсветки, закрываются при уходе с шага.
  if (category !== activeCategory) scene?.closeDrawers();
  activeCategory = category;
  renderNavigation(nav, activeCategory, navigate);
  renderPanel(panel, activeCategory, configuration, calculatePrice(configuration), applyChange, applyLive, applyTechBay);
  window.lucide?.createIcons();
  panel.querySelector('[data-next-category]')?.addEventListener('click', () => {
    const currentIndex = CENTRUM_CONFIG.categories.findIndex((item) => item.id === activeCategory);
    navigate(CENTRUM_CONFIG.categories[currentIndex + 1].id);
  });
  if (focus) scene?.focus(activeCategory);
}

function applyChange(patch) {
  updateConfiguration(patch);
  updateConfigurator();
  if ('drawerLighting' in patch) scene?.showDrawerLighting(patch.drawerLighting);
  if ('headphoneSides' in patch) scene?.showHeadphones();
}

const hexToRgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
const ledColorOf = (config) => config.ledTemperature === 'rgb'
  ? hexToRgb(config.ledRgb)
  : CENTRUM_CONFIG.lighting[config.ledTemperature].color;

// Правка без перерисовки панели — для палитры RGB, которая меняет цвет на лету.
function applyLive(patch) {
  updateConfiguration(patch);
  scene?.setLedColor(ledColorOf(configuration));
  updatePriceBar(priceBar, configuration, calculatePrice(configuration));
  updateURL(configuration);
}

export function updateConfigurator() {
  const price = calculatePrice(configuration);
  const wood = CENTRUM_CONFIG.wood[configuration.wood];
  scene?.update({ ...configuration, woodTint: wood.tint, ledColor: ledColorOf(configuration) });
  renderNavigation(nav, activeCategory, navigate);
  renderPanel(panel, activeCategory, configuration, price, applyChange, applyLive, applyTechBay);
  window.lucide?.createIcons();
  panel.querySelector('[data-next-category]')?.addEventListener('click', () => {
    const currentIndex = CENTRUM_CONFIG.categories.findIndex((item) => item.id === activeCategory);
    navigate(CENTRUM_CONFIG.categories[currentIndex + 1].id);
  });
  updatePriceBar(priceBar, configuration, price);
  updateModalSummary(modal, price);
  updateURL(configuration);
}

window.updateConfigurator = updateConfigurator;

hotspotsRoot.innerHTML = HOTSPOTS.map((hotspot) => `<button type="button" class="hotspot" data-hotspot="${hotspot.id}" aria-label="${hotspot.label}"><i></i><span>${hotspot.label}</span></button>`).join('');
hotspotsRoot.querySelectorAll('[data-hotspot]').forEach((button) => button.addEventListener('click', () => navigate(HOTSPOTS.find((item) => item.id === button.dataset.hotspot).category)));

// Метки, закрытые корпусом, гаснут: иначе с любого ракурса по стенке рассыпаны
// точки с другой стороны стола. Луч через всю сетку дорогой, поэтому
// заслонение пересчитывается, только когда камера остановилась.
let lastView = '';
let stillFrames = 0;
function positionHotspots() {
  if (scene) {
    const points = HOTSPOTS.map((hotspot) => scene.project(hotspot.point));
    const view = points.map((p) => (p ? `${Math.round(p.x)},${Math.round(p.y)}` : '-')).join(' ');
    stillFrames = view === lastView ? stillFrames + 1 : 0;
    lastView = view;
    const recheck = stillFrames === 6;
    HOTSPOTS.forEach((hotspot, i) => {
      const button = hotspotsRoot.querySelector(`[data-hotspot="${hotspot.id}"]`);
      const point = points[i];
      button.hidden = !point || point.x < 0 || point.y < 0 || point.x > canvas.clientWidth || point.y > canvas.clientHeight;
      if (point) button.style.transform = `translate(${point.x}px, ${point.y}px)`;
      if (recheck && !button.hidden) button.classList.toggle('is-occluded', scene.isOccluded(hotspot.point));
    });
  }
  requestAnimationFrame(positionHotspots);
}
requestAnimationFrame(positionHotspots);

// Свет в сцене включён по умолчанию; тумблер только показывает его или гасит.
const ledPower = document.querySelector('[data-led-power]');
scene?.setLed(ledPower.checked);
ledPower.addEventListener('change', () => scene?.setLed(ledPower.checked));

document.querySelector('[data-reset-view]').addEventListener('click', () => scene?.reset());
document.querySelector('[data-reset-all]').addEventListener('click', () => {
  resetConfiguration();
  resetTechBayView();
  applyTechBay(techBayView);
  activeCategory = 'finish';
  updateConfigurator();
  scene?.reset();
  notify('Конфигурация сброшена');
});
document.querySelectorAll('[data-open-preorder]').forEach((button) => button.addEventListener('click', () => {
  modal.hidden = false;
  document.body.classList.add('modal-open');
  modal.querySelector('input').focus();
}));
modal.querySelectorAll('[data-close-modal]').forEach((button) => button.addEventListener('click', () => {
  modal.hidden = true;
  document.body.classList.remove('modal-open');
}));
modal.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') { modal.hidden = true; document.body.classList.remove('modal-open'); }
});

modal.querySelector('form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const button = event.submitter;
  const data = Object.fromEntries(new FormData(event.currentTarget));
  const price = calculatePrice(configuration);
  button.disabled = true;
  button.textContent = 'Отправляем…';
  try {
    const result = await submitPreorder({ contact: data, configuration: { ...configuration }, specification: getHumanSummary(configuration, price), price, url: location.href });
    modal.querySelector('[data-form-status]').textContent = result.draft ? 'Заявка сохранена на этом устройстве. Подключите endpoint в конфигурации, чтобы отправлять ее менеджеру.' : 'Заявка отправлена. Мы свяжемся с вами.';
    event.currentTarget.reset();
  } catch (error) {
    modal.querySelector('[data-form-status]').textContent = `Не удалось отправить заявку: ${error.message}`;
  } finally {
    button.disabled = false;
    button.textContent = 'Отправить заявку';
  }
});

const loader = document.querySelector('#scene-loader');
// Без текстур корпус рисуется светлыми цветами-метками материалов, поэтому
// заглушку снимаем только когда пришли обе карты — столешницы и стенки.
// Ошибка загрузки тоже считается ответом: ждать дальше нечего.
const readyCheck = setInterval(() => {
  const { worktopTexture, sideTexture } = canvas.dataset;
  if (worktopTexture && sideTexture) {
    loader.classList.add('is-ready');
    clearInterval(readyCheck);
  }
}, 120);
setTimeout(() => loader.classList.add('is-ready'), 15000);

navigate(activeCategory, { focus: Boolean(requestedStep) });
updateConfigurator();
