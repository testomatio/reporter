# Developer guige

Mocha reporter should be a commonJS module (impossible to use ES6 module syntax).
Thus, the `/lib` dir is build to commonJS using TypeScript. (Refer to package.json scripts - `build:cjs`).

To prepare mocha adapter run `npm run build:cjs` in the root directory.