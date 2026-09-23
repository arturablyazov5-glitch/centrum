import { CENTRUM_CONFIG } from './centrum-config.js';
import { configuration, updateConfiguration, resetConfiguration } from './config-state.js';
import { calculatePrice } from './pricing.js';
import { readConfigurationFromURL, updateURL, copyConfigurationURL } from './url-state.js';
import { createConfiguratorScene, HOTSPOTS } from './three-scene.js';
import { renderNavigation, renderPanel, updatePriceBar, updateModalSummary, getHumanSummary } from './ui.js';
import { submitPreorder } from './preorder.js';

const nav = document.querySelector('#category-nav');
const panel = document.querySelector('#options-panel');
const priceBar = document.querySelector('#price-bar');
const canvas = document.querySelector('#centrum-canvas');
const modal = document.querySelector('#preorder-modal');
const toast = document.querySelector('#toast');
const hotspotsRoot = document.querySelector('#hotspots');
const scene = createConfiguratorScene(canvas);
let activeCategory = 'finish';

Object.assign(configuration, readConfigurationFromURL());

function notify(message) {
  toast.textContent = message;
  toast.hidden = false;
  clearTimeout(notify.timer);
  notify.timer = setTimeout(() => { toast.hidden = true; }, 2400);
}

async function copyLink() {
  try { await copyConfigurationURL(configuration); notify('Ссылка на конфигурацию скопирована'); }
  catch { notify('Не удалось скопировать ссылку'); }
}

function navigate(category, { focus = true } = {}) {
  activeCategory = category;
  renderNavigation(nav, activeCategory, navigate);
  renderPanel(panel, activeCategory, configuration, calculatePrice(configuration), applyChange, applyLive);
  panel.querySelector('[data-copy]')?.addEventListener('click', copyLink);
  document.querySelector('[data-progress]').textContent = `${CENTRUM_CONFIG.categories.find((item) => item.id === activeCategory).number} / ${String(CENTRUM_CONFIG.categories.length).padStart(2, '0')}`;
  if (focus) scene?.focus(activeCategory);
}

function applyChange(patch) {
  updateConfiguration(patch);
  updateConfigurator();
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
  renderPanel(panel, activeCategory, configuration, price, applyChange, applyLive);
  panel.querySelector('[data-copy]')?.addEventListener('click', copyLink);
  updatePriceBar(priceBar, configuration, price);
  updateModalSummary(modal, price);
  updateURL(configuration);
}

window.updateConfigurator = updateConfigurator;

hotspotsRoot.innerHTML = HOTSPOTS.map((hotspot) => `<button type="button" class="hotspot" data-hotspot="${hotspot.id}" aria-label="${hotspot.label}"><i></i><span>${hotspot.label}</span></button>`).join('');
hotspotsRoot.querySelectorAll('[data-hotspot]').forEach((button) => button.addEventListener('click', () => navigate(HOTSPOTS.find((item) => item.id === button.dataset.hotspot).category)));

function positionHotspots() {
  if (scene) {
    for (const hotspot of HOTSPOTS) {
      const button = hotspotsRoot.querySelector(`[data-hotspot="${hotspot.id}"]`);
      const point = scene.project(hotspot.point);
      button.hidden = !point || point.x < 0 || point.y < 0 || point.x > canvas.clientWidth || point.y > canvas.clientHeight;
      if (point) button.style.transform = `translate(${point.x}px, ${point.y}px)`;
    }
  }
  requestAnimationFrame(positionHotspots);
}
requestAnimationFrame(positionHotspots);

// Свет в сцене включён по умолчанию; тумблер только показывает его или гасит.
const ledPower = document.querySelector('[data-led-power]');
scene?.setLed(ledPower.checked);
ledPower.addEventListener('change', () => scene?.setLed(ledPower.checked));

document.querySelector('[data-copy-link]').addEventListener('click', copyLink);
document.querySelector('[data-reset-view]').addEventListener('click', () => scene?.reset());
document.querySelector('[data-reset-all]').addEventListener('click', () => {
  resetConfiguration();
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

navigate(activeCategory, { focus: false });
updateConfigurator();
