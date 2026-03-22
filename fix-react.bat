@echo off
echo Fixing React duplicate issue...
echo.
echo Step 1: Removing node_modules...
rmdir /s /q node_modules
echo.
echo Step 2: Removing package-lock.json...
del package-lock.json
echo.
echo Step 3: Installing dependencies...
call npm install
echo.
echo Step 4: Installing react-router-dom...
call npm install react-router-dom
echo.
echo Done! Please restart the dev server.
pause
