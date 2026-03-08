@echo off
setlocal

cd /d "%~dp0"

echo ============================================
echo   Lancement EucAnalypTips (App + API)
echo ============================================
echo.

where npm >nul 2>&1
if errorlevel 1 (
  echo [ERREUR] npm est introuvable. Installe Node.js puis reessaye.
  pause
  exit /b 1
)

if not exist "node_modules" (
  echo [INFO] node_modules absent, installation des dependances...
  call npm install
  if errorlevel 1 (
    echo [ERREUR] npm install a echoue.
    pause
    exit /b 1
  )
)

echo [INFO] Verification Docker (Postgres/Redis)...
where docker >nul 2>&1
if errorlevel 1 (
  echo [WARN] Docker non detecte. Je continue sans docker compose.
) else (
  docker info >nul 2>&1
  if errorlevel 1 (
    echo [WARN] Docker detecte mais daemon non demarre. Je continue.
  ) else (
    call docker compose up -d postgres redis >nul 2>&1
    if errorlevel 1 (
      echo [WARN] docker compose postgres/redis non demarre. Je continue.
    ) else (
      echo [OK] Postgres/Redis docker lances.
    )
  )
)

echo.
echo [INFO] Lancement API...
start "EucAnalypTips API" cmd /k "cd /d ""%~dp0"" && npm run dev:api"

echo [INFO] Lancement APP web...
start "EucAnalypTips APP" cmd /k "cd /d ""%~dp0"" && npm run dev:app"

echo [INFO] Ouverture du navigateur dans quelques secondes...
timeout /t 8 /nobreak >nul
start "" "http://localhost:3001"

echo [OK] C est lance. Tu peux fermer cette fenetre.
exit /b 0
