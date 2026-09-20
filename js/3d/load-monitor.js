// Небольшой glTF 2.0-загрузчик только для статичной техники в карточке CENTRUM.
// Он читает геометрию из GLB без Blender и без сторонних библиотек: настоящая форма,
// сглаженные нормали, разбиение по материалам и базовые текстуры каждого из них.

import { CENTER, LEVEL_1, LEVEL_2 } from './params.js';
import { loadBaseColorTextures } from './gltf-textures.js';

const COMPONENT = {
  5121: Uint8Array,
  5123: Uint16Array,
  5125: Uint32Array,
  5126: Float32Array,
};
const WIDTH = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 };
const IDENTITY = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];

function multiply(a, b) {
  const out = new Float32Array(16);
  for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) {
    let sum = 0;
    for (let k = 0; k < 4; k++) sum += a[k * 4 + r] * b[c * 4 + k];
    out[c * 4 + r] = sum;
  }
  return out;
}

function transformPoint(m, x, y, z) {
  return [m[0] * x + m[4] * y + m[8] * z + m[12], m[1] * x + m[5] * y + m[9] * z + m[13], m[2] * x + m[6] * y + m[10] * z + m[14]];
}

function transformNormal(m, x, y, z) {
  const nx = m[0] * x + m[4] * y + m[8] * z;
  const ny = m[1] * x + m[5] * y + m[9] * z;
  const nz = m[2] * x + m[6] * y + m[10] * z;
  const length = Math.hypot(nx, ny, nz) || 1;
  return [nx / length, ny / length, nz / length];
}

function accessor(json, binary, index) {
  const spec = json.accessors[index];
  const view = json.bufferViews[spec.bufferView];
  const Type = COMPONENT[spec.componentType];
  const width = WIDTH[spec.type];
  if (!Type || !width) throw new Error('Неподдерживаемый поток GLB-модели');
  const offset = (view.byteOffset || 0) + (spec.byteOffset || 0);
  const packedSize = Type.BYTES_PER_ELEMENT * width;
  const stride = view.byteStride || packedSize;
  if (stride === packedSize) return new Type(binary, offset, spec.count * width);

  // Sketchfab часто хранит POSITION/NORMAL/UV в общем interleaved-буфере.
  // WebGL мог бы читать его напрямую, но здесь массив разворачивается один раз,
  // чтобы дальнейшая сборка GLB оставалась одинаковой для всех источников.
  const out = new Type(spec.count * width);
  const data = new DataView(binary);
  const read = {
    5121: (at) => data.getUint8(at),
    5123: (at) => data.getUint16(at, true),
    5125: (at) => data.getUint32(at, true),
    5126: (at) => data.getFloat32(at, true),
  }[spec.componentType];
  for (let i = 0; i < spec.count; i++)
    for (let c = 0; c < width; c++) out[i * width + c] = read(offset + i * stride + c * Type.BYTES_PER_ELEMENT);
  return out;
}

function materialColor(material) {
  // baseColorFactor умножается на текстуру, поэтому при её наличии по умолчанию белый.
  const fallback = material?.pbrMetallicRoughness?.baseColorTexture ? [1, 1, 1] : [0.12, 0.14, 0.17];
  const factor = material?.pbrMetallicRoughness?.baseColorFactor
    || material?.extensions?.KHR_materials_pbrSpecularGlossiness?.diffuseFactor;
  return factor ? factor.slice(0, 3) : fallback;
}

// Внешняя картинка экрана имеет приоритет над встроенной в GLB. Если пользователь
// временно удалил файл или положил битый PNG, модель всё равно откроется со своей
// штатной встроенной текстурой.
async function loadImage(url) {
  const image = new Image();
  image.src = url;
  await image.decode();
  return image;
}

// Модель скачана в сантиметровой сцене Sketchfab. 72 переводит её в мм и даёт
// реалистичную ширину ~772 мм; ось Z уже направлена вверх после её root-transform.
const MONITOR_SCALE = 72;
// Монитор стоит на рабочей поверхности у передней внутренней стенки, напротив кресла.
// Стенка пояса — цилиндр R1250: по центру она на отметке 200, а у краёв экрана
// (±386 от оси) уже на 261. Задняя грань корпуса при этом смещении оказывается
// на 308, то есть перед стенкой с зазором ~47 мм, а не утоплена в неё.
const MONITOR_OFFSET = [CENTER, 500, LEVEL_1 + 274];

// MacBook экспортирован в условных единицах: ширина корпуса 2,99. Масштаб ниже
// даёт паспортные 356 мм. Ноутбук отнесён от монитора по дуге и слегка развернут
// к человеку; его дальний угол остаётся перед внутренней стенкой R1250, а не
// входит в неё.
const LAPTOP_SCALE = 356 / 2.99;
const LAPTOP_OFFSET = [2150, 790, LEVEL_1 - 0.2];

// Разворот ноутбука вокруг вертикали. Одно значение на загрузчик и на анимацию
// крышки: раньше загрузчик поворачивал модель на 18°, а laptop-motion.js
// компенсировал 16°, и ось шарнира шла наискось к самому шарниру.
export const LAPTOP_TURN = 18 * Math.PI / 180;

// Ось шарнира крышки в координатах загрузчика (после axis(), в единицах GLB).
// Замерена по нижней кромке узлов 17–23: x = 0 — шарнир лежит на осевой линии
// модели. В мир переводится тем же turn/scale/offset, что и сама геометрия,
// поэтому переживает и подъём уровней, и смену LAPTOP_SCALE.
// Прошитая мировая точка здесь уже отставала: после подъёма уровней на 70 мм
// шарнир остался на Z=761.7 при столешнице 820, и крышка складывалась под стол.
const LAPTOP_HINGE_LOCAL = [0, -1.0392, 0.0838];

export const LAPTOP_HINGE = (() => {
  const [hx, hy, hz] = LAPTOP_HINGE_LOCAL;
  const cos = Math.cos(LAPTOP_TURN), sin = Math.sin(LAPTOP_TURN);
  return [
    LAPTOP_OFFSET[0] + (hx * cos - hy * sin) * LAPTOP_SCALE,
    LAPTOP_OFFSET[1] + (hx * sin + hy * cos) * LAPTOP_SCALE,
    LAPTOP_OFFSET[2] + hz * LAPTOP_SCALE,
  ];
})();

// Surface Headphones лежат на наружных плоскостях чашек, а не стоят обручем.
// Исходная модель уже в миллиметровом масштабе, но примерно втрое крупнее натуры.
// Перенос локального минимума Z в ноль гарантирует реальный контакт со столешницей.
const HEADPHONES_SCALE = 0.3;
const HEADPHONES_CENTER = [0.0634204557, 523.0688263876];
const HEADPHONES_BOTTOM = -174.4373833565;
const HEADPHONES_OFFSET = [2470, 1100, LEVEL_1];

// Горшок стоит на втором уровне напротив ноутбука. Масштаб 500 даёт крону
// около 383 мм и высоту 491 мм, а основание горшка — около 170 мм.
// В GLB низ уже направлен в -Z; смещение ставит его точно на второй уровень.
const PLANT_SCALE = 500;
const PLANT_BOTTOM = -0.4901100099;
const PLANT_OFFSET = [480, 450, LEVEL_2 - PLANT_BOTTOM * PLANT_SCALE];

// iPhone экспортирован в метрах: масштаб 1000 даёт корпус 73 × 150 мм.
// Матрица и защитное стекло находятся на локальном минимуме Z (-4,375 мм),
// поэтому без переворота телефон уже лежит экраном вниз. Смещение ставит стекло
// точно на рабочую поверхность первого уровня; блок камер остаётся сверху.
const IPHONE_SCALE = 1000;
const IPHONE_SCREEN_BOTTOM = -0.0043750028;
const IPHONE_OFFSET = [850, 850, LEVEL_1 - IPHONE_SCREEN_BOTTOM * IPHONE_SCALE];

// Bambu Lab A1 mini: реальные габариты 347 × 315 × 365 мм.
// Стоит на правой части рабочей поверхности: ближе к боковой стенке, рядом с
// iPhone, но вне зоны прохода и Bridge.
const PRINTER_SCALE = [490.4, 430.8, 510.3];
const PRINTER_OFFSET = [449, 1700, LEVEL_1 - 0.6];

// Gaming Chair экспортирован в условных сантиметровых единицах. Масштаб 2,55
// даёт реальный габарит около 717 × 642 × 1152 мм. Центр исходной геометрии
// сдвинут, а нижняя точка колёс находится на Y=34,537, поэтому ось ниже
// одновременно центрирует кресло в отверстии и ставит его ровно на пол.
const CHAIR_SCALE = 2.55;
const CHAIR_CENTER = [0.4471421242, 93.4203135333];
const CHAIR_BOTTOM = 34.5369549429;

async function loadGlbGroups({ url, prefix, scale, offset, axis = (p) => p, normalAxis = (n) => n, turn = 0, flipX = false, tint = null, mono = false, skipMaterials = [], useEmissive = false, textureOverrides = {}, colorOverrides = {}, partForNode = null }) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`GLB не загружен: ${response.status}`);
  const buffer = await response.arrayBuffer();
  const view = new DataView(buffer);
  if (view.getUint32(0, true) !== 0x46546c67) throw new Error('Файл монитора не является GLB');
  const jsonLength = view.getUint32(12, true);
  const json = JSON.parse(new TextDecoder().decode(new Uint8Array(buffer, 20, jsonLength)));
  const binaryOffset = 20 + jsonLength + 8;
  const binary = buffer.slice(binaryOffset);
  const textures = await loadBaseColorTextures(json, binary);
  const overrides = new Map();
  await Promise.all(Object.entries(textureOverrides).map(async ([materialName, textureUrl]) => {
    try {
      overrides.set(materialName, await loadImage(textureUrl));
    } catch (error) {
      console.warn(`Экран ${prefix}: не удалось загрузить ${textureUrl}, используется картинка из GLB`, error);
    }
  }));
  const parent = [];
  json.nodes.forEach((node, i) => node.children?.forEach((child) => { parent[child] = i; }));
  const world = (index) => parent[index] === undefined
    ? (json.nodes[index].matrix || IDENTITY)
    : multiply(world(parent[index]), json.nodes[index].matrix || IDENTITY);
  const groups = [];
  const [scaleX, scaleY, scaleZ] = Array.isArray(scale) ? scale : [scale, scale, scale];

  json.nodes.forEach((node, nodeIndex) => {
    if (node.mesh === undefined) return;
    const matrix = world(nodeIndex);
    for (const primitive of json.meshes[node.mesh].primitives) {
      if (primitive.mode !== undefined && primitive.mode !== 4) continue;
      const material = json.materials?.[primitive.material];
      // Прозрачные стёкла некоторых GLB используют transmission. Наш непрозрачный
      // проход их не смешивает, поэтому конкретную заслоняющую плоскость можно
      // исключить, сохранив лежащую прямо под ней текстурированную матрицу.
      if (skipMaterials.includes(material?.name)) continue;
      const positions = accessor(json, binary, primitive.attributes.POSITION);
      const normals = accessor(json, binary, primitive.attributes.NORMAL);
      const indices = primitive.indices === undefined ? null : accessor(json, binary, primitive.indices);
      // Текстурные координаты берём, только если к материалу действительно
      // приложена картинка: иначе незачем гонять лишний поток вершин.
      const texture = overrides.get(material?.name) || textures.get(primitive.material) || null;
      const uvSource = texture && primitive.attributes.TEXCOORD_0 !== undefined
        ? accessor(json, binary, primitive.attributes.TEXCOORD_0)
        : null;
      const count = indices ? indices.length : positions.length / 3;
      const position = new Float32Array(count * 3);
      const normal = new Float32Array(count * 3);
      const color = new Float32Array(count * 3);
      const uv = uvSource ? new Float32Array(count * 2) : null;
      const color0 = colorOverrides[material?.name] || tint || materialColor(material);
      for (let i = 0; i < count; i++) {
        const source = indices ? indices[i] : i;
        const local = transformPoint(matrix, positions[source * 3], positions[source * 3 + 1], positions[source * 3 + 2]);
        const rawPoint = axis(local);
        const rawNormal = normalAxis(transformNormal(matrix, normals[source * 3], normals[source * 3 + 1], normals[source * 3 + 2]));
        // Переворот на 180° вокруг горизонтальной оси: у исходного монитора
        // стойка оказалась сверху, а экран смотрел от сидящего человека.
        const p = flipX ? [rawPoint[0], -rawPoint[1], -rawPoint[2]] : rawPoint;
        const n = flipX ? [rawNormal[0], -rawNormal[1], -rawNormal[2]] : rawNormal;
        const cos = Math.cos(turn), sin = Math.sin(turn);
        const px = (p[0] * cos - p[1] * sin) * scaleX;
        const py = (p[0] * sin + p[1] * cos) * scaleY;
        position.set([offset[0] + px, offset[1] + py, offset[2] + p[2] * scaleZ], i * 3);
        normal.set([n[0] * cos - n[1] * sin, n[0] * sin + n[1] * cos, n[2]], i * 3);
        color.set(color0, i * 3);
        if (uv) uv.set([uvSource[source * 2], uvSource[source * 2 + 1]], i * 2);
      }
      // Некоторые GLB помечают декоративные текстуры как emissive. Включаем
      // самосвечение только для моделей, где оно проверено явно: иначе экран
      // большого монитора выбеливается вместе со всем материалом.
      const directTexture = useEmissive && texture && material?.emissiveTexture ? 1 : 0;
      groups.push({
        name: `${prefix}-${groups.length}`,
        part: partForNode ? partForNode(nodeIndex, material?.name) : null,
        mesh: { position, normal, color, uv, count },
        lines: { position: new Float32Array(), color: new Float32Array(), count: 0 },
        texture: uv ? texture : null,
        // Экран MacBook хранит ту же картинку одновременно в baseColor и emissive.
        // Сохраняем это свойство: изображение остаётся ярким, а не выглядит бумагой.
        emissive: 0,
        directTexture,
        // Ordered fade нужен стенкам при пролёте камерой, но на светящейся матрице
        // он превращается в заметную точечную сетку при крупном плане.
        noFade: directTexture > 0,
        // Матрица MacBook расположена почти в одной плоскости с защитным слоем.
        // Приоритет глубины не даёт соседним полигонам пробивать её квадратами.
        // Экран и тонкий шильдик Apple лежат почти в одной плоскости с соседней
        // геометрией. Небольшой приоритет глубины убирает квадратные полосы,
        // не сдвигая сами детали модели.
        depthPriority: directTexture > 0 || material?.name === 'Material.017',
        clampTexture: directTexture > 0,
        mono,
      });
    }
  });
  return groups;
}

export const loadMonitorGroups = () => loadGlbGroups({
  url: 'assets/3d/ultrawide_monitor.glb', prefix: 'monitor', scale: MONITOR_SCALE, offset: MONITOR_OFFSET,
  textureOverrides: { Screen: 'assets/textures/monitor-screen.png' },
  useEmissive: true,
  // В этой экспортированной Sketchfab-сцене высота лежит по -Y, а глубина по Z.
  axis: ([x, y, z]) => [x, z, -y],
  normalAxis: ([x, y, z]) => [x, z, -y],
  flipX: true,
  // После переворота стойки экран всё ещё был обращён к внутренней стенке.
  // Разворот вокруг вертикали направляет его к сидящему человеку.
  turn: Math.PI,
});

// Открытый MacBook стоит слева от монитора. После перевода осей X — ширина,
// Y — глубина, Z — высота; экран и клавиатура развёрнуты к креслу.
export const loadLaptopGroups = () => loadGlbGroups({
  url: 'assets/3d/apple_macbook_pro_16_inch_2021.glb',
  prefix: 'laptop',
  scale: LAPTOP_SCALE,
  offset: LAPTOP_OFFSET,
  axis: ([x, y, z]) => [x, z, y],
  normalAxis: ([x, y, z]) => [x, z, y],
  turn: LAPTOP_TURN,
  // Material.005 — прозрачное защитное стекло перед экраном. Без отдельного
  // transmission-прохода оно становилось непрозрачным белым и закрывало обои.
  skipMaterials: ['Material.005'],
  textureOverrides: { 'Material.008': 'assets/textures/macbook-screen.png' },
  useEmissive: true,
  // Узлы 17–23 — крышка, рамка и экран; они двигаются вместе вокруг шарнира.
  partForNode: (nodeIndex) => (nodeIndex >= 17 && nodeIndex <= 23 ? 'laptop-lid' : null),
});

// Наушники находятся ещё левее MacBook и заметно дальше по дуге столешницы.
// Более сильный поворот повторяет радиальное направление рабочей зоны, а вся
// опорная плоскость остаётся внутри окружности R1250 и не заходит в высокий пояс.
export const loadHeadphonesGroups = () => loadGlbGroups({
  url: 'assets/3d/microsoft_headphones_surface_2.glb',
  prefix: 'headphones',
  scale: HEADPHONES_SCALE,
  offset: HEADPHONES_OFFSET,
  axis: ([x, y, z]) => [x - HEADPHONES_CENTER[0], y - HEADPHONES_CENTER[1], z - HEADPHONES_BOTTOM],
  normalAxis: ([x, y, z]) => [x, y, z],
  turn: -32 * Math.PI / 180,
});

// Центр основания лежит между внутренней кромкой верхнего кольца и наружным
// контуром. Горшок целиком опирается на столешницу, листья могут нависать.
export const loadPlantGroups = () => loadGlbGroups({
  url: 'assets/3d/potted_plant.glb',
  prefix: 'plant',
  scale: PLANT_SCALE,
  offset: PLANT_OFFSET,
  turn: 18 * Math.PI / 180,
});

// В исходном GLB ось высоты направлена в -Y, а глубина — в Z. Перекладываем
// её в систему CENTRUM (Z вверх); независимый масштаб даёт реальные 278,9 ×
// 114,9 × 4,1–10,9 мм по спецификации Apple и ставит модель на первый уровень.
export const loadKeyboardGroups = () => loadGlbGroups({
  url: 'assets/3d/apple_magic_keyboard.glb', prefix: 'keyboard', scale: [56.25, 72, 142.83], offset: [CENTER, 660, LEVEL_1 + 3.5],
  axis: ([x, y, z]) => [x, z, -y],
  normalAxis: ([x, y, z]) => [x, z, -y],
  turn: Math.PI,
  // У исходной клавиатуры верх и низ экспортированы наоборот.
  flipX: true,
});

// В исходном GLB мышь лежит поперёк: её длинная ось смотрела вдоль X.
// Разворот на 90° ставит её вдоль руки, а масштаб доводит габарит до 62 × 117 мм.
// Кресло стоит в центре отверстия, колёсами на полу и лицом к монитору.
export const loadChairGroups = () => loadGlbGroups({
  url: 'assets/3d/gaming_chair_free_download.glb',
  prefix: 'chair',
  scale: CHAIR_SCALE,
  offset: [CENTER, CENTER, 0],
  axis: ([x, y, z]) => [x - CHAIR_CENTER[0], z - CHAIR_CENTER[1], y - CHAIR_BOTTOM],
  normalAxis: ([x, y, z]) => [x, z, y],
  // Прозрачность декоративного логотипа текущий непрозрачный WebGL-проход
  // не смешивает; без него на спинке появлялся бы прямоугольный фон текстуры.
  skipMaterials: ['aseito_logo'],
  // В исходной модели перед кресла направлен по +Z. Разворот направляет его
  // к монитору, расположенному со стороны меньших координат Y.
  turn: Math.PI,
});

export const loadMouseGroups = () => loadGlbGroups({
  url: 'assets/3d/computer_mouse_low-poly.glb', prefix: 'mouse', scale: 33, offset: [CENTER - 340, 700, LEVEL_1],
  axis: ([x, y, z]) => [x, z, y],
  normalAxis: ([x, y, z]) => [x, z, y],
  turn: 3 * Math.PI / 2,
});

// Телефон лежит справа от мыши в свободной части Sector. Все его углы остаются
// между кромкой отверстия R600 и внутренней стенкой R1250.
export const loadIphoneGroups = () => loadGlbGroups({
  url: 'assets/3d/iphone_17_pro.glb',
  prefix: 'iphone',
  scale: IPHONE_SCALE,
  offset: IPHONE_OFFSET,
  turn: 152 * Math.PI / 180,
  // Frosted_glass полагается на стандартное значение glTF: белый baseColorFactor.
  // Общий тёмный fallback загрузчика делал всю заднюю панель почти чёрной.
  colorOverrides: { Frosted_glass: [1, 1, 1] },
});

// У исходной Bambu Lab A1 mini фронт направлен вдоль -Z. После переноса осей
// это -Y, то есть точно к человеку в центральной зоне; дополнительный поворот
// на 270° разворачивал к нему левую сторону корпуса.
export const loadPrinterGroups = () => loadGlbGroups({
  url: 'assets/3d/bambu_lab_a1_mini.glb',
  prefix: 'printer',
  scale: PRINTER_SCALE,
  offset: PRINTER_OFFSET,
  axis: ([x, y, z]) => [x, z, y],
  normalAxis: ([x, y, z]) => [x, z, y],
  turn: 0,
});
