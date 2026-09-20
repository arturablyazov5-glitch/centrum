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
