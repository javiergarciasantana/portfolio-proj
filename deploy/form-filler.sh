#!/bin/bash
set -e

# Clean stale X lock files from previous crashes
rm -f /tmp/.X1-lock /tmp/.X11-unix/X1

# Virtual framebuffer — 512×640 matches WinBox window size
Xvfb :1 -screen 0 512x640x24 &
export DISPLAY=:1
sleep 1

# Start FormFiller — Maven project at fixed path
cd /opt/portfolio/form-filler
mvn javafx:run &

# VNC server: no password, shared (multiple viewers), port 5901
x11vnc -display :1 -forever -nopw -shared -rfbport 5901 \
  -bg -o /var/log/x11vnc-form-filler.log -noipv6

# noVNC WebSocket proxy on port 6081 → forwards to VNC 5901
exec websockify --web /usr/share/novnc/ 0.0.0.0:6081 localhost:5901
