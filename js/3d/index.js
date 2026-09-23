// Точка входа 3D-блока: единственное, что подключается из centrum.html.
// Карточка встаёт первой секцией листа, сразу под шапкой: объёмная модель —
// это то, с чего смотрят проект, а чертежи идут после неё.

import { createCard } from './card.js?v=20260923-sockets3';

function mount() {
  const monolith = document.querySelector('.sheet.monolith');
  if (!monolith || document.querySelector('#section-3d')) return;
  // Вставка сразу после шапки листа; если шапки нет — просто в начало.
  const head = monolith.querySelector(':scope > .head');
  const place = (node) => (head ? head.after(node) : monolith.prepend(node));
  try {
    place(createCard());
  } catch (error) {
    // Молча пропасть карточка не должна: причина видна и на странице, и в консоли.
    console.error('3D-карточка не построилась:', error);
    const note = document.createElement('section');
    note.className = 'monolith-section';
    note.id = 'section-3d';
    note.innerHTML = '<div class="monolith-title"><span class="num">3D</span><h2>Интерактивная модель</h2></div>'
      + `<p class="viewer-fallback">Модель не построилась: ${error.message}. Подробности — в консоли браузера.</p>`;
    place(note);
  }
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount);
else mount();
