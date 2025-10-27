#!/usr/bin/env node

/**
 * State verification script
 * Verifies that all critical files are present and properly structured
 */

import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

console.log('🔍 Verifying LMeve application state...\n');

const criticalFiles = [
  'src/App.tsx',
  'src/main.tsx',
  'src/index.css',
  'src/main.css',
  'src/styles/theme.css',
  'index.html',
  'package.json',
  'vite.config.ts',
  'tailwind.config.js',
  'src/lib/types.ts',
  'src/lib/auth-provider.tsx',
  'src/components/tabs/Dashboard.tsx'
];

const criticalDependencies = [
  '@github/spark',
  '@phosphor-icons/react',
  'react',
  'react-dom',
  'tailwindcss',
  'vite'
];

let allGood = true;

// Check critical files
console.log('📁 Checking critical files:');
for (const file of criticalFiles) {
  const path = join(__dirname, file);
  if (existsSync(path)) {
    console.log(`✅ ${file}`);
  } else {
    console.log(`❌ ${file} - MISSING`);
    allGood = false;
  }
}

// Check package.json dependencies
console.log('\n📦 Checking critical dependencies:');
try {
  const packageJson = JSON.parse(readFileSync(join(__dirname, 'package.json'), 'utf8'));
  const allDeps = { ...packageJson.dependencies, ...packageJson.devDependencies };
  
  for (const dep of criticalDependencies) {
    if (allDeps[dep]) {
      console.log(`✅ ${dep} - ${allDeps[dep]}`);
    } else {
      console.log(`❌ ${dep} - MISSING`);
      allGood = false;
    }
  }
} catch (error) {
  console.log('❌ Could not read package.json');
  allGood = false;
}

// Check App.tsx structure
console.log('\n🏗️ Checking App.tsx structure:');
try {
  const appContent = readFileSync(join(__dirname, 'src/App.tsx'), 'utf8');
  
  const checks = [
    { name: 'React imports', pattern: /import React/ },
    { name: 'Component exports', pattern: /export default App/ },
    { name: 'Auth provider', pattern: /AuthProvider/ },
    { name: 'Database provider', pattern: /DatabaseProvider/ },
    { name: 'Theme imports', pattern: /useThemeManager/ },
    { name: 'Tab navigation', pattern: /Tabs.*TabsContent/ }
  ];
  
  for (const check of checks) {
    if (check.pattern.test(appContent)) {
      console.log(`✅ ${check.name}`);
    } else {
      console.log(`❌ ${check.name} - NOT FOUND`);
      allGood = false;
    }
  }
} catch (error) {
  console.log('❌ Could not read App.tsx');
  allGood = false;
}

console.log(`\n${allGood ? '🎉' : '⚠️'} State verification ${allGood ? 'PASSED' : 'FAILED'}`);
console.log(allGood 
  ? 'Application state is verified and ready for deployment.' 
  : 'Some critical issues found - please review before deployment.'
);

process.exit(allGood ? 0 : 1);