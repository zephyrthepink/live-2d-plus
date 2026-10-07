/* global __webpack_public_path__ */

// Webpack derives this from the bundle's own URL. SillyTavern loads extensions
// as modules, where document.currentScript is null; scanning script tags could
// accidentally select a different extension's folder.
export const EXTENSION_WEB_PATH = new URL('../', __webpack_public_path__).pathname.replace(/\/$/, '');
