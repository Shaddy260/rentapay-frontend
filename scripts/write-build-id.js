// scripts/write-build-id.js
//
// FIX: this used to live inside vite.config.js as a custom plugin
// (fs/path/fileURLToPath + a buildStart hook). That broke Cloudflare
// Pages' `wrangler deploy` step, which does its own parsing of
// vite.config.js and choked on the extra code ("Error parsing file:
// vite.config.js") even though `vite build` itself succeeded fine.
// Moved out to a plain, ordinary Node script run before `vite build`
// (see package.json's "build" script) - vite.config.js is back to its
// original, deploy-tool-safe shape.
//
// FIX: package.json has "type": "module", so this file is loaded as
// an ES module - plain require() throws ("require is not defined in
// ES module scope"). Uses import/fileURLToPath instead, same pattern
// already used elsewhere in this project (e.g. vite.config.js before
// it was simplified).
//
// Writes the SAME build id to two places so they can be compared at
// runtime:
//   - public/version.json  - copied verbatim into dist/ by Vite,
//     served as a static, always-fetchable file the running app polls.
//   - .env.production       - VITE_-prefixed vars here are picked up
//     automatically by Vite's built-in env loading (no vite.config.js
//     changes needed) and baked into the bundle as
//     import.meta.env.VITE_BUILD_ID.
//
// See src/components/UpdateChecker.jsx for what actually compares
// these and prompts a refresh.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const buildId = String(Date.now());

fs.writeFileSync(
  path.resolve(__dirname, '..', 'public', 'version.json'),
  JSON.stringify({ buildId })
);

// FIX: this used to fully overwrite .env.production with only the
// build id line, silently wiping out any other VITE_* vars a person
// had added (VITE_API_BASE_URL, VITE_ADMIN_PATH, VITE_GOOGLE_CLIENT_ID,
// etc.) on every single build. Now reads whatever's already there,
// replaces just the VITE_BUILD_ID line (or appends it if missing),
// and leaves every other line untouched.
const envPath = path.resolve(__dirname, '..', '.env.production');
let existingLines = [];
try {
  existingLines = fs.readFileSync(envPath, 'utf8').split('\n').filter(Boolean);
} catch {
  // File doesn't exist yet - fine, we'll create it fresh below.
}
const withoutBuildId = existingLines.filter((line) => !line.startsWith('VITE_BUILD_ID='));
withoutBuildId.push(`VITE_BUILD_ID=${buildId}`);
fs.writeFileSync(envPath, withoutBuildId.join('\n') + '\n');

console.log(`[write-build-id] Stamped build ${buildId}`);
