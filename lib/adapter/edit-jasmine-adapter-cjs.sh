#!/bin/bash

# This script changes the export statement in lib/adapter/mocha.js file after it was transpiled to CommonJS.

# Define the file path
file="lib-cjs/lib/adapter/jasmine.js"

# Use sed to perform the replacement
sed -i '' 's/exports\.default = JasmineReporter;/module.exports = JasmineReporter;/' "$file"

echo "Replacement complete in $file"
