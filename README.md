# reporter

## Mocha

run the following command from examples folder

`mocha --reporter ../../lib/adapter/mocha.js  --reporter-options apiKey=l5x5d5cd6pc3`

## codeceptJS

Add plugin to codecept conf

```js
testomat: {
  enabled: true,
  require: 'testomat-reporter/lib/adapter/codecept',
  apiKey: 'l5x5d5cd6pc3',
}
```

## jest

Add the following line to jest.config.js

`reporters: ['default', ['../../lib/adapter/jest.js', { apiKey: 'l5x5d5cd6pc3' }]],`