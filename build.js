#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const watch = process.argv.includes('-w') || process.argv.includes('--watch');
const production = process.env.NODE_ENV === 'production';

const srcDir = path.join(__dirname, 'src');
const distDir = path.join(__dirname, 'dist');

function ensureDir(dir) {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
}

function copyFile(src, dest) {
    ensureDir(path.dirname(dest));
    fs.copyFileSync(src, dest);
}

function build() {
    console.log('Building cockpit-zfs-manager...');
    
    // Clean dist directory
    if (fs.existsSync(distDir)) {
        fs.rmSync(distDir, { recursive: true });
    }
    ensureDir(distDir);
    
    // Compile SCSS to CSS
    console.log('Compiling SCSS...');
    try {
        const sassPath = path.join(__dirname, 'node_modules', '.bin', 'sass');
        const sassCmd = fs.existsSync(sassPath) ? sassPath : 'npx sass';
        // Suppress deprecation warnings from PatternFly dependencies (they're harmless)
        execSync(`${sassCmd} --quiet-deps --quiet ${path.join(srcDir, 'zfs-manager.scss')} ${path.join(distDir, 'zfs-manager.css')}`, { stdio: 'inherit' });
    } catch (error) {
        console.error('SCSS compilation failed:', error.message);
        process.exit(1);
    }
    
    // Copy manifest.json
    if (fs.existsSync(path.join(srcDir, 'manifest.json'))) {
        copyFile(path.join(srcDir, 'manifest.json'), path.join(distDir, 'manifest.json'));
    }
    
    // Copy HTML files
    if (fs.existsSync(path.join(srcDir, 'index.html'))) {
        copyFile(path.join(srcDir, 'index.html'), path.join(distDir, 'index.html'));
    }
    
    // Copy JavaScript files
    if (fs.existsSync(path.join(srcDir, 'zfs-manager.js'))) {
        copyFile(path.join(srcDir, 'zfs-manager.js'), path.join(distDir, 'zfs-manager.js'));
    }
    
    console.log('Build complete! Output in dist/');
    
    // RSYNC support for remote development
    if (process.env.RSYNC) {
        const rsyncTarget = process.env.RSYNC;
        const rsyncDest = process.env.RSYNC_DEVEL 
            ? `${rsyncTarget}:~/.local/share/cockpit/zfs-manager`
            : `${rsyncTarget}:/usr/share/cockpit/zfs-manager`;
        
        console.log(`Syncing to ${rsyncDest}...`);
        execSync(`rsync -avz --delete ${distDir}/ ${rsyncDest}/`, { stdio: 'inherit' });
    }
}

if (watch) {
    console.log('Watching for changes...');
    build();
    
    fs.watch(srcDir, { recursive: true }, (eventType, filename) => {
        if (filename) {
            console.log(`Change detected: ${filename}`);
            build();
        }
    });
} else {
    build();
}

