#!/bin/bash

# # Define the directory containing the scripts
# SCRIPT_DIR="build/scripts"

# echo "Executing scripts in $SCRIPT_DIR"
# echo "---------------------------------"

# # Iterate over each script in the directory
# for script in "$SCRIPT_DIR"/*; 
# do
#   # Check if the file is a regular file
#   if [ -f "$script" ]; then
#     echo "Executing $script"
#     # Change the permissions to make the script executable
#     chmod +x "$script"
#     echo "Permissions changed for $script"

#     # Execute the script
#     "$script"
#     echo "Executed $script"
#   fi
# done

node build/scripts/edit-package-json.js
node build/scripts/edit-jasmine-adapter-cjs.js
node build/scripts/edit-mocha-adapter-cjs.js
node build/scripts/replace-dirname.js
