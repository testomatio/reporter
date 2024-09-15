// import fs from 'fs';
// import path from 'path';

// // This script updates "type" to "commonjs" and "chalk" version to "^4.1.2" in package.json file.
// // Because chalk 5+ works only with ESM.

// // Define the file path
// const filePath = path.join(process.cwd(), 'lib/package.json');

// // Read the file content
// fs.readFile(filePath, 'utf8', (err, data) => {
//   if (err) {
//     console.error('Error reading the file:', err);
//     return;
//   }

//   // Parse the JSON content
//   let packageJson;
//   try {
//     packageJson = JSON.parse(data);
//   } catch (parseErr) {
//     console.error('Error parsing JSON:', parseErr);
//     return;
//   }

//   // Update the "type"
//   packageJson.type = 'commonjs';

//   // Convert the JSON object back to a string
//   const updatedData = JSON.stringify(packageJson, null, 2);

//   // Write the updated content back to the file
//   fs.writeFile(filePath, updatedData, 'utf8', (err) => {
//     if (err) {
//       console.error('Error writing the file:', err);
//       return;
//     }
//     console.log(`Updated 'type' to 'commonjs' in ${filePath}`);
//   });
// });