import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

console.log('🚀 Starting Vercel build...');

try {
  // Nettoyer le dossier dist
  if (fs.existsSync('./dist')) {
    console.log('🧹 Cleaning dist folder...');
    fs.rmSync('./dist', { recursive: true, force: true });
  }

  // Compiler TypeScript
  console.log('📦 Compiling TypeScript...');
  execSync('npx tsc', { stdio: 'inherit' });
  
  // Transformer les alias de chemins
  console.log('🔗 Processing path aliases...');
  execSync('npx tsc-alias', { stdio: 'inherit' });
  
  console.log('✅ Build completed successfully!');
  console.log('📁 Files in dist:', fs.readdirSync('./dist').join(', '));
} catch (error) {
  console.error('❌ Build failed:', error.message);
  process.exit(1);
} 