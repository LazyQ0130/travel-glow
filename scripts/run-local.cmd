@echo off
cd /d "%~dp0\.."
node server/app.js > server.out.log 2> server.err.log
