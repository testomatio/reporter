# Developer guige

Mocha reporter should be a commonJS module (impossible to use ES6 module syntax).
Thus, the `/lib` dir is build to commonJS using TypeScript. (Refer to package.json scripts - `build:cjs`).

Follow next steps prepare mocha adapter:

1. Build the adapter using TypeScript: `npm run build:cjs`.
After this you will see the `lib-cjs` dir with the compiled code.

2. [**automated**] In file `lib-cjs/package.json` change `type` field to `commonjs`.
This is required to treat all files in the `lib-cjs` dir as commonJS modules.

3. [**automated**] In file `lib-cjs/lib/adapter/mocha.js` change the export statement from `exports.default = MochaReporter` to `module.exports = MochaReporter`.
Otherwise mocha will throw the error `TypeError: this._reporter is not a constructor`.

> Steps 2 and 3 could be executed by script:

`chmod +x lib/adapter/mocha/edit-mocha-adapter.sh lib/adapter/mocha/edit-package-json.sh && ./lib/adapter/mocha/edit-mocha-adapter.sh && ./lib/adapter/mocha/edit-package-json.sh`


4. Use the mocha adapter by path: `lib/lib/adapter/mocha/mocha.js`.
