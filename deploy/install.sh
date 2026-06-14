#!/bin/bash
# Run on the server to set up portfolio dependencies selectively.
set -e

# Default to 'all' if no arguments are passed
if [ $# -eq 0 ]; then
    TARGETS=("all")
else
    TARGETS=("$@")
fi

# Helper function to check if a specific target was requested
run_target() {
    local target=$1
    for t in "${TARGETS[@]}"; do
        if [ "$t" == "all" ] || [ "$t" == "$target" ]; then
            return 0 # True (run it)
        fi
    done
    return 1 # False (skip it)
}

if run_target "deps"; then
    echo "=== Installing system dependencies ==="
    sudo apt update
    sudo apt install -y \
      xvfb x11vnc novnc websockify \
      openjdk-17-jdk maven \
      cmake libglfw3-dev libgl1-mesa-dev libglu1-mesa-dev \
      g++ libomp-dev ghc \
      chromium-bowser chromium-chromedriver
fi

if run_target "dirs"; then
    echo "=== Creating directory structure ==="
    sudo mkdir -p /opt/portfolio/form-filler
    sudo mkdir -p /opt/portfolio/labyrinth
    sudo mkdir -p /opt/portfolio/polygon_triangulation
    sudo mkdir -p /opt/portfolio/n_queens_omp

    # Symlink repo's api/ so /opt/portfolio/api always points to the live checkout
    REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
    sudo ln -sfn "$REPO_ROOT/api" /opt/portfolio/api
    echo "  API symlink → /opt/portfolio/api → $REPO_ROOT/api"
fi

echo "=== Building / deploying requested apps ==="

if run_target "polygon"; then
    bash "$(dirname "$0")/polygon-triangulation.sh"
fi

if run_target "n-queens"; then
    bash "$(dirname "$0")/n-queens-omp.sh"
fi

if run_target "labyrinth"; then
    bash "$(dirname "$0")/labyrinth-madness-build.sh"
fi

if run_target "form-filler"; then
    bash "$(dirname "$0")/form-filler-deploy.sh"
fi

if run_target "haskell"; then
    bash "$(dirname "$0")/haskell-tui.sh"
fi

echo ""
echo "=== Manual steps required ==="
echo "  FormFiller Maven project  → /opt/portfolio/form-filler/  (pom.xml + src/)"
echo "  Labyrinth jars            → /opt/portfolio/labyrinth/LabyrinthApp.jar + core.jar"
echo "  Haskell binary            → /opt/portfolio/haskell-tui"
echo "  N-Queens binary           → /opt/portfolio/n_queens_omp/n_queens_omp"
echo "  Polygon binary            → /opt/portfolio/polygon_triangulation/build/PolygonTriangulation"
echo ""
echo "=== Start the API ==="
echo "  cd /opt/portfolio/api && npm run start:prod"