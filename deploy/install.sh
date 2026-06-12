#!/bin/bash
# Run once on the server to set up portfolio dependencies.
set -e

echo "=== Installing system dependencies ==="
sudo apt update
sudo apt install -y \
  xvfb x11vnc novnc websockify \
  openjdk-17-jdk maven \
  cmake libglfw3-dev libgl1-mesa-dev libglu1-mesa-dev \
  g++ libomp-dev

echo "=== Creating directory structure ==="
sudo mkdir -p /opt/portfolio/form-filler
sudo mkdir -p /opt/portfolio/labyrinth
sudo mkdir -p /opt/portfolio/polygon_triangulation
sudo mkdir -p /opt/portfolio/n_queens_omp

echo "=== Building new apps ==="
bash "$(dirname "$0")/polygon-triangulation.sh"
bash "$(dirname "$0")/n-queens-omp.sh"

echo ""
echo "=== Manual steps required ==="
echo "  FormFiller Maven project  → /opt/portfolio/form-filler/  (pom.xml + src/)"
echo "  Labyrinth jars            → /opt/portfolio/labyrinth/LabyrinthApp.jar + core.jar"
echo "  Haskell binary            → /opt/portfolio/haskell-tui"
echo "  N-Queens binary           → /opt/portfolio/n_queens_omp/n_queens_omp  (built above)"
echo "  Polygon binary            → /opt/portfolio/polygon_triangulation/build/PolygonTriangulation  (built above)"
echo ""
echo "=== Start the API ==="
echo "  cd /opt/portfolio/api && npm run start:prod"
