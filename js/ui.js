import { CENTRUM_CONFIG } from './centrum-config.js';
import { formatPrice, formatPriceDelta } from './pricing.js';
import { toggleControl } from './toggle.js';

const escapeHTML = (value) => String(value).replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[char]);

// Готовые цвета для RGB; любой другой выбирается палитрой.
const RGB_PRESETS = ['#ff4d4d', '#ff9f43', '#ffe066', '#51e08a', '#38d9f5', '#4d7cff', '#a66bff', '#ff5fc8'];

// dot — цвет света кружком у названия. Фото отделки нужно только дереву:
// у света нет фактуры, есть только цвет.
function optionButton({ key, option, selected, type, details = '', dot = '' }) {
  const swatch = option.swatch && !dot ? `<span class="material-preview" style="--swatch:${option.swatch}"></span>` : '';
  const title = dot ? `<strong class="option-title"><i class="option-dot" style="--dot:${dot}"></i>${escapeHTML(option.name)}</strong>` : `<strong>${escapeHTML(option.name)}</strong>`;
  return `<button class="option-card ${dot ? 'option-card--dot' : ''} ${selected ? 'is-selected' : ''}" type="button" data-option-type="${type}" data-option-key="${key}" aria-pressed="${selected}">
    ${swatch}<span class="option-copy">${title}<span>${escapeHTML(option.description || details)}</span><em>${formatPriceDelta(option.price)}</em></span>
  </button>`;
}

function switchRow(key, option, checked, note = '') {
  return `<label class="switch-row"><span><strong>${escapeHTML(option.name)}</strong><small>${escapeHTML(option.description || note)}</small><em>${formatPriceDelta(option.price)}</em></span>${toggleControl({ checked, attrs: `data-toggle="${key}"` })}</label>`;
}

export function renderNavigation(root, activeCategory, onNavigate) {
  root.innerHTML = CENTRUM_CONFIG.categories.map((category) => `<button type="button" data-category="${category.id}" class="nav-step ${category.id === activeCategory ? 'is-active' : ''}" aria-current="${category.id === activeCategory ? 'step' : 'false'}"><span>${category.number}</span><strong>${category.name}</strong></button>`).join('');
  root.querySelectorAll('[data-category]').forEach((button) => button.addEventListener('click', () => onNavigate(button.dataset.category)));
}

function rgbPicker(configuration) {
  const current = configuration.ledRgb;
  return `<div class="rgb-picker"><span>Цвет подсветки</span><div class="rgb-swatches">${RGB_PRESETS.map((color) => `<button type="button" class="rgb-swatch ${color === current ? 'is-selected' : ''}" style="--dot:${color}" data-rgb="${color}" aria-label="Цвет ${color}"></button>`).join('')}<label class="rgb-custom ${RGB_PRESETS.includes(current) ? '' : 'is-selected'}" style="--dot:${current}" title="Любой цвет"><input type="color" value="${current}" data-rgb-input aria-label="Выбрать любой цвет"></label></div></div>`;
}

export function renderPanel(root, categoryId, configuration, price, onChange, onLive = onChange) {
  const category = CENTRUM_CONFIG.categories.find((item) => item.id === categoryId) || CENTRUM_CONFIG.categories[0];
  let content = '';
  if (categoryId === 'finish') {
    content = `<div class="option-grid material-grid">${Object.entries(CENTRUM_CONFIG.wood).map(([key, option]) => optionButton({ key, option, selected: key === configuration.wood, type: 'wood' })).join('')}</div>`;
  } else if (categoryId === 'storage') {
    content = `<div class="storage-control"><span>Количество фасадов</span><div class="stepper"><button type="button" data-step="-1" aria-label="Уменьшить">−</button><strong>${configuration.drawers}</strong><button type="button" data-step="1" aria-label="Увеличить">+</button></div><p>От ${CENTRUM_CONFIG.drawers.min} до ${CENTRUM_CONFIG.drawers.max}. ${CENTRUM_CONFIG.drawers.included} входят в базовую комплектацию.</p><em>${configuration.drawers > CENTRUM_CONFIG.drawers.included ? formatPriceDelta((configuration.drawers - CENTRUM_CONFIG.drawers.included) * CENTRUM_CONFIG.drawers.additionalDrawerPrice) : 'Без изменения базовой цены'}</em></div>`;
  } else if (categoryId === 'electricity') {
    content = `<div class="option-grid single-grid">${Object.entries(CENTRUM_CONFIG.electricity).map(([key, option]) => optionButton({ key, option, selected: key === configuration.electricity, type: 'electricity', details: `${option.sockets220} × 220 В · ${option.usbC} × USB-C · ${option.usbA} × USB-A · ${option.qi} × Qi` })).join('')}</div>`;
  } else if (categoryId === 'lighting') {
    content = `<div class="option-grid material-grid">${Object.entries(CENTRUM_CONFIG.lighting).filter(([key]) => key !== 'drawerLighting').map(([key, option]) => optionButton({ key, option: { ...option, description: option.temperature ? `${option.temperature} K` : 'Любой цвет' }, selected: key === configuration.ledTemperature, type: 'lighting', dot: key === 'rgb' ? (configuration.ledTemperature === 'rgb' ? configuration.ledRgb : 'conic-gradient(#ff4d4d, #ffe066, #51e08a, #38d9f5, #4d7cff, #ff5fc8, #ff4d4d)') : option.swatch })).join('')}</div>${configuration.ledTemperature === 'rgb' ? rgbPicker(configuration) : ''}${switchRow('drawerLighting', CENTRUM_CONFIG.lighting.drawerLighting, configuration.drawerLighting)}`;
  } else if (categoryId === 'techBay') {
    content = `<div class="included-badge">Входит в базу</div><div class="feature-list">${CENTRUM_CONFIG.techBay.map((item) => `<div><strong>${item.name}</strong><span>${item.detail}</span></div>`).join('')}</div>`;
  } else if (categoryId === 'audio') {
    content = `<div class="included-note"><strong>Акустическая обработка</strong><span>Встроена в стенку и входит в базовую комплектацию.</span></div>${switchRow('audio51', CENTRUM_CONFIG.audio.audio51, configuration.audio51)}`;
  } else if (categoryId === 'monitor') {
    content = `${switchRow('monitorArm', CENTRUM_CONFIG.monitor.arm, configuration.monitorArm)}<p class="panel-note">Монитор приобретается отдельно. Его изображение в сцене, если показано, носит демонстрационный характер.</p>`;
  } else {
    content = `<div class="summary-list">${summaryRows(configuration, price)}</div><button type="button" class="secondary-wide" data-copy>Скопировать ссылку</button>`;
  }

  root.innerHTML = `<div class="panel-heading"><span>${category.number}</span><h1>${category.name}</h1><p>${category.description}</p></div><div class="panel-content">${content}</div>`;
  root.querySelectorAll('[data-option-type]').forEach((button) => button.addEventListener('click', () => {
    const keyMap = { wood: 'wood', electricity: 'electricity', lighting: 'ledTemperature' };
    onChange({ [keyMap[button.dataset.optionType]]: button.dataset.optionKey });
  }));
  root.querySelectorAll('[data-step]').forEach((button) => button.addEventListener('click', () => onChange({ drawers: Math.max(CENTRUM_CONFIG.drawers.min, Math.min(CENTRUM_CONFIG.drawers.max, configuration.drawers + Number(button.dataset.step))) })));
  // Цвет RGB меняется на лету: панель не перерисовываем, иначе палитра закроется.
  const setRgb = (color) => {
    root.querySelector('[data-option-key="rgb"] .option-dot')?.style.setProperty('--dot', color);
    root.querySelectorAll('[data-rgb]').forEach((swatch) => swatch.classList.toggle('is-selected', swatch.dataset.rgb === color));
    const custom = root.querySelector('.rgb-custom');
    if (custom) { custom.style.setProperty('--dot', color); custom.classList.toggle('is-selected', !RGB_PRESETS.includes(color)); }
    onLive({ ledRgb: color });
  };
  root.querySelectorAll('[data-rgb]').forEach((swatch) => swatch.addEventListener('click', () => {
    root.querySelector('[data-rgb-input]').value = swatch.dataset.rgb;
    setRgb(swatch.dataset.rgb);
  }));
  root.querySelector('[data-rgb-input]')?.addEventListener('input', (event) => setRgb(event.target.value.toLowerCase()));
  root.querySelectorAll('[data-toggle]').forEach((input) => input.addEventListener('change', () => onChange({ [input.dataset.toggle]: input.checked })));
}

function summaryRows(configuration, price) {
  const yesNo = (value) => value ? 'Да' : 'Нет';
  const rows = [
    ['Модель', CENTRUM_CONFIG.model.name],
    ['Размер', `${CENTRUM_CONFIG.dimensions.width} × ${CENTRUM_CONFIG.dimensions.depth} мм`],
    ['Отделка', CENTRUM_CONFIG.wood[configuration.wood].name],
    ['Хранение', `${configuration.drawers} ${configuration.drawers === 1 ? 'ящик' : configuration.drawers < 5 ? 'ящика' : 'ящиков'}`],
    ['Электрика', CENTRUM_CONFIG.electricity[configuration.electricity].name],
    ['Освещение', CENTRUM_CONFIG.lighting[configuration.ledTemperature].name + (configuration.ledTemperature === 'rgb' ? ` · ${configuration.ledRgb.toUpperCase()}` : '')],
    [CENTRUM_CONFIG.lighting.drawerLighting.name, yesNo(configuration.drawerLighting)],
    ['Tech Bay', 'Входит'],
    ['Акустика 5.1', yesNo(configuration.audio51)],
    ['Кронштейн', yesNo(configuration.monitorArm)],
    ['Итого', formatPrice(price.totalPrice)],
    [`Предоплата ${CENTRUM_CONFIG.model.depositPercent}%`, formatPrice(price.deposit)],
  ];
  return rows.map(([label, value]) => `<div><span>${label}</span><strong>${value}</strong></div>`).join('');
}

export function getHumanSummary(configuration, price) {
  const holder = document.createElement('div');
  holder.innerHTML = summaryRows(configuration, price);
  return [...holder.children].map((row) => `${row.firstElementChild.textContent}: ${row.lastElementChild.textContent}`).join('\n');
}

export function updatePriceBar(root, configuration, price) {
  root.querySelector('[data-model-name]').textContent = CENTRUM_CONFIG.model.name;
  root.querySelector('[data-config-caption]').textContent = `${CENTRUM_CONFIG.wood[configuration.wood].name} · ${configuration.drawers} ящ. · ${CENTRUM_CONFIG.electricity[configuration.electricity].name}`;
  root.querySelector('[data-base-price]').textContent = formatPrice(price.basePrice);
  root.querySelector('[data-options-price]').textContent = formatPriceDelta(price.optionsPrice);
  root.querySelector('[data-total-price]').textContent = formatPrice(price.totalPrice);
  root.querySelector('[data-deposit-label]').textContent = `Предоплата ${CENTRUM_CONFIG.model.depositPercent}%`;
  root.querySelector('[data-deposit-price]').textContent = formatPrice(price.deposit);
}

export function updateModalSummary(root, price) {
  root.querySelector('[data-modal-model]').textContent = CENTRUM_CONFIG.model.name;
  root.querySelector('[data-modal-total]').textContent = formatPrice(price.totalPrice);
  root.querySelector('[data-modal-deposit-label]').textContent = `Предоплата ${CENTRUM_CONFIG.model.depositPercent}%`;
  root.querySelector('[data-modal-deposit]').textContent = formatPrice(price.deposit);
}
