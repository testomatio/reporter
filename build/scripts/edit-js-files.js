import { promises as fs } from 'fs';
import path from 'path';

// Directory containing the files
const directoryPath = path.join(process.cwd(), 'lib');

// Function to replace text in a file
async function replaceTextInFile(filePath) {
  try {
    const data = await fs.readFile(filePath, 'utf8');

    // Replace 'exports.default' with 'module.exports'
    const result = data.replace(/exports\.default/g, 'module.exports');

    // Write the modified content back to the file
    await fs.writeFile(filePath, result, 'utf8');
    console.log(`Replaced text in ${filePath}`);
  } catch (err) {
    console.error(`Error processing file ${filePath}:`, err);
  }
}

async function removeStringWithDirnameDeclaration(filePath) {
  const data = await fs.readFile(filePath, 'utf8');

  // remove lines containing "const __dirname ="
  const result = data
    .split('\n')
    .filter(line => !line.includes('const __dirname ='))
    .join('\n');

  // Write the modified content back to the file
  await fs.writeFile(filePath, result, 'utf8');
  console.log(`Removed __dirname declaration in ${filePath}`);
}

// Function to recursively process directories
async function processDirectory(directoryPath) {
  const entries = await fs.readdir(directoryPath, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(directoryPath, entry.name);

    if (entry.isDirectory()) {
      // Recursively process nested directories
      await processDirectory(fullPath);
    } else if (entry.isFile() && (fullPath.endsWith('.js') || fullPath.endsWith('.cjs'))) {
      // Process only .js or .cjs files
      await replaceTextInFile(fullPath);
      await removeStringWithDirnameDeclaration(fullPath);
      await addNonDefaultExportxToTheEndOfFile(fullPath);
    }
  }
}

// I need to modify all exports like "exports.initPlaywrightForStorage = initPlaywrightForStorage"
// to "module.exports.initPlaywrightForStorage = initPlaywrightForStorage" and add to the end of the file
async function addNonDefaultExportxToTheEndOfFile(filePath) {
  const data = await fs.readFile(filePath, 'utf8');
  // process lines
  const lines = data.split('\n');
  // pattern: exports.<module_name> = <module_name>;
  const linesWithExports = lines.filter(line => line.match(/exports\.[a-zA-Z0-9_]+ = [a-zA-Z0-9_]+;/));
  const moduleNamesToExport = linesWithExports.map(line => line.split('=')[0].split('.')[1].trim());

  // add module.exports to the end of the file
  const newLines = lines.concat(
    moduleNamesToExport.map(moduleName => `module.exports.${moduleName} = ${moduleName};\n`),
  );
  const result = newLines.join('\n');

  // Write the modified content back to the file
  await fs.writeFile(filePath, result, 'utf8');
  console.log(`Added module.exports to the end of ${filePath}`);
}

// Start processing the directory
processDirectory(directoryPath);
