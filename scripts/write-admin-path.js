// scripts/write-admin-path.js
//
// FIX (direct request: "how do we go about" the admin's separate
// installable app, then "sure" to wiring it to an env var so it can't
// drift): the admin-only PWA (see index.html's manifest-swap script
// and public/manifest-admin.json) needs the SAME path in three
// places - App.jsx's route, index.html's inline swap script, and
// manifest-admin.json's start_url/scope. App.jsx already reads
// VITE_ADMIN_PATH via import.meta.env at runtime, which is the
// correct way to do it inside the React bundle. index.html and
// manifest-admin.json are both static files copied/transformed
// BEFORE any React code runs, though, so they can't read
// import.meta.env - this script is what keeps them in sync with the
// same source of truth instead, run before every build exactly like
// write-build-id.js already is.
//
// Uses Vite's own loadEnv (not a separate dotenv dependency) so this
// reads .env/.env.production the exact same way `vite build` itself
// will - if VITE_ADMIN_PATH isn't set anywhere, both this script and
// App.jsx fall back to the same literal default, so they can never
// disagree.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { loadEnv } from 'vite';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

const DEFAULT_ADMIN_PATH = '/admin-portal-access-secret';

const mode = process.env.NODE_ENV === 'development' ? 'development' : 'production';
const env = loadEnv(mode, root, 'VITE_');
const adminPath = env.VITE_ADMIN_PATH || DEFAULT_ADMIN_PATH;

if (!adminPath.startsWith('/')) {
  throw new Error(`[write-admin-path] VITE_ADMIN_PATH must start with '/', got: ${adminPath}`);
}

// 1) manifest-admin.json - start_url and scope both need to match
//    exactly, or a browser-installed admin shortcut will either land
//    somewhere wrong or refuse to stay "standalone" once it navigates.
const manifestPath = path.resolve(root, 'public', 'manifest-admin.json');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
manifest.start_url = adminPath;
manifest.scope = adminPath;
fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');

// 2) index.html - the inline manifest-swap script runs before any
//    React code (or import.meta.env) is available, so its ADMIN_PATH
//    constant is baked in here as plain text rather than read at
//    runtime. The regex only ever touches that one literal - it's
//    anchored to the surrounding `var ADMIN_PATH = '...'` assignment
//    so nothing else in index.html can accidentally match.
const indexHtmlPath = path.resolve(root, 'index.html');
let indexHtml = fs.readFileSync(indexHtmlPath, 'utf8');
const adminPathPattern = /var ADMIN_PATH = '[^']*';/;
if (!adminPathPattern.test(indexHtml)) {
  throw new Error('[write-admin-path] Could not find the ADMIN_PATH assignment in index.html - has the manifest-swap script been changed?');
}
indexHtml = indexHtml.replace(adminPathPattern, `var ADMIN_PATH = '${adminPath}';`);
fs.writeFileSync(indexHtmlPath, indexHtml);

console.log(`[write-admin-path] Synced admin PWA path to: ${adminPath}`);
