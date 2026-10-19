// Контур комплекта из той же геометрии, что и чертёж №30.
import { PAD, padPath, bridgePadPath } from './3d/worktop-pad.js';
export function worktopPadDiagram() {
  return `<svg viewBox="0 0 2800 2800" role="img" aria-label="Накладка сверху: основная часть вокруг пользователя и отдельная деталь на подъёмный мост">
    <rect x="25" y="25" width="2650" height="2650" rx="200" fill="none" stroke="#555158" stroke-width="14"/>
    <circle cx="${PAD.cx}" cy="${PAD.cy}" r="1240" fill="none" stroke="#555158" stroke-width="10" stroke-dasharray="22 35"/>
    <path d="${padPath()}" transform="translate(${PAD.cx} ${PAD.cy})" fill="#454449" stroke="#a8a19a" stroke-width="14"/>
    <path d="${bridgePadPath()}" fill="#e8a961" fill-opacity=".7" stroke="#e8a961" stroke-width="16"/>
    <circle cx="${PAD.cx}" cy="${PAD.cy}" r="120" fill="#f2f0ed"/>
    <circle cx="${PAD.cx}" cy="${PAD.cy}" r="230" fill="none" stroke="#6d6a65" stroke-width="12"/>
  </svg>`;
}
