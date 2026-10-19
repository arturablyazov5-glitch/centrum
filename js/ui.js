import { CENTRUM_CONFIG } from './centrum-config.js';
import { drawerPriceDelta, formatPrice, formatPriceDelta } from './pricing.js';
import { calculateDrawerDirectCost } from './drawer-costing.js';
import { calculateDrawerLightingCost } from './drawer-lighting-costing.js';
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

// Tech Bay: что показано в 3D и введённый корпус — не часть конфигурации и не
// влияют на цену, поэтому живут здесь и переживают перерисовку панели.
export const techBayView = { open: false, layers: { air: false, cables: false, service: false }, size: { w: '', d: '', h: '' }, pc: null };
export function resetTechBayView() {
  techBayView.open = false;
  for (const id of Object.keys(techBayView.layers)) techBayView.layers[id] = false;
}

const TECH_DIMS = [['w', 'width', 'Ширина', 'ширине'], ['d', 'depth', 'Глубина', 'глубине'], ['h', 'height', 'Высота', 'высоте']];

// Ответ на «встанет ли мой корпус»: по каждому размеру — запас или перебор.
function techBayFit() {
  const { pc } = CENTRUM_CONFIG.techBay;
  // Пустое или негодное поле — предельный размер: корпус в 3D меняется сразу
  // по каждой введённой цифре, а не после заполнения всех трёх полей.
  const typed = TECH_DIMS.map(([key]) => {
    const v = Number(String(techBayView.size[key]).trim().replace(',', '.'));
    return String(techBayView.size[key]).trim() !== '' && Number.isFinite(v) && v > 0 ? v : null;
  });
  if (typed.every((v) => v === null)) return { state: 'empty', text: 'Введите размеры корпуса из его паспорта, в миллиметрах.' };
  const values = typed.map((v, i) => v ?? pc[TECH_DIMS[i][1]]);
  const missing = TECH_DIMS.filter((_, i) => typed[i] === null).map(([, limit, label]) => `${label.toLowerCase()} ${pc[limit]}`);
  const assumed = missing.length ? ` Пока не введено — берём предел: ${missing.join(', ')} мм.` : '';
  // Корпус меньше 100 мм по любой стороне не бывает — скорее всего, ввели сантиметры.
  const unitHint = typed.some((v) => v !== null && v < 100) ? ' Проверьте единицы: нужны миллиметры, а не сантиметры.' : '';
  const over = TECH_DIMS.map(([, limit, label], i) => ({ label: label.toLowerCase(), value: values[i], limit: pc[limit] })).filter((d) => d.value > d.limit);
  const cap = techBayView.clamped ? (() => { const m = CENTRUM_CONFIG.techBay.pcMax(values[0]); return ` Больше ниши не бывает: при ширине ${values[0]} предел ${m.width} × ${m.depth} × ${m.height} мм.`; })() : '';
  if (over.length) return { state: 'no', values, text: `Не встанет: ${over.map((d) => `${d.label} ${d.value} больше ${d.limit} мм`).join(', ')}.${cap}${unitHint}` };
  const spare = TECH_DIMS.map(([, limit, , where], i) => `по ${where} ${pc[limit] - values[i]}`).join(', ');
  return { state: 'yes', values, text: `Встанет. Запас ${spare} мм.${assumed}${unitHint}` };
}

// Больше физического предела ниши ввести нельзя: число в поле сразу
// заменяется пределом. Глубина зависит от ширины — широкий корпус упирается в скос.
function clampTechBaySize(root) {
  const { pc, pcMax } = CENTRUM_CONFIG.techBay;
  const num = (key) => {
    const v = Number(String(techBayView.size[key]).trim().replace(',', '.'));
    return String(techBayView.size[key]).trim() !== '' && Number.isFinite(v) ? v : null;
  };
  const max = pcMax(Math.min(num('w') ?? pc.width, pcMax(0).width));
  techBayView.clamped = false;
  for (const [key, limit] of TECH_DIMS) {
    const v = num(key);
    if (v === null || v <= max[limit]) continue;
    techBayView.size[key] = String(max[limit]);
    const field = root.querySelector(`[data-techbay-size="${key}"]`);
    if (field) field.value = techBayView.size[key];
    techBayView.clamped = true;
  }
}

function techBayContent() {
  const t = CENTRUM_CONFIG.techBay;
  const layers = t.layers.map((layer) => `<button type="button" class="techbay-layer techbay-layer--${layer.id} ${techBayView.layers[layer.id] ? 'is-on' : ''}" data-techbay-layer="${layer.id}" aria-pressed="${techBayView.layers[layer.id]}"><i class="techbay-layer-dot" aria-hidden="true"></i>${layer.name}</button>`).join('');
  const notes = t.layers.map((layer) => `<li ${techBayView.layers[layer.id] ? '' : 'hidden'} data-techbay-note="${layer.id}"><i class="techbay-layer-dot techbay-layer--${layer.id}" aria-hidden="true"></i>${layer.detail}</li>`).join('');
  const max = t.pcMax(0);
  const inputs = TECH_DIMS.map(([key, limit, label]) => `<label><span>${label}</span><input type="number" inputmode="numeric" min="0" max="${max[limit]}" step="1" placeholder="до ${t.pc[limit]}" value="${escapeHTML(techBayView.size[key])}" data-techbay-size="${key}" aria-label="${label} корпуса, мм"></label>`).join('');
  const fit = techBayFit();
  return `<div class="included-badge">Входит в базу</div>
    <button type="button" class="techbay-open ${techBayView.open ? 'is-open' : ''}" data-techbay-open aria-pressed="${techBayView.open}"><span>${techBayView.open ? 'Закрыть отсек' : 'Открыть отсек'}</span></button>
    <div class="techbay-layers" role="group" aria-label="Показать в 3D">${layers}</div>
    <ul class="techbay-notes">${notes}</ul>
    <section class="techbay-block">
      <h2>Какой компьютер встанет</h2>
      <dl class="techbay-specs">
        <div><dt>Корпус</dt><dd>до ${t.pc.width} × ${t.pc.depth} × ${t.pc.height} мм</dd></div>
        <div><dt>Тепло</dt><dd>до ${t.heatW} Вт</dd></div>
        <div><dt>Шум у кресла</dt><dd>≤${t.noiseIdle} дБА в простое, ≤${t.noiseLoad} под нагрузкой</dd></div>
        <div><dt>Масса</dt><dd>до ${t.massKg} кг</dd></div>
        <div><dt>Плата</dt><dd>${t.board}: звук и USB для панелей наушников</dd></div>
        <div><dt>Поддон</dt><dd>мотор, направляющие на ${t.trayLoadKg} кг, ход ${t.trayTravel} мм</dd></div>
      </dl>
    </section>
    <section class="techbay-block">
      <h2>Проверить свой корпус</h2>
      <div class="techbay-size">${inputs}</div>
      <p class="techbay-fit techbay-fit--${fit.state}" data-techbay-fit>${fit.text}</p>
    </section>
    <p class="panel-note">Размеры корпуса — ширина × глубина × высота, с ножками. Компьютер мощнее ${t.heatW} Вт обсудим отдельно. Сам компьютер не входит в комплект.</p>`;
}

export function renderNavigation(root, activeCategory, onNavigate) {
  root.innerHTML = CENTRUM_CONFIG.categories.map((category) => `<button type="button" data-category="${category.id}" class="nav-step ${category.id === activeCategory ? 'is-active' : ''}" aria-current="${category.id === activeCategory ? 'step' : 'false'}"><span>${category.number}</span><strong>${category.name}</strong></button>`).join('');
  root.querySelectorAll('[data-category]').forEach((button) => button.addEventListener('click', () => onNavigate(button.dataset.category)));
}

function rgbPicker(configuration) {
  const current = configuration.ledRgb;
  return `<div class="rgb-picker"><span>Цвет подсветки</span><div class="rgb-swatches">${RGB_PRESETS.map((color) => `<button type="button" class="rgb-swatch ${color === current ? 'is-selected' : ''}" style="--dot:${color}" data-rgb="${color}" aria-label="Цвет ${color}"></button>`).join('')}<label class="rgb-custom ${RGB_PRESETS.includes(current) ? '' : 'is-selected'}" style="--dot:${current}" title="Любой цвет"><input type="color" value="${current}" data-rgb-input aria-label="Выбрать любой цвет"></label></div></div>`;
}

export function renderPanel(root, categoryId, configuration, price, onChange, onLive = onChange, onTechBay = () => {}) {
  const category = CENTRUM_CONFIG.categories.find((item) => item.id === categoryId) || CENTRUM_CONFIG.categories[0];
  let content = '';
  if (categoryId === 'finish') {
    content = `<div class="option-grid material-grid">${Object.entries(CENTRUM_CONFIG.wood).map(([key, option]) => optionButton({ key, option, selected: key === configuration.wood, type: 'wood' })).join('')}</div>`;
  } else if (categoryId === 'storage') {
    const drawerDelta = drawerPriceDelta(configuration.drawers);
    const { min, max, included, costing } = CENTRUM_CONFIG.drawers;
    const drawerCost = calculateDrawerDirectCost(configuration.drawers);
    content = `<div class="storage-control"><span>Количество ящиков</span><div class="stepper"><button type="button" data-step="-1" aria-label="Уменьшить">−</button><strong>${configuration.drawers}</strong><button type="button" data-step="1" aria-label="Увеличить">+</button></div><p>От ${min} до ${max}. ${included} входят в базовую комплектацию. Цена пересчитывается по размерам фасадов, коробов, направляющих, раскроя и сборки.</p><em>${drawerDelta === 0 ? 'Без изменения базовой цены' : formatPriceDelta(drawerDelta)}</em><p class="panel-note">Ориентир прямых затрат на короба, фасады и меняющиеся перегородки: ${formatPrice(Math.round(drawerCost.total))}. В расчёте — одна пара направляющих на ящик (${costing.softCloseRailSetPrice} ₽, нагрузка 35 кг), плита 16 мм для коробов и 18 мм для фасадов, раскрой, кромка и сборка. В 3D боковина короба задана как 14 мм; фиксированный каркас уже в базе; отход листа и доставка не включены; для широких коробов нагрузку и усиление должен подтвердить изготовитель.</p></div>`;
  } else if (categoryId === 'electricity') {
    content = `<div class="option-grid single-grid">${Object.entries(CENTRUM_CONFIG.electricity).map(([key, option]) => optionButton({ key, option, selected: key === configuration.electricity, type: 'electricity', details: `${option.sockets220} × 220 В · ${option.usbC} × USB-C · ${option.usbA} × USB-A · ${option.qi} × Qi` })).join('')}</div>`;
  } else if (categoryId === 'lighting') {
    const drawerLight = CENTRUM_CONFIG.lighting.drawerLighting;
    const drawerLightCost = calculateDrawerLightingCost(configuration.drawers);
    content = `<div class="option-grid material-grid">${Object.entries(CENTRUM_CONFIG.lighting).filter(([key]) => key !== 'drawerLighting').map(([key, option]) => optionButton({ key, option: { ...option, description: option.temperature ? `${option.temperature} K` : 'Любой цвет' }, selected: key === configuration.ledTemperature, type: 'lighting', dot: key === 'rgb' ? (configuration.ledTemperature === 'rgb' ? configuration.ledRgb : 'conic-gradient(#ff4d4d, #ffe066, #51e08a, #38d9f5, #4d7cff, #ff5fc8, #ff4d4d)') : option.swatch })).join('')}</div>${configuration.ledTemperature === 'rgb' ? rgbPicker(configuration) : ''}${switchRow('drawerLighting', { ...drawerLight, price: drawerLightCost.price }, configuration.drawerLighting)}<p class="panel-note">Цена рассчитана для ${configuration.drawers} ящиков: ${Math.round(drawerLightCost.profileLengthMm)} мм профиля, датчик на каждый ящик и проводка по рядам. Предварительная оценка материалов; окончательную смету подтвердит изготовитель.</p>`;
  } else if (categoryId === 'techBay') {
    content = techBayContent();
  } else if (categoryId === 'audio') {
    content = `<div class="included-note"><strong>Акустические рейки</strong><span>Деревянные рейки на войлоке по всей стенке гасят эхо. Входят в базовую комплектацию.</span></div>${switchRow('audio51', CENTRUM_CONFIG.audio.audio51, configuration.audio51)}<div class="included-note"><strong>Панель для наушников</strong><span>Под кромкой у клавиатуры: USB-C, 3,5 мм и USB-A на графитовой панели в кармане со скруглённой кромкой. Звук и USB — от компьютера в Tech Bay, поэтому ${CENTRUM_CONFIG.techBay.board}. Входит в базовую комплектацию.</span></div>${switchRow('headphoneSides', CENTRUM_CONFIG.audio.headphoneSides, configuration.headphoneSides)}`;
  } else if (categoryId === 'worktopPad') {
    content = `<img class="pad-config-render" src="output/render/premium/worktop-pad-on-1600.png" width="1600" height="1067" alt="Графитовая экокожа накладки по дуге ореховой кромки, рядом клавиатура и мышь" loading="lazy" />${switchRow('worktopPad', CENTRUM_CONFIG.worktopPad, configuration.worktopPad)}<p class="panel-note">Цельный контур вокруг вас, без стыков под руками. Для моста предусмотрена отдельная деталь. Материал и мягкость согласуем по образцу.</p>${CENTRUM_CONFIG.worktopPad.price === null ? '<p class="panel-note">Стоимость рассчитаем отдельно. При выборе накладки показанные сумма и предоплата относятся к столу без неё.</p>' : ''}`;
  } else if (categoryId === 'monitor') {
    const { included, max, post } = CENTRUM_CONFIG.monitor;
    const extra = configuration.monitors - included;
    content = `<div class="included-note"><strong>Шина и одна стойка с рукой</strong><span>Две шины в стенке по всей дуге и стойка с рукой на газлифте. Экран ставится в любое место дуги и переставляется за полминуты, провода уходят в стенку. Входит в базовую комплектацию.</span></div><div class="storage-control"><span>Стойки под экраны</span><div class="stepper"><button type="button" data-monitor-step="-1" aria-label="Уменьшить">−</button><strong>${configuration.monitors}</strong><button type="button" data-monitor-step="1" aria-label="Увеличить">+</button></div><p>От ${included} до ${max}. ${post.description}.</p><em>${extra > 0 ? formatPriceDelta(extra * post.price) : 'Без изменения базовой цены'}</em></div><p class="panel-note">Мониторы приобретаются отдельно. Изображение монитора в сцене демонстрационное.</p>`;
  } else {
    content = `<div class="summary-list">${summaryRows(configuration, price)}</div>`;
  }

  const isLastCategory = categoryId === CENTRUM_CONFIG.categories.at(-1).id;
  const nextAction = isLastCategory
    ? ''
    : '<button class="next-step" type="button" data-next-category>Далее <i data-lucide="arrow-right" aria-hidden="true"></i></button>';
  root.innerHTML = `<div class="panel-heading"><h1>${category.name}</h1><p>${category.description}</p></div><div class="panel-content">${content}${nextAction}</div>`;
  root.querySelectorAll('[data-option-type]').forEach((button) => button.addEventListener('click', () => {
    const keyMap = { wood: 'wood', electricity: 'electricity', lighting: 'ledTemperature' };
    onChange({ [keyMap[button.dataset.optionType]]: button.dataset.optionKey });
  }));
  root.querySelectorAll('[data-monitor-step]').forEach((button) => button.addEventListener('click', () => onChange({ monitors: Math.max(CENTRUM_CONFIG.monitor.included, Math.min(CENTRUM_CONFIG.monitor.max, configuration.monitors + Number(button.dataset.monitorStep))) })));
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
  bindTechBay(root, onTechBay);
}

// Кнопки Tech Bay меняют только 3D и свою подпись: панель целиком не
// перерисовываем, иначе поле размера теряло бы фокус на каждой цифре.
function bindTechBay(root, onTechBay) {
  const open = root.querySelector('[data-techbay-open]');
  if (!open) return;
  const setOpen = (value) => {
    techBayView.open = value;
    open.classList.toggle('is-open', value);
    open.setAttribute('aria-pressed', String(value));
    open.querySelector('span').textContent = value ? 'Закрыть отсек' : 'Открыть отсек';
  };
  open.addEventListener('click', () => { setOpen(!techBayView.open); onTechBay(techBayView); });
  root.querySelectorAll('[data-techbay-layer]').forEach((button) => button.addEventListener('click', () => {
    const id = button.dataset.techbayLayer;
    techBayView.layers[id] = !techBayView.layers[id];
    button.classList.toggle('is-on', techBayView.layers[id]);
    button.setAttribute('aria-pressed', String(techBayView.layers[id]));
    root.querySelector(`[data-techbay-note="${id}"]`).hidden = !techBayView.layers[id];
    onTechBay(techBayView);
  }));
  root.querySelectorAll('[data-techbay-size]').forEach((input) => input.addEventListener('input', () => {
    techBayView.size[input.dataset.techbaySize] = input.value;
    clampTechBaySize(root);
    const fit = techBayFit();
    const out = root.querySelector('[data-techbay-fit]');
    out.textContent = fit.text;
    out.className = `techbay-fit techbay-fit--${fit.state}`;
    // Корпус в 3D повторяет введённый; отсек открывается сам, чтобы его было видно.
    techBayView.pc = fit.values ? { size: fit.values, fits: fit.state === 'yes' } : null;
    if (techBayView.pc && !techBayView.open) setOpen(true);
    onTechBay(techBayView);
  }));
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
    ['Объёмный звук 5.1', yesNo(configuration.audio51)],
    [CENTRUM_CONFIG.audio.headphoneSides.name, yesNo(configuration.headphoneSides)],
    ['Стойки под экраны', configuration.monitors > CENTRUM_CONFIG.monitor.included ? `${configuration.monitors} (1 в базе)` : '1 · входит'],
    ['Рабочая накладка', configuration.worktopPad ? formatPriceDelta(CENTRUM_CONFIG.worktopPad.price) + (CENTRUM_CONFIG.worktopPad.estimated ? ' (предварительно)' : '') : 'Нет'],
    [price.pendingPadPrice ? 'Итого без накладки' : configuration.worktopPad && CENTRUM_CONFIG.worktopPad.estimated ? 'Предварительно итого' : 'Итого', formatPrice(price.totalPrice)],
    [`Предоплата ${CENTRUM_CONFIG.model.depositPercent}%${price.pendingPadPrice ? ' без накладки' : ''}`, formatPrice(price.deposit)],
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
  root.querySelector('[data-total-price]').previousElementSibling.textContent = price.pendingPadPrice ? 'Итого без накладки' : configuration.worktopPad && CENTRUM_CONFIG.worktopPad.estimated ? 'Предварительно итого' : 'Итого';
  root.querySelector('[data-deposit-label]').textContent = `Предоплата ${CENTRUM_CONFIG.model.depositPercent}%${price.pendingPadPrice ? ' без накладки' : ''}`;
  root.querySelector('[data-deposit-price]').textContent = formatPrice(price.deposit);
}

export function updateModalSummary(root, price) {
  root.querySelector('[data-modal-model]').textContent = CENTRUM_CONFIG.model.name + (price.pendingPadPrice ? ' · без стоимости накладки' : price.estimated ? ' · предварительный расчёт' : '');
  root.querySelector('[data-modal-total]').textContent = formatPrice(price.totalPrice);
  root.querySelector('[data-modal-deposit-label]').textContent = `Предоплата ${CENTRUM_CONFIG.model.depositPercent}%${price.pendingPadPrice ? ' без накладки' : ''}`;
  root.querySelector('[data-modal-deposit]').textContent = formatPrice(price.deposit);
}
