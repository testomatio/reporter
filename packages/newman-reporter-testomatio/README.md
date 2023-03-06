### NEWMAN-REPORTER-TESTOMATIO

This package could be used only with [@testomatio/reporter](https://github.com/testomatio/reporter).

## Usage
1. Add as dependency
\
`npm i newman-reporter-testomatio`

1. Make sure `newman` also installed.
\
`newman` and `newman-reporter-testomatio` should be installed in the same directory.
\
If you run your tests using globally installed newman (`newman run ...`), intall `newman-reporter-testomatio` globally too (`npm i newman-reporter-testomatio -g`).
\
If you use locally installed newman (withing the project) (`npx newman run ...`), install `newman-reporter-testomatio` locally (`npm i newman-reporter-testomatio`).
You can verify installed packages via `npm list` or `npm list -g`.

1. Run collection and specify `testomatio` as reporter:
\
`npx newman run <collection_name> -r testomatio`
\
Do not forget to pass token as TESTOMATIO env variable. Also TESTOMATIO_CREATE should be set to truthy value (e.g. TESTOMATIO_CREATE=1).


### Run tests
\
`TESTOMATIO=<API_KEY> npm test`


### Publishing
`npm publish`

or

1. Build .js files
\
`tsc`

2. Publish
\
`npm publish`
