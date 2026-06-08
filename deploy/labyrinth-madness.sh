#!/bin/bash
set -e

rm -f /tmp/.X2-lock /tmp/.X11-unix/X2

# 608×740 matches WinBox window size
Xvfb :2 -screen 0 608x740x24 &
export DISPLAY=:2
sleep 1

# Labyrinth Madness — pre-built jars at fixed path
java -cp /opt/portfolio/labyrinth/LabyrinthApp.jar:/opt/portfolio/labyrinth/core.jar \
  labyrinth_madness.src.Main &

x11vnc -display :2 -forever -nopw -shared -rfbport 5902 \
  -bg -o /var/log/x11vnc-labyrinth.log -noipv6

exec websockify --web /usr/share/novnc/ 0.0.0.0:6082 localhost:5902
