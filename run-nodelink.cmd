@echo off
cd /d "C:\Users\WINDOWS 10\Desktop\web 2\.nodelink"
"C:\Program Files\nodejs\node.exe" --dns-result-order=ipv4first dist\src\index.js >> nodelink.log 2>> nodelink-error.log
