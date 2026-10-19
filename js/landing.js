// Лендинг CENTRUM: появление блоков, липкая кнопка и ленивая загрузка конфигуратора.
// Конфигуратор тянет WebGL-сцену и GLB-модели, поэтому iframe получает src только
// при приближении к секции — иначе первый экран грузится вместе со всей 3D-сценой.

import { CENTRUM_CONFIG } from './centrum-config.js';
import { calculatePrice, formatPrice, formatPriceDelta } from './pricing.js';
import { POWER_PACKAGES } from './3d/sockets.js';
import { readConfigurationFromURL } from './url-state.js';
import { worktopPadDiagram } from './worktop-pad-diagram.js';

const padPlan = document.querySelector('[data-pad-plan]');
if (padPlan) padPlan.innerHTML = worktopPadDiagram();

const head = document.getElementById('site-head');
if (head) {
  const onScroll = () => head.classList.toggle('is-stuck', window.scrollY > 24);
  onScroll();
  addEventListener('scroll', onScroll, { passive: true });
}

const revealObserver = new IntersectionObserver(
  (entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      entry.target.classList.add('is-in');
      revealObserver.unobserve(entry.target);
    }
  },
  { rootMargin: '0px 0px -12% 0px', threshold: 0.08 },
);
document.querySelectorAll('.reveal').forEach((el) => revealObserver.observe(el));

const frame = document.querySelector('.configurator-frame iframe');
const loader = document.querySelector('[data-frame-loader]');
if (frame) {
  const show = () => {
    frame.classList.add('is-ready');
    loader?.classList.add('is-hidden');
  };
  frame.addEventListener('load', show);
  const frameObserver = new IntersectionObserver(
    (entries) => {
      if (!entries.some((e) => e.isIntersecting)) return;
      frameObserver.disconnect();
      frame.src = frame.dataset.src;
    },
    { rootMargin: '600px 0px' },
  );
  frameObserver.observe(frame.closest('.configurator-frame'));
}

// Пресеты: href карточки — это ссылка на конфигурацию. Цена и опции читаются из неё
// тем же кодом, что и в конфигураторе, поэтому не расходятся с прайсом.
const drawersWord = (n) => (n % 10 === 1 && n % 100 !== 11 ? 'ящик' : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 10 || n % 100 >= 20) ? 'ящика' : 'ящиков');
const presetTags = (c) => {
  const light = CENTRUM_CONFIG.lighting[c.ledTemperature];
  return [
    { text: CENTRUM_CONFIG.wood[c.wood].name, swatch: CENTRUM_CONFIG.wood[c.wood].swatch },
    { text: `${c.drawers} ${drawersWord(c.drawers)}` },
    { text: `Питание ${CENTRUM_CONFIG.electricity[c.electricity].name}` },
    { text: light.temperature ? `Свет ${light.temperature} K` : 'RGB-свет', swatch: light.temperature ? light.swatch : c.ledRgb },
    c.drawerLighting && { text: 'Подсветка ящиков' },
    c.audio51 && { text: 'Звук 5.1' },
    c.monitors > 1 && { text: `${c.monitors} экрана` },
  ].filter(Boolean);
};

document.querySelectorAll('[data-preset]').forEach((card) => {
  const url = new URL(card.getAttribute('href'), location.href);
  const configuration = readConfigurationFromURL(url.search);
  card.querySelector('[data-preset-price]').textContent = formatPrice(calculatePrice(configuration).totalPrice);
  card.querySelector('[data-preset-tags]').replaceChildren(
    ...presetTags(configuration).map(({ text, swatch }) => {
      const li = document.createElement('li');
      if (swatch) {
        const dot = document.createElement('i');
        dot.style.background = swatch;
        li.append(dot);
      }
      li.append(text);
      return li;
    }),
  );

  // Без JS ссылка откроет конфигуратор отдельной страницей; с JS — сборка грузится во встроенный.
  if (!frame) return;
  card.addEventListener('click', (event) => {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return;
    event.preventDefault();
    const src = `${frame.dataset.src.split('?')[0]}${url.search}`;
    frame.dataset.src = src;
    if (frame.getAttribute('src')) {
      frame.classList.remove('is-ready');
      loader?.classList.remove('is-hidden');
      frame.src = src;
    }
    document.getElementById('configurator')?.scrollIntoView({ behavior: 'smooth' });
  });
});

// Цена опции 5.1 в блоке «Звук» берётся из прайса, как у пресетов.
document.querySelectorAll('[data-audio-price]').forEach((el) => {
  el.textContent = `+${formatPrice(CENTRUM_CONFIG.audio.audio51.price)}`;
});

// Цены отделки совпадают с конфигуратором и берутся из общего прайса.
document.querySelectorAll('[data-finish-price]').forEach((el) => {
  el.textContent = formatPriceDelta(CENTRUM_CONFIG.wood[el.dataset.finishPrice].price);
});

// Цена пары боковых панелей для наушников — из прайса.
document.querySelectorAll('[data-phones-price]').forEach((el) => {
  el.textContent = formatPrice(CENTRUM_CONFIG.audio.headphoneSides.price);
});

// Цена дополнительной стойки под экран — из прайса.
document.querySelectorAll('[data-monitor-price]').forEach((el) => {
  el.textContent = formatPrice(CENTRUM_CONFIG.monitor.post.price);
});

document.querySelectorAll('[data-light-demo]').forEach((demo) => {
  const toggle = demo.querySelector('[data-light-toggle]');
  const images = demo.querySelectorAll('[data-light-image]');
  if (!toggle || images.length !== 2) return;

  const updateLightState = () => {
    const isOn = toggle.checked;
    demo.dataset.state = isOn ? 'on' : 'off';
  };

  toggle.addEventListener('change', updateLightState);
  updateLightState();
});

// Эргономика: точка на рендере и пункт под ним подсвечиваются вместе.
document.querySelectorAll('[data-ergo]').forEach((ergo) => {
  const items = ergo.querySelectorAll('[data-spot]');
  const setActive = (id) => {
    ergo.classList.toggle('has-active', Boolean(id));
    items.forEach((item) => item.classList.toggle('is-active', item.dataset.spot === id));
  };
  items.forEach((item) => {
    item.addEventListener('mouseenter', () => setActive(item.dataset.spot));
    item.addEventListener('mouseleave', () => setActive(null));
    item.addEventListener('focus', () => setActive(item.dataset.spot));
    item.addEventListener('blur', () => setActive(null));
  });
});

const zoomIcon = `
  <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round">
    <circle cx="10.8" cy="10.8" r="5.8"></circle>
    <path d="m15.2 15.2 4.3 4.3"></path>
  </svg>
`;
const lightbox = document.createElement('div');
lightbox.className = 'lightbox';
lightbox.setAttribute('aria-hidden', 'true');
lightbox.innerHTML = '<button class="lightbox-close" type="button" aria-label="Закрыть">×</button><img alt="" />';
document.body.append(lightbox);
const lightboxImage = lightbox.querySelector('img');
const closeLightbox = () => {
  lightbox.classList.remove('is-open');
  lightbox.setAttribute('aria-hidden', 'true');
  lightboxImage.removeAttribute('src');
};
lightbox.querySelector('.lightbox-close').addEventListener('click', closeLightbox);
lightbox.addEventListener('click', (event) => {
  if (event.target === lightbox) closeLightbox();
});
addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && lightbox.classList.contains('is-open')) closeLightbox();
});

const photoTargets = document.querySelectorAll(
  'main figure:not(.no-photo-zoom) img, main .card-media img, main .light-demo-media',
);
photoTargets.forEach((target) => {
  const isImage = target instanceof HTMLImageElement;
  const wrapper = isImage ? target.parentElement : target;
  if (!wrapper || wrapper.querySelector('.photo-zoom-button')) return;
  wrapper.classList.add('photo-zoom-target');
  const button = document.createElement('button');
  button.className = 'photo-zoom-button';
  button.type = 'button';
  button.setAttribute('aria-label', 'Открыть фото крупнее');
  button.innerHTML = zoomIcon;
  wrapper.append(button);
  button.addEventListener('click', () => {
    const image = isImage
      ? target
      : wrapper.querySelector('[data-light-state="on"]')?.closest('[data-light-demo]')?.dataset.state === 'on'
        ? wrapper.querySelector('[data-light-state="on"]')
        : wrapper.querySelector('[data-light-state="off"]');
    if (!image?.src) return;
    lightboxImage.src = image.currentSrc || image.src;
    lightboxImage.alt = image.alt || '';
    lightbox.classList.add('is-open');
    lightbox.setAttribute('aria-hidden', 'false');
  });
});

// Липкая кнопка появляется после первого экрана и прячется на самом конфигураторе,
// чтобы не перекрывать его собственную панель с ценой.
const sticky = document.getElementById('sticky-cta');
const configurator = document.getElementById('configurator');
if (sticky && configurator) {
  const update = () => {
    const passedHero = window.scrollY > window.innerHeight * 0.9;
    const box = configurator.getBoundingClientRect();
    const onConfigurator = box.top < window.innerHeight * 0.6 && box.bottom > 0;
    sticky.classList.toggle('is-visible', passedHero && !onConfigurator);
  };
  update();
  addEventListener('scroll', update, { passive: true });
  addEventListener('resize', update);
}

// Цена накладки общая с конфигуратором.
document.querySelectorAll('[data-pad-price]').forEach((el) => { el.textContent = formatPriceDelta(CENTRUM_CONFIG.worktopPad.price); });

// Электрика: три кадра одного ракурса, пакет выбирается табами. Числа, цена
// и схема постов — из centrum-config.js и js/3d/sockets.js, как в конфигураторе.
document.querySelectorAll('[data-power-demo]').forEach((demo) => {
  const tabs = [...demo.querySelectorAll('[data-power-tab]')];
  const thumb = demo.querySelector('.power-tabs-thumb');
  const posts = demo.querySelector('[data-power-posts]');
  const slots = { left: Math.max(...Object.values(POWER_PACKAGES).map((p) => p.left.length)),
    right: Math.max(...Object.values(POWER_PACKAGES).map((p) => p.right.length)) };
  const post = (id, side) => {
    const kinds = POWER_PACKAGES[id][side], base = POWER_PACKAGES.base[side];
    const cells = Array.from({ length: slots[side] }, (_, i) => {
      if (i >= kinds.length) return '<i class="is-empty"></i>';
      return `<i data-kind="${kinds[i]}"${kinds[i] !== base[i] ? ' class="is-new"' : ''}></i>`;
    });
    // Посты растут от экрана к боку: левый на схеме читается справа налево.
    return `<span class="power-post">${(side === 'left' ? cells.reverse() : cells).join('')}</span>`;
  };
  let current = null;
  const select = (id, focus = false) => {
    const option = CENTRUM_CONFIG.electricity[id];
    if (!option) return;
    demo.dataset.state = id;
    tabs.forEach((tab) => {
      const on = tab.dataset.powerTab === id;
      tab.setAttribute('aria-selected', String(on));
      tab.tabIndex = on ? 0 : -1;
      if (on) {
        thumb.style.width = `${tab.offsetWidth}px`;
        thumb.style.transform = `translateX(${tab.offsetLeft}px)`;
        if (focus) tab.focus();
      }
    });
    demo.querySelectorAll('[data-power-count]').forEach((el) => {
      const key = el.dataset.powerCount;
      const value = String(option[key]);
      if (el.textContent !== value && current) {
        el.classList.remove('is-changing');
        void el.offsetWidth;
        el.classList.add('is-changing');
      }
      el.textContent = value;
      el.classList.toggle('is-up', option[key] > CENTRUM_CONFIG.electricity.base[key]);
    });
    demo.querySelector('[data-power-price]').textContent = option.price ? formatPriceDelta(option.price) : 'В базе';
    demo.querySelector('[data-power-note]').textContent = option.price ? 'к цене стола' : 'входит в стоимость стола';
    demo.querySelector('[data-power-link]').href = `configurator.html?power=${id}&step=electricity`;
    posts.innerHTML = `<span>Слева</span>${post(id, 'left')}<span class="power-screen"></span>${post(id, 'right')}<span>Справа</span>`;
    current = id;
  };
  tabs.forEach((tab, index) => {
    tab.addEventListener('click', () => select(tab.dataset.powerTab));
    tab.addEventListener('keydown', (event) => {
      const step = { ArrowRight: 1, ArrowLeft: -1 }[event.key];
      if (!step) return;
      event.preventDefault();
      select(tabs[(index + step + tabs.length) % tabs.length].dataset.powerTab, true);
    });
  });
  select(demo.dataset.state || 'base');
  // Ширина табов известна только после загрузки шрифта.
  document.fonts?.ready.then(() => select(current));
  addEventListener('resize', () => select(current));
});
