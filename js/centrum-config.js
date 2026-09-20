export const CENTRUM_CONFIG = Object.freeze({
  model: {
    id: 'centrum-v1',
    name: 'CENTRUM V1',
    basePrice: 589000,
    depositPercent: 50,
  },
  dimensions: { width: 2900, depth: 2900 },
  categories: [
    { id: 'finish', number: '01', name: 'Отделка', description: 'Выберите характер натуральной деревянной поверхности. Корпус всегда остается матово-черным.' },
    { id: 'storage', number: '02', name: 'Хранение', description: 'Фасады равномерно занимают всю фиксированную зону хранения без пустых ячеек.' },
    { id: 'electricity', number: '03', name: 'Электрика', description: 'Готовые пакеты питания для техники, зарядки и повседневных устройств.' },
    { id: 'lighting', number: '04', name: 'Свет', description: 'Температура встроенной LED-линии меняет свет внутри рабочего пространства.' },
    { id: 'techBay', number: '05', name: 'Tech Bay', description: 'Подготовленная ниша для скрытой установки компьютера клиента.' },
    { id: 'audio', number: '06', name: 'Акустика', description: 'Акустическая обработка входит в базу. Система 5.1 устанавливается скрыто.' },
    { id: 'monitor', number: '07', name: 'Монитор', description: 'Добавьте интегрированный кронштейн. Сам монитор приобретается отдельно.' },
    { id: 'summary', number: '08', name: 'Итог', description: 'Проверьте собранную конфигурацию и сохраните ссылку.' },
  ],
  wood: {
    walnut: { name: 'Орех', description: 'Теплый натуральный оттенок', price: 0, materialKey: 'walnut', tint: [1, 1, 1], swatch: '#79513a' },
    darkWalnut: { name: 'Темный орех', description: 'Глубокий темный оттенок дерева', price: 15000, materialKey: 'dark-walnut', tint: [0.52, 0.38, 0.29], swatch: '#3f2c24' },
    naturalOak: { name: 'Натуральный дуб', description: 'Светлая натуральная текстура', price: 12000, materialKey: 'natural-oak', tint: [1.16, 1.04, 0.78], swatch: '#b99568' },
    blackOak: { name: 'Черный дуб', description: 'Темная графичная текстура', price: 18000, materialKey: 'black-oak', tint: [0.28, 0.29, 0.28], swatch: '#272625' },
  },
  drawers: { min: 1, max: 9, included: 3, additionalDrawerPrice: 7000 },
  electricity: {
    base: { name: 'BASE', price: 0, sockets220: 4, usbC: 2, usbA: 2, qi: 1 },
    advanced: { name: 'ADVANCED', price: 24000, sockets220: 6, usbC: 4, usbA: 2, qi: 2 },
    max: { name: 'MAX', price: 42000, sockets220: 8, usbC: 6, usbA: 4, qi: 3 },
  },
  lighting: {
    warm: { name: 'Теплый', temperature: 3000, price: 0, color: [1, 0.64, 0.35], swatch: '#f5b36b' },
    neutral: { name: 'Нейтральный', temperature: 4000, price: 0, color: [1, 0.82, 0.62], swatch: '#f3d8b2' },
    cold: { name: 'Холодный', temperature: 6000, price: 0, color: [0.72, 0.84, 1], swatch: '#c5dcff' },
    rgb: { name: 'RGB', temperature: null, price: 18000, color: [0.58, 0.68, 1], swatch: '#899ef0' },
    drawerLighting: { name: 'Подсветка ящиков', description: 'Мягкий свет включается при открытии', price: 14000 },
  },
  audio: {
    acousticTreatmentIncluded: true,
    audio51: { name: 'Встроенная акустика 5.1', description: 'Пять скрытых каналов и сабвуфер без видимой техники', price: 79000 },
  },
  monitor: {
    monitorIncluded: false,
    arm: { name: 'Кронштейн для монитора', description: 'Скрытое крепление и кабельный маршрут', price: 22000 },
  },
  baseIncluded: [
    'Конструкция 2900 × 2900 мм', 'Bridge', 'Холодильник', 'Tech Bay', 'Мусорный модуль',
    'Базовая система хранения', 'Кабель-менеджмент', 'Вентиляция', 'Dock', 'Qi', 'LED',
    'Акустическая обработка', 'Матовый черный корпус',
  ],
  techBay: [
    { name: 'Вентиляция', detail: 'Раздельные приточный и вытяжной тракты' },
    { name: 'Кабельные трассы', detail: 'Питание и сигнальные линии скрыты в корпусе' },
    { name: 'Сервисный доступ', detail: 'Обслуживание без демонтажа рабочей поверхности' },
    { name: 'Компьютер клиента', detail: 'Устанавливается скрыто и не входит в комплект' },
  ],
  preorder: { endpoint: '', method: 'POST' },
  contact: { telegram: 'mansurov_rafael' },
});

export const DEFAULT_CONFIGURATION = Object.freeze({
  model: CENTRUM_CONFIG.model.id,
  wood: 'walnut',
  drawers: CENTRUM_CONFIG.drawers.included,
  electricity: 'base',
  ledTemperature: 'neutral',
  drawerLighting: false,
  audio51: false,
  monitorArm: false,
});
