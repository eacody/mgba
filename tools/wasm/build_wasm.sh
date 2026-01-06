#!/usr/bin/env bash
set -euo pipefail

# Simple build wrapper for building mGBA libretro with Emscripten in CI or local emsdk container
# Usage: run inside an emscripten environment where `emcmake`, `emmake`, `emcc` are available.

ROOT_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
BUILD_DIR="$ROOT_DIR/build-wasm"
ARTIFACT_DIR="$ROOT_DIR/build-wasm-artifacts"
mkdir -p "$BUILD_DIR" "$ARTIFACT_DIR"

cd "$BUILD_DIR"

echo "Configuring with emcmake..."
emcmake cmake "$ROOT_DIR" \
  -DBUILD_SHARED=OFF \
  -DENABLE_SQLITE3=ON \
  -DENABLE_DEBUGGERS=OFF \
  -DENABLE_FFMPEG=OFF \
  -DENABLE_QT=OFF \
  -DENABLE_SDL=OFF \
  -DUSE_MINIZIP=ON \
  -DPLATFORM_LIBRETRO=ON \
  -DTHREADING=OFF \
  -DCMAKE_BUILD_TYPE=Release

echo "Building mgba_libretro target..."
emmake make mgba_libretro -j$(nproc || echo 2)

# Locate built target - try typical locations
LIB_PATH=""
if [ -f "$BUILD_DIR/src/platform/libretro/libmgba_libretro.a" ]; then
  LIB_PATH="$BUILD_DIR/src/platform/libretro/libmgba_libretro.a"
elif [ -f "$BUILD_DIR/src/platform/libretro/libmgba_libretro.a" ]; then
  LIB_PATH="$BUILD_DIR/src/platform/libretro/libmgba_libretro.a"
fi

echo "Attempting to create wasm + JS via emcc..."
# If the build produced a static .a or .o, link it with emcc. Otherwise try to find an executable named mgba_libretro
EMCC_OUTPUT_JS="$ARTIFACT_DIR/mgba.js"
EMCC_OUTPUT_WASM="$ARTIFACT_DIR/mgba.wasm"

EXPORTED_FUNCTIONS=("_malloc" "_free" "_memcpy" "_memset" "_mgba_set_accelerometer" "_mgba_set_gyroscope" "_mgba_set_light_sensor" "_mgba_get_save_type" "_retro_init" "_retro_deinit" "_retro_api_version" "_retro_get_system_info" "_retro_get_system_av_info" "_retro_set_environment" "_retro_set_video_refresh" "_retro_set_audio_sample_batch" "_retro_set_input_poll" "_retro_set_input_state" "_retro_reset" "_retro_run" "_retro_serialize_size" "_retro_serialize" "_retro_unserialize" "_retro_load_game" "_retro_unload_game")
EXPORTED_JSON=$(printf '%s,"' "${EXPORTED_FUNCTIONS[@]}" | sed 's/","/","/g' | sed 's/^/[/; s/$/]/' )

# Build linking step - best-effort
if [ -n "$LIB_PATH" ] && [ -f "$LIB_PATH" ]; then
  echo "Linking static lib $LIB_PATH"
  emcc "$LIB_PATH" -o "$EMCC_OUTPUT_JS" \
    -O2 -flto -fno-rtti -fno-exceptions \
    -s WASM=1 -s ALLOW_MEMORY_GROWTH=1 -s INITIAL_MEMORY=50331648 -s MAXIMUM_MEMORY=134217728 \
    -s STACK_SIZE=4194304 -s USE_PTHREADS=0 \
    -s EXPORTED_FUNCTIONS='$(printf "%s," "${EXPORTED_FUNCTIONS[@]}" | sed 's/,$//')' \
    --memory-init-file 0
else
  # try to find executable
  if [ -f "$BUILD_DIR/mgba_libretro" ]; then
    emcc "$BUILD_DIR/mgba_libretro" -o "$EMCC_OUTPUT_JS" \
      -O2 -flto -fno-rtti -fno-exceptions \
      -s WASM=1 -s ALLOW_MEMORY_GROWTH=1 -s INITIAL_MEMORY=50331648 -s MAXIMUM_MEMORY=134217728 \
      -s STACK_SIZE=4194304 -s USE_PTHREADS=0 \
      -s EXPORTED_FUNCTIONS='$(printf "%s," "${EXPORTED_FUNCTIONS[@]}" | sed 's/,$//')' \
      --memory-init-file 0
  else
    echo "Warning: could not find a built lib or binary to link with emcc. Build logs should be inspected."
  fi
fi

echo "Build finished. Artifacts (if produced) are in: $ARTIFACT_DIR"
