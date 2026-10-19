import { SIZE, TECH_PC, TECH_TRAY_TRAVEL, techPcMax } from './3d/params.js';

export const CENTRUM_CONFIG = Object.freeze({
  model: {
    id: 'centrum',
    name: 'CENTRUM',
    basePrice: 589000,
    depositPercent: 50,
  },
  dimensions: { width: SIZE, depth: SIZE },
  categories: [
    { id: 'finish', number: '01', name: 'Отделка', description: 'Выберите характер натуральной деревянной поверхности. Корпус всегда остается матово-черным.' },
    { id: 'storage', number: '02', name: 'Хранение', description: 'Фасады равномерно занимают всю фиксированную зону хранения без пустых ячеек.' },
    { id: 'electricity', number: '03', name: 'Электрика', description: 'Готовые пакеты питания для техники, зарядки и повседневных устройств.' },
    { id: 'lighting', number: '04', name: 'Свет', description: 'Температура встроенной LED-линии меняет свет внутри рабочего пространства.' },
    { id: 'techBay', number: '05', name: 'Tech Bay', description: 'Подготовленная ниша для скрытой установки компьютера клиента.' },
    { id: 'audio', number: '06', name: 'Акустика', description: 'Акустические панели и панель для наушников под кромкой уже в базе. Объёмный звук 5.1 и боковые панели для наушников — по желанию.' },
    { id: 'monitor', number: '07', name: 'Монитор', description: 'Стойка с рукой для одного экрана уже в базе. Для второго и следующих экранов, до четырёх, добавьте стойки. Сами мониторы приобретаются отдельно.' },
    { id: 'worktopPad', number: '08', name: 'Накладка', description: 'Комфортная опора для рук по всей форме рабочей поверхности.' },
    { id: 'summary', number: '09', name: 'Итог', description: 'Проверьте собранную конфигурацию и сохраните ссылку.' },
  ],
  wood: {
    walnut: { name: 'Орех', description: 'Теплый натуральный оттенок', price: 0, materialKey: 'walnut', tint: [1, 1, 1], swatch: '#79513a' },
    darkWalnut: { name: 'Темный орех', description: 'Глубокий темный оттенок дерева', price: 9000, materialKey: 'dark-walnut', tint: [0.52, 0.38, 0.29], swatch: '#3f2c24' },
    naturalOak: { name: 'Натуральный дуб', description: 'Светлая натуральная текстура', price: -1000, materialKey: 'natural-oak', tint: [1.16, 1.04, 0.78], swatch: '#b99568' },
    blackOak: { name: 'Черный дуб', description: 'Темная графичная текстура', price: 7000, materialKey: 'black-oak', tint: [0.28, 0.29, 0.28], swatch: '#272625' },
  },
  // Ящики — прямые затраты рассчитываются из деталей/раскладки в drawer-costing.js.
  // Ставки и границы оценки с источниками описаны в docs/drawers/price-policy.md.
  drawers: {
    min: 1,
    max: 9,
    included: 3,
    targetMarginPerAddedDrawer: 2500,
    costing: {
      bodySheet: { thicknessMm: 16, sheetPrice: 4945, sheetAreaM2: 5.796 },
      facadeSheet: { thicknessMm: 18, sheetPrice: 3650, sheetAreaM2: 5.796 },
      cuttingPerMeter: { 16: 30, 18: 35 },
      edgeTapePerMeter: 31.84,
      edgeBandingPerMeter: 35,
      curvedMillingPerFacade: 200,
      curvedEdgebandingPerFacade: 200,
      drillPerHole: 11,
      modeledRailHolesPerDrawer: 10,
      softCloseRailSetPrice: 622.11,
      assemblyPerDrawer: 340,
    },
  },
  electricity: {
    base: { name: 'BASE', price: 0, sockets220: 4, usbC: 2, usbA: 2, qi: 1 },
    advanced: { name: 'ADVANCED', price: 16000, sockets220: 6, usbC: 4, usbA: 2, qi: 2 },
    max: { name: 'MAX', price: 26000, sockets220: 8, usbC: 6, usbA: 4, qi: 3 },
  },
  lighting: {
    warm: { name: 'Теплый', temperature: 3000, price: 0, color: [1, 0.64, 0.35], swatch: '#f5b36b' },
    neutral: { name: 'Нейтральный', temperature: 4000, price: 0, color: [1, 0.82, 0.62], swatch: '#f3d8b2' },
    cold: { name: 'Холодный', temperature: 6000, price: 0, color: [0.72, 0.84, 1], swatch: '#c5dcff' },
    rgb: { name: 'RGB', temperature: null, price: 10000, color: [0.58, 0.68, 1], swatch: '#899ef0' },
    drawerLighting: {
      name: 'Подсветка ящиков',
      description: 'Свет включается при открытии; доплата зависит от числа ящиков',
      estimated: true,
      pricing: {
        // Розничные ставки по источникам из docs/drawer-lighting/price-policy.md.
        ledTapePerMeter: 728.67,
        aluminumProfilePerMeter: 495.20,
        opalDiffuserPerMeter: 264.10,
        endCapSetPerProfile: 288.86,
        openingSensorPerDrawer: 505,
        flexibleWirePerMeter: 23.76,
        movingLeadSlackMm: 100,
        targetMarkup: 2000,
        priceRounding: 100,
      },
    },
  },
  audio: {
    acousticTreatmentIncluded: true,
    // Диапазон себестоимости 140–200 тыс. ₽: цена 145 тыс. держит наценку
    // не выше 5 тыс. ₽ даже по нижней оценке затрат.
    audio51: { name: 'Объёмный звук 5.1', description: 'Пять динамиков в стенке, сабвуфер и ресивер. Подключаем и настраиваем на месте', price: 145000 },
    // Панели для наушников — docs/headphones, js/3d/audio-panels.js. Центральная
    // под клавиатурой в базе; левая и правая у бёдер — опция, парой: для работы
    // у боковых станций. Карманы и канал есть в каждом столе, панели ставятся и потом.
    // По текущей оценке себестоимость пары с хабом — около 11 000 ₽;
    // цена 12 000 ₽ оставляет около 1 000 ₽ наценки.
    headphoneSides: { name: 'Боковые панели для наушников', description: 'Ещё две панели — у левого и у правого бедра: USB-C, 3,5 мм и USB-A. Повернулись к боковой станции — подключились рядом', price: 12000 },
  },
  // Кольцевая шина и стойки — docs/monitor-mount. Шины и одна стойка с рукой
  // и кабелями в базе; остальные — поштучно, до четырёх (раскладки —
  // build-monitor-rail.js). Кабели каждой стойки — в своей дорожке, лист 48.
  // Себестоимость следующей стойки ~34 000 ₽ пока не подтверждена сметой.
  // Цена 39 000 ₽ даёт наценку ≤5 000 ₽ только если эту оценку подтвердит цех.
  monitor: {
    monitorIncluded: false,
    included: 1,
    max: 4,
    post: { name: 'Стойка с рукой', description: 'Для каждого следующего экрана. Рука на газлифте, видеокабель и питание в комплекте, монтажник прокладывает их за один визит', price: 39000 },
  },
  worktopPad: { name: 'Рабочая накладка', description: 'Вся неподвижная поверхность и отдельная деталь на Bridge. Экокожа с упругой подложкой, держится на скрытых магнитах; состав согласуем перед изготовлением. Предварительная цена комплекта.', price: 28600, estimated: true },
  baseIncluded: [
    `Конструкция ${SIZE} × ${SIZE} мм`, 'Bridge', 'Шина и стойка с рукой под монитор', 'Холодильник', 'Tech Bay', 'Мусорный модуль',
    'Базовая система хранения', 'Кабель-менеджмент', 'Вентиляция', 'Dock', 'Qi', 'LED',
    'Акустическая обработка', 'Панель для наушников', 'Матовый черный корпус',
  ],
  // Tech Bay — листы 09–11. Габарит ПК берётся из params.js, чтобы панель
  // и 3D-модель не расходились; тепло, шум и масса — расчёт на виде 11.
  techBay: {
    pc: { width: TECH_PC[0], depth: TECH_PC[1], height: TECH_PC[2] },
    // Больше этого в нишу не встать физически, даже без зазоров (params.js).
    pcMax: techPcMax,
    // Панели для наушников пассивные: распределитель в Tech Bay берёт звук и USB
    // с разъёмов передней панели на плате (docs/headphones, решение 28.09.2026).
    board: 'нужны свободные разъёмы передней панели на плате ПК',
    heatW: 300,
    airflow: 25,
    noiseIdle: 30,
    noiseLoad: 35,
    massKg: 15,
    trayTravel: TECH_TRAY_TRAVEL,
    trayLoadKg: 45,
    layers: [
      { id: 'air', name: 'Воздух', icon: 'wind', detail: 'Приток через фильтр в фасаде, подъём по зазорам, тихая вытяжка из трёх вентиляторов и выброс через решётку сбоку' },
      { id: 'cables', name: 'Кабели', icon: 'cable', detail: 'От ПК — по складному рычагу за поддоном, дальше своя шахта: питание и данные раздельно, лоток к Dock' },
      { id: 'service', name: 'Сервис', icon: 'wrench', detail: 'Кнопка на фасаде рядом с отсеком: панели уходят вверх в стол, поддон с мотором выезжает на 400 мм' },
    ],
  },
  preorder: { endpoint: '', method: 'POST' },
});

export const DEFAULT_CONFIGURATION = Object.freeze({
  model: CENTRUM_CONFIG.model.id,
  wood: 'walnut',
  drawers: CENTRUM_CONFIG.drawers.included,
  electricity: 'base',
  ledTemperature: 'neutral',
  drawerLighting: false,
  audio51: false,
  headphoneSides: false,
  monitors: CENTRUM_CONFIG.monitor.included,
  worktopPad: false,
  // Цвет для сценария RGB: любой, задаётся палитрой на шаге «Свет».
  ledRgb: '#899ef0',
});
