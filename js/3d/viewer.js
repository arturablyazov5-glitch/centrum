// Вьювер: связывает модель, камеру, управление и подвижные узлы в один объект
// с понятным интерфейсом. Кадр считается только тогда, когда что-то изменилось.

import { buildModel } from './build-model.js?v=20260926-phones';
import { buildLayout, monitorInstanceMatrix, MONITOR_LAYOUTS, MAX_MONITORS } from './build-monitor-rail.js?v=20260925-real';
import { createMesh, toBufferData } from './mesh.js';
import { mirrorBuffers } from './mirror.js';
import { createRenderer } from './renderer.js?v=20260926-elec';
import { createCamera, viewMatrix, projectionMatrix, clampCamera, fitDistance, eyePosition, fadeDistance, VIEWS } from './camera.js';
import { createFocus } from './focus.js';
import { attachControls } from './controls.js';
import { cameraRay, pickGroup } from './picking.js';
import { createBridgeMotion } from './bridge-motion.js';
import { createFridgeMotion } from './fridge-motion.js';
import { createTrashMotion } from './trash-motion.js';
import { createDrawerMotion } from './drawer-motion.js';
import { createTechBayMotion } from './techbay-motion.js?v=20260926-tray';
import { createLaptopMotion } from './laptop-motion.js?v=20260923-props';
import { CELLS, DRAWER_TRAVEL } from './build-drawers.js';
import { loadMonitorGroups, loadLaptopGroups, loadHeadphonesGroups, loadPlantGroups, loadKeyboardGroups, loadMouseGroups, loadChairGroups, loadIphoneGroups, loadPrinterGroups, loadMugGroups, loadSocketGroups } from './load-monitor.js?v=20260925-rail';
import { buildConfigDrawerGroups, buildConfigDrawerLedGroups, buildConfigCarcassGroups, buildConfigMiddleSlideGroups } from './build-config-drawers.js?v=20260926-slides';
import { cellsFor } from './drawer-layout.js';
import { drawerLightVolume } from './build-drawer.js';
import { DRAWER_LED_COLOR } from './palette.js';
import { multiply, identity, translation, scaling } from './mat4.js';
import { TECH_PC_ANCHOR, techBayLightVolume } from './build-techbay.js?v=20260926-vent';
import { SIZE, TECH_PC as TECH_PC_LIMIT } from './params.js';
import { prop, PAD_LIFT } from './props.js';

const AUTO_SPEED = 0.22; // рад/с при включённом автоповороте
const LED_FADE = 2.4;    // свет разгорается и гаснет за доли секунды, а не мгновенно
const LAPTOP_SCREEN_ON_DELAY = 0.5;
const LAPTOP_SCREEN_FADE_SPEED = 3.4;

export function createViewer(canvas, { productOnly = false } = {}) {
  const renderer = createRenderer(canvas);
  if (!renderer) return null;

  const model = buildModel({ configurable: productOnly });
  const groups = renderer.prepare(model.groups);
  const byName = Object.fromEntries(groups.map((g) => [g.name, g]));
  const camera = createCamera(model.pivot);
  let ledColor = [1, 0.72, 0.46];
  let configuredDrawerCount = 3;
  // Подсветка ящиков — опция. На листе проекта показана, в конфигураторе
  // включается тумблером; горит только у выдвинутого ящика.
  let drawerLighting = !productOnly;

  const configDrawerGroups = productOnly ? renderer.prepare(buildConfigDrawerGroups()) : [];
  const configDrawerLeds = productOnly ? renderer.prepare(buildConfigDrawerLedGroups()) : [];
  // Каркас (перегородки, полки, неподвижные звенья) и промежуточные звенья —
  // тоже по варианту на каждое число ящиков.
  const configCarcass = productOnly ? renderer.prepare(buildConfigCarcassGroups()) : [];
  const configMiddleSlides = productOnly ? renderer.prepare(buildConfigMiddleSlideGroups()) : [];
  const configVariants = [configDrawerGroups, configCarcass, configMiddleSlides];
  const showConfigVariant = () => {
    for (const list of configVariants) list.forEach((group, i) => { group.visible = i + 1 === configuredDrawerCount; });
  };
  if (productOnly) {
    groups.push(...configDrawerGroups, ...configDrawerLeds, ...configCarcass, ...configMiddleSlides);
    Object.assign(byName, Object.fromEntries([...configDrawerGroups, ...configDrawerLeds, ...configCarcass, ...configMiddleSlides].map((g) => [g.name, g])));
    for (const group of configDrawerLeds) group.visible = false;
    for (const group of groups) {
      if (group.name.startsWith('drawer-') || group.name.startsWith('slide-')) group.visible = false;
    }
    showConfigVariant();
    // Решётки 5.1 в конфигураторе появляются только вместе с опцией.
    byName.speakers.visible = false;
  }
  // Схема трактов Tech Bay включается только кнопками на шаге Tech Bay.
  const TECH_LAYERS = ['air', 'cables', 'service'];
  for (const id of TECH_LAYERS) byName[`techbay-${id}`].visible = false;
  // Схема электрики — только по кнопкам «Электрика» на листе проекта.
  const ELEC_IDS = groups.filter((g) => g.name.startsWith('elec-')).map((g) => g.name);
  for (const name of ELEC_IDS) byName[name].visible = false;
  // Накладка — опция: без неё видна столешница, в том числе на витрине сайта.
  byName['worktop-pad'].visible = false;
  byName['bridge-pad'].visible = false;
  // Панели для наушников: боковые — опция, без неё в боковых карманах глухие вставки.
  const applyAudioSides = (on) => {
    byName['audio-sides'].visible = on;
    byName['audio-sides-blank'].visible = !on;
  };
  applyAudioSides(false);
  // Стойки под мониторы: на сайте — базовая стойка с рукой под покупным экраном,
  // в конфигураторе — вариант на 1…3 стойки с условными экранами (build-model.js).
  // Мониторы. На сайте — базовая стойка с рукой под покупным экраном из props.js.
  // В конфигураторе — раскладка на 1…5 экранов: стойки, руки и кабели строятся
  // по запросу (build-monitor-rail.js), экраны — та же модель GLB, что в Blender,
  // в пяти экземплярах со своими матрицами (буферы общие).
  let monitors = { count: 1, audio51: false };
  const layoutGroups = new Map();
  let screenInstances = [];
  const layoutGroup = (count, audio51) => {
    const key = `monitor-layout-${count}${audio51 ? '-51' : ''}`;
    if (!layoutGroups.has(key)) {
      const mesh = createMesh();
      buildLayout(mesh, mesh, count, audio51);
      const [g] = renderer.prepare([{ name: key, mesh: mirrorBuffers(toBufferData(mesh)), lines: { position: new Float32Array(), color: new Float32Array(), count: 0 } }]);
      groups.push(g);
      byName[key] = g;
      layoutGroups.set(key, g);
    }
    return layoutGroups.get(key);
  };
  const applyMonitors = () => {
    byName['monitor-post'].visible = !productOnly;
    byName['monitor-arm'].visible = !productOnly;
    byName['monitor-cables'].visible = !productOnly;
    if (!productOnly) return;
    const shown = layoutGroup(monitors.count, monitors.audio51);
    for (const g of layoutGroups.values()) g.visible = g === shown;
    const L = MONITOR_LAYOUTS[monitors.count];
    screenInstances.forEach((set, i) => {
      const on = i < L.screens.length;
      const model = on ? new Float32Array(monitorInstanceMatrix(L.screens[i], L.scale, L.z)) : null;
      for (const g of set) { g.visible = on; if (model) g.model = model; }
    });
  };
  applyMonitors();
  // Круги под решётки закрыты кусками реек, пока решёток нет.
  byName['acoustic-windows'].visible = !byName.speakers.visible;
  // Дверца ресивера на левом боку — та же опция 5.1: без неё в проёме заглушка.
  const applyReceiverDoor = (on) => {
    byName['receiver-door'].visible = on;
    byName['receiver-door-blank'].visible = !on;
  };
  applyReceiverDoor(byName.speakers.visible);
  // Пакет электрики: рамки постов, проёмы в ленте и модули Qi у каждого пакета
  // свои (sockets.js). Рамки приходят позже, поэтому видимость ставится и при загрузке.
  let electricity = 'base';
  const applyElectricity = (list) => {
    for (const g of list) if (g.packages) g.visible = g.packages.includes(electricity);
  };
  applyElectricity(groups);

  // Одна бесшовная карта ореха покрывает верх, 60-мм торцы и нижний шпон
  // столешниц Core/Bridge, включая нижнюю плоскость вокруг LED-паза.
  // Грузим её отдельно, чтобы тяжёлая 3D-карточка появилась сразу даже при медленном диске.
  const wood = new Image();
  wood.src = 'assets/textures/tabletop-walnut.png';
  wood.decode().then(() => {
    renderer.setTexture(byName.core, wood, { surfaceOnly: true });
    renderer.setTexture(byName.bridge, wood, { surfaceOnly: true });
    renderer.setTexture(byName.speakers, wood, { surfaceOnly: true });
    // Лента реек — по варианту на пакет электрики (build-model.js), шпон у всех.
    for (const g of groups.filter((g) => g.name.startsWith('acoustic'))) renderer.setTexture(g, wood, { surfaceOnly: true });
    canvas.setAttribute('data-worktop-texture', 'ready');
    invalidate();
  }).catch((error) => {
    canvas.setAttribute('data-worktop-texture', error.message);
    console.error('Столешница: текстура не добавлена в 3D-сцену:', error);
  });

  // Экокожа накладки: плитка 250 × 250 мм (развёртка toBufferData — 2900 мм на карту),
  // карта нейтрально-серая со средним 0,495, поэтому яркость возвращаем множителем.
  const leather = new Image();
  leather.src = 'assets/textures/leather-albedo.png';
  leather.decode().then(() => {
    for (const name of ['worktop-pad', 'bridge-pad'])
      renderer.setTexture(byName[name], leather, { scale: 2900 / 250, gain: 1 / 0.495 });
    canvas.setAttribute('data-leather-texture', 'ready');
    invalidate();
  }).catch((error) => {
    canvas.setAttribute('data-leather-texture', error.message);
    console.error('Накладка: текстура кожи не добавлена в 3D-сцену:', error);
  });

  // Отдельная карта наружной стенки: мелкая тёмная фактура повторяется по длине
  // фасада и по высоте, не затрагивая деревянную столешницу.
  const sidePanel = new Image();
  sidePanel.src = 'assets/textures/side-panel-charcoal.png';
  sidePanel.decode().then(() => {
    for (const group of Object.values(byName)) {
      if (group.name === 'core' || group.name === 'cavities' || group.name.startsWith('techbay-front') || group.name === 'eo-door' || group.name === 'trash-front' || group.name.startsWith('receiver-door') || (group.name.startsWith('drawer-') && !group.name.startsWith('drawer-led-')) || group.name.startsWith('config-drawers-')) {
        renderer.setSideTexture(group, sidePanel);
      }
    }
    canvas.setAttribute('data-side-texture', 'ready');
    invalidate();
  }).catch((error) => {
    canvas.setAttribute('data-side-texture', error.message);
    console.error('Наружная стенка: текстура не добавлена в 3D-сцену:', error);
  });

  // Подвижные узлы: каждый знает свою матрицу и сам сообщает, что ещё едет.
  const parts = [
    // Плита и её фурнитура едут по одной матрице; газлифт — по своим двум.
    {
      motion: createBridgeMotion(),
      group: byName.bridge,
      groups: [byName['bridge-fittings'], byName['bridge-pad']],
      extra: [
        { group: byName['bridge-strut-tube'], kind: 'tube' },
        { group: byName['bridge-strut-rod'], kind: 'rod' },
      ],
    },
    { motion: createFridgeMotion(), group: byName['fridge-door'] },
  ];
  const drawers = [];
  for (const cell of CELLS) {
    const motion = createDrawerMotion();
    // Короб и промежуточное звено направляющей ходят от одного мотора, но на разное расстояние.
    const led = byName[`drawer-led-${cell.index}`];
    // Внутреннее звено привинчено к коробу и едет с ним.
    const part = { motion, group: byName[`drawer-${cell.index}`], slide: byName[`slide-${cell.index}`], groups: [led, byName[`slide-inner-${cell.index}`]], led };
    parts.push(part);
    drawers.push(part);
  }
  // В конфигураторе фасады — один меш на вариант деления, поэтому ящики
  // выдвигаются все вместе: так показывается подсветка при открытии.
  const configDrawers = {
    motion: createDrawerMotion(),
    apply() {
      const matrix = this.motion.matrix();
      for (const group of [...configDrawerGroups, ...configDrawerLeds]) group.model = matrix;
      // Промежуточное звено телескопа проходит половину пути короба.
      const middle = this.motion.middleMatrix();
      for (const group of configMiddleSlides) group.model = middle;
    },
  };
  if (productOnly) parts.push(configDrawers);
  // Яркость подсветки идёт за выдвижением: закрытый ящик тёмный, открытый светится.
  const applyDrawerLeds = () => {
    for (const d of drawers) {
      d.led.visible = drawerLighting && !productOnly;
      d.led.emissive = drawerLighting ? d.motion.value / DRAWER_TRAVEL : 0;
    }
    for (const group of configDrawerLeds) {
      group.visible = drawerLighting && group.name === `config-drawer-led-${configuredDrawerCount}`;
      group.emissive = drawerLighting ? configDrawers.motion.value / DRAWER_TRAVEL : 0;
    }
  };
  applyDrawerLeds();
  // Источники света для рендера: у каждого выдвинутого ящика свой, в отражённой сцене.
  const toScene = ({ position, min, max }, level) => ({
    position: [SIZE - position[0], position[1], position[2]],
    min: [SIZE - max[0], min[1], min[2]],
    max: [SIZE - min[0], max[1], max[2]],
    level,
  });
  const drawerLights = () => {
    if (!drawerLighting) return [];
    if (productOnly) {
      const offset = configDrawers.motion.value;
      if (offset <= 0) return [];
      return cellsFor(configuredDrawerCount).map((cell) => toScene(drawerLightVolume(cell, offset), offset / DRAWER_TRAVEL));
    }
    return drawers.flatMap((d, i) => (d.motion.value > 0
      ? [toScene(drawerLightVolume(CELLS[i], d.motion.value), d.motion.value / DRAWER_TRAVEL)] : []));
  };
  const [bridge, fridge] = parts;
  // Tech Bay открывается только кнопкой: панели фасада уходят вверх, потом выезжает
  // поддон с ПК. Корпус ПК масштабируется от точки «низ, перед, середина».
  byName['techbay-pc-over'].visible = false;
  const pcAnchor = [SIZE - TECH_PC_ANCHOR[0], TECH_PC_ANCHOR[1], TECH_PC_ANCHOR[2]]; // сцена отражена
  const techBay = {
    motion: createTechBayMotion(),
    pcScale: [1, 1, 1],
    apply() {
      byName['techbay-front-top'].model = this.motion.topMatrix();
      byName['techbay-front-bottom'].model = this.motion.bottomMatrix();
      byName['techbay-intake'].model = this.motion.bottomMatrix();
      byName['techbay-led'].emissive = this.motion.lightLevel();
      for (const panel of ['top', 'bottom']) {
        byName[`techbay-carriage-${panel}`].model = this.motion.carriageMatrix(panel);
        byName[`techbay-strap-${panel}`].model = this.motion.strapMatrix(panel);
      }
      const tray = translation(0, this.motion.trayOffset(), 0);
      byName['techbay-tray'].model = tray;
      byName['techbay-slide'].model = this.motion.slideMatrix();
      const arm = this.motion.armMatrices();
      byName['techbay-arm-a'].model = arm.a;
      byName['techbay-arm-b'].model = arm.b;
      const pc = multiply(tray, multiply(translation(...pcAnchor), multiply(scaling(...this.pcScale), translation(...pcAnchor.map((v) => -v)))));
      byName['techbay-pc'].model = pc;
      byName['techbay-pc-over'].model = pc;
    },
  };
  parts.push(techBay);
  // Мусорный модуль в К6: фасад, рама, поддон и ведро едут вместе, промежуточные
  // звенья направляющих — на полхода, как у ящиков.
  const trash = { motion: createTrashMotion(), group: byName['trash-front'], slide: byName['trash-slide'], groups: [byName['trash-bin']] };
  parts.push(trash);
  // Свет подсветки отсека для рендера сайта — пока отсек открыт или открывается.
  const techBayLights = () => {
    const level = techBay.motion.lightLevel();
    return level > 0 ? [toScene(techBayLightVolume(), level)] : [];
  };
  let laptop = null;
  let laptopOpen = true;

  // Какая группа геометрии какой узел открывает. Всё остальное — корпус, по нему не тычут.
  const partByGroup = new Map([['bridge', bridge], ['fridge-door', fridge],
    ['trash-front', trash], ['trash-bin', trash], ['trash-slide', trash]]);
  // По фурнитуре Bridge тычут так же, как по самой плите: это один узел.
  for (const name of ['bridge-fittings', 'bridge-pad', 'bridge-strut-tube', 'bridge-strut-rod']) partByGroup.set(name, bridge);
  for (const [i, part] of drawers.entries()) {
    partByGroup.set(`drawer-${CELLS[i].index}`, part);
    partByGroup.set(`slide-${CELLS[i].index}`, part);
    partByGroup.set(`slide-inner-${CELLS[i].index}`, part);
    partByGroup.set(`drawer-led-${CELLS[i].index}`, part);
  }
  const nameOfPart = (part) => (part === bridge ? 'bridge'
    : part === fridge ? 'fridge'
      : part === trash ? 'trash'
      : part === laptop ? 'laptop'
        : `drawer-${drawers.indexOf(part)}`);
  const listeners = new Set();

  let dirty = true;
  let autoRotate = false;
  let visible = true;
  let fitted = false;
  let nearFade = false;
  let pendingHover = null;
  let hoverDirty = false;
  let ledTarget = 1;
  let ledLevel = 1;
  let padOn = false;
  let last = performance.now();
  let frame = 0;

  const invalidate = () => { dirty = true; };

  // Предметы с onPad встают на накладку, когда она включена. Крышке ноутбука
  // подъём добавляется поверх её собственного поворота.
  const onPad = (matrix) => padOn ? multiply(translation(0, 0, PAD_LIFT), matrix) : matrix;
  const placeOnPad = () => {
    const lid = laptop ? laptop.motion.matrix() : null;
    for (const group of groups)
      if (group.onPad) group.model = onPad(group.part === 'laptop-lid' && lid ? lid : identity());
  };

  // Экран — отдельный слой на крышке. При открытии он остаётся выключенным
  // полсекунды, затем загорается; при закрытии мягко гаснет до полного скрытия.
  const setLaptopScreen = (open, { initial = false } = {}) => {
    if (!laptop) return;
    laptop.screenTarget = open ? 1 : 0;
    laptop.screenDelay = open && !initial ? LAPTOP_SCREEN_ON_DELAY : 0;
    if (initial) laptop.screenLevel = open ? 1 : 0;
    for (const screen of laptop.screens) {
      screen.visible = open || laptop.screenLevel > 0.001;
      screen.screenPower = laptop.screenLevel;
    }
  };

  const updateLaptopScreen = (dt) => {
    if (!laptop) return false;
    if (laptop.screenDelay > 0) {
      laptop.screenDelay = Math.max(0, laptop.screenDelay - dt);
      return true;
    }
    if (Math.abs(laptop.screenTarget - laptop.screenLevel) < 0.001) {
      laptop.screenLevel = laptop.screenTarget;
      if (laptop.screenTarget === 0)
        for (const screen of laptop.screens) screen.visible = false;
      return false;
    }
    laptop.screenLevel += Math.sign(laptop.screenTarget - laptop.screenLevel)
      * Math.min(LAPTOP_SCREEN_FADE_SPEED * dt, Math.abs(laptop.screenTarget - laptop.screenLevel));
    for (const screen of laptop.screens) {
      screen.visible = true;
      screen.screenPower = laptop.screenLevel;
    }
    return true;
  };

  // Покупные модели грузятся отдельно от корпуса: карточка CENTRUM появляется сразу,
  // а тяжёлая техника добавляется в сцену по мере готовности, не подвешивая интерфейс.
  // Розетки — часть самого стола: без них в стенке остаются сквозные отверстия,
  // поэтому они грузятся и в конфигураторе, где реквизита нет.
  const SOCKETS = [['socket', 'Розетка', loadSocketGroups]];
  const EXTERNAL = productOnly ? SOCKETS : [
    ['monitor', 'Монитор', loadMonitorGroups],
    ['laptop', 'Ноутбук', loadLaptopGroups],
    ['headphones', 'Наушники', loadHeadphonesGroups],
    ['plant', 'Растение', loadPlantGroups],
    ['keyboard', 'Клавиатура', loadKeyboardGroups],
    ['mouse', 'Мышь', loadMouseGroups],
    ['iphone', 'iPhone', loadIphoneGroups],
    ['printer', '3D-принтер', loadPrinterGroups],
    ['mug', 'Кружка', loadMugGroups],
    ...SOCKETS,
    ['chair', 'Кресло', loadChairGroups],
  ];
  const loaded = {};
  if (productOnly) {
    loadMonitorGroups().then((incoming) => {
      const prepared = renderer.prepare(incoming);
      screenInstances = Array.from({ length: MAX_MONITORS }, (_, i) => prepared.map((g) => ({ ...g, name: `${g.name}#${i}` })));
      for (const set of screenInstances) groups.push(...set);
      applyMonitors();
      canvas.setAttribute('data-monitor', 'ready');
      invalidate();
    }).catch((error) => console.error('Монитор: модель не добавлена в 3D-сцену:', error));
  }
  for (const [key, label, load] of EXTERNAL) {
    load().then((incoming) => {
      const prepared = renderer.prepare(incoming);
      groups.push(...prepared);
      loaded[key] = prepared;
      if (prop(key)?.onPad) for (const group of prepared) group.onPad = true;
      Object.assign(byName, Object.fromEntries(prepared.map((g) => [g.name, g])));
      applyElectricity(prepared);
      if (key === 'laptop') {
        const motion = createLaptopMotion();
        motion.set(laptopOpen);
        laptop = {
          motion,
          groups: prepared.filter((g) => g.part === 'laptop-lid'),
          // У матрицы отдельная текстурированная геометрия. В закрытом состоянии
          // она скрывается целиком, чтобы обратная сторона экрана не проходила
          // сквозь тонкую алюминиевую крышку.
          screens: prepared.filter((g) => g.directTexture > 0),
          screenLevel: laptopOpen ? 1 : 0,
          screenTarget: laptopOpen ? 1 : 0,
          screenDelay: 0,
        };
        setLaptopScreen(laptopOpen, { initial: true });
        parts.push(laptop);
        // Клик по основанию, клавиатуре или экрану управляет одной крышкой.
        for (const group of prepared) partByGroup.set(group.name, laptop);
        canvas.setAttribute('data-laptop-open', String(laptop.motion.isOpen));
      }
      placeOnPad();
      canvas.setAttribute(`data-${key}`, 'ready');
      invalidate();
    }).catch((error) => {
      canvas.setAttribute(`data-${key}`, error.message);
      console.error(`${label}: модель не добавлена в 3D-сцену:`, error);
    });
  }

  // Луч из камеры через точку холста: им пользуются и выбор детали, и наезд колесом.
  function rayAt(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return null;
    return cameraRay(camera, rect.width / rect.height,
      ((clientX - rect.left) / rect.width) * 2 - 1,
      1 - ((clientY - rect.top) / rect.height) * 2);
  }

  const hitAt = (clientX, clientY) => {
    const ray = rayAt(clientX, clientY);
    if (!ray) return null;
    return pickGroup(groups, ray, { minDistance: nearFade ? fadeDistance(camera) * 0.12 : 1 });
  };

  const focus = createFocus(camera);
  // Двойной тычок в одну точку — это не «открыть дважды», а «показать поближе»:
  // первое переключение отменяется, камера подлетает к точке под курсором.
  let lastTap = null;

  const damping = attachControls(canvas, camera, invalidate, {
    // Тычок по детали открывает или закрывает её; навигация сюда не попадает.
    onTap(clientX, clientY) {
      const hit = hitAt(clientX, clientY);
      const now = performance.now();
      const isDouble = lastTap && now - lastTap.time < 320
        && Math.hypot(clientX - lastTap.x, clientY - lastTap.y) < 12;

      if (isDouble) {
        // Первое переключение откатываем, иначе фокус попутно открывал бы узел.
        if (lastTap.part) {
          lastTap.part.motion.toggle();
          if (lastTap.part === laptop) {
            setLaptopScreen(laptop.motion.isOpen);
            canvas.setAttribute('data-laptop-open', String(laptop.motion.isOpen));
          }
          for (const listener of listeners) listener(nameOfPart(lastTap.part), lastTap.part.motion.isOpen);
        }
        lastTap = null;
        if (hit) focus.to(hit.point);
        invalidate();
        return;
      }

      const part = hit ? partByGroup.get(hit.name) || null : null;
      if (part) {
        part.motion.toggle();
        if (part === laptop) {
          setLaptopScreen(laptop.motion.isOpen);
          canvas.setAttribute('data-laptop-open', String(laptop.motion.isOpen));
        }
        for (const listener of listeners) listener(nameOfPart(part), part.motion.isOpen);
        invalidate();
      }
      lastTap = { time: now, x: clientX, y: clientY, part };
    },
    // Курсор подсказывает, что деталь можно открыть. Сам расчёт откладывается
    // до кадра: движений мыши приходит больше, чем нужно проверок.
    onHover(clientX, clientY) {
      pendingHover = clientX === null ? null : { x: clientX, y: clientY };
      hoverDirty = true;
    },
    // S — кадрировать деталь под курсором, H — всю модель. Как в Cinema 4D.
    onFrame(clientX, clientY) {
      const hit = hitAt(clientX, clientY);
      if (hit) { focus.to(hit.point); invalidate(); }
    },
    onFrameAll() {
      focus.to(model.pivot, fitDistance(VIEWS.iso.distance, canvas.width / canvas.height));
      invalidate();
    },
  });

  function resize() {
    // Чуть больший supersampling особенно заметен на длинных радиусных кромках.
    const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    const width = Math.max(1, Math.round(canvas.clientWidth * dpr));
    const height = Math.max(1, Math.round(canvas.clientHeight * dpr));
    if (canvas.width !== width || canvas.height !== height) {
      renderer.resize(width, height);
      invalidate();
    }
  }

  function loop(now) {
    frame = requestAnimationFrame(loop);
    const dt = Math.min((now - last) / 1000, 0.1);
    last = now;
    if (!visible) return;

    if (autoRotate) { camera.azimuth += AUTO_SPEED * dt; invalidate(); }
    if (damping()) invalidate();
    if (focus.update(dt)) invalidate();

    if (hoverDirty) {
      hoverDirty = false;
      const hit = pendingHover ? hitAt(pendingHover.x, pendingHover.y) : null;
      canvas.classList.toggle('is-hovering-part', !!(hit && partByGroup.has(hit.name)));
    }

    for (const part of parts) {
      if (!part.motion.update(dt)) continue;
      if (part.apply) { part.apply(); invalidate(); continue; }
      const matrix = part.motion.matrix();
      if (part.group) part.group.model = matrix;
      for (const group of part.groups || []) group.model = group.onPad ? onPad(matrix) : matrix;
      for (const item of part.extra || []) item.group.model = part.motion.strut(item.kind);
      if (part.slide) part.slide.model = part.motion.middleMatrix();
      invalidate();
    }
    applyDrawerLeds();

    if (updateLaptopScreen(dt)) invalidate();

    if (Math.abs(ledTarget - ledLevel) > 0.001) {
      ledLevel += Math.sign(ledTarget - ledLevel) * Math.min(LED_FADE * dt, Math.abs(ledTarget - ledLevel));
      byName.led.visible = ledLevel > 0.01;
      byName.led.emissive = ledLevel;
      invalidate();
    }

    resize();
    if (!fitted && canvas.width > 1) {
      fitted = true;
      camera.distance = fitDistance(VIEWS.iso.distance, canvas.width / canvas.height);
      invalidate();
    }
    if (!dirty) return;

    dirty = false;
    clampCamera(camera);
    if (productOnly) {
      camera.elevation = Math.max(-0.04, Math.min(1.28, camera.elevation));
      camera.distance = Math.max(2400, Math.min(7900, camera.distance));
    }
    renderer.draw(groups, projectionMatrix(canvas.width / canvas.height || 1, camera.distance), viewMatrix(camera),
      { ledLevel, ledColor, eye: eyePosition(camera), fade: nearFade ? fadeDistance(camera) : 0,
        drawerLights: [...techBayLights(), ...drawerLights()], drawerLightColor: DRAWER_LED_COLOR });
  }
  frame = requestAnimationFrame(loop);

  // Рендер останавливается, когда карточка ушла с экрана.
  // Берём последнюю запись: пока iframe лендинга грузится, браузер может сложить
  // в одну пачку «не видно» и «видно», и по первой сцена застывала навсегда.
  const observer = new IntersectionObserver((entries) => { visible = entries[entries.length - 1].isIntersecting; invalidate(); }, { threshold: 0 });
  observer.observe(canvas);
  window.addEventListener('resize', invalidate);

  return {
    camera,
    // Готовый ракурс возвращает и точку взгляда: после полёта по сцене иначе не собраться.
    setView(name, { smooth = false } = {}) {
      const preset = VIEWS[name] || VIEWS.iso;
      if (smooth) {
        focus.toView({ ...preset, distance: fitDistance(preset.distance, canvas.width / canvas.height) }, model.pivot);
        invalidate();
        return;
      }
      focus.cancel();
      Object.assign(camera, preset);
      camera.target = (preset.target || model.pivot).slice();
      camera.distance = fitDistance(preset.distance, canvas.width / canvas.height);
      invalidate();
    },
    setBridge(open) { bridge.motion.set(open); },
    setFridge(open) { fridge.motion.set(open); },
    setTrash(open) { trash.motion.set(open); },
    setDrawer(index, open) { drawers[index]?.motion.set(open); },
    setAllDrawers(open) { for (const d of drawers) d.motion.set(open); },
    setDrawerCount(count) {
      configuredDrawerCount = Math.max(1, Math.min(9, Number(count) || 3));
      if (!productOnly) return;
      showConfigVariant();
      applyDrawerLeds();
      invalidate();
    },
    setDrawerLighting(on) { drawerLighting = Boolean(on); applyDrawerLeds(); invalidate(); },
    // Конфигуратор: выдвинуть все ящики сразу (показ подсветки).
    setConfigDrawersOpen(open) { configDrawers.motion.set(open); invalidate(); },
    setWoodTint(tint) {
      renderer.setSurfaceTint(byName.core, tint);
      renderer.setSurfaceTint(byName.bridge, tint);
      renderer.setSurfaceTint(byName.speakers, tint);
      for (const g of groups.filter((g) => g.name.startsWith('acoustic'))) renderer.setSurfaceTint(g, tint);
      invalidate();
    },
    setLedColor(color) { ledColor = color.slice(); invalidate(); },
    setLaptop(open) {
      laptopOpen = open;
      if (laptop) {
        laptop.motion.set(open);
        setLaptopScreen(open);
        canvas.setAttribute('data-laptop-open', String(laptop.motion.isOpen));
      }
      invalidate();
    },
    // Подписка на открытие деталей тычком, чтобы кнопки не расходились с моделью.
    onPartToggle(listener) { listeners.add(listener); return () => listeners.delete(listener); },
    drawerCount: drawers.length,
    setLed(on) { ledTarget = on ? 1 : 0; invalidate(); },
    setFloor(on) { byName.floor.visible = on; invalidate(); },
    setElectricity(pkg) { electricity = pkg; applyElectricity(groups); invalidate(); },
    // Открытый Tech Bay: панели фасада ушли вверх в пояс, поддон с ПК выдвинут на 400.
    setTechBayOpen(open) {
      techBay.motion.set(open);
      invalidate();
    },
    // Корпус покупателя в мм; fits — встаёт ли он. null — предельный корпус.
    setTechBayPc(size, fits = true) {
      const [w, d, h] = TECH_PC_LIMIT;
      techBay.pcScale = size ? [size[0] / w, size[1] / d, size[2] / h] : [1, 1, 1];
      byName['techbay-pc'].visible = fits;
      byName['techbay-pc-over'].visible = !fits;
      techBay.apply();
      invalidate();
    },
    // Слои схемы: { air, cables, service } — какие стрелки показать поверх модели.
    setElectricLayer(id, on) {
      const g = byName[`elec-${id}`];
      if (!g) return;
      g.visible = Boolean(on);
      invalidate();
    },
    setTechBayLayers(layers) {
      for (const id of TECH_LAYERS) byName[`techbay-${id}`].visible = Boolean(layers[id]);
      invalidate();
    },
    setSpeakers(on) {
      byName.speakers.visible = on;
      byName['acoustic-windows'].visible = !on;
      applyReceiverDoor(on);
      invalidate();
    },
    setAudioSides(on) {
      applyAudioSides(Boolean(on));
      invalidate();
    },
    setMonitors(count, audio51 = false) {
      monitors = { count, audio51 };
      applyMonitors();
      invalidate();
    },
    setWorktopPad(on) {
      byName['worktop-pad'].visible = on;
      byName['bridge-pad'].visible = on;
      padOn = on;
      placeOnPad();
      invalidate();
    },
    setNearFade(on) { nearFade = on; invalidate(); },
    // Кресло стоит ровно в отверстии и закрывает обзор внутрь, поэтому его убирают отдельно.
    setChair(on) { for (const g of loaded.chair || []) g.visible = on; invalidate(); },
    setAutoRotate(on) { autoRotate = on; invalidate(); },
    flyTo(view) {
      const target = view.target || model.pivot;
      focus.toView({ ...view, target, distance: fitDistance(view.distance, canvas.width / canvas.height) }, model.pivot);
      invalidate();
    },
    // Закрыта ли точка моделью: луч от камеры к точке упирается в грань раньше.
    // Схемные слои поверх модели не заслоняют. tolerance — точки меток стоят
    // до 120 мм внутри ниш (холодильник, ящики), их собственный фасад не в счёт.
    isOccluded(point, tolerance = 160) {
      const origin = eyePosition(camera);
      const d = point.map((v, k) => v - origin[k]);
      const length = Math.hypot(...d);
      if (length < 1) return false;
      const solid = groups.filter((g) => !g.overlay);
      const hit = pickGroup(solid, { origin, direction: d.map((v) => v / length) });
      return Boolean(hit) && hit.distance < length - tolerance;
    },
    projectPoint(point) {
      const matrix = multiply(projectionMatrix(canvas.width / canvas.height || 1, camera.distance), viewMatrix(camera));
      const x = point[0], y = point[1], z = point[2];
      const cx = matrix[0] * x + matrix[4] * y + matrix[8] * z + matrix[12];
      const cy = matrix[1] * x + matrix[5] * y + matrix[9] * z + matrix[13];
      const cw = matrix[3] * x + matrix[7] * y + matrix[11] * z + matrix[15];
      if (cw <= 0) return null;
      return { x: (cx / cw * 0.5 + 0.5) * canvas.clientWidth, y: (1 - (cy / cw * 0.5 + 0.5)) * canvas.clientHeight };
    },
    get configuredDrawerCount() { return configuredDrawerCount; },
    get autoRotate() { return autoRotate; },
    invalidate,
    destroy() { cancelAnimationFrame(frame); observer.disconnect(); },
  };
}
