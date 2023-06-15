# Workflows

List of CI configurations which include Testomat.io Reporter

## GitHub Actions and CodeceptJS

Execute CodeceptJS in parallel mode with 2 wokers and report data to Testomat.io Application.
This workflow will be executed from Testomat.io Application when you click "Run on CI"

```yaml
name: CodeceptJS Tests

on:
  workflow_dispatch:
    inputs:
      grep:
        description: 'A grep '
        required: false
        default: ''
      testomatio:
        required: false
      run:
        required: false

jobs:
  build:

    runs-on: ubuntu-latest

    steps:
    - uses: actions/checkout@v2
    - name: Setup node
      uses: actions/setup-node@v1
      with:
        node-version: 16.x
    - run: npm i
    - run: npx start-test-run -c 'npx codeceptjs run-workers 2 --grep "${{ github.event.inputs.grep }}"'
      env:
        TESTOMATIO: "${{ github.event.inputs.testomatio }}"
        TESTOMATIO_RUN: "${{ github.event.inputs.run }}"
```

## Azure Pipelines and CodeceptJS 

Simple workflow for CodeceptJS and Azure 

```yaml
trigger:
- master

pool:
  vmImage: ubuntu-latest

steps:
- task: NodeTool@0
  inputs:
    versionSpec: '16.x'
  displayName: 'Install Node.js'

- script: |
    npm install
    TESTOMATIO=$(testomatio) npx codeceptjs run --grep="$(grep)"
  displayName: 'run tests'
```

Enable `testomatio` variable inside Azure Pipelines config to pass this value

## GitHub Actions and MiniTest 

GitHub Actions workflow that uses Testomat.io Reporter to send results from Minitest to Testomat.io Application and add comment to GitHub pull request:

```yaml
name: CI

on:
  pull_request:

jobs:
  test:
    name: Tests
    runs-on: ubuntu-latest
    steps:
    - name: Checkout code
      uses: actions/checkout@v2

    - name: Setup node
      uses: actions/setup-node@v1      

    - name: install nodejs deps
      run: npm i

    - name: install ruby deps
      run: bundle install

    # all required preperations

    - name: test
      run: bundle exec rails test
      env:
        RAILS_ENV: test
    - name: Testomatio Report
      run: npx report-xml "test/reports/**.xml" --lang=Ruby
      if: always()
      env:
        TESTOMATIO: ${{ secrets.TESTOMATIO }}
        TESTOMATIO_RUN: "PR ${{ github.event.number }} ${{ github.event.pull_request.title }}"
        GH_PAT: ${{ github.token }}
```

## GitHub Actions and PHPUnit

GitHub Actions workflow that uses Testomat.io Reporter to send results from Minitest to Testomat.io Application and add comment to GitHub pull request:

```yaml
name: CI

on:
  pull_request:

jobs:
  test:
    name: Tests
    runs-on: ubuntu-latest
    steps:
    - name: Checkout code
      uses: actions/checkout@v2

    - name: Install dependencies
      run: composer install

    # all required preparations

    - name: Run PHPUnit tests
      run: vendor/bin/phpunit --log-junit=report.xml

    - name: Testomatio Report
      run: npx report-xml report.xml --lang=PHP
      if: always()
      env:
        TESTOMATIO: ${{ secrets.TESTOMATIO }}
        TESTOMATIO_RUN: "PR ${{ github.event.number }} ${{ github.event.pull_request.title }}"
        GH_PAT: ${{ github.token }}
```

...more examples are coming