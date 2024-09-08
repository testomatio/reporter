import { promises as fs } from 'fs';
import path from 'path';

// Directory containing the files
const directoryPath = path.join(process.cwd(), 'cjs');

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
  try {
    const data = await fs.readFile(filePath, 'utf8');

    // remove lines containing "const __dirname ="
    const result = data.split('\n').filter(line => !line.includes('const __dirname =')).join('\n');

    // Write the modified content back to the file
    await fs.writeFile(filePath, result, 'utf8');
    console.log(`Removed __dirname declaration in ${filePath}`);

  } catch (err) {
    console.error(`Error processing file ${filePath}:`, err);
  }
}

// Function to recursively process directories
async function processDirectory(directoryPath) {
  try {
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
      }
    }
  } catch (err) {
    console.error(`Error reading directory ${directoryPath}:`, err);
  }
}

// Start processing the directory
processDirectory(directoryPath);
