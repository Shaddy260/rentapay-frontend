// scripts/write-manager-path.js
//
// SECTION 3 (General Manager dedicated login) - same reasoning as
// write-admin-path.js: the General Manager PWA (index.html's
// manifest-swap script + public/manifest-manager.json) needs the SAME
// path as App.jsx's route. App.jsx reads VITE_MANAGER_PATH via
// import.meta.env at runtime, which works fine inside the React
// bundle - but index.html and manifest-manager.json are both static
// files that exist before any React code runs, so they can't read
// import.meta.env. This script keeps them in sync with the same
// source of truth, run before every build exactly like
// write-admin-path.js already is.
//
// Uses Vite's own loadEnv (not a separate dotenv dependency) so this
// reads .env/.env.production the exact same way `vite build` itself
// will - if VITE_MANAGER_PATH isn't set anywhere, both this script and
// App.jsx fall back to the same literal default, so they can never
// disagree.

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { loadEnv } from 'vite';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

const DEFAULT_MANAGER_PATH = '/manager-account';

const mode = process.env.NODE_ENV === 'development' ? 'development' : 'production';
const env = loadEnv(mode, root, 'VITE_');
const managerPath = env.VITE_MANAGER_PATH || DEFAULT_MANAGER_PATH;

if (!managerPath.startsWith('/')) {
  throw new Error(`[write-manager-path] VITE_MANAGER_PATH must start with '/', got: ${managerPath}`);
}

// 1) manifest-manager.json - start_url and scope both need to match
//    exactly, or a browser-installed shortcut will either land
//    somewhere wrong or refuse to stay "standalone" once it navigates.
const manifestPath = path.resolve(root, 'public', 'manifest-manager.json');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
manifest.start_url = managerPath;
manifest.scope = managerPath;
fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');

// 2) index.html - the inline manifest-swap script runs before any
//    React code (or import.meta.env) is available, so its
//    MANAGER_PATH constant is baked in here as plain text rather than
//    read at runtime. The regex only ever touches that one literal -
//    it's anchored to the surrounding `var MANAGER_PATH = '...'`
//    assignment so nothing else in index.html can accidentally match.
const indexHtmlPath = path.resolve(root, 'index.html');
let indexHtml = fs.readFileSync(indexHtmlPath, 'utf8');
const managerPathPattern = /var MANAGER_PATH = '[^']*';/;
if (!managerPathPattern.test(indexHtml)) {
  throw new Error('[write-manager-path] Could not find the MANAGER_PATH assignment in index.html - has the manifest-swap script been changed?');
}
indexHtml = indexHtml.replace(managerPathPattern, `var MANAGER_PATH = '${managerPath}';`);
fs.writeFileSync(indexHtmlPath, indexHtml);

console.log(`[write-manager-path] Synced General Manager PWA path to: ${managerPath}`);
