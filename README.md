# reporter

Send test run reports to your testomat.io project. Get the API key from testomat.

You can refer sample tests from example folder of this repo. This is a basic example. If you need something full fledged you can refer this [example repo](https://github.com/testomatio/examples)

Add `testomat-reporter` package to your project

## codeceptJS

Make sure you load all your tests using [check-test](https://github.com/testomatio/check-tests#cli). Once all the test are loaded, get the test id from testomat account and add it to your scenario like in this [example](https://github.com/testomatio/reporter/blob/master/example/codecept/index_test.js#L3)

Test id will be available in test view in your testomat account

[img]

Add plugin to [codecept conf](https://github.com/testomatio/reporter/blob/master/example/codecept/codecept.conf.js#L23)

```js
plugins: {
  testomat: {
    enabled: true,
    require: '@testomatio/reporter/lib/adapter/codecept',
    apiKey: process.env.API_KEY || 'API_KEY', // pass in api key via config or env variable
  }
}
```

**Note: Get the API_KEY from your testomat console**
[img]

**Normal run :** Run the test with codecept command `npx codeceptjs run`

**Worker :** If you are using worker use the following command `start-test-run -c 'npx codeceptjs run-workers 2 --verbose'`

## Mocha
Load the test using using `check-test` if not done already. Get the test id from testomat account and add it to your mocha test like in this [example](https://github.com/testomatio/reporter/blob/master/example/mocha/test/index.test.js#L4)

run the following command from you project folder
```sh
mocha --reporter ./node_modules/testomat-reporter/lib/adapter/mocha.js  --reporter-options apiKey=API_KEY
```


## Jest
Load the test using using `check-test` . Add the test id to your tests like in this [example](https://github.com/testomatio/reporter/blob/master/example/jest/index.test.js#L1)

Add the following line to [jest.config.js](https://github.com/testomatio/reporter/blob/master/example/jest/jest.config.js#L100)

`reporters: ['default', ['../../lib/adapter/jest.js', { apiKey: API_KEY }]],`

Run your tests.


## Cucumber

Load you test using [`check-cucumber`](https://github.com/testomatio/check-cucumber)

Add test ids to the scenarios like in this [example](https://github.com/testomatio/reporter/blob/master/example/cucumber/Coffe-machine/features/money_Interactions.feature#L9)

Create a formatter file passing the API like this [example](https://github.com/testomatio/reporter/blob/master/example/cucumber/Coffe-machine/formatter.js)

Run cucumber test with this formatter
```sh
./node_modules/.bin/cucumber-js --format formatter.js
```
