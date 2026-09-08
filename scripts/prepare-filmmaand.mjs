import { createReadStream, createWriteStream } from 'node:fs';
import { mkdir, readFile, rename, rm, copyFile } from 'node:fs/promises';
import { createGunzip } from 'node:zlib';
import { pipeline } from 'node:stream/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const root = new URL('../', import.meta.url);
const manifest = JSON.parse(await readFile(new URL('filmmaand-data/manifest.json', root), 'utf8'));
const destination = new URL('filmmaand-server/data/', root);
await mkdir(destination, { recursive: true });
for (const [name, expected] of Object.entries(manifest)) {
  const target = new URL(name, destination);
  const temporary = fileURLToPath(target) + '.partial';
  try {
    await pipeline(createReadStream(new URL(`filmmaand-data/${name}.gz`, root)), createGunzip(), createWriteStream(temporary));
    const hash = createHash('sha256');
    let bytes = 0;
    for await (const chunk of createReadStream(temporary)) { hash.update(chunk); bytes += chunk.length; }
    if (bytes !== expected.bytes || hash.digest('hex') !== expected.sha256) throw new Error(`Catalogue integrity failed: ${name}`);
    await rename(temporary, target);
    console.log(`Prepared ${name} (${bytes} bytes, verified)`);
  } finally { await rm(temporary, { force: true }); }
}

// Public programme keeps its existing assets; only its canonical document route changes.
await mkdir(new URL('public/filmmaand/programma/', root), {recursive:true});
await copyFile(new URL('public/filmmaand/agenda/index.html', root),new URL('public/filmmaand/programma/index.html', root));
