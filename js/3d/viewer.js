// Вьювер: связывает модель, камеру, управление и подвижные узлы в один объект
// с понятным интерфейсом. Кадр считается только тогда, когда что-то изменилось.

import { buildModel } from './build-model.js?v=20260923-sockets';
import { createRenderer } from './renderer.js?v=20260921-03';
import { createCamera, viewMatrix, projectionMatrix, clampCamera, fitDistance, eyePosition, fadeDistance, VIEWS } from './camera.js';
import { createFocus } from './focus.js';
import { attachControls } from './controls.js';
import { cameraRay, pickGroup } from './picking.js';
import { createBridgeMotion } from './bridge-motion.js';
import { createFridgeMotion } from './fridge-motion.js';
import { createDrawerMotion } from './drawer-motion.js';
import { createLaptopMotion } from './laptop-motion.js';
import { CELLS } from './build-drawers.js';
import { loadMonitorGroups, loadLaptopGroups, loadHeadphonesGroups, loadPlantGroups, loadKeyboardGroups, loadMouseGroups, loadChairGroups, loadIphoneGroups, loadPrinterGroups, loadMugGroups, loadSocketGroups } from './load-monitor.js?v=20260923-sockets3';
import { buildConfigDrawerGroups } from './build-config-drawers.js';
import { multiply } from './mat4.js';

const AUTO_SPEED = 0.22; // рад/с при включённом автоповороте
const LED_FADE = 2.4;    // свет разгорается и гаснет за доли секунды, а не мгновенно
const LAPTOP_SCREEN_ON_DELAY = 0.5;
const LAPTOP_SCREEN_FADE_SPEED = 3.4;

export function createViewer(canvas, { productOnly = false } = {}) {
  const renderer = createRenderer(canvas);
  if (!renderer) return null;

  const model = buildModel();
  const groups = renderer.prepare(model.groups);
  const byName = Object.fromEntries(groups.map((g) => [g.name, g]));
  const camera = createCamera(model.pivot);
  let ledColor = [1, 0.72, 0.46];
  let configuredDrawerCount = 3;

  const configDrawerGroups = productOnly ? renderer.prepare(buildConfigDrawerGroups()) : [];
  if (productOnly) {
    groups.push(...configDrawerGroups);
    Object.assign(byName, Object.fromEntries(configDrawerGroups.map((g) => [g.name, g])));
    for (const group of groups) {
      if (group.name.startsWith('drawer-') || group.name.startsWith('slide-')) group.visible = false;
    }
    for (const group of configDrawerGroups) group.visible = group.name === 'config-drawers-3';
  }

  // Одна бесшовная карта ореха покрывает верх, 60-мм торцы и нижний шпон
  // столешниц Core/Bridge, включая нижнюю плоскость вокруг LED-паза.
  // Грузим её отдельно, чтобы тяжёлая 3D-карточка появилась сразу даже при медленном диске.
  const wood = new Image();
  wood.src = 'assets/textures/tabletop-walnut.png';
  wood.decode().then(() => {
    renderer.setTexture(byName.core, wood, { surfaceOnly: true });
    renderer.setTexture(byName.bridge, wood, { surfaceOnly: true });
    canvas.setAttribute('data-worktop-texture', 'ready');
    invalidate();
  }).catch((error) => {
    canvas.setAttribute('data-worktop-texture', error.message);
    console.error('Столешница: текстура не добавлена в 3D-сцену:', error);
  });

  // Отдельная карта наружной стенки: мелкая тёмная фактура повторяется по длине
  // фасада и по высоте, не затрагивая деревянную столешницу.
  const sidePanel = new Image();
  sidePanel.src = 'assets/textures/side-panel-charcoal.png';
  sidePanel.decode().then(() => {
    for (const group of Object.values(byName)) {
      if (group.name === 'core' || group.name === 'cavities' || group.name.startsWith('drawer-') || group.name.startsWith('config-drawers-')) {
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
      groups: [byName['bridge-fittings']],
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
    const part = { motion, group: byName[`drawer-${cell.index}`], slide: byName[`slide-${cell.index}`] };
    parts.push(part);
    drawers.push(part);
  }
  const [bridge, fridge] = parts;
  let laptop = null;
  let laptopOpen = true;

  // Какая группа геометрии какой узел открывает. Всё остальное — корпус, по нему не тычут.
  const partByGroup = new Map([['bridge', bridge], ['fridge-door', fridge]]);
  // По фурнитуре Bridge тычут так же, как по самой плите: это один узел.
  for (const name of ['bridge-fittings', 'bridge-strut-tube', 'bridge-strut-rod']) partByGroup.set(name, bridge);
  for (const [i, part] of drawers.entries()) {
    partByGroup.set(`drawer-${CELLS[i].index}`, part);
    partByGroup.set(`slide-${CELLS[i].index}`, part);
  }
  const nameOfPart = (part) => (part === bridge ? 'bridge'
    : part === fridge ? 'fridge'
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
  let last = performance.now();
  let frame = 0;

  const invalidate = () => { dirty = true; };

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
  const EXTERNAL = productOnly ? [] : [
    ['monitor', 'Монитор', loadMonitorGroups],
    ['laptop', 'Ноутбук', loadLaptopGroups],
    ['headphones', 'Наушники', loadHeadphonesGroups],
    ['plant', 'Растение', loadPlantGroups],
    ['keyboard', 'Клавиатура', loadKeyboardGroups],
    ['mouse', 'Мышь', loadMouseGroups],
    ['iphone', 'iPhone', loadIphoneGroups],
    ['printer', '3D-принтер', loadPrinterGroups],
    ['mug', 'Кружка', loadMugGroups],
    ['socket', 'Розетка', loadSocketGroups],
    ['chair', 'Кресло', loadChairGroups],
  ];
  const loaded = {};
  for (const [key, label, load] of EXTERNAL) {
    load().then((incoming) => {
      const prepared = renderer.prepare(incoming);
      groups.push(...prepared);
      loaded[key] = prepared;
      Object.assign(byName, Object.fromEntries(prepared.map((g) => [g.name, g])));
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
      const matrix = part.motion.matrix();
      if (part.group) part.group.model = matrix;
      for (const group of part.groups || []) group.model = matrix;
      for (const item of part.extra || []) item.group.model = part.motion.strut(item.kind);
      if (part.slide) part.slide.model = part.motion.middleMatrix();
      invalidate();
    }

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
      { ledLevel, ledColor, eye: eyePosition(camera), fade: nearFade ? fadeDistance(camera) : 0 });
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
    setDrawer(index, open) { drawers[index]?.motion.set(open); },
    setAllDrawers(open) { for (const d of drawers) d.motion.set(open); },
    setDrawerCount(count) {
      configuredDrawerCount = Math.max(1, Math.min(9, Number(count) || 3));
      if (!productOnly) return;
      for (const group of configDrawerGroups)
        group.visible = group.name === `config-drawers-${configuredDrawerCount}`;
      invalidate();
    },
    setWoodTint(tint) {
      renderer.setSurfaceTint(byName.core, tint);
      renderer.setSurfaceTint(byName.bridge, tint);
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
    setNearFade(on) { nearFade = on; invalidate(); },
    // Кресло стоит ровно в отверстии и закрывает обзор внутрь, поэтому его убирают отдельно.
    setChair(on) { for (const g of loaded.chair || []) g.visible = on; invalidate(); },
    setAutoRotate(on) { autoRotate = on; invalidate(); },
    flyTo(view) {
      const target = view.target || model.pivot;
      focus.toView({ ...view, target, distance: fitDistance(view.distance, canvas.width / canvas.height) }, model.pivot);
      invalidate();
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
