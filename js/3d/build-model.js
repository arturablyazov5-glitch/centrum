// Сборка всех частей CENTRUM в набор групп. Группа — это то, что можно отдельно
// показать, погасить или подвинуть: пол, корпус, ниши, LED, Bridge, дверь и ящики.

import { CENTER, LEVEL_1 } from './params.js';
import { createMesh, createLines, addPolyline, toBufferData } from './mesh.js';
import { clearOfEntry } from './entry-cut.js';
import { buildCore, coreEdges } from './build-core.js?v=20260925-techbay';
import { buildBridge, bridgeEdges } from './build-bridge.js';
import { buildBridgeFrame, buildBridgeFittings, buildStrutTube, buildStrutRod } from './bridge-fittings.js';
import { buildFridgeCavity, buildFridgeDoor, fridgeDoorEdges, buildFridgeUnit, buildFridgeTray, buildFridgeDry } from './build-fridge.js';
import { buildTrashCavity, buildTrashFront, trashFrontEdges, buildTrashBin, buildTrashSlideMiddle, buildTrashSlidesFixed } from './build-trash.js';
import { buildEoDoor, buildEoNiche, eoDoorEdges } from './build-eo-door.js';
import { buildNichePanels, buildEoDoorScrews } from './build-k2-service.js';
import {
  buildTechBay, buildTechBayFrontBottom, buildTechBayFrontTop, techBayFrontEdges, buildTechBayTray, buildTechBayDrive, buildTechBaySlideMiddle, buildTechBayArmA, buildTechBayArmB, buildTechBayLift, buildTechBayButton, buildTechBayCarriage, buildTechBayStrap, buildTechBayPc, buildTechBayAir, buildTechBayCables, buildTechBayService, buildTechBayIntake, buildTechBayVent, buildTechBayLed,
} from './build-techbay.js?v=20260926-vent';
import { buildTechBayShaft } from './build-techbay-shaft.js';
import { buildDrawerCarcass, buildDrawerShell, CELLS } from './build-drawers.js';
import { buildDrawer, buildDrawerLed, drawerEdges } from './build-drawer.js';
import { buildFixedSlides, buildMiddleSlide, buildInnerSlide } from './build-slides.js';
import { buildLed } from './build-led.js';
import { buildSpeakerGrilles } from './build-speakers.js';
import { buildReceiverDoor, receiverDoorEdges } from './receiver-door.js';
import { buildAcoustic, buildAcousticWindows } from './build-acoustic.js';
import { buildQi, QI_IDS } from './build-qi.js';
import { PACKAGE_IDS, qiSpots } from './sockets.js';
import { buildWorktopPad, buildBridgePad } from './build-worktop-pad.js';
import { buildRails, buildRailSlots, buildPost, buildArm } from './build-monitor-rail.js?v=20260925-real';
import { buildMicHatches, buildMicSleeve } from './build-mic-hatch.js';
import { buildRingBrackets } from './build-ring-brackets.js';
import { buildAudioCenter, buildAudioSides, buildAudioHook } from './build-audio-panels.js';
import { buildElectrics, ELEC_LAYERS } from './build-electrics.js?v=20260926-elec';
import { buildFloor, floorGrid } from './build-floor.js?v=20260908-17';
import { PALETTE, DRAWER_LED_COLOR } from './palette.js';
import { mirrorBuffers } from './mirror.js';

// Кольцевой контур рисуется по частям: отрезки внутри прохода пропускаются.
function addRingEdges(lines, ring, color) {
  for (let i = 0; i < ring.length - 1; i++) {
    const seg = [ring[i], ring[i + 1]];
    if (clearOfEntry(seg)) addPolyline(lines, seg, color);
  }
}

function group(name, build, buildLines) {
  const mesh = createMesh();
  const lines = createLines();
  build(mesh);
  if (buildLines) buildLines(lines);
  // Пол симметричен, а предметы на столе построены уже в готовой сцене —
  // отражается только сам стол.
  const mirror = name !== 'floor';
  const buffers = toBufferData(mesh);
  const edges = toBufferData(lines);
  return { name, mesh: mirror ? mirrorBuffers(buffers) : buffers, lines: mirror ? mirrorBuffers(edges) : edges };
}

const outlines = (rects, color = PALETTE.ink) => (lines) => {
  for (const rect of rects) addPolyline(lines, rect, color, true);
};

// configurable — конфигуратор: деление фасада там меняется, поэтому перегородки
// и неподвижные звенья направляющих он строит сам под каждый вариант
// (build-config-drawers.js), а в общем каркасе остаётся только корпус блока.
// detail — геометрия для Blender: кронштейны кольца в полной детализации.
export function buildModel({ configurable = false, detail = false } = {}) {
  const core = group('core', buildCore, (lines) => {
    for (const ring of coreEdges()) addRingEdges(lines, ring, PALETTE.ink);
  });

  const bridge = group('bridge', buildBridge, (lines) => {
    const { outline, bottom, handles } = bridgeEdges();
    addPolyline(lines, outline, PALETTE.ink, true);
    addPolyline(lines, bottom, PALETTE.inkSoft, true);
    for (const handle of handles) addPolyline(lines, handle, PALETTE.inkSoft, true);
  });

  // Фурнитура узла: опорный выступ и половины петель в П1 стоят на месте, проушины газлифтов
  // едут вместе с секцией, а корпус и шток газлифта — каждый по своей матрице.
  // Материалов в каждой группе несколько (чёрная краска, оцинковка, хром, POM,
  // резина), поэтому Blender получает и цвета граней.
  const bridgeFrame = { ...group('bridge-frame', buildBridgeFrame), multiMaterial: true };
  const bridgeFittings = { ...group('bridge-fittings', buildBridgeFittings), multiMaterial: true };
  const strutTube = { ...group('bridge-strut-tube', buildStrutTube), multiMaterial: true };
  const strutRod = { ...group('bridge-strut-rod', buildStrutRod), multiMaterial: true };

  const cavities = group('cavities', (mesh) => {
    buildFridgeCavity(mesh);
    buildTrashCavity(mesh);
    buildTechBay(mesh);
    if (configurable) buildDrawerShell(mesh); else buildDrawerCarcass(mesh);
  });
  // Неподвижные звенья направляющих с проставками, винтами и упорами. Сталь,
  // пластик и панель каркаса — Blender раздаёт материалы по цветам граней.
  const slidesFixed = { ...group('slides-fixed', buildFixedSlides), multiMaterial: true };

  const fridgeDoor = group('fridge-door', buildFridgeDoor, outlines(fridgeDoorEdges()));
  // Содержимое ниши (лист 08): прибор за стеклом, съёмный поддон с датчиком воды и
  // сухой электроотсек с розеткой за задней стенкой. Всё неподвижно; прибор —
  // своя группа, его контур условный. Материалы — по цветам граней.
  const fridgeUnit = { ...group('fridge-unit', buildFridgeUnit), multiMaterial: true };
  const fridgeTray = { ...group('fridge-tray', buildFridgeTray), multiMaterial: true };
  const fridgeDry = { ...group('fridge-dry', buildFridgeDry), multiMaterial: true };
  // Мусорный модуль в К6 (build-trash.js): фасад — лак, как у ящиков; рама, поддон,
  // ведро и внутренние звенья едут с ним, промежуточные звенья — на полхода.
  // Сталь, пластик и порошок — Blender раздаёт материалы по цветам граней.
  const trashFront = group('trash-front', buildTrashFront, outlines(trashFrontEdges()));
  const trashBin = { ...group('trash-bin', buildTrashBin), multiMaterial: true };
  const trashSlide = { ...group('trash-slide', buildTrashSlideMiddle), multiMaterial: true };
  const trashSlidesFixed = { ...group('trash-slides-fixed', buildTrashSlidesFixed), multiMaterial: true };
  // Дверца ЭО (лист 16) на передней грани К2: глухая, со щелями сверху и снизу;
  // открывание, петли и замок не заданы. За ней — тёмная ниша проёма.
  const eoDoor = group('eo-door', buildEoDoor, outlines(eoDoorEdges()));
  const eoNiche = { ...group('eo-niche', buildEoNiche), multiMaterial: true };
  // Сервисный доступ К2 (лист 35): панели в стенке ниши у стыков К1|К2 и К2|К3 —
  // шов и винты М4 (панель вровень со стенкой и того же цвета), винты дверцы ЭО.
  const k2Service = { ...group('k2-service', (mesh) => { buildNichePanels(mesh); buildEoDoorScrews(mesh); }), multiMaterial: true };
  // Tech Bay: фасад из двух панелей уходит вверх в пояс, поддон с ПК выезжает.
  // В сцене Blender это отдельные объекты: кадр «Tech Bay» снимает отсек открытым.
  const techBayFront = ['bottom', 'top'].map((panel) =>
    group(`techbay-front-${panel}`, panel === 'bottom' ? buildTechBayFrontBottom : buildTechBayFrontTop, outlines(techBayFrontEdges(panel)())));
  // Вентиляция: решётка с кассетой фильтра едет с нижней панелью; плениум,
  // переходник и жалюзи выброса стоят на месте. Материалов несколько — чёрный
  // алюминий, сталь, войлок, фильтр, резина.
  const techBayIntake = { ...group('techbay-intake', buildTechBayIntake), multiMaterial: true };
  const techBayVent = { ...group('techbay-vent', buildTechBayVent), multiMaterial: true };
  // Подсветка отсека светится, пока отсек открыт (viewer.js, techBay.apply).
  const techBayLed = { ...group('techbay-led', buildTechBayLed), emissive: 0, emissiveColor: DRAWER_LED_COLOR, castShadow: false, multiMaterial: true };
  const techBayTray = { ...group('techbay-tray', buildTechBayTray), multiMaterial: true };
  // Механизм поддона: неподвижные звенья направляющих и привод, среднее звено
  // (половина хода) и два звена кабельного рычага — у каждого своя матрица.
  // Подъём фасада: рейки, вал и мотор неподвижны, каретки и ленты — по панели.
  const techBayMechanism = [['drive', buildTechBayDrive], ['slide', buildTechBaySlideMiddle], ['arm-a', buildTechBayArmA], ['arm-b', buildTechBayArmB],
    ['lift', buildTechBayLift], ['button', buildTechBayButton], ...['top', 'bottom'].flatMap((p) => [[`carriage-${p}`, buildTechBayCarriage(p)], [`strap-${p}`, buildTechBayStrap(p)]])]
    .map(([id, build]) => ({ ...group(`techbay-${id}`, build), multiMaterial: true }));
  // Шахта за задней стенкой отсека: гребёнка запаса кабелей мониторов (лист 48) и
  // блок розеток на 6 мест (лист 16). Не видна даже при открытом отсеке, не движется.
  const techBayShaft = { ...group('techbay-shaft', buildTechBayShaft), multiMaterial: true };
  // Корпус ПК меняет размер под введённый покупателем; не встающий — красный.
  // В Blender едет предельный корпус.
  const techBayPc = { ...group('techbay-pc', buildTechBayPc(PALETTE.device, PALETTE.bezel)), multiMaterial: true };
  const techBayPcOver = { ...group('techbay-pc-over', buildTechBayPc(PALETTE.techOver, PALETTE.techOverFace)), siteOnly: true };
  // Схема трёх трактов (лист 10): стрелки чистым цветом поверх модели, по слою на тракт.
  const techBayLayers = [['air', buildTechBayAir], ['cables', buildTechBayCables], ['service', buildTechBayService]]
    .map(([id, build]) => ({ ...group(`techbay-${id}`, build), siteOnly: true, flat: true, overlay: true, castShadow: false }));

  // Каждый ящик сетки — отдельная подвижная группа, но геометрия у всех одна и та же.
  const drawers = [];
  const slides = [];
  const innerSlides = [];
  // Подсветка ящиков — опция: профиль в каждом коробе, свою группу он получает,
  // чтобы ехать с ящиком и светиться, только пока тот выдвинут (viewer.js).
  const drawerLeds = [];
  for (const cell of CELLS) {
    drawers.push(group(`drawer-${cell.index}`, (mesh) => buildDrawer(mesh, cell), outlines(drawerEdges(cell))));
    // Промежуточное звено идёт на полхода, внутреннее — с коробом на весь ход.
    slides.push({ ...group(`slide-${cell.index}`, (mesh) => buildMiddleSlide(mesh, cell)), multiMaterial: true });
    innerSlides.push({ ...group(`slide-inner-${cell.index}`, (mesh) => buildInnerSlide(mesh, cell)), multiMaterial: true });
    drawerLeds.push({ ...group(`drawer-led-${cell.index}`, (mesh) => buildDrawerLed(mesh, cell)),
      emissive: 0, emissiveColor: DRAWER_LED_COLOR, castShadow: false, multiMaterial: true });
  }

  // Та же единственная лента из паза: она светится сама и освещает рабочую
  // зону, но новой геометрии или второй ветви здесь не появляется.
  const led = { ...group('led', buildLed), emissive: 1, castShadow: false };
  // Пол только принимает тени. Все остальные текущие и будущие группы получают
  // castShadow=true автоматически в renderer.prepare().
  const floor = { ...group('floor', buildFloor, floorGrid), castShadow: false };
  // Решётки 5.1: опция, поэтому отдельная группа — конфигуратор включает её вместе с опцией.
  const speakers = group('speakers', buildSpeakerGrilles);
  // Дверца ресивера на левом боку (receiver-door.js) — та же опция 5.1: с ней
  // перфорированная панель, без неё в том же проёме глухая заглушка. Опция 5.1 —
  // не пакет электрики, поэтому не packages, а option: включает setSpeakers (viewer.js).
  const receiverDoor = { ...group('receiver-door', buildReceiverDoor(true), outlines(receiverDoorEdges())), option: 'audio51' };
  const receiverDoorBlank = { ...group('receiver-door-blank', buildReceiverDoor(false), outlines(receiverDoorEdges())), option: '!audio51' };
  // Акустическая лента реек — в базе, в рейках пять кругов Ø186 под решётки.
  // Куски реек внутри кругов — отдельная группа: с опцией 5.1 она гаснет,
  // и в кругах видны решётки. В группе два
  // материала — шпон реек и войлок, поэтому Blender раздаёт их по цвету граней.
  // Проёмы в ленте под рамки электрики у каждого пакета свои: лента — три
  // варианта, конфигуратор и Blender показывают один.
  const acoustic = { ...group('acoustic', (mesh) => buildAcoustic(mesh, 'base')), multiMaterial: true, packages: ['base'] };
  const acousticVariants = ['advanced', 'max'].map((pkg) => ({
    ...group(`acoustic-${pkg}`, (mesh) => buildAcoustic(mesh, pkg)), multiMaterial: true, packages: [pkg],
  }));
  // Модули Qi — по группе на место (sockets.js). Два материала: стекло и обод.
  const qi = QI_IDS.map((id) => ({
    ...group(`qi-${id}`, buildQi(id)), multiMaterial: true,
    packages: PACKAGE_IDS.filter((pkg) => qiSpots(pkg).some((q) => q.id === id)),
  }));
  const acousticWindows = { ...group('acoustic-windows', buildAcousticWindows), multiMaterial: true };
  // Рабочая накладка — опция: конфигуратор включает обе детали вместе с ней.
  // Деталь на Bridge — отдельная группа, потому что поднимается вместе с секцией.
  // Кожа и строчка — два материала, Blender раздаёт их по цвету граней.
  const worktopPad = { ...group('worktop-pad', buildWorktopPad), multiMaterial: true };
  const bridgePad = { ...group('bridge-pad', buildBridgePad), multiMaterial: true };

  // Кольцевая шина и стойки под мониторы (build-monitor-rail.js, листы 44–48).
  // В базе шины и одна стойка с рукой на оси экрана — её и снимает Blender;
  // рука, стойка и кабели — отдельные детали, у них разные материалы.
  // Раскладки на 1…5 экранов конфигуратор строит сам, по запросу (viewer.js):
  // пять вариантов сразу — это миллионы вершин.
  const monitorRail = group('monitor-rail', buildRails);
  const monitorRailSlot = group('monitor-rail-slot', buildRailSlots);
  const monitorPost = group('monitor-post', (mesh) => buildPost(mesh, 0));
  const monitorArm = group('monitor-arm', (mesh) => buildArm(mesh, null, 0));
  const monitorCables = group('monitor-cables', (mesh) => buildArm(createMesh(), mesh, 0));

  // Люки под штангу микрофона (mic-hatch.js, лист 51): графитовые фланцы, крышки и
  // стальные кольца в выборках снизу — в каждом столе; зазоры, выемки под палец,
  // стенки выборок и отверстий — тёмные, отдельной деталью.
  const micHatch = group('mic-hatch', (mesh) => buildMicHatches(mesh, createMesh()));
  const micHatchGap = group('mic-hatch-gap', (mesh) => buildMicHatches(createMesh(), mesh));
  // Кабель от люков идёт закладной трубой в сотах кольца (mic-hatch.js) и гильзой
  // вниз в Tech Bay. Снаружи не видно ничего; в модели — только гильза, а вся
  // трасса — в схеме «Данные».
  const micChannel = group('mic-channel', buildMicSleeve);

  // Кронштейны рабочего кольца (узел У4, листы 06 и 34): 21 косынка на стенке
  // ниши R1050, винты DIN 912 с шайбами — видны только из ниши для ног.
  const ringBrackets = { ...group('ring-brackets', (mesh) => buildRingBrackets(mesh, { detail })), multiMaterial: true };

  // Панели для наушников (build-audio-panels.js, docs/headphones): карманы снизу
  // кромки есть в каждом столе. Центральная панель с гнёздами — в базе; боковые —
  // опция, без неё в боковых карманах глухие вставки. Крючок — в базе, сложен.
  // Материалов несколько (алюминий, сталь, позолота, пластик, гравировка) —
  // Blender раздаёт их по цвету граней.
  const audioCenter = { ...group('audio-center', buildAudioCenter), multiMaterial: true };
  const audioSides = { ...group('audio-sides', buildAudioSides(true)), multiMaterial: true };
  const audioSidesBlank = { ...group('audio-sides-blank', buildAudioSides(false)), multiMaterial: true };
  const audioHook = { ...group('audio-hook', (mesh) => buildAudioHook(mesh)), multiMaterial: true };

  // Электрика целиком (electrics.js, листы 12, 16, 50): рентген поверх корпуса,
  // по слою на систему. Только сайт: в Blender схема не едет.
  const electrics = ELEC_LAYERS.map(({ id }) => ({
    ...group(`elec-${id}`, buildElectrics(id)), siteOnly: true, flat: true, overlay: true, xray: true, castShadow: false,
  }));

  return {
    // Центр вращения: середина пятна чуть выше пола — так модель целиком попадает в кадр.
    pivot: [CENTER, CENTER, LEVEL_1 * 0.3],
    groups: [floor, core, cavities, led, speakers, receiverDoor, receiverDoorBlank, acoustic, ...acousticVariants, ...qi, acousticWindows, worktopPad, ...(configurable ? [] : [slidesFixed]), ...slides, ...innerSlides, ...drawers, ...drawerLeds, fridgeDoor, fridgeUnit, fridgeTray, fridgeDry, trashFront, trashBin, trashSlide, trashSlidesFixed, eoDoor, eoNiche, k2Service, ...techBayFront, techBayIntake, techBayVent, techBayLed, techBayTray, ...techBayMechanism, techBayShaft, techBayPc, techBayPcOver,
      bridgeFrame, bridge, bridgePad, bridgeFittings, strutTube, strutRod, ...techBayLayers,
      monitorRail, monitorRailSlot, monitorPost, monitorArm, monitorCables, micHatch, micHatchGap, micChannel, ringBrackets,
      audioCenter, audioSides, audioSidesBlank, audioHook, ...electrics],
  };
}
