@echo off
echo ==========================================
echo Deploiement SignVue
echo ==========================================
echo.

echo [1/4] Installation des dependances...
cd services\auth-service
call npm install
cd ..\..

echo.
echo [2/4] Arret des services...
docker-compose down

echo.
echo [3/4] Demarrage des services...
docker-compose up -d --build

echo.
echo [4/4] Verification...
docker-compose ps

echo.
echo ==========================================
echo Deploiement termine !
echo ==========================================
echo.
echo Pour voir les logs : docker-compose logs -f auth-service
echo.
pause
