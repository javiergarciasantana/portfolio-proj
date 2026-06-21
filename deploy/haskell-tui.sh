#!/bin/bash
set -e

SRC=/home/jsantana/haskell_functions
DEST=/opt/portfolio/haskell-tui

echo "=== Building Haskell TUI ==="

# Go to the source directory
cd "$SRC"

# Compile the Haskell project using optimizations (-O2)
# We output the binary directly to the target location expected by the Gateway
# All function sets must be explicitly included for GHC to link them!
sudo ghc -O2 -o "$DEST" main.hs \
    function_sets/tui_utils.hs \
    function_sets/animation.hs \
    function_sets/menus.hs \
    function_sets/set_1.hs \
    function_sets/set_2.hs \
    function_sets/set_3.hs \
    function_sets/set_4.hs

# Clean up the compilation artifacts (.hi and .o files) to keep the folder clean
sudo rm -f *.hi *.o function_sets/*.hi function_sets/*.o

echo "=== Haskell TUI ready ==="
echo "  Binary: $DEST"