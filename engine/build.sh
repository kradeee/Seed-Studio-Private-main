#!/usr/bin/env bash
# Rebuild the map/search engine (public/engine/api.js + api.wasm) from
# public/engine/api-source.c and Cubiomes (the xpple fork), with Emscripten.
#
#   engine/build.sh [path/to/cubiomes]      default: engine/cubiomes
#
# Needs `emcc` on the PATH (https://emscripten.org/docs/getting_started/downloads.html).
# The GitHub workflow .github/workflows/engine.yml runs this for you.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
CUB="$(cd "${1:-$ROOT/engine/cubiomes}" && pwd)"

# api-source.c includes "../cubiomes/...": rebuild that layout in a scratch folder.
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT
mkdir -p "$WORK/mods"
cp -R "$CUB" "$WORK/cubiomes"
cp "$ROOT/public/engine/api-source.c" "$WORK/mods/api.c"

# Every Cubiomes source except its own test and tool programs.
SOURCES=$(cd "$WORK/mods" && ls ../cubiomes/*.c ../cubiomes/features/*.c | grep -v -e '/tests\.c$' -e '/xradv\.c$')

cd "$WORK/mods"
# Same flags Seeder uses (cubiomes-mods/build.sh + makefile).
emcc -O3 -flto -fwrapv api.c $SOURCES -lm \
  -s WASM=1 -s STACK_SIZE=1048576 -s WASM_BIGINT -s NO_EXIT_RUNTIME=1 \
  -s "EXPORTED_FUNCTIONS=['_malloc','_main']" \
  -s "EXPORTED_RUNTIME_METHODS=['cwrap','HEAPU8','HEAP32']" \
  -o api.js

cp api.js api.wasm "$ROOT/public/engine/"
{
  echo "cubiomes: xpple/cubiomes $(git -C "$CUB" rev-parse HEAD 2>/dev/null || echo unknown)"
  echo "cubiomes-date: $(git -C "$CUB" log -1 --format=%cs 2>/dev/null || echo unknown)"
  echo "emscripten: $(emcc --version | head -1)"
  echo "built: $(date -u +%Y-%m-%dT%H:%MZ)"
} > "$ROOT/public/engine/ENGINE_VERSION.txt"
echo "Engine rebuilt:"; cat "$ROOT/public/engine/ENGINE_VERSION.txt"
