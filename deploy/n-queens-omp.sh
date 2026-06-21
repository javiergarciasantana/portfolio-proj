#!/bin/bash
set -e

SRC=/home/jsantana/n_queens_omp
DEST=/opt/portfolio/n_queens_omp

echo "=== Building n_queens ==="
sudo mkdir -p "$DEST"
sudo cp -r "$SRC/src" "$DEST/"
sudo cp "$SRC/CMakeLists.txt" "$DEST/"

cd "$DEST"
sudo cmake -B build -DCMAKE_BUILD_TYPE=Release
sudo cmake --build build


echo "=== n_queens ready ==="
echo "  Binary: $DEST/build/NQueensVisualizer"
