#!/bin/bash
set -e

SRC=/home/jsantana/n_queens_omp
DEST=/opt/portfolio/n_queens_omp

echo "=== Building n_queens_omp ==="
sudo mkdir -p "$DEST"
sudo cp "$SRC/n_queens_omp.cc" "$DEST/"

cd "$DEST"
sudo g++ -O2 -fopenmp -o n_queens_omp n_queens_omp.cc

echo "=== n_queens_omp ready ==="
echo "  Binary: $DEST/n_queens_omp"
