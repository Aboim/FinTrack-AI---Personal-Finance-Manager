
const fs = require('fs');
const path = require('path');

const distPath = path.join(__dirname, 'dist');

// Limpar pasta dist
if (fs.existsSync(distPath)) {
  fs.rmSync(distPath, { recursive: true, force: true });
}
fs.mkdirSync(distPath);

// Ficheiros a copiar
const filesToCopy = [
  'index.html',
  'index.tsx',
  'App.tsx',
  'types.ts',
  'metadata.json'
];

filesToCopy.forEach(file => {
  if (fs.existsSync(path.join(__dirname, file))) {
    fs.copyFileSync(path.join(__dirname, file), path.join(distPath, file));
    console.log(`Copiado: ${file}`);
  }
});

// Copiar pasta services se existir
const servicesPath = path.join(__dirname, 'services');
if (fs.existsSync(servicesPath)) {
  const destServices = path.join(distPath, 'services');
  fs.mkdirSync(destServices);
  fs.readdirSync(servicesPath).forEach(file => {
    fs.copyFileSync(path.join(servicesPath, file), path.join(destServices, file));
  });
  console.log('Copiada: pasta services');
}

console.log('Build para mobile concluído com sucesso!');
