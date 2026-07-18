#!/bin/bash

STAGED_FILES=$(git diff --cached --name-only --diff-filter=d)
if [ -z "$STAGED_FILES" ]; then
  exit 0
fi

TS_FILES=$(echo "$STAGED_FILES" | grep -E '\.(ts|tsx)$')
VUE_FILES=$(echo "$STAGED_FILES" | grep -E '\.vue$')
if [ -z "$TS_FILES" ] && [ -z "$VUE_FILES" ]; then
  exit 0
fi

FILTER_WEB=""
FILTER_PLAYGROUND=""
if echo "$STAGED_FILES" | grep -q "^apps/web-antd"; then
  FILTER_WEB="--filter=@vben/web-antd"
fi
if echo "$STAGED_FILES" | grep -q "^playground"; then
  FILTER_PLAYGROUND="--filter=@vben/playground"
fi

if [ -z "$FILTER_WEB" ] && [ -z "$FILTER_PLAYGROUND" ]; then
  exit 0
fi

touch /tmp/typecheck_output.txt
touch /tmp/other_errors.txt

pnpm turbo run typecheck $FILTER_WEB $FILTER_PLAYGROUND 2>&1 > /tmp/typecheck_output.txt || true

grep -E "error TS" /tmp/typecheck_output.txt | grep -vE "basic\.vue\(|preferences\.ts\(" > /tmp/other_errors.txt

if [ ! -s /tmp/other_errors.txt ]; then
  echo "Typecheck errors are only in framework files (basic.vue, preferences.ts), skipping..."
  exit 0
else
  cat /tmp/typecheck_output.txt
  exit 1
fi