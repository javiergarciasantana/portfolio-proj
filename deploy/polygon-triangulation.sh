#!/bin/bash
set -e

SRC=/home/jsantana/polygon_triangulation
DEST=/opt/portfolio/polygon_triangulation

echo "=== Building polygon_triangulation ==="
sudo mkdir -p "$DEST"
sudo cp -r "$SRC/src" "$DEST/"
sudo cp "$SRC/CMakeLists.txt" "$DEST/"

cd "$DEST"
sudo cmake -B build -DCMAKE_BUILD_TYPE=Release
sudo cmake --build build

echo "=== Creating sample input ==="
sudo tee "$DEST/sample.txt" > /dev/null <<'EOF'
6
0.0 0.0
2.0 0.0
3.0 1.5
2.0 3.0
0.0 3.0
-1.0 1.5
EOF

echo "=== polygon_triangulation ready ==="
echo "  Binary: $DEST/build/PolygonTriangulation"
echo "  Sample: $DEST/sample.txt"
