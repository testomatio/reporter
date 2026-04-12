# testomatio-reporter-cli

Yarn Berry compatible CLI wrapper around `@testomatio/reporter`.

## Why

Yarn 4 rejects bin names containing `/`. This wrapper exposes valid command names:

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

All arguments are forwarded to `@testomatio/reporter` CLI.
