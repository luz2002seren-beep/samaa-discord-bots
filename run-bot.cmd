@echo off
cd /d "%~dp0"
start "Samaa bot 1" /b "C:\Program Files\nodejs\node.exe" dist\index.js --bot=1 >> bot-1.log 2>> bot-1-error.log
start "Samaa bot 2" /b "C:\Program Files\nodejs\node.exe" dist\index.js --bot=2 >> bot-2.log 2>> bot-2-error.log
start "Samaa bot 3" /b "C:\Program Files\nodejs\node.exe" dist\index.js --bot=3 >> bot-3.log 2>> bot-3-error.log
