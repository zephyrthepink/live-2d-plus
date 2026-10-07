# Third-party notices

These notices describe the bundled dependencies and assets. The extension's own
license does not replace their upstream licenses. Preserve `licenses/`, this
file, generated `dist/*.LICENSE.txt` files, and notices embedded in the cores.

| Component | Source | License / notice |
| --- | --- | --- |
| PixiJS 7.4.2 | [pixijs/pixijs](https://github.com/pixijs/pixijs) | MIT; [license](licenses/pixi.js.txt) |
| Pixi filters 5.3.0 | [pixijs/filters](https://github.com/pixijs/filters) | MIT; [license](licenses/pixi-filters.txt) |
| Live2D display lipsync patch 0.5.0-ls-8 | [RaSan147/pixi-live2d-display](https://github.com/RaSan147/pixi-live2d-display) | MIT; [license](licenses/pixi-live2d-display-lipsyncpatch.txt) |
| React / ReactDOM 18.2.0 | [facebook/react](https://github.com/facebook/react) | MIT; [React](licenses/react.txt), [ReactDOM](licenses/react-dom.txt) |
| Vosk Browser 0.0.8 | [ccoreilly/vosk-browser](https://github.com/ccoreilly/vosk-browser) | Apache-2.0; [license](licenses/Apache-2.0.txt) |
| Vosk small English model 0.15 | [Vosk model list](https://alphacephei.com/vosk/models) | Apache-2.0; [license](licenses/Apache-2.0.txt). Original model repackaged as `.tar.gz` for Vosk Browser. |
| Live2D Cubism 2 / Cubism Core | `src/lib/live2d.min.js`, `src/lib/live2dcubismcore.min.js` | Live2D proprietary runtime terms. The Cubism Core header identifies this as Redistributable Code and links to the [Live2D agreement](https://www.live2d.com/eula/live2d-proprietary-software-license-agreement_en.html). |
| Ngaco font | `assets/fonts/ngaco/Ngaco.ttf` | Copyright (c) 2026 Khurasan. Font metadata links to [Khurasan Studio licensing](https://khurasanstudio.com/license/). Original font metadata is preserved. |

The default Shizuku demo model is loaded from its external source rather than
included in this repository. User-installed model files keep their own licenses.
