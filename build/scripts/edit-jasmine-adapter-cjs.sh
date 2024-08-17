#!/bin/bash

# This script changes the export statement in lib/adapter/mocha.js file after it was transpiled to CommonJS.

# Define the file path
file="lib-cjs/lib/adapter/jasmine.js"

# Use sed to perform the replacement
sed -i '' 's/exports\.default = JasmineReporter;/module.exports = JasmineReporter;/' "$file"

echo "exporting module changed in file in $file"



# #!/bin/bash

# # Define the file path
# FILE_PATH="lib-cjs/lib/adapter/jasmine.js"

# # Use sed to replace the string
# sed -i '' 's/exports\.JasmineReporter = JasmineReporter;/module\.exports = JasmineReporter;/g' "$FILE_PATH"

# echo "File updated successfully."