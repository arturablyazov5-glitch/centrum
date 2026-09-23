// Тумблер CENTRUM: разметка компонента из toggle.css. Подпись и обёртку-label
// задаёт вызывающий код — тумблер бывает и в строке опции, и плашкой поверх сцены.
export function toggleControl({ checked = false, attrs = '' } = {}) {
  return `<input type="checkbox" class="toggle-input" ${attrs} ${checked ? 'checked' : ''}><span class="toggle" aria-hidden="true"></span>`;
}
