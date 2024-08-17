import fs from 'fs';
import path from 'path';

// This script changes the export statement in lib/adapter/jasmine.js file after it was transpiled to CommonJS.

// Define the file path
const filePath = path.join(__dirname, 'lib-cjs/lib/adapter/jasmine.js');

// Read the file content
fs.readFile(filePath, 'utf8', (err, data) => {
  if (err) {
    console.error('Error reading the file:', err);
    return;
  }

  // Use a regular expression to perform the replacement
  const result = data.replace(/exports\.default = JasmineReporter;/, 'module.exports = JasmineReporter;');

  // Write the modified content back to file
  fs.writeFile(filePath, result, 'utf8', (err) => {
    if (err) {
      console.error('Error writing the file:', err);
      return;
    }
    console.log(`Exporting module changed in file: ${filePath}`);
  });
});