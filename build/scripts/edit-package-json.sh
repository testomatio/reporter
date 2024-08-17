#!/bin/bash

# This script updates "type" to "commonjs" and "chalk" version to "^4.1.2" in package.json file.
# Because chalk 5+ works only with ESM.

# Define the file path
file="lib-cjs/package.json"

# Use sed to perform the replacements
sed -i '' 's/"type": "module"/"type": "commonjs"/' "$file"
# sed -i '' 's/"chalk": "[^"]*"/"chalk": "^4.1.2"/' "$file"

echo "Updated 'type' to 'commonjs' in $file"