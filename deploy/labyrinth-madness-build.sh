#!/bin/bash
set -e

SRC=/home/jsantana/labyrinth_madness
DEST=/opt/portfolio/labyrinth

echo "=== Building Labyrinth Madness ==="
sudo mkdir -p "$DEST"
sudo cp -r "$SRC/src" "$DEST/"

cd "$DEST"

if [ ! -f core.jar ]; then
  echo "  Downloading Processing core.jar..."
  sudo wget -q https://repo1.maven.org/maven2/org/processing/core/4.5.3/core-4.5.3.jar -O core.jar
fi

echo "  Compiling sources..."
sudo javac -cp core.jar -d . src/*.java

echo "  Packaging LabyrinthApp.jar..."
sudo jar cvf LabyrinthApp.jar labyrinth_madness/src/*.class > /dev/null

echo "=== Labyrinth Madness ready ==="
echo "  Jars: $DEST/LabyrinthApp.jar + $DEST/core.jar"
echo "  Run:  java -cp $DEST/LabyrinthApp.jar:$DEST/core.jar labyrinth_madness.src.Main"
