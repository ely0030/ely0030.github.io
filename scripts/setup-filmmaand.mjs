import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../', import.meta.url));
if (Number(process.versions.node.split('.')[0]) < 24) {
  console.error('Filmmaand development requires Node 24 or newer (node:sqlite). With nvm: nvm install && nvm use');
  process.exit(1);
}
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
for (const [command, args] of [
  [npm, ['ci', '--no-audit', '--no-fund']],
  [npm, ['--prefix', 'filmmaand-server', 'ci', '--no-audit', '--no-fund']],
  [process.execPath, ['scripts/prepare-filmmaand.mjs']],
]) {
  const result = spawnSync(command, args, { cwd: root, stdio: 'inherit' });
  if (result.error) console.error(result.error.message);
  if (result.error || result.status !== 0) process.exit(result.status || 1);
}
console.log('Ready: npm run dev:filmmaand (isolated sample app) or npm run dev:site (Astro pages).');
