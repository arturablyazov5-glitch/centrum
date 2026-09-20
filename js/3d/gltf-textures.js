// Извлечение базовых текстур из GLB. Картинки лежат внутри того же файла отдельным
// куском буфера, поэтому их не нужно ни скачивать, ни распаковывать заранее:
// достаточно отдать байты браузеру как Blob и дождаться декодирования.
//
// Читается только baseColorTexture — то, что видно глазом. Карты металличности,
// шероховатости и нормалей наш рендер не использует.

// Байты картинки по её описанию в glTF.
function imageBytes(json, binary, image) {
  if (image.bufferView === undefined) return null;
  const view = json.bufferViews[image.bufferView];
  return new Uint8Array(binary, view.byteOffset || 0, view.byteLength);
}

// Декодирование одной картинки в объект, который WebGL примет напрямую.
async function decodeImage(bytes, mimeType) {
  const url = URL.createObjectURL(new Blob([bytes], { type: mimeType || 'image/png' }));
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    return image;
  } finally {
    URL.revokeObjectURL(url);
  }
}

// Карта «индекс материала → картинка». Одна и та же картинка декодируется один раз,
// даже если на неё ссылаются несколько материалов.
export async function loadBaseColorTextures(json, binary) {
  const byMaterial = new Map();
  if (!json.materials) return byMaterial;

  const cache = new Map();
  const decoded = await Promise.all(json.materials.map(async (material, index) => {
    const reference = material?.pbrMetallicRoughness?.baseColorTexture
      || material?.extensions?.KHR_materials_pbrSpecularGlossiness?.diffuseTexture;
    if (!reference) return null;
    const source = json.textures?.[reference.index]?.source;
    if (source === undefined) return null;
    if (!cache.has(source)) {
      const image = json.images?.[source];
      const bytes = image && imageBytes(json, binary, image);
      // Испорченную или внешнюю картинку пропускаем: модель должна показаться и без неё.
      cache.set(source, bytes ? decodeImage(bytes, image.mimeType).catch(() => null) : Promise.resolve(null));
    }
    return { index, image: await cache.get(source) };
  }));

  for (const entry of decoded) if (entry?.image) byMaterial.set(entry.index, entry.image);
  return byMaterial;
}
