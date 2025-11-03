#!/bin/bash

echo "Démarrage de l'ERP Multi-Entreprises..."
echo

# Vérifier si Node.js est installé
if ! command -v node &> /dev/null; then
    echo "Erreur: Node.js n'est pas installé"
    echo "Veuillez installer Node.js depuis https://nodejs.org/"
    exit 1
fi

# Vérifier si MongoDB est en cours d'exécution
echo "Vérification de MongoDB..."
if ! mongosh --eval "db.runCommand('ping')" &> /dev/null; then
    echo "Attention: MongoDB ne semble pas être en cours d'exécution"
    echo "Veuillez démarrer MongoDB avant de lancer l'application"
    echo
fi

# Installer les dépendances si nécessaire
if [ ! -d "node_modules" ]; then
    echo "Installation des dépendances..."
    npm install --legacy-peer-deps
    if [ $? -ne 0 ]; then
        echo "Erreur lors de l'installation des dépendances"
        exit 1
    fi
fi

# Créer le fichier .env.local s'il n'existe pas
if [ ! -f ".env.local" ]; then
    echo "Création du fichier de configuration..."
    cp env.example .env.local
    echo "Fichier .env.local créé. Veuillez le modifier selon vos besoins."
    echo
fi

# Démarrer l'application
echo "Démarrage de l'application..."
echo "L'application sera accessible sur http://localhost:3000"
echo
npm run dev
