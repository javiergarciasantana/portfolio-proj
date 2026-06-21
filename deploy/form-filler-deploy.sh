#!/bin/bash
set -e

SRC=/home/jsantana/FormFiller
DEST=/opt/portfolio/form-filler

echo "=== Deploying FormFiller ==="
sudo mkdir -p "$DEST"

# Sync source, skip build artifacts
sudo rsync -a --delete \
  --exclude=target/ \
  --exclude='.git/' \
  --exclude='*.iml' \
  "$SRC/" "$DEST/"

echo "  Pre-fetching Maven dependencies (avoids first-run delay)..."
cd "$DEST"
sudo mvn dependency:resolve -q 2>&1 | tail -5

echo "=== FormFiller ready ==="
echo "  Project: $DEST/pom.xml"
echo "  Run:     cd $DEST && mvn javafx:run"
