# Текстуры CENTRUM

- `tabletop-walnut.png` — древесина столешниц, торцов и нижнего шпона.
- `macbook-screen.png` — изображение экрана MacBook Pro (для своей картинки удобнее формат 16:10).
- `monitor-screen.png` — изображение ультраширокого монитора (используйте широкий панорамный кадр).
- `pbr/smoked-walnut-veneer/` — 4K PBR-карты копчёного орехового шпона
  (Diffuse, Roughness, Normal OpenGL, Displacement). Источник: Poly Haven,
  `smoked_walnut_veneer`, автор Jenelle van Heerden, лицензия CC0.
- `pbr/dark-walnut-veneer/` — три подготовленные 4K-карты натурального тёмного
  ореха для Blender: `Walnut_BaseColor.png`, `Walnut_Roughness.png`,
  `Walnut_Normal.png`. Они получены из исходного скана выше скриптом
  `tools/build-dark-walnut-maps.py`; приложенный коллаж в картах не используется.

Чтобы заменить экран, сохраните свою PNG-картинку под тем же именем и перезагрузите
`centrum.html`. Пиксельный размер может быть любым; соотношение сторон лучше подобрать
под форму видимой матрицы, иначе изображение будет растянуто UV-развёрткой модели.
