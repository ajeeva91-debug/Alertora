@echo off
title ALERTORA AI Local Web Server
echo ==============================================================
echo               ALERTORA AI — LOCAL WEB SERVER
echo ==============================================================
echo.
echo Starting web server on http://localhost:3000 ...
echo Opening ALERTORA AI in your browser...
echo.

start http://localhost:3000

py -m http.server 3000 || python -m http.server 3000

pause
