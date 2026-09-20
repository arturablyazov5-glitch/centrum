// Карточка «3D» в конце листа: разметка, кнопки и связь с вьювером.
// Здесь нет ни геометрии, ни рендера — только интерфейс вокруг них.

import { createViewer } from './viewer.js?v=20260909-02';

const DESCRIPTION = 'Объёмная модель построена по тем же числам, что и чертежи: габарит 2900 × 2900*, '
  + 'отверстие Ø1200*, пояс 300* до первого уровня и 200* выше, рабочая поверхность 820*, второй уровень 1270* '
  + 'с переходом на участке 1700–2300* и выступом 60* с пазом LED, проход 800* и подъёмная секция Bridge с ходом 0–100°. '
  + 'Блок хранения на участке 1800* — сетка 3 × 3: девять одинаковых ящиков на телескопических направляющих полного выдвижения, '
  + 'каждый открывается отдельно, дверь холодильника — тоже. '
  + 'На внутренней стенке установлен Ultrawide Monitor, перед ним — клавиатура и мышь, справа от мыши экраном вниз лежит iPhone, слева — открытый MacBook Pro и лежащие наушники; на втором уровне стоит растение в горшке. '
  + 'Модель показывает объём и взаимное положение частей; размеры снимать с чертежей, а не с экрана.';

const VIEW_BUTTONS = [
  ['iso', 'Изометрия'],
  ['front', 'Спереди'],
  ['side', 'Сбоку'],
  ['entry', 'От входа'],
  ['top', 'Сверху'],
  ['tech', 'Техника'],
];

const SCENE_BUTTONS = [
  ['chair', 'Кресло', true],
  ['nearFade', 'Просвечивать близкое', false],
  ['led', 'LED', true],
  ['floor', 'Пол', true],
  ['spin', 'Автоповорот', false],
];

function button(label, pressed) {
  const el = document.createElement('button');
  el.type = 'button';
  el.textContent = label;
  el.setAttribute('aria-pressed', String(pressed));
  return el;
}

export function createCard() {
  const section = document.createElement('section');
  section.className = 'monolith-section';
  section.id = 'section-3d';
  section.innerHTML = `
    <div class="monolith-title"><span class="num">3D</span><h2>Интерактивная модель</h2></div>
    <article class="view view-3d">
      <header><span class="num">3D</span><h3>CENTRUM в объёме · поворот, Bridge, холодильник и ящики</h3></header>
      <div class="viewer-3d">
        <canvas tabindex="0" role="img"
          aria-label="Интерактивная 3D-модель CENTRUM. Перетаскивание поворачивает модель, стрелки на клавиатуре тоже."></canvas>
        <p class="viewer-hint">ЛКМ — орбита · ПКМ или Shift+ЛКМ — панорама · колесо, средняя или Cmd+ЛКМ — наезд ·
          клавиши 1/2/3 — панорама/наезд/орбита · S — кадрировать деталь под курсором, H — всю модель ·
          клик открывает Bridge, дверь, ящики и закрывает MacBook</p>
      </div>
      <div class="viewer-controls">
        <div class="viewer-row"><span class="viewer-label">Ракурс</span><div class="viewer-group" role="group" aria-label="Ракурс"></div></div>
        <div class="viewer-row"><span class="viewer-label">Сцена</span><div class="viewer-group" role="group" aria-label="Сцена"></div></div>
      </div>
      <footer><p>${DESCRIPTION}</p></footer>
    </article>`;

  const canvas = section.querySelector('canvas');
  const viewer = createViewer(canvas);

  if (!viewer) {
    section.querySelector('.viewer-3d').innerHTML =
      '<p class="viewer-fallback">Браузер не отдаёт WebGL, поэтому объёмная модель не строится. '
      + 'Все размеры и узлы есть на чертежах выше.</p>';
    section.querySelector('.viewer-controls').remove();
    return section;
  }

  const [viewGroup, sceneGroup] = section.querySelectorAll('.viewer-group');

  const viewElements = new Map();
  const markView = (name) => {
    for (const [key, node] of viewElements) node.setAttribute('aria-pressed', String(key === name));
  };
  for (const [name, label] of VIEW_BUTTONS) {
    const el = button(label, name === 'iso');
    el.onclick = () => { viewer.setView(name); markView(name); };
    viewElements.set(name, el);
    viewGroup.append(el);
  }

  const actions = {
    chair: (on) => viewer.setChair(on),
    nearFade: (on) => viewer.setNearFade(on),
    led: (on) => viewer.setLed(on),
    floor: (on) => viewer.setFloor(on),
    spin: (on) => viewer.setAutoRotate(on),
  };

  // Каждая кнопка помнит своё исходное состояние — это и есть то, к чему возвращает «Сброс».
  const toggles = [];
  const addToggle = (parent, [key, label, initial]) => {
    const el = button(label, initial);
    el.onclick = () => {
      const next = el.getAttribute('aria-pressed') !== 'true';
      el.setAttribute('aria-pressed', String(next));
      actions[key](next);
    };
    parent.append(el);
    toggles.push({ el, key, initial });
  };
  for (const spec of SCENE_BUTTONS) addToggle(sceneGroup, spec);

  const reset = button('Сброс', false);
  reset.classList.add('viewer-reset');
  reset.onclick = () => {
    viewer.setView('iso');
    markView('iso');
    for (const { el, key, initial } of toggles) {
      el.setAttribute('aria-pressed', String(initial));
      actions[key](initial);
    }
    viewer.setBridge(false);
    viewer.setFridge(false);
    viewer.setAllDrawers(false);
    viewer.setLaptop(true);
  };
  sceneGroup.append(reset);

  return section;
}
