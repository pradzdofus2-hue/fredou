@echo off
setlocal
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js 24 ou plus recent est necessaire. Installer Node.js depuis https://nodejs.org/
  pause
  exit /b 1
)
node -e "if(Number(process.versions.node.split('.')[0])<24){console.error('Node.js 24 minimum requis');process.exit(1)}"
if errorlevel 1 exit /b 1
if not exist .env.local copy .env.example .env.local >nul
echo Installation locale de FREDOU COLLECTION...
call npm.cmd ci --cache .cache/npm
if errorlevel 1 goto erreur
call npm.cmd run art
if errorlevel 1 goto erreur
call npm.cmd run db:migrate
if errorlevel 1 goto erreur
call npm.cmd run db:seed
if errorlevel 1 goto erreur
echo Installation terminee. Lancez LANCER.bat.
exit /b 0
:erreur
echo Installation interrompue. Consultez le message ci-dessus.
pause
exit /b 1
