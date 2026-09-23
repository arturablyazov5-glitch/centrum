// Лендинг CENTRUM: появление блоков, липкая кнопка и ленивая загрузка конфигуратора.
// Конфигуратор тянет WebGL-сцену и GLB-модели, поэтому iframe получает src только
// при приближении к секции — иначе первый экран грузится вместе со всей 3D-сценой.

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
