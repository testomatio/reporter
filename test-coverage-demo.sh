#!/bin/bash

# Test script for code coverage feature demonstration
# This script demonstrates how to run tests with coverage collection and reporting

set -e

echo "=========================================="
echo "Testomatio Coverage Feature Demo"
echo "=========================================="
echo ""

cd "$(dirname "$0")/example/vitest"

echo "Step 1: Installing dependencies..."
npm install --silent 2>&1 | grep -v "^npm WARN" || true

echo ""
echo "Step 2: Running tests WITHOUT coverage..."
npm run test

echo ""
echo "Step 3: Running tests WITH coverage..."
npm run test:coverage

echo ""
echo "Step 4: Verifying coverage files were created..."
if [ -f "coverage/lcov.info" ]; then
  echo "✓ coverage/lcov.info created"
  echo "  Lines in file: $(wc -l < coverage/lcov.info)"
fi

if [ -f "coverage/coverage-final.json" ]; then
  echo "✓ coverage/coverage-final.json created"
fi

if [ -d "coverage/lcov-report" ]; then
  echo "✓ coverage/lcov-report/ directory created"
  echo "  HTML files: $(find coverage/lcov-report -name '*.html' | wc -l)"
fi

echo ""
echo "Step 5: Testing coverage collection with TESTOMATIO_COVERAGE..."
echo ""
TESTOMATIO_COVERAGE=1 npm run test:coverage

echo ""
echo "=========================================="
echo "Coverage Feature Demo Complete!"
echo "=========================================="
echo ""
echo "Coverage report is available at:"
echo "  file://$(pwd)/coverage/lcov-report/index.html"
echo ""
echo "To upload coverage to S3, configure S3 credentials and run:"
echo "  TESTOMATIO=<api_key> TESTOMATIO_COVERAGE=1 S3_BUCKET=<bucket> npm run test:coverage"
