
// // file is updated (was: loadConfig.js)
// const path = process.cwd() + '/node_modules/jasmine/lib/command.js';
// const apiKey = process.env.TESTOMATIO;
// import fs from 'fs';

// fs.readFile(path, 'utf8', (err, data) => {
//   if (err) {
//     console.error(`Error reading file: ${err}`);
//     process.exit(1);
//   }

//   let result = data;

//   if (apiKey) {
//     result = data.replace(/new Report\(.*\)/, `new Report({ apiKey: '${apiKey}' })`);
//   } else {
//     result = data.replace(/new Report\(.*\)/, `new Report()`);
//   }
//   fs.writeFile(path, result, 'utf8', (err) => {
//     if (err) {
//       console.error(`Error writing file: ${err}`);
//       process.exit(1);
//     }
//     console.log('Replacement successful.');
//   });
// });