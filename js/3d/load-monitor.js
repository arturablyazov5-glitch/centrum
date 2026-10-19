// Небольшой glTF 2.0-загрузчик только для статичной техники в карточке CENTRUM.
// Он читает геометрию из GLB без Blender и без сторонних библиотек: настоящая форма,
// сглаженные нормали, разбиение по материалам и базовые текстуры каждого из них.

import { loadBaseColorTextures } from './gltf-textures.js';
import { PROPS, SOCKET_PROPS, prop, propMatrix } from './props.js';

// Где стоит каждый предмет — props.js: одно описание на сайт и на Blender.
// Здесь только то, как модель показать во вьюере.

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

// Нормали переводятся обратной транспонированной матрицей: у клавиатуры и
// принтера масштаб по осям разный, и простой поворот их бы перекосил.
function normalMatrix(m) {
  const [a, b, c, d, e, f, g, h, i] = [m[0], m[4], m[8], m[1], m[5], m[9], m[2], m[6], m[10]];
  const det = a * (e * i - f * h) - b * (d * i - f * g) + c * (d * h - e * g);
  // Обратная матрица, сразу транспонированная: по строкам.
  return [
    (e * i - f * h) / det, (f * g - d * i) / det, (d * h - e * g) / det,
    (c * h - b * i) / det, (a * i - c * g) / det, (b * g - a * h) / det,
    (b * f - c * e) / det, (c * d - a * f) / det, (a * e - b * d) / det,
  ];
}

async function loadGlbGroups({ url, prefix, matrix: place, tint = null, mono = false, skipMaterials = [], useEmissive = false, textureOverrides = {}, colorOverrides = {}, partForNode = null, rootNode = null, clip = null }) {
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
  // rootNode: берём одну ветку файла в собственных координатах её узла.
  const underRoot = (index) => rootNode === null || index === rootNode
    || (parent[index] !== undefined && underRoot(parent[index]));
  const world = (index) => index === rootNode ? IDENTITY : parent[index] === undefined
    ? (json.nodes[index].matrix || IDENTITY)
    : multiply(world(parent[index]), json.nodes[index].matrix || IDENTITY);
  const groups = [];
  const n = normalMatrix(place);

  json.nodes.forEach((node, nodeIndex) => {
    if (node.mesh === undefined || !underRoot(nodeIndex)) return;
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
      // KHR_texture_transform: мелкая повторяющаяся текстура (пробка у подставки
      // кружки) задана масштабом UV. Без него на подставку растягивался бы один
      // увеличенный фрагмент. Поворот UV в наших моделях не встречается.
      const uvTransform = material?.pbrMetallicRoughness?.baseColorTexture?.extensions?.KHR_texture_transform;
      const uvOffset = uvTransform?.offset || [0, 0];
      const uvScale = uvTransform?.scale || [1, 1];
      const count = indices ? indices.length : positions.length / 3;
      const position = new Float32Array(count * 3);
      const normal = new Float32Array(count * 3);
      const color = new Float32Array(count * 3);
      const uv = uvSource ? new Float32Array(count * 2) : null;
      const color0 = colorOverrides[material?.name] || tint || materialColor(material);
      for (let i = 0; i < count; i++) {
        const source = indices ? indices[i] : i;
        const local = transformPoint(matrix, positions[source * 3], positions[source * 3 + 1], positions[source * 3 + 2]);
        position.set(transformPoint(place, local[0], local[1], local[2]), i * 3);
        const [nx, ny, nz] = transformNormal(matrix, normals[source * 3], normals[source * 3 + 1], normals[source * 3 + 2]);
        const wx = n[0] * nx + n[1] * ny + n[2] * nz, wy = n[3] * nx + n[4] * ny + n[5] * nz, wz = n[6] * nx + n[7] * ny + n[8] * nz;
        const length = Math.hypot(wx, wy, wz) || 1;
        normal.set([wx / length, wy / length, wz / length], i * 3);
        color.set(color0, i * 3);
        if (uv) uv.set([
          uvOffset[0] + uvSource[source * 2] * uvScale[0],
          uvOffset[1] + uvSource[source * 2 + 1] * uvScale[1],
        ], i * 2);
      }
      // clip из props.js: треугольники, задевшие зону ниже minZ или ближе minY, выбрасываются.
      let mesh = { position, normal, color, uv, count };
      if (clip) {
        const keep = [];
        for (let t = 0; t < count; t += 3) {
          let ok = true;
          for (let k = t; k < t + 3; k++) if (position[k * 3 + 2] < clip.minZ || position[k * 3 + 1] < clip.minY) ok = false;
          if (ok) keep.push(t);
        }
        if (!keep.length) continue;
        const pack = (src, w) => {
          const out = new Float32Array(keep.length * 3 * w);
          keep.forEach((t, j) => out.set(src.subarray(t * w, (t + 3) * w), j * 3 * w));
          return out;
        };
        mesh = { position: pack(position, 3), normal: pack(normal, 3), color: pack(color, 3), uv: uv ? pack(uv, 2) : null, count: keep.length * 3 };
      }
      // Некоторые GLB помечают декоративные текстуры как emissive. Включаем
      // самосвечение только для моделей, где оно проверено явно: иначе экран
      // большого монитора выбеливается вместе со всем материалом.
      const directTexture = useEmissive && texture && material?.emissiveTexture ? 1 : 0;
      groups.push({
        name: `${prefix}-${groups.length}`,
        part: partForNode ? partForNode(nodeIndex, material?.name) : null,
        mesh,
        lines: { position: new Float32Array(), color: new Float32Array(), count: 0 },
        texture: mesh.uv ? texture : null,
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

// Предмет из props.js: матрица места и цвета — оттуда, остальное — настройки показа.
const loadProp = (name, options = {}) => {
  const p = prop(name);
  return loadGlbGroups({ url: p.url, prefix: name, matrix: propMatrix(p), rootNode: p.rootNode ?? null,
    colorOverrides: p.colorOverrides || {}, textureOverrides: p.textureOverrides || {}, clip: p.clip || null, ...options });
};

export const loadMonitorGroups = () => loadProp('monitor', {
  textureOverrides: { Screen: 'assets/textures/monitor-screen.png' },
  useEmissive: true,
});

export const loadLaptopGroups = () => loadProp('laptop', {
  // Material.005 — прозрачное защитное стекло перед экраном. Без отдельного
  // transmission-прохода оно становилось непрозрачным белым и закрывало обои.
  skipMaterials: ['Material.005'],
  textureOverrides: { 'Material.008': 'assets/textures/macbook-screen.png' },
  useEmissive: true,
  // Узлы 17–23 — крышка, рамка и экран; они двигаются вместе вокруг шарнира.
  partForNode: (nodeIndex) => (nodeIndex >= 17 && nodeIndex <= 23 ? 'laptop-lid' : null),
});

export const loadHeadphonesGroups = () => loadProp('headphones');
export const loadPlantGroups = () => loadProp('plant');
export const loadKeyboardGroups = () => loadProp('keyboard');
export const loadMouseGroups = () => loadProp('mouse');
export const loadIphoneGroups = () => loadProp('iphone');
export const loadPrinterGroups = () => loadProp('printer');
export const loadMugGroups = () => loadProp('mug');

// Прозрачность декоративного логотипа непрозрачный WebGL-проход не смешивает;
// без него на спинке появлялся бы прямоугольный фон текстуры.
export const loadChairGroups = () => loadProp('chair', { skipMaterials: ['aseito_logo'] });

// Рамки всех пакетов электрики; у каждой группы — список пакетов, где она стоит.
export const loadSocketGroups = async () => (await Promise.all(SOCKET_PROPS
  .map(async (p) => (await loadProp(p.name)).map((g) => Object.assign(g, { packages: p.packages }))))).flat();
