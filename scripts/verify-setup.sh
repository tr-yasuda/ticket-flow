#!/usr/bin/env sh
set -eu

REQUIRED_DIRS="
  src/domain
  src/application
  src/infrastructure
  src/presentation
  tests/unit
  tests/integration
  tests/e2e
"

REQUIRED_FILES="
  .editorconfig
  package.json
  README.md
"

fail=0

for dir in $REQUIRED_DIRS; do
  if [ ! -d "$dir" ]; then
    echo "Missing directory: $dir" >&2
    fail=1
  fi
done

for file in $REQUIRED_FILES; do
  if [ ! -f "$file" ]; then
    echo "Missing file: $file" >&2
    fail=1
  fi
done

if [ "$fail" -ne 0 ]; then
  echo "Project setup verification failed." >&2
  exit 1
fi

echo "Project setup verification passed."
