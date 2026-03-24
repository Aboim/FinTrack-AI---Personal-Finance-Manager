const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('--- Iniciando Preparação para Windows ---');

// 1. Instalar dependências se necessário
try {
  console.log('Verificando dependências...');
  execSync('npm install', { stdio: 'inherit' });
} catch (e) {
  console.error('Erro ao instalar dependências:', e.message);
}

// 2. Executar o build do Vite
try {
  console.log('Executando build do Vite...');
  execSync('npm run build', { stdio: 'inherit' });
} catch (e) {
  console.error('Erro no build do Vite:', e.message);
  process.exit(1);
}

// 3. Executar o electron-builder
try {
  console.log('Convertendo para executável Windows...');
  // Nota: No Windows/macOS local, isto funcionará sem wine.
  execSync('npx electron-builder --win --portable', { stdio: 'inherit' });
  console.log('--- Conversão concluída com sucesso! ---');
  console.log('O executável encontra-se na pasta "windows".');
} catch (e) {
  console.error('Erro na conversão para Windows:', e.message);
  console.log('\nNOTA: Se estiver a correr isto num ambiente Linux sem "wine" instalado,');
  console.log('a conversão para Windows falhará. Recomenda-se correr este script');
  console.log('diretamente no Windows ou macOS.');
}
