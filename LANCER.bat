@echo off
setlocal
cd /d "%~dp0"
if not exist node_modules (
  call INSTALLER.bat
  if errorlevel 1 exit /b 1
)
if not exist .env.local copy .env.example .env.local >nul
call npm.cmd run db:migrate
if errorlevel 1 goto erreur
call npm.cmd run db:seed
if errorlevel 1 goto erreur
echo.
echo FREDOU COLLECTION - http://localhost:3000
echo Mode local. Gardez cette fenetre ouverte. Ctrl+C pour arreter.
echo.
call npm.cmd run dev
if errorlevel 1 goto erreur
exit /b 0
:erreur
echo Le lancement a echoue. Consultez le message ci-dessus.
pause
exit /b 1
