// WebGL-рендер без внешних библиотек: материалы, один студийный источник,
// настоящая карта падающих теней и свет от существующей LED-ленты.

import { normalMatrix3, identity, lookAt, multiply, orthographic } from './mat4.js';
import { computeBounds } from './bounds.js';
import { CENTER, LEVEL_1, R_HOLE, R_BELT_HIGH, R_LIP, TRANS_FAR, TRANS_LEN } from './params.js';
import { LED_END_Y } from './build-led.js';
import { LED_CEILING_GLSL } from './led-lighting.js';
import { PALETTE } from './palette.js';
import { SPEAKER_CHANNELS, SPEAKER_Z, speakerAngle } from './build-speakers.js';
import { GRILLE_FIELD, HOLE_D, HOLE_PITCH } from './receiver-door.js';

// GLSL требует у float-констант явную точку: 820 — синтаксическая ошибка, 820.0 — нет.
const f = (n) => n.toFixed(1);

const VERT = `
precision highp float;
attribute vec3 aPosition;
attribute vec3 aNormal;
attribute vec3 aColor;
attribute vec2 aUV;
uniform mat4 uProjection, uView, uModel;
uniform mat3 uNormalMatrix;
uniform mat4 uShadowMatrix;
varying vec3 vNormal, vColor, vWorld;
varying vec3 vLocal, vLocalNormal;
varying vec2 vUV;
varying vec4 vShadowCoord;
void main(){
  vLocal = aPosition;
  vLocalNormal = aNormal;
  vec4 world = uModel * vec4(aPosition, 1.0);
  vWorld = world.xyz;
  vNormal = uNormalMatrix * aNormal;
  vColor = aColor;
  vUV = aUV;
  vShadowCoord = uShadowMatrix * world;
  gl_Position = uProjection * uView * world;
}`;

const FRAG = `
#extension GL_OES_standard_derivatives : enable
precision highp float;
varying vec3 vNormal, vColor, vWorld;
varying vec3 vLocal, vLocalNormal;
varying vec2 vUV;
uniform vec3 uEmissiveColor;
// Подсветка ящиков: точка света (xyz, яркость) и объём, куда свет достаёт.
uniform vec4 uDrawerLight[9], uDrawerLightMin[9], uDrawerLightMax[9];
uniform vec3 uDrawerLightColor;
uniform float uUnlit, uEmissive, uDirectTexture, uScreenPower, uLed, uFade, uTextured, uMono, uSurfaceTexture, uSideTexture, uFlat;
// Повтор и яркость карты группы: плитка кожи накладки мельче общей развёртки 2900 мм,
// а её нейтрально-серая карта (среднее 0,5) не должна темнить цвет вершин.
uniform float uTextureScale, uTextureGain;
uniform vec3 uEye, uSurfaceTint, uLedColor;
uniform sampler2D uTexture;
uniform sampler2D uShadowMap;
uniform sampler2D uSideMap;
uniform vec2 uShadowTexel;
uniform float uShadowEnabled;
varying vec4 vShadowCoord;
// Спокойная предметная студия: мягкий нейтрально-тёплый key, слабый fill и
// холодноватый контровой. Тёплая локальная засветка ниже принадлежит только LED.
const vec3 SUN = vec3(-0.52, -0.58, 0.63);
const vec3 FILL = vec3(0.25, -0.38, 0.72);
const vec3 RIM = vec3(0.68, 0.48, 0.56);
const vec3 SKY = vec3(0.15, 0.17, 0.22);
const vec3 GROUND = vec3(0.015, 0.012, 0.010);
// Лента лежит в пазу выступа; на спуске меняются и радиус, и высота.
const vec2 LED_CENTER = vec2(${f(CENTER)}, ${f(CENTER)});
const float SECTOR_Z = ${f(LEVEL_1)};
const float HOLE_R = ${f(R_HOLE)};
const vec3 GRILLE = vec3(${PALETTE.grille.map((v) => v.toFixed(4)).join(', ')});
const vec3 RECEIVER_GRILLE = vec3(${PALETTE.receiverGrille.map((v) => v.toFixed(4)).join(', ')});
// Металл фурнитуры: хром штока газлифта и оцинкованная сталь осей и планок.
const vec3 CHROME = vec3(${PALETTE.gasRod.map((v) => v.toFixed(4)).join(', ')});
const vec3 ZINC = vec3(${PALETTE.steel.map((v) => v.toFixed(4)).join(', ')});

// Отражение студии в металле: тёмный пол, светлый потолок с софтбоксом
// и блик ключевого света. Без него металл при одном направленном источнике
// выглядит серой пластмассой — у хрома своего цвета почти нет.
vec3 studioReflection(vec3 r, vec3 sunDir, float roughness){
  float up = r.z;
  vec3 env = mix(vec3(0.012), vec3(0.16, 0.165, 0.175), smoothstep(-0.25, 0.35, up));
  float box = smoothstep(0.45, 0.62 + roughness * 0.3, up) * (1.0 - smoothstep(0.9, 0.99, up));
  env += vec3(1.25, 1.2, 1.12) * box;
  float sharp = mix(220.0, 18.0, roughness);
  env += vec3(2.6, 2.3, 2.0) * pow(max(dot(r, sunDir), 0.0), sharp);
  return env;
}

float unpackDepth(vec4 rgba){
  // UNORM8 хранит байты как n/255, а разряды упаковки имеют основание 256.
  // Без обратного масштаба появлялась периодическая ошибка глубины ~29 мм.
  return dot(rgba * (255.0 / 256.0),
    vec4(1.0 / 16777216.0, 1.0 / 65536.0, 1.0 / 256.0, 1.0));
}

${LED_CEILING_GLSL}

// Источник следует сужению выступа и высоте нижней грани на спуске.
vec4 nearestLed(vec3 p){
  vec2 d = p.xy - LED_CENTER;
  float len = max(length(d), 1.0);
  vec2 wall = LED_CENTER + d / len * ${f(R_BELT_HIGH)};
  float t = clamp((${f(TRANS_FAR)} - wall.y) / ${f(TRANS_LEN)}, 0.0, 1.0);
  float overhang = ${f(R_BELT_HIGH - R_LIP)} * t * t * (3.0 - 2.0 * t);
  vec2 ring = LED_CENTER + d / len * (${f(R_BELT_HIGH)} - overhang * 0.5);
  float live = 1.0 - smoothstep(${f(LED_END_Y - 35)}, ${f(LED_END_Y)}, wall.y);
  // Под нижней гранью; небольшой запас учитывает хорды сетки плиты.
  return vec4(ring, ledCeilingAt(ring.y) - 2.0, live);
}

// Непериодический экранный шум для необязательного режима просвечивания.
// В отличие от прежней матрицы Байера он не рисует диагональную штриховку.
float fadeNoise(vec2 p){
  return fract(52.9829189 * fract(dot(floor(p), vec2(0.06711056, 0.00583715))));
}

// Одна карта глубины обслуживает всю сцену. Любая нынешняя или будущая группа
// автоматически отбрасывает тень, пока она явно не помечена как чистый приёмник.
float shadowSample(vec2 uv, float compareDepth){
  float depth = unpackDepth(texture2D(uShadowMap, uv));
  return compareDepth <= depth ? 1.0 : 0.0;
}

float castShadow(vec3 n, vec3 lightDir){
  vec3 uvz = vShadowCoord.xyz / vShadowCoord.w * 0.5 + 0.5;
  // Соседние пиксели PCF лежат на другой глубине даже на ровном столе.
  // Сравниваем их с плоскостью получателя, иначе появляется диагональная сетка.
  vec3 dx = dFdx(uvz), dy = dFdy(uvz);
  float determinant = dx.x * dy.y - dx.y * dy.x;
  vec2 gradient = abs(determinant) > 1e-12
    ? vec2(dy.y * dx.z - dx.y * dy.z, dx.x * dy.z - dy.x * dx.z) / determinant
    : vec2(0.0);
  if (uShadowEnabled < 0.5) return 1.0;
  if (uvz.x <= 0.0 || uvz.x >= 1.0 || uvz.y <= 0.0 || uvz.y >= 1.0 || uvz.z <= 0.0 || uvz.z >= 1.0) return 1.0;
  float bias = 0.00015 + dot(abs(gradient), uShadowTexel) * 0.6;
  float compareDepth = uvz.z - bias;
  // Плотный центр сохраняет хорошо читаемую падающую и контактную тень;
  // небольшой PCF-контур оставляет только узкую естественную полутень.
  float soft = 0.0;
  for (int x = -1; x <= 1; x++) for (int y = -1; y <= 1; y++) {
    vec2 offset = vec2(float(x), float(y)) * uShadowTexel;
    soft += shadowSample(uvz.xy + offset, compareDepth + dot(gradient, offset));
  }
  return soft / 9.0;
}

const float PI = 3.14159265;

vec3 fresnelSchlick(float cosTheta, vec3 f0){
  return f0 + (1.0 - f0) * pow(1.0 - cosTheta, 5.0);
}

float distributionGGX(float noH, float roughness){
  float a = roughness * roughness;
  float a2 = a * a;
  float d = noH * noH * (a2 - 1.0) + 1.0;
  return a2 / max(PI * d * d, 0.0001);
}

float geometrySchlick(float noX, float roughness){
  float r = roughness + 1.0;
  float k = r * r / 8.0;
  return noX / max(noX * (1.0 - k) + k, 0.0001);
}

vec3 pbrLight(vec3 baseColor, vec3 n, vec3 v, vec3 l, vec3 radiance,
  float roughness, vec3 f0, float visibility){
  vec3 h = normalize(v + l);
  float noL = max(dot(n, l), 0.0);
  float noV = max(dot(n, v), 0.001);
  float noH = max(dot(n, h), 0.0);
  float voH = max(dot(v, h), 0.0);
  float d = distributionGGX(noH, roughness);
  float g = geometrySchlick(noV, roughness) * geometrySchlick(noL, roughness);
  vec3 f = fresnelSchlick(voH, f0);
  vec3 specular = d * g * f / max(4.0 * noV * noL, 0.001);
  vec3 diffuse = (1.0 - f) * baseColor / PI;
  return (diffuse + specular) * radiance * noL * visibility;
}

// Ближайшее к нулю из двух угловых отклонений, второе приводится к −π…π.
float nearestAngle(float best, float d){
  d = mod(d + PI, 2.0 * PI) - PI;
  return abs(d) < abs(best) ? d : best;
}

// Нейтральная компрессия бликов без агрессивного S-контраста и оранжевого
// сдвига прежнего filmic-пресета.
vec3 neutralTone(vec3 color){
  float peak = max(max(color.r, color.g), color.b);
  const float compressionStart = 0.76;
  const float distanceToWhite = 0.24;
  if (peak <= compressionStart) return color;
  float compressed = 1.0 - distanceToWhite * distanceToWhite
    / (peak + distanceToWhite - compressionStart);
  vec3 mapped = color * (compressed / peak);
  float desaturate = 1.0 - 1.0 / (0.16 * (peak - compressed) + 1.0);
  return mix(mapped, vec3(compressed), desaturate);
}

void main(){
  // Грани у самого объектива растворяются: сплошная стенка перед камерой
  // не закрывает то, ради чего внутрь и заходили.
  if (uFade > 0.0) {
    float visibility = smoothstep(uFade * 0.12, uFade, distance(vWorld, uEye));
    if (visibility < fadeNoise(gl_FragCoord.xy)) discard;
  }

  vec3 n = normalize(vNormal);
  vec3 viewDir = normalize(uEye - vWorld);
  // Собственный цвет: у корпуса он задан вершинами, у покупных моделей — картинкой
  // из GLB, помноженной на baseColorFactor материала. Картинки в sRGB, поэтому
  // раскодировать в линейное пространство нужно уже произведение.
  vec3 sampled = texture2D(uTexture, vUV * uTextureScale).rgb * uTextureGain;
  // uMono обесцвечивает картинку: так покупную модель можно перекрасить в нейтральный
  // тон, сохранив фактуру — плетение ткани, швы, потёртости остаются на месте.
  if (uMono > 0.5) sampled = vec3(dot(sampled, vec3(0.2126, 0.7152, 0.0722)));
  // Для корпуса одна карта назначена большой сборной группе, но древесина нужна
  // только облицованным плоскостям и 60-мм торцам. Отдельная метка нижнего шпона
  // не даёт текстуре попасть на днище корпуса, фасады и внутренние стенки.
  float worktop = 1.0 - step(0.025, distance(vColor, vec3(0.910, 0.898, 0.875)));
  float upper = 1.0 - step(0.025, distance(vColor, vec3(0.875, 0.863, 0.835)));
  float bridgeTop = 1.0 - step(0.025, distance(vColor, vec3(0.824, 0.808, 0.776)));
  float worktopBottom = 1.0 - step(0.025, distance(vColor, vec3(0.694, 0.663, 0.604)));
  float surfaceMask = uSurfaceTexture * max(max(worktop, worktopBottom), max(upper, bridgeTop));
  // Торцы 60 мм и стенки выборок: плоская развёртка по x/y на вертикали
  // вырождается в линию, и шпон тянулся поперёк кромки частыми полосами.
  // Здесь шпон идёт вдоль кромки — проекцией по координатам самой детали,
  // чтобы рисунок ехал вместе с поднятым мостом.
  if (surfaceMask > 0.5) {
    vec3 ln = normalize(vLocalNormal);
    float edge = 1.0 - smoothstep(0.55, 0.8, abs(ln.z));
    if (edge > 0.0) {
      float bx = ln.x * ln.x, by = ln.y * ln.y;
      vec3 along = (texture2D(uTexture, vLocal.yz / 2900.0).rgb * bx
        + texture2D(uTexture, vLocal.xz / 2900.0).rgb * by) / max(bx + by, 1e-4);
      sampled = mix(sampled, along * uTextureGain, edge);
    }
  }
  // Серый корпус — наружная стенка, нижняя внутренняя стенка и underside —
  // один материал. Для него отдельная проекция идёт по длине/высоте плоскости,
  // поэтому фактура не растягивается по мировому X/Y.
  float bodySide = 1.0 - step(0.025, distance(vColor, vec3(0.788, 0.773, 0.741)));
  // Дерево получают рейки акустической ленты; сама стенка за ними — серая панель.
  float bodyBelt = 1.0 - step(0.002, distance(vColor, vec3(0.345, 0.341, 0.333)));
  // Решётки 5.1 облицованы тем же шпоном: их цвет отличается от пояса на 1/255 только как метка.
  float grilleMask = 1.0 - step(0.0015, distance(vColor, GRILLE));
  bodyBelt = max(bodyBelt, grilleMask);
  float bodyUnderside = 1.0 - step(0.025, distance(vColor, vec3(0.667, 0.651, 0.624)));
  float bodyDrawer = 1.0 - step(0.025, distance(vColor, vec3(0.780, 0.761, 0.729)));
  // Цоколь — та же панель корпуса, только темнее: фактура та же, тон свой.
  float bodyPlinth = 1.0 - step(0.025, distance(vColor, vec3(0.490, 0.478, 0.459)));
  float sideMask = uSideTexture * max(max(bodySide, bodyPlinth), max(bodyUnderside, bodyDrawer));
  vec2 sideUV = abs(n.z) > max(abs(n.x), abs(n.y))
    ? vec2(vWorld.x / 220.0, vWorld.y / 220.0)
    : (abs(n.x) > abs(n.y)
      ? vec2(vWorld.y / 220.0, vWorld.z / 720.0)
      : vec2(vWorld.x / 220.0, vWorld.z / 720.0));
  vec3 sideSampled = texture2D(uSideMap, fract(sideUV)).rgb;
  vec2 beltUV = abs(n.z) > max(abs(n.x), abs(n.y))
    ? vWorld.xy / 1180.0
    : (abs(n.x) > abs(n.y) ? vWorld.yz / 1180.0 : vWorld.xz / 1180.0);
  vec3 beltSampled = texture2D(uTexture, fract(beltUV)).rgb;
  vec3 materialSampled = mix(sampled, sideSampled, sideMask);
  float beltMask = uSurfaceTexture * bodyBelt;
  materialSampled = mix(materialSampled, beltSampled, beltMask);
  // Рейки — шпон; обе внутренние стенки — та же панель корпуса, что снаружи.
  float woodMask = max(surfaceMask, beltMask);
  float textureMix = max(uTextured * (1.0 - uSurfaceTexture), max(woodMask, sideMask));
  vec3 albedo = mix(vColor, vColor * materialSampled, textureMix);
  albedo *= mix(vec3(1.0), uSurfaceTint, woodMask);
  // Перфорация решёток 5.1: Ø6 с шагом 10 мм в шахматном порядке. Сетка своя
  // у каждой решётки — от её центра по развёртке стенки R1150, отверстие в центре.
  // Отверстия только целые и только внутри R80: у кромки остаётся сплошной
  // шпон, скос не прорезан. В отверстиях — чисто чёрная ткань. Когда отверстие
  // мельче пикселя, рисунок переходит в средний тон — иначе шёл бы муар.
  float grilleCover = 0.0;
  if (grilleMask > 0.5) {
    float theta = atan(vWorld.y - LED_CENTER.y, vWorld.x - LED_CENTER.x);
    float dTheta = 10.0;
${SPEAKER_CHANNELS.map((c) => `    dTheta = nearestAngle(dTheta, theta - ${speakerAngle(c.deg).toFixed(6)});`).join('\n')}
    vec2 local = vec2(dTheta * ${f(R_BELT_HIGH)}, vWorld.z - ${f(SPEAKER_Z)});
    vec2 wall = local / 10.0 + 0.5;
    float shift = 0.5 * mod(floor(wall.y), 2.0);
    wall.x += shift;
    float cellPx = max(fwidth(wall.x), fwidth(wall.y));
    vec2 offset = fract(wall) - 0.5;
    float inField = step(length(local - offset * 10.0), 80.0);
    float hole = inField * (1.0 - smoothstep(0.3 - cellPx, 0.3 + cellPx, length(offset)));
    grilleCover = mix(0.28 * inField, hole, 1.0 - smoothstep(0.25, 0.6, cellPx));
  }
  // Дверца ресивера 5.1 на боку (receiver-door.js): тот же рисунок — Ø6 шаг 10 в
  // шахматном порядке, прямоугольное поле со сплошным краем 20 мм, только на лице.
  float receiverMask = 1.0 - step(0.0015, distance(vColor, RECEIVER_GRILLE));
  if (receiverMask > 0.5 && abs(n.x) > 0.9) {
    vec2 local = vec2(vWorld.y - ${f(GRILLE_FIELD.center[0])}, vWorld.z - ${f(GRILLE_FIELD.center[1])});
    vec2 wall = local / ${f(HOLE_PITCH)} + 0.5;
    wall.x += 0.5 * mod(floor(wall.y), 2.0);
    float cellPx = max(fwidth(wall.x), fwidth(wall.y));
    vec2 offset = fract(wall) - 0.5;
    vec2 centre = abs(local - offset * ${f(HOLE_PITCH)});
    float inField = step(centre.x, ${f(GRILLE_FIELD.half[0] - HOLE_D / 2)}) * step(centre.y, ${f(GRILLE_FIELD.half[1] - HOLE_D / 2)});
    float r = ${f(HOLE_D / 2 / HOLE_PITCH)};
    float hole = inField * (1.0 - smoothstep(r - cellPx, r + cellPx, length(offset)));
    grilleCover = mix(0.28 * inField, hole, 1.0 - smoothstep(0.25, 0.6, cellPx));
  }
  vec3 baseColor = pow(max(albedo, 0.0), vec3(2.2));
  // Двусторонняя геометрия нужна для осмотра изнутри; освещаем ту сторону,
  // которая обращена к камере, вместо прежнего одинакового света на всех гранях.
  if (dot(n, viewDir) < 0.0) n = -n;

  vec3 sunDir = normalize(SUN);
  vec3 fillDir = normalize(FILL);
  vec3 rimDir = normalize(RIM);
  float hemi = n.z * 0.5 + 0.5;
  float luminance = dot(baseColor, vec3(0.2126, 0.7152, 0.0722));
  float textureLuminance = dot(materialSampled, vec3(0.2126, 0.7152, 0.0722));
  float darkFinish = 1.0 - smoothstep(0.035, 0.22, luminance);
  float floorMask = 1.0 - step(0.025, distance(vColor, vec3(0.067, 0.055, 0.047)));
  float roughness = mix(0.62, 0.50, woodMask);
  roughness = mix(roughness, 0.56, sideMask);
  roughness = mix(roughness, 0.48, darkFinish * (1.0 - uMono * 0.65));
  roughness = mix(roughness, 0.82, floorMask);
  roughness = clamp(roughness + woodMask * (textureLuminance - 0.5) * 0.025, 0.38, 0.84);
  vec3 f0 = mix(vec3(0.04), vec3(0.045), max(sideMask, darkFinish * 0.45));
  f0 = mix(f0, vec3(0.018), floorMask);
  float shadow = castShadow(n, sunDir);
  float keyVisibility = mix(0.05, 1.0, shadow);

  // Один источник и одна согласованная карта теней.
  vec3 keyRadiance = vec3(2.62, 2.24, 1.90);
  vec3 shaded = pbrLight(baseColor, n, viewDir, sunDir, keyRadiance, roughness, f0, keyVisibility);
  shaded += pbrLight(baseColor, n, viewDir, fillDir, vec3(0.22, 0.27, 0.36), roughness, f0, 1.0);

  shaded += baseColor * mix(vec3(0.12), vec3(0.32, 0.34, 0.38), hemi);

  float chrome = 1.0 - step(0.01, distance(vColor, CHROME));
  float zinc = 1.0 - step(0.01, distance(vColor, ZINC));
  float metal = max(chrome, zinc);
  if (metal > 0.5) {
    float metalRough = mix(0.32, 0.06, chrome);
    vec3 tint = mix(vec3(0.62, 0.64, 0.66), vec3(0.92, 0.93, 0.95), chrome);
    vec3 r = reflect(-viewDir, n);
    float fres = pow(1.0 - max(dot(n, viewDir), 0.0), 5.0);
    vec3 env = studioReflection(r, sunDir, metalRough) * mix(tint, vec3(1.0), fres);
    shaded = env * mix(0.35, 1.0, shadow);
  }

  // Заливка от ленты. Лента лежит в пазу и смотрит строго вниз, на рабочую
  // поверхность: всё, что выше неё или дальше пояса, света не получает.
  vec4 led = nearestLed(vWorld);
  vec3 fromLed = vWorld - led.xyz;
  float dist = max(length(fromLed), 1.0);
  float radius = length(vWorld.xy - LED_CENTER);
  float below = step(vWorld.z, led.z - 4.0);
  float down = max(-fromLed.z / dist, 0.0);
  float inside = 1.0 - smoothstep(${f(R_BELT_HIGH)}, ${f(R_BELT_HIGH + 170)}, radius);
  // Стенки свет не пропускают: ниже рабочей поверхности он есть только в шахте
  // центрального отверстия. Внутрь холодильника, ящиков и ниши для ног он не попадает.
  float reachable = max(step(SECTOR_Z - 1.0, vWorld.z), 1.0 - step(HOLE_R, radius));
  // Лента находится примерно в 400 мм от рабочей плоскости. Радиус затухания
  // выбран так, чтобы получалось читаемое тёплое пятно под реальной лентой,
  // но свет по-прежнему не заполнял весь корпус.
  float falloff = 1.0 / (1.0 + pow(dist / 950.0, 2.0));
  float cone = uLed * led.w * below * inside * down * reachable;
  // Луч обязан целиком пройти под плитой, включая гнутый переход.
  cone *= ledPlateVisible(led.xyz, vWorld) * (1.0 - step(${f(R_BELT_HIGH + 1)}, radius));
  // Ограниченная декоративная подсветка только внутренней стенки корпуса.
  // Предметы сохраняют отдельное студийное освещение.
  // Прямо под лентой стоят рейки из шпона (beltMask): без него засветка гасла
  // бы на рейках, ровно там, где лента и светит.
  float wallLit = max(sideMask, beltMask) * (1.0 - step(0.1, abs(n.z))) * step(${f(R_BELT_HIGH - 60)}, radius);
  // Сама рабочая плоскость под лентой: только горизонталь на отметке LEVEL_1,
  // поэтому верх предметов на столе засветку по-прежнему не получает.
  float deskLit = uSurfaceTexture * step(0.9, n.z) * (1.0 - step(6.0, abs(vWorld.z - SECTOR_Z)))
    * smoothstep(${f(R_BELT_HIGH - 780)}, ${f(R_BELT_HIGH - 20)}, radius);
  // Мягкий градиент без ступеньки: квадрат smoothstep гасит пятно к центру плавно.
  deskLit *= deskLit;
  cone *= max(wallLit, deskLit * 0.18);
  vec3 ledDir = -fromLed / dist;
  float ledNoL = max(dot(n, ledDir), 0.0);
  vec3 ledRadiance = uLedColor * cone * 7.5 * falloff;
  // Один и тот же источник даёт широкий тёплый wash и более узкий PBR-блик.
  // Поэтому его включение меняет не только пиксели самой линии, но и окружение.
  shaded += baseColor * uLedColor * cone * falloff * ledNoL * 36.0;

  // Подсветка открытого ящика: профиль под вырезом фасада светит в короб и нишу.
  // Теней здесь нет, поэтому каждый источник ограничен объёмом своего ящика.
  // Фактура панели корпуса без мип-карт рябит на расстоянии; под близким светом
  // эта рябь становится муаром. Поэтому здесь панель берётся средним тоном карты.
  vec3 drawerAlbedo = mix(baseColor, pow(vColor * 0.155, vec3(2.2)), sideMask);
  for (int i = 0; i < 9; i++) {
    vec4 drawerLight = uDrawerLight[i];
    if (drawerLight.w <= 0.0) continue;
    if (any(lessThan(vWorld, uDrawerLightMin[i].xyz)) || any(greaterThan(vWorld, uDrawerLightMax[i].xyz))) continue;
    vec3 toLight = drawerLight.xyz - vWorld;
    float d = max(length(toLight), 1.0);
    float ndl = max(dot(n, toLight / d), 0.0);
    shaded += drawerAlbedo * uDrawerLightColor * drawerLight.w * ndl * 22.0 / (1.0 + pow(d / 320.0, 2.0));
  }

  vec3 rgb = shaded;
  rgb = neutralTone(rgb * 1.06);
  rgb = pow(max(rgb, 0.0), vec3(1.0 / 2.2));
  // Отверстия решётки гасим уже после света: иначе блик и заполняющий свет
  // делали чёрную ткань серой.
  rgb *= 1.0 - grilleCover;
  // Светящийся рассеиватель выводится после тонемаппинга: иначе его максимум
  // сжимался до серо-бежевого и визуально не воспринимался источником света.
  // Это всё та же единственная геометрия LED, а не дополнительная полоса.
  rgb = mix(rgb, clamp(uEmissiveColor * 1.15, 0.0, 1.0), uEmissive);
  // Экранная текстура уже хранится в sRGB. Для проверенного emissive-материала
  // показываем её напрямую: без освещения, тонемаппинга и серой добавки, которая
  // раньше выбеливала обои и убивала исходную насыщенность.
  // Матрица MacBook затухает до почти чёрного, а не превращается в серый
  // освещённый прямоугольник. Этим же параметром плавно возвращается картинка.
  vec3 poweredScreen = mix(vec3(0.008, 0.010, 0.014), clamp(sampled * vColor, 0.0, 1.0), uScreenPower);
  rgb = mix(rgb, poweredScreen, uDirectTexture);
  // Пол — конечный квадрат. В Blender его край не виден, потому что свет
  // софтбоксов затухает с расстоянием и пол к краю уходит в цвет фона. Здесь
  // ключевой свет направленный, поэтому то же затухание задаём явно: световое
  // пятно под столом, а к краю пол растворяется ровно в цвет очистки кадра.
  float floorDist = length(vWorld.xy - LED_CENTER);
  float floorFade = smoothstep(1450.0, 2850.0, floorDist);
  rgb = mix(rgb, vec3(0.006, 0.005, 0.004), floorMask * floorFade * (2.0 - floorFade));
  // Схемные слои (стрелки воздуха и кабелей) — чистый цвет без света и тени.
  rgb = mix(rgb, vColor, uFlat);
  vec3 lineColor = mix(vec3(0.10), baseColor, 0.15);
  gl_FragColor = vec4(mix(rgb, lineColor, uUnlit * 0.48), 1.0);
}`;

const SHADOW_VERT = `
precision highp float;
attribute vec3 aPosition;
uniform mat4 uShadowMatrix, uModel;
void main(){ gl_Position = uShadowMatrix * uModel * vec4(aPosition, 1.0); }`;

const SHADOW_FRAG = `
precision highp float;
vec4 packDepth(float depth){
  const vec4 factors = vec4(16777216.0, 65536.0, 256.0, 1.0);
  const vec4 shift = vec4(1.0 / 256.0, 1.0 / 256.0, 1.0 / 256.0, 0.0);
  vec4 rgba = fract(depth * factors);
  return (rgba - rgba.xxyz * shift) * (256.0 / 255.0);
}
void main(){ gl_FragColor = packDepth(gl_FragCoord.z); }`;

function compile(gl, type, source) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(shader));
  return shader;
}

function createProgram(gl) {
  const program = gl.createProgram();
  gl.attachShader(program, compile(gl, gl.VERTEX_SHADER, VERT));
  gl.attachShader(program, compile(gl, gl.FRAGMENT_SHADER, FRAG));
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program));
  return program;
}

function createShadowProgram(gl) {
  const program = gl.createProgram();
  gl.attachShader(program, compile(gl, gl.VERTEX_SHADER, SHADOW_VERT));
  gl.attachShader(program, compile(gl, gl.FRAGMENT_SHADER, SHADOW_FRAG));
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program));
  return program;
}

function createShadowTarget(gl, size) {
  // Глубина упакована в RGBA-текстуру: настоящая shadow map работает и в
  // WebGL 1 без необязательного расширения WEBGL_depth_texture.
  const texture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, size, size, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  const depth = gl.createRenderbuffer();
  gl.bindRenderbuffer(gl.RENDERBUFFER, depth);
  gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT16, size, size);
  const framebuffer = gl.createFramebuffer();
  gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
  gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, depth);
  const ready = gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE;
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  gl.bindRenderbuffer(gl.RENDERBUFFER, null);
  return ready ? { texture, depth, framebuffer, size } : null;
}

function upload(gl, data) {
  if (!data || !data.count) return null;
  const make = (array) => {
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, array, gl.STATIC_DRAW);
    return buffer;
  };
  const normal = data.normal && data.normal.length ? data.normal : new Float32Array(data.count * 3);
  const uv = data.uv && data.uv.length ? data.uv : new Float32Array(data.count * 2);
  return { position: make(data.position), normal: make(normal), color: make(data.color), uv: make(uv), count: data.count };
}

// Картинка из GLB как текстура GPU. В glTF текстурные координаты уже отсчитываются
// от левого верхнего угла картинки, поэтому переворачивать её при загрузке не нужно —
// это тот же выбор, что делает flipY = false в загрузчиках glTF.
function uploadTexture(gl, image, { clamp = false } = {}) {
  const texture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
  const powerOfTwo = (v) => v > 0 && (v & (v - 1)) === 0;
  if (powerOfTwo(image.width) && powerOfTwo(image.height)) {
    gl.generateMipmap(gl.TEXTURE_2D);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
  } else {
    // WebGL 1 не умеет мипмапы и повтор для картинок произвольного размера.
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  }
  if (clamp) {
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  }
  // На наклонённых экранах обычная трилинейная фильтрация даёт муар и полосы.
  // Анизотропия поддерживается всеми актуальными настольными браузерами.
  const anisotropy = gl.getExtension('EXT_texture_filter_anisotropic')
    || gl.getExtension('WEBKIT_EXT_texture_filter_anisotropic')
    || gl.getExtension('MOZ_EXT_texture_filter_anisotropic');
  if (anisotropy) {
    const max = gl.getParameter(anisotropy.MAX_TEXTURE_MAX_ANISOTROPY_EXT);
    gl.texParameterf(gl.TEXTURE_2D, anisotropy.TEXTURE_MAX_ANISOTROPY_EXT, Math.min(8, max));
  }
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  return texture;
}

export function createRenderer(canvas) {
  const gl = canvas.getContext('webgl', { antialias: true, alpha: false, depth: true, powerPreference: 'high-performance' })
    || canvas.getContext('experimental-webgl', { antialias: true, alpha: false });
  if (!gl) return null;
  gl.getExtension('OES_standard_derivatives');

  const program = createProgram(gl);
  const shadowProgram = createShadowProgram(gl);
  const shadowTarget = createShadowTarget(gl, 2048);
  const shadowTargetPoint = [CENTER, CENTER, 500];
  const shadowView = lookAt([-2710, -3190, 5540], shadowTargetPoint, [0, 0, 1]);
  const shadowProjection = orthographic(-4300, 4300, -4300, 4300, 100, 15e3);
  const shadowMatrix = multiply(shadowProjection, shadowView);
  const loc = {
    position: gl.getAttribLocation(program, 'aPosition'),
    normal: gl.getAttribLocation(program, 'aNormal'),
    color: gl.getAttribLocation(program, 'aColor'),
    uv: gl.getAttribLocation(program, 'aUV'),
    projection: gl.getUniformLocation(program, 'uProjection'),
    view: gl.getUniformLocation(program, 'uView'),
    model: gl.getUniformLocation(program, 'uModel'),
    normalMatrix: gl.getUniformLocation(program, 'uNormalMatrix'),
    unlit: gl.getUniformLocation(program, 'uUnlit'),
    emissive: gl.getUniformLocation(program, 'uEmissive'),
    emissiveColor: gl.getUniformLocation(program, 'uEmissiveColor'),
    drawerLight: gl.getUniformLocation(program, 'uDrawerLight'),
    drawerLightMin: gl.getUniformLocation(program, 'uDrawerLightMin'),
    drawerLightMax: gl.getUniformLocation(program, 'uDrawerLightMax'),
    drawerLightColor: gl.getUniformLocation(program, 'uDrawerLightColor'),
    directTexture: gl.getUniformLocation(program, 'uDirectTexture'),
    screenPower: gl.getUniformLocation(program, 'uScreenPower'),
    led: gl.getUniformLocation(program, 'uLed'),
    fade: gl.getUniformLocation(program, 'uFade'),
    eye: gl.getUniformLocation(program, 'uEye'),
    surfaceTint: gl.getUniformLocation(program, 'uSurfaceTint'),
    ledColor: gl.getUniformLocation(program, 'uLedColor'),
    textured: gl.getUniformLocation(program, 'uTextured'),
    mono: gl.getUniformLocation(program, 'uMono'),
    flat: gl.getUniformLocation(program, 'uFlat'),
    surfaceTexture: gl.getUniformLocation(program, 'uSurfaceTexture'),
    textureScale: gl.getUniformLocation(program, 'uTextureScale'),
    textureGain: gl.getUniformLocation(program, 'uTextureGain'),
    sideTexture: gl.getUniformLocation(program, 'uSideTexture'),
    shadowMatrix: gl.getUniformLocation(program, 'uShadowMatrix'),
    shadowMap: gl.getUniformLocation(program, 'uShadowMap'),
    shadowTexel: gl.getUniformLocation(program, 'uShadowTexel'),
    shadowEnabled: gl.getUniformLocation(program, 'uShadowEnabled'),
    sampler: gl.getUniformLocation(program, 'uTexture'),
    sideSampler: gl.getUniformLocation(program, 'uSideMap'),
  };
  const shadowLoc = {
    position: gl.getAttribLocation(shadowProgram, 'aPosition'),
    matrix: gl.getUniformLocation(shadowProgram, 'uShadowMatrix'),
    model: gl.getUniformLocation(shadowProgram, 'uModel'),
  };
  gl.useProgram(program);
  gl.enable(gl.DEPTH_TEST);
  gl.disable(gl.CULL_FACE);
  gl.clearColor(0.006, 0.005, 0.004, 1);
  canvas.setAttribute('data-shadow-map', shadowTarget ? 'ready' : 'unsupported');
  canvas.removeAttribute('data-contact-shadows');
  canvas.setAttribute('data-bloom', 'disabled');
  gl.disable(gl.DITHER);

  const bind = (buffers) => {
    for (const [name, index, size] of [['position', loc.position, 3], ['normal', loc.normal, 3], ['color', loc.color, 3], ['uv', loc.uv, 2]]) {
      if (index < 0) continue;
      gl.bindBuffer(gl.ARRAY_BUFFER, buffers[name]);
      gl.enableVertexAttribArray(index);
      gl.vertexAttribPointer(index, size, gl.FLOAT, false, 0, 0);
    }
  };

  const drawShadowMap = (groups) => {
    if (!shadowTarget) return;
    gl.bindFramebuffer(gl.FRAMEBUFFER, shadowTarget.framebuffer);
    gl.viewport(0, 0, shadowTarget.size, shadowTarget.size);
    // Белый RGBA распаковывается как глубина дальше дальней плоскости. Если здесь
    // оставить чёрный фон студии, весь кадр ошибочно окажется в тени.
    gl.clearColor(1, 1, 1, 1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.useProgram(shadowProgram);
    gl.uniformMatrix4fv(shadowLoc.matrix, false, shadowMatrix);
    gl.enable(gl.POLYGON_OFFSET_FILL);
    gl.polygonOffset(2.0, 4.0);
    for (const g of groups) {
      if (!g.visible || !g.mesh || !g.castShadow) continue;
      gl.uniformMatrix4fv(shadowLoc.model, false, g.model);
      gl.bindBuffer(gl.ARRAY_BUFFER, g.mesh.position);
      gl.enableVertexAttribArray(shadowLoc.position);
      gl.vertexAttribPointer(shadowLoc.position, 3, gl.FLOAT, false, 0, 0);
      gl.drawArrays(gl.TRIANGLES, 0, g.mesh.count);
    }
    gl.disable(gl.POLYGON_OFFSET_FILL);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.clearColor(0.006, 0.005, 0.004, 1);
  };

  return {
    gl,
    // Готовит группы модели к отрисовке; возвращает объекты с буферами.
    prepare(groups) {
      return groups.map((g) => ({
        name: g.name,
        part: g.part || null,
        packages: g.packages || null,
        // Исходные треугольники нужны для выбора детали курсором, коробка — чтобы
        // не перебирать их, когда луч заведомо мимо.
        source: g.mesh,
        bounds: computeBounds(g.mesh && g.mesh.position),
        mesh: upload(gl, g.mesh),
        lines: upload(gl, g.lines),
        texture: g.texture ? uploadTexture(gl, g.texture, { clamp: !!g.clampTexture }) : null,
        sideMap: g.sideTexture ? uploadTexture(gl, g.sideTexture) : null,
        surfaceTexture: !!g.surfaceTexture,
        surfaceTint: g.surfaceTint || [1, 1, 1],
        sideTexture: !!g.sideTexture,
        noFade: !!g.noFade,
        depthPriority: !!g.depthPriority,
        mono: !!g.mono,
        flat: !!g.flat,
        overlay: !!g.overlay,
        xray: !!g.xray,
        model: identity(),
        emissive: g.emissive || 0,
        // Цвет свечения: по умолчанию — цвет основной LED, у подсветки ящиков свой.
        emissiveColor: g.emissiveColor || null,
        directTexture: g.directTexture || 0,
        screenPower: g.screenPower ?? 1,
        castShadow: g.castShadow !== false,
        visible: true,
      }));
    },
    resize(width, height) {
      canvas.width = width;
      canvas.height = height;
      gl.viewport(0, 0, width, height);
    },
    draw(groups, projection, view, { ledLevel = 0, ledColor = [1, 0.72, 0.46], eye = [0, 0, 0], fade = 0, drawerLights = [], drawerLightColor = [1, 0.74, 0.47] } = {}) {
      drawShadowMap(groups);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.useProgram(program);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      gl.uniformMatrix4fv(loc.projection, false, projection);
      gl.uniformMatrix4fv(loc.view, false, view);
      gl.uniformMatrix4fv(loc.shadowMatrix, false, shadowMatrix);
      gl.uniform2f(loc.shadowTexel, shadowTarget ? 1 / shadowTarget.size : 0, shadowTarget ? 1 / shadowTarget.size : 0);
      gl.uniform1f(loc.shadowEnabled, shadowTarget ? 1 : 0);
      if (shadowTarget) {
        gl.activeTexture(gl.TEXTURE1);
        gl.bindTexture(gl.TEXTURE_2D, shadowTarget.texture);
        gl.uniform1i(loc.shadowMap, 1);
      }
      gl.uniform1f(loc.led, ledLevel);
      gl.uniform3fv(loc.ledColor, ledColor);
      gl.uniform3fv(loc.eye, eye);
      // До девяти источников подсветки ящиков: неиспользуемые с нулевой яркостью.
      const light = new Float32Array(36), lo = new Float32Array(36), hi = new Float32Array(36);
      drawerLights.slice(0, 9).forEach((d, i) => {
        light.set([...d.position, d.level], i * 4);
        lo.set([...d.min, 0], i * 4);
        hi.set([...d.max, 0], i * 4);
      });
      gl.uniform4fv(loc.drawerLight, light);
      gl.uniform4fv(loc.drawerLightMin, lo);
      gl.uniform4fv(loc.drawerLightMax, hi);
      gl.uniform3fv(loc.drawerLightColor, drawerLightColor);

      // Грани слегка отодвигаются, чтобы контурные линии всегда были поверх них.
      gl.enable(gl.POLYGON_OFFSET_FILL);
      // Схемные слои рисуются последними и поверх корпуса: стрелки идут внутри стенок.
      const ordered = groups.some((g) => g.overlay) ? [...groups.filter((g) => !g.overlay), ...groups.filter((g) => g.overlay)] : groups;
      // Рентген (xray) — тоже поверх корпуса, но со своей глубиной: детали схемы
      // электрики перекрывают друг друга правильно. Буфер глубины очищается один
      // раз, перед первым таким слоем, — корпус к этому времени уже нарисован.
      let xrayDepth = false;
      for (const g of ordered) {
        if (!g.visible || !g.mesh) continue;
        if (g.xray && !xrayDepth) { gl.clear(gl.DEPTH_BUFFER_BIT); xrayDepth = true; }
        if (g.overlay && !g.xray) gl.disable(gl.DEPTH_TEST);
        gl.uniformMatrix4fv(loc.model, false, g.model);
        gl.uniformMatrix3fv(loc.normalMatrix, false, normalMatrix3(g.model));
        gl.uniform1f(loc.unlit, 0);
        gl.uniform1f(loc.emissive, g.emissive);
        gl.uniform3fv(loc.emissiveColor, g.emissiveColor || ledColor);
        gl.uniform1f(loc.directTexture, g.directTexture);
        gl.uniform1f(loc.screenPower, g.screenPower);
        gl.uniform1f(loc.fade, g.noFade ? 0 : fade);
        gl.uniform1f(loc.textured, g.texture ? 1 : 0);
        gl.uniform1f(loc.mono, g.mono ? 1 : 0);
        gl.uniform1f(loc.flat, g.flat ? 1 : 0);
        gl.uniform1f(loc.surfaceTexture, g.surfaceTexture ? 1 : 0);
        gl.uniform1f(loc.textureScale, g.textureScale || 1);
        gl.uniform1f(loc.textureGain, g.textureGain || 1);
        gl.uniform3fv(loc.surfaceTint, g.surfaceTint || [1, 1, 1]);
        gl.uniform1f(loc.sideTexture, g.sideTexture ? 1 : 0);
        // Экранные полигоны подтягиваем к камере только на этапе теста глубины.
        // Сама геометрия и физическое положение модели остаются неизменными.
        gl.polygonOffset(g.depthPriority ? -2.0 : 1.2, g.depthPriority ? -4.0 : 2.0);
        if (g.texture) {
          gl.activeTexture(gl.TEXTURE0);
          gl.bindTexture(gl.TEXTURE_2D, g.texture);
          gl.uniform1i(loc.sampler, 0);
        }
        gl.activeTexture(gl.TEXTURE2);
        gl.bindTexture(gl.TEXTURE_2D, g.sideMap || g.texture);
        gl.uniform1i(loc.sideSampler, 2);
        bind(g.mesh);
        gl.drawArrays(gl.TRIANGLES, 0, g.mesh.count);
        if (g.overlay && !g.xray) gl.enable(gl.DEPTH_TEST);
      }
      gl.disable(gl.POLYGON_OFFSET_FILL);

      // В фоторежиме геометрию читают свет, блики и реальные зазоры. Отдельный
      // чертёжный контур поверх граней намеренно не рисуем.
    },
    setTexture(group, image, { surfaceOnly = false, scale = 1, gain = 1 } = {}) {
      if (!group || !image) return;
      group.texture = uploadTexture(gl, image);
      group.surfaceTexture = surfaceOnly;
      group.textureScale = scale;
      group.textureGain = gain;
    },
    setSideTexture(group, image) {
      if (!group || !image) return;
      group.sideMap = uploadTexture(gl, image);
      group.sideTexture = true;
    },
    setSurfaceTint(group, tint) {
      if (!group || !Array.isArray(tint) || tint.length !== 3) return;
      group.surfaceTint = tint.slice();
    },
  };
}
