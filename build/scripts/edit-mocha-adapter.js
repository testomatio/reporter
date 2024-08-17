import fs from 'fs';
import path from 'path';

// This script changes the export statement in lib/adapter/mocha.js file after it was transpiled to CommonJS.

// Define the file path
const filePath = path.join(__dirname, 'lib-cjs/lib/adapter/mocha/mocha.js');

// Read the file content
fs.readFile(filePath, 'utf8', (err, data) => {
  if (err) {
    console.error('Error reading the file:', err);
    return;
  }

  // Use a regular expression to perform the replacement
  const result = data.replace(/exports\.default = MochaReporter;/, 'module.exports = MochaReporter;');

  // Write the content back to file
  fs.writeFile(filePath, result, 'utf8', (err) => {
    if (err) {
      console.error('Error writing the file:', err);
      return;
    }
    console.log(`Replacement complete in ${filePath}`);
  });
});
