#!/bin/bash
set -ex

# Instala o Chromium necessário para o Puppeteer
apt-get update
apt-get install -y wget chromium

# Configura o Puppeteer
export PUPPETEER_EXECUTABLE_PATH=$(which chromium)

npm install