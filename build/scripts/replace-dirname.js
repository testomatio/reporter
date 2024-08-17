const fs = require('fs');
const path = require('path');

// Function to perform the replacement
function replaceDirname(filePath) {
  fs.readFile(filePath, 'utf8', (err, data) => {
    if (err) {
      console.error(`Error reading the file: ${filePath}`, err);
      return;
    }

    // Remove lines that start with "const __dirname = path"
    const result = data.split('\n').filter(line => !line.startsWith('const __dirname = path')).join('\n');

    // Write the updated content back to the file
    fs.writeFile(filePath, result, 'utf8', (err) => {
      if (err) {
        console.error(`Error writing the file: ${filePath}`, err);
        return;
      }
      console.log(`Replacement complete in ${filePath}`);
    });
  });
}

// Define the file paths
const filePaths = [
  path.join(__dirname, 'lib-cjs/lib/adapter/jasmine.js'),
  path.join(__dirname, 'lib-cjs/lib/adapter/mocha/mocha.js'),
  path.join(__dirname, 'lib-cjs/lib/pipe/html.js')
];

// Perform the replacement for each file
filePaths.forEach(replaceDirname);