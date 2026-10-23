# testomatio-reporter-cli

Yarn Berry compatible standalone CLI for `@testomatio/reporter`.

## Why

Yarn 4 rejects bin names containing `/`. This package publishes the reporter CLI with valid command names and does not depend on `@testomatio/reporter`, so Yarn does not link the package that contains the invalid bin name.

- `testomatio-reporter`
- `reporter`

## Install

```bash
yarn add -D testomatio-reporter-cli
```

## Usage

```bash
npx testomatio-reporter run "npx playwright test"
# or
npx reporter run "npx playwright test"
# or
npx testomatio-reporter-cli run "npx playwright test"
```

All arguments are forwarded to the bundled reporter CLI.
