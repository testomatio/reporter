### NEWMAN-REPORTER-TESTOMATIO

This package is adapter for [@testomatio/reporter](https://github.com/testomatio/reporter).

## Usage
1. Add as dependency:
\
`npm i newman-reporter-testomatio`
\
Note:
\
`newman` and `newman-reporter-testomatio` should be installed in the same directory.
\
If you run your tests using globally installed newman (`newman run ...`), intall `newman-reporter-testomatio` globally too (`npm i newman-reporter-testomatio -g`).
\
If you use locally installed newman (within the project) (`npx newman run ...`), install `newman-reporter-testomatio` locally (`npm i newman-reporter-testomatio`).
You can verify installed packages via `npm list` or `npm list -g`.

2. Run collection and specify `testomatio` as reporter:
\
`TESTOMATIO=<token> npx newman run <collection_name> -r testomatio`

### Publishing
`npm publish`
\
or
1. Build .js files: `tsc`
2. Publish: `npm publish`


### Install as local package
Build local package:

`tsc && npm pack`

Install:

`npm i <path to generated .tgz file>`
