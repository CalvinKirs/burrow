// Builds the unpacked extension into dist/. Each entry needs its own output format
// (IIFE content script, ES module worker, HTML pages), so they are separate Vite builds.
import { execFileSync } from 'node:child_process';
import { cpSync, existsSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { build } from 'vite';

const root = import.meta.dirname;
const dist = resolve(root, 'dist');
const minify = !process.argv.includes('--dev');

const base = { configFile: false, logLevel: 'warn', publicDir: false };
const out = { outDir: dist, emptyOutDir: false, minify, modulePreload: false, target: 'chrome120' };

rmSync(dist, { recursive: true, force: true });

await build({
  ...base,
  root: resolve(root, 'src/pages'),
  base: './',
  build: {
    ...out,
    rollupOptions: { input: ['options', 'popup', 'offscreen'].map((n) => resolve(root, `src/pages/${n}.html`)) },
  },
});

await build({
  ...base,
  build: {
    ...out,
    rollupOptions: {
      input: resolve(root, 'src/background/index.ts'),
      output: { format: 'es', entryFileNames: 'background.js', inlineDynamicImports: true },
    },
  },
});

await build({
  ...base,
  build: {
    ...out,
    rollupOptions: {
      input: resolve(root, 'src/content/index.ts'),
      output: { format: 'iife', entryFileNames: 'content.js', inlineDynamicImports: true },
    },
  },
});

await build({
  ...base,
  build: {
    ...out,
    rollupOptions: {
      input: resolve(root, 'src/mermaid/index.ts'),
      preserveEntrySignatures: 'strict',
      output: { format: 'es', entryFileNames: 'mermaid.js', chunkFileNames: 'chunks/[name]-[hash].js' },
    },
  },
});

cpSync(resolve(root, 'manifest.json'), resolve(dist, 'manifest.json'));
cpSync(resolve(root, 'src/content/styles.css'), resolve(dist, 'content.css'));
cpSync(resolve(root, 'static/icons'), resolve(dist, 'icons'), { recursive: true });
for (const name of ['LICENSE', 'NOTICE']) cpSync(resolve(root, name), resolve(dist, name));
writeFileSync(resolve(dist, 'THIRD-PARTY-LICENSES.txt'), thirdPartyLicenses());
console.log('Built dist/');

/** License texts of every production dependency, since their code is bundled into dist/. */
function thirdPartyLicenses() {
  const dirs = execFileSync('npm', ['ls', '--omit=dev', '--all', '--parseable'], { cwd: root, encoding: 'utf8' })
    .split('\n')
    .filter((dir) => dir && dir !== root);
  const sections = new Map();
  for (const dir of dirs) {
    if (!existsSync(dir)) continue;
    const pkg = JSON.parse(readFileSync(resolve(dir, 'package.json'), 'utf8'));
    const file = readdirSync(dir).find((f) => /^(licen[sc]e|copying)/i.test(f));
    const text = file ? readFileSync(resolve(dir, file), 'utf8').trim() : '(no license file in package)';
    const license = typeof pkg.license === 'string' ? pkg.license : 'see below';
    sections.set(`${pkg.name}@${pkg.version}`, `${pkg.name}@${pkg.version} (${license})\n\n${text}`);
  }
  const rule = `\n\n${'-'.repeat(80)}\n\n`;
  return [...sections.keys()].sort().map((key) => sections.get(key)).join(rule) + '\n';
}
