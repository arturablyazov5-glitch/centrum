# Generated walnut albedo

Generated with the built-in imagegen tool on 2026-09-20 for CENTRUM furniture
look development. `albedo.png` is a new material image, not a paint-over of a
render or a crop of the supplied concept photographs.

Intended mapping: 1.2 m field, horizontal grain. Shader in
`tools/render-premium.py` derives gentle roughness variation and very shallow
micro-bump from the same albedo. These are artistic approximations, not scanned
or independently measured PBR maps. Tiling is requested from the generator;
there is no mathematical guarantee of exact edge continuity.

24.09.2026: `albedo.png` пересобран из этой же генерации в бесшовную клетку
1034 × 2508 px без новой генерации. По длине волокна правый край плавно
перетекает в левый на полосе 220 px (smoothstep), поперёк волокна добавлена
зеркальная копия — книжный подбор, как стыкуют листы шпона. Плотность прежняя,
около 1045 px/м: поле 0,99 м вдоль волокна и 2,4 м поперёк
(`WOOD_U`/`WOOD_V` в `tools/update-graphite-metal-geometry.py`).
