import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const packageRoot = path.resolve(__dirname, '..');
const repositoryRoot = path.resolve(packageRoot, '..', '..');

const rootPackagePath = path.join(repositoryRoot, 'package.json');
const cliPackagePath = path.join(packageRoot, 'package.json');

const entrypoints = [
  'src/bin/cli.js',
  'src/bin/reportXml.js',
  'src/bin/startTest.js',
  'src/bin/uploadArtifacts.js',
];

const assetDirectories = [
  'src/template',
  'types',
];

const importSpecifierPattern =
  /(?:import|export)\s+(?:[^'"]*?\s+from\s+)?['"]([^'"]+)['"]|import\(\s*['"]([^'"]+)['"]\s*\)/g;

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function writeJson(filePath, data) {
  fs.writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`);
}

function copyDirectory(source, destination) {
  if (!fs.existsSync(source)) return;

  fs.rmSync(destination, { recursive: true, force: true });
  fs.cpSync(source, destination, { recursive: true });
}

function copyFile(source, destination) {
  if (!fs.existsSync(source)) return;

  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.copyFileSync(source, destination);
}

function toPackageRelativePath(filePath) {
  return path.relative(repositoryRoot, filePath).replace(/\\/g, '/');
}

function resolveRelativeImport(importerPath, specifier) {
  if (!specifier.startsWith('.')) return null;

  const basePath = path.resolve(path.dirname(importerPath), specifier);
  const candidates = [
    basePath,
    `${basePath}.js`,
    `${basePath}.mjs`,
    `${basePath}.cjs`,
    `${basePath}.json`,
    path.join(basePath, 'index.js'),
  ];

  return candidates.find(candidate => fs.existsSync(candidate) && fs.statSync(candidate).isFile()) || null;
}

function collectRelativeDependencies(entrypoint) {
  const files = new Set();
  const queue = [path.join(repositoryRoot, entrypoint)];

  while (queue.length) {
    const filePath = queue.pop();
    if (!filePath || files.has(filePath)) continue;

    files.add(filePath);

    if (!/\.(?:js|mjs|cjs)$/.test(filePath)) continue;

    const source = fs.readFileSync(filePath, 'utf8');
    importSpecifierPattern.lastIndex = 0;

    for (const match of source.matchAll(importSpecifierPattern)) {
      const specifier = match[1] || match[2];
      const resolved = resolveRelativeImport(filePath, specifier);
      if (resolved) queue.push(resolved);
    }
  }

  return files;
}

fs.rmSync(path.join(packageRoot, 'src'), { recursive: true, force: true });
fs.rmSync(path.join(packageRoot, 'types'), { recursive: true, force: true });

const sourceFiles = new Set();
for (const entrypoint of entrypoints) {
  for (const file of collectRelativeDependencies(entrypoint)) {
    sourceFiles.add(file);
  }
}

for (const file of sourceFiles) {
  copyFile(file, path.join(packageRoot, toPackageRelativePath(file)));
}

for (const directory of assetDirectories) {
  copyDirectory(path.join(repositoryRoot, directory), path.join(packageRoot, directory));
}

const rootPackage = readJson(rootPackagePath);
const cliPackage = readJson(cliPackagePath);

cliPackage.dependencies = { ...rootPackage.dependencies };
delete cliPackage.dependencies['@testomatio/reporter'];

cliPackage.files = ['bin', 'src', 'types'];

writeJson(cliPackagePath, cliPackage);

console.log('Prepared standalone testomatio-reporter-cli package.');
