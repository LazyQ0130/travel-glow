@echo off
cd /d "%~dp0\.."
if not exist "logs" mkdir "logs"
for /f %%i in ('node -e "process.stdout.write(new Date().toISOString().slice(0,10).replace(/-/g,''))"') do set LOG_DATE=%%i
node server/app.js > "logs\server-%LOG_DATE%.out.log" 2> "logs\server-%LOG_DATE%.err.log"
