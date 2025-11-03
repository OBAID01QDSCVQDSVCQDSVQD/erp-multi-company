@echo off
echo Démarrage de l'ERP Multi-Entreprises...
echo.

REM Vérifier si Node.js est installé
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo Erreur: Node.js n'est pas installé ou n'est pas dans le PATH
    echo Veuillez installer Node.js depuis https://nodejs.org/
    pause
    exit /b 1
)

REM Vérifier si MongoDB est en cours d'exécution
echo Vérification de MongoDB...
mongosh --eval "db.runCommand('ping')" >nul 2>&1
if %errorlevel% neq 0 (
    echo Attention: MongoDB ne semble pas être en cours d'exécution
    echo Veuillez démarrer MongoDB avant de lancer l'application
    echo.
)

REM Installer les dépendances si nécessaire
if not exist node_modules (
    echo Installation des dépendances...
    npm install --legacy-peer-deps
    if %errorlevel% neq 0 (
        echo Erreur lors de l'installation des dépendances
        pause
        exit /b 1
    )
)

REM Créer le fichier .env.local s'il n'existe pas
if not exist .env.local (
    echo Création du fichier de configuration...
    copy env.example .env.local >nul
    echo Fichier .env.local créé. Veuillez le modifier selon vos besoins.
    echo.
)

REM Démarrer l'application
echo Démarrage de l'application...
echo L'application sera accessible sur http://localhost:3000
echo.
npm run dev

pause
