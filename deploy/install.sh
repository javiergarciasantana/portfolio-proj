#!/bin/bash
# Run once on the server to set up the always-on desktop services.
set -e

echo "=== Installing system dependencies ==="
sudo apt update
sudo apt install -y xvfb x11vnc novnc websockify openjdk-17-jdk maven

echo "=== Creating directory structure ==="
sudo mkdir -p /opt/portfolio/scripts
sudo mkdir -p /opt/portfolio/form-filler
sudo mkdir -p /opt/portfolio/labyrinth

echo "=== Installing start scripts ==="
sudo cp form-filler.sh      /opt/portfolio/scripts/form-filler.sh
sudo cp labyrinth-madness.sh /opt/portfolio/scripts/labyrinth-madness.sh
sudo chmod +x /opt/portfolio/scripts/*.sh

echo "=== Installing systemd services ==="
sudo cp form-filler.service      /etc/systemd/system/form-filler.service
sudo cp labyrinth-madness.service /etc/systemd/system/labyrinth-madness.service
sudo systemctl daemon-reload
sudo systemctl enable form-filler labyrinth-madness
sudo systemctl start  form-filler labyrinth-madness

echo ""
echo "=== Deploy your apps ==="
echo "  FormFiller Maven project  → /opt/portfolio/form-filler/  (pom.xml + src/)"
echo "  Labyrinth jars            → /opt/portfolio/labyrinth/LabyrinthApp.jar + core.jar"
echo "  Haskell binary            → /opt/portfolio/haskell-tui"
echo ""
echo "=== Check service status ==="
echo "  systemctl status form-filler"
echo "  systemctl status labyrinth-madness"
echo "  journalctl -u form-filler -f"
