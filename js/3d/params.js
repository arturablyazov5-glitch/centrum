// Размеры CENTRUM в миллиметрах. Единственный источник чисел для 3D-модели:
// значения совпадают с чертежами (виды 01–04) и с аксонометрией в centrum.js.
// Система координат: X — ширина, Y — глубина (0 = перед пользователем, 2900 = вход),
// Z — высота от пола. Центр отверстия — (1450, 1450).

export const SIZE = 2900;            // наружный габарит по обеим осям
export const CENTER = SIZE / 2;      // 1450 — центр отверстия и всего пятна
export const CORNER_R = 200;         // скругление углов наружного контура

export const R_HOLE = 600;           // кромка центрального отверстия Ø1200
export const R_BELT_LOW = 1150;      // внутренняя грань пояса ниже первого уровня (пояс 300)
export const R_BELT_HIGH = 1250;     // внутренняя грань пояса выше первого уровня (пояс 200)
export const R_LIP = 1190;           // внутренняя кромка выступа 60 с пазом LED

export const LEVEL_1 = 820;          // верх первого уровня (рабочая поверхность)
export const LEVEL_2 = 1270;         // верх второго уровня
export const TOP_THICK = 60;         // толщина столешницы
export const UNDER_1 = LEVEL_1 - TOP_THICK; // 760 — низ столешницы первого уровня

// Скругление внутренней кромки отверстия — единственной кромки, через которую
// предплечья лежат весь рабочий день. ANSI/HFES 100 требует минимум R2, но такой
// радиус не распределяет давление, а лишь снимает порез: клинические разборы
// контактного напряжения называют достаточным от R6. Взято 8 — середина рабочего
// диапазона и ходовой радиус фрезы. Кромка облицовывается не шпоном, а накладным
// бруском: шпон на валу R8 вскрывается по пласти.
export const EDGE_R = 8;
export const EDGE_SEG = 4;           // разбиение четверти вала по дуге

export const RISE = LEVEL_2 - LEVEL_1;      // 450 — перепад уровней
export const TRANS_FAR = 2300;       // конец перехода со стороны входа
export const TRANS_LEN = 600;        // длина участка перехода (1700…2300)

export const ENTRY_W = 800;          // ширина прохода
export const ENTRY_X0 = CENTER - ENTRY_W / 2; // 1050 — ось петли Bridge
export const ENTRY_X1 = CENTER + ENTRY_W / 2; // 1850 — опорный выступ
export const ENTRY_Y = CENTER;       // проход вырезан только в задней половине

export const BRIDGE_OPEN_DEG = 100;  // упор подъёмной секции

// Подъёмная секция и её фурнитура — листы 20–23. Секция 793 × 1003 × 60:
// в проём 800 она встаёт с зазором 3 у петли и 4 у опорного выступа.
export const BRIDGE_GAP_HINGE = 3;   // зазор у петли, задан в закрытом положении
export const BRIDGE_GAP_LEDGE = 4;   // зазор по кромке опорного выступа
export const LEAF_X0 = ENTRY_X0 + BRIDGE_GAP_HINGE; // 1053 — кромка секции у петли
export const LEAF_X1 = ENTRY_X1 - BRIDGE_GAP_LEDGE; // 1846 — свободный конец секции

// Модуль холодильника занимает угол. Остальная длина этого фасада отдана
// запланированной сетке 3 × 3: девять одинаковых ящиков на участке 1800.
export const PLINTH = 89;
export const FRIDGE_MODULE_Y = [220, 820];
export const FRIDGE_Y = [270, 770];
export const FRIDGE_DEPTH = 460;
export const FRIDGE_HEIGHT = 639;
export const DRAWERS_Y = [850, 2650];

export const SEGMENTS = 128;         // разбиение окружностей по углу

// Плавный подъём столешницы от первого уровня ко второму (smoothstep, как на виде 04).
export function rise(y) {
  const t = Math.max(0, Math.min(1, (TRANS_FAR - y) / TRANS_LEN));
  return RISE * t * t * (3 - 2 * t);
}

// Отметка верха корпуса в точке с глубиной y.
export const topAt = (y) => LEVEL_1 + rise(y);

// Отметка низа столешницы (верхнего выступа) в точке с глубиной y.
export const underAt = (y) => topAt(y) - TOP_THICK;

// Есть ли в этом месте второй уровень: ниже допуска считаем зону плоской.
export const isHighZone = (y) => rise(y) > 1;

// Радиус наружного контура под заданным углом: скруглённый квадрат 2900 с R200.
export function boundaryRadius(a) {
  const dx = Math.cos(a), dy = Math.sin(a);
  const half = CENTER - CORNER_R; // 1250
  let lo = 0, hi = 2200;
  for (let i = 0; i < 30; i++) {
    const r = (lo + hi) / 2;
    const d = Math.hypot(Math.max(Math.abs(r * dx) - half, 0), Math.max(Math.abs(r * dy) - half, 0));
    if (d <= CORNER_R) lo = r; else hi = r;
  }
  return lo;
}

// Точка наружного контура под заданным углом.
export const boundaryPoint = (a) => [CENTER + boundaryRadius(a) * Math.cos(a), CENTER + boundaryRadius(a) * Math.sin(a)];

// Точка окружности радиуса r под заданным углом.
export const ringPoint = (a, r) => [CENTER + r * Math.cos(a), CENTER + r * Math.sin(a)];

// Свес верхней столешницы повторяет долю подъёма: 60 мм на отметке 1270,
// плавно уменьшается на переходе и равен 0 на рабочем уровне 820.
// У самого нуля свес гасим: иначе на стыке сегментов кольца (buildCore) свес
// на одном конце сегмента ещё доли мм, а на другом уже 0 — получается игольчатый
// почти вырожденный четырёхугольник (perimeter²/area в тысячи), который в рендере
// читается как гребёнка тонких плавников на кромке столешницы. 2 мм — на порядок
// меньше любого видимого допуска (ср. BRIDGE_GAP_* ниже), поэтому срез незаметен.
const LIP_OVERHANG_EPS = 2; // мм
export function lipOverhang(a) {
  const belt = ringPoint(a, R_BELT_HIGH);
  const value = (R_BELT_HIGH - R_LIP) * (rise(belt[1]) / RISE);
  return value < LIP_OVERHANG_EPS ? 0 : value;
}

export const lipPoint = (a) => ringPoint(a, R_BELT_HIGH - lipOverhang(a));

// Глубина y, на которой окружность радиуса r пересекает вертикаль x (задняя половина).
export const arcY = (x, r) => CENTER + Math.sqrt(Math.max(0, r * r - (x - CENTER) ** 2));

// Начало подъёмной секции по глубине: кромка отверстия у торца прохода (≈1897).
// Длина секции отсюда до наружного габарита — те самые 1003 мм с листа 20.
export const BRIDGE_Y0 = arcY(ENTRY_X0, R_HOLE);
