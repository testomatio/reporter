#!/bin/bash

FILE_PATH="lib-cjs/lib/adapter/jasmine.js"
sed -i '' '/^const __dirname = path/d' "$FILE_PATH"
echo "Replacement complete in $FILE_PATH"

FILE_PATH="lib-cjs/lib/adapter/mocha/mocha.js"
sed -i '' '/^const __dirname = path/d' "$FILE_PATH"
echo "Replacement complete in $FILE_PATH"

FILE_PATH="lib-cjs/lib/pipe/html.js"
sed -i '' '/^const __dirname = path/d' "$FILE_PATH"
echo "Replacement complete in $FILE_PATH"
