// Discover every unit test, including new domain subdirectories.
// Resolve from this file so execution does not depend on the caller's directory.
import { readdir } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = fileURLToPath(new URL('../', import.meta.url));
async function discover(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const groups = await Promise.all(entries.map(entry => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return discover(path);
    return entry.isFile() && entry.name.endsWith('.test.ts') ? [path] : [];
  }));
  return groups.flat();
}
const files = (await Promise.all(['src', 'scripts'].map(dir => discover(join(root, dir)))))
  .flat().map(path => relative(root, path)).sort();
if (!files.length) throw new Error('No unit tests discovered.');
if (process.argv.includes('--list')) {
  console.log(files.join('\n'));
} else {
  const result = spawnSync(process.execPath, ['--experimental-strip-types', '--test', ...files], {
    cwd: root, stdio: 'inherit',
  });
  if (result.error) throw result.error;
  process.exitCode = result.status ?? 1;
}
