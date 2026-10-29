# Licenses for third-party assets

All third-party assets used by the workbench are free to use. The table lists each file, where it comes from and its licence.

| File | Source | Licence |
|---|---|---|
| `public/models/feather_esp32s3.glb` | Adafruit_CAD_Parts, `Feather ESP32-S3` STEP (https://github.com/adafruit/Adafruit_CAD_Parts), converted to GLB and simplified by `scripts/convert-models.mjs` | MIT, Copyright (c) 2016 Adafruit Industries |
| `public/models/micro_servo.glb` | Adafruit_CAD_Parts, micro servo STEP, converted and simplified the same way | MIT, Copyright (c) 2016 Adafruit Industries |
| `public/models/battery_4xaa.glb` | Adafruit_CAD_Parts, 4×AA battery holder STEP, converted and simplified the same way | MIT, Copyright (c) 2016 Adafruit Industries |
| `public/env/studio_small_09_1k.hdr` | Poly Haven, "Studio Small 09" (https://polyhaven.com/a/studio_small_09) | CC0 1.0 (public domain) |
| `public/textures/wood_table_001_*_1k.jpg` | Poly Haven, "Wood Table 001" (https://polyhaven.com/a/wood_table_001) | CC0 1.0 (public domain) |

Everything else in the 3D scene was made in code for this project: the iron and stand, solder spool, flux pen, wick, solder pump, screwdriver, wire stripper, multimeter, USB-C cable, wires, solder joints, the mat and smoke textures, labels and the robot.

Tools used only at development time (they are not bundled into the site):

- `occt-import-js`: LGPL-2.1, reads the STEP files.
- `@gltf-transform/*` and `meshoptimizer`: MIT, write and compress the GLB files.

The site itself uses React, three.js, @react-three/fiber, @react-three/drei, zustand and Tailwind CSS. All of these are MIT.

## Adafruit_CAD_Parts licence text

```
MIT License

Copyright (c) 2016 Adafruit Industries

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```
