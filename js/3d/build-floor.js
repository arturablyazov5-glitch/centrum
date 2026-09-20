// Матовый студийный пол. Масштаб теперь читается по самой модели, а не по
// чертёжной сетке: чистая плоскость лучше принимает свет и контактную тень.

import { SIZE } from './params.js';
import { addQuad } from './mesh.js';
import { PALETTE } from './palette.js?v=20260908-14';

const MARGIN = 1600;                 // запас пола вокруг пятна стола

const min = -MARGIN, max = SIZE + MARGIN;

export function buildFloor(mesh) {
  addQuad(mesh, [min, min, -2], [max, min, -2], [max, max, -2], [min, max, -2], PALETTE.floor);
}

export function floorGrid(lines) {
  // Оставлено как пустой построитель для общего интерфейса групп.
}
