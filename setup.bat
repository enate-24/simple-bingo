@echo off
echo Installing backend dependencies...
cd server
call npm install
echo.
echo Creating admin user...
call npm run create-admin
echo.
echo Setup complete!
pause
