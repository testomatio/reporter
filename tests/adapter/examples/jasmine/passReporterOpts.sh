#!/bin/sh

node ./tests/adapter/examples/jasmine/passReporterOpts.js

# if [ $TESTOMATIO ]
# then
#    sed -i "s/new Report(.*)/new Report({ apiKey: '${TESTOMATIO}' })/" ./node_modules/jasmine/lib/loadConfig.js
# else
#    sed -i "s/new Report(.*)/new Report()/" ./node_modules/jasmine/lib/loadConfig.js
# fi
