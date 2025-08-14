const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const iconSizes = [16, 32, 72, 96, 128, 144, 152, 192, 384, 512];
const appleIconSizes = [152, 167, 180];
const splashSizes = [
    { width: 2048, height: 2732, name: 'apple-splash-2048-2732' },
    { width: 1668, height: 2388, name: 'apple-splash-1668-2388' },
    { width: 1536, height: 2048, name: 'apple-splash-1536-2048' },
    { width: 1125, height: 2436, name: 'apple-splash-1125-2436' },
    { width: 750, height: 1334, name: 'apple-splash-750-1334' },
    { width: 640, height: 1136, name: 'apple-splash-640-1136' }
];

async function generateIcons() {
    const sourceIcon = path.join(__dirname, '../public/favicon.svg');
    
    // Create icons directory
    const iconsDir = path.join(__dirname, '../public/icons');
    if (!fs.existsSync(iconsDir)) {
        fs.mkdirSync(iconsDir, { recursive: true });
    }
    
    // Generate standard icons
    for (const size of iconSizes) {
        await sharp(sourceIcon)
            .resize(size, size)
            .png()
            .toFile(path.join(iconsDir, `icon-${size}x${size}.png`));
    }
    
    // Generate Apple touch icons
    for (const size of appleIconSizes) {
        await sharp(sourceIcon)
            .resize(size, size)
            .png()
            .toFile(path.join(iconsDir, `apple-touch-icon-${size}x${size}.png`));
    }
    
    // Generate Apple touch icon (default)
    await sharp(sourceIcon)
        .resize(180, 180)
        .png()
        .toFile(path.join(iconsDir, 'apple-touch-icon.png'));
        
    // Generate shortcut icons
    await sharp(sourceIcon)
        .resize(96, 96)
        .png()
        .toFile(path.join(iconsDir, 'shortcut-task.png'));
        
    await sharp(sourceIcon)
        .resize(96, 96)
        .png()
        .toFile(path.join(iconsDir, 'shortcut-today.png'));
}

async function generateSplashScreens() {
    const sourceIcon = path.join(__dirname, '../public/favicon.svg');
    
    // Create splash directory
    const splashDir = path.join(__dirname, '../public/splash');
    if (!fs.existsSync(splashDir)) {
        fs.mkdirSync(splashDir, { recursive: true });
    }
    
    // Generate splash screens
    for (const splash of splashSizes) {
        await sharp({
            create: {
                width: splash.width,
                height: splash.height,
                channels: 4,
                background: { r: 59, g: 130, b: 246, alpha: 1 }
            }
        })
        .composite([{
            input: await sharp(sourceIcon)
                .resize(200, 200)
                .png()
                .toBuffer(),
            gravity: 'center'
        }])
        .png()
        .toFile(path.join(splashDir, `${splash.name}.png`));
    }
}

async function main() {
    try {
        console.log('Generating PWA icons...');
        await generateIcons();
        
        console.log('Generating splash screens...');
        await generateSplashScreens();
        
        console.log('PWA assets generated successfully!');
    } catch (error) {
        console.error('Error generating PWA assets:', error);
    }
}

main();
