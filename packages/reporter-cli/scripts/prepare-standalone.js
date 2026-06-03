import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const packageRoot = path.resolve(__dirname, '..');
const repositoryRoot = path.resolve(packageRoot, '..', '..');

const rootPackagePath = path.join(repositoryRoot, 'package.json');
const cliPackagePath = path.join(packageRoot, 'package.json');

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

fs.rmSync(path.join(packageRoot, 'src'), { recursive: true, force: true });
fs.rmSync(path.join(packageRoot, 'types'), { recursive: true, force: true });

copyDirectory(path.join(repositoryRoot, 'src'), path.join(packageRoot, 'src'));
copyDirectory(path.join(repositoryRoot, 'types'), path.join(packageRoot, 'types'));

const rootPackage = readJson(rootPackagePath);
const cliPackage = readJson(cliPackagePath);

cliPackage.dependencies = { ...rootPackage.dependencies };
delete cliPackage.dependencies['@testomatio/reporter'];

cliPackage.files = ['bin', 'src', 'types'];

writeJson(cliPackagePath, cliPackage);

console.log('Prepared standalone testomatio-reporter-cli package.');
