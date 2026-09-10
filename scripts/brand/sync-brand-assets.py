#!/usr/bin/env python3
"""
HisaabPro Brand Asset Generator & Sync Engine (SSOT)
---------------------------------------------------
Single Source of Truth for all brand assets, app icons, and logos.

How it works:
1. Place a new master logo file in `assets/branding/`:
   - `assets/branding/master-sheet.png` (Full logo kit sheet), OR
   - `assets/branding/master-icon.png` (Square/Squircle icon), AND/OR
   - `assets/branding/master-logo.png` (Horizontal logo)
2. Run `npm run brand:sync`
3. Automatically updates:
   - Web & PWA icons (favicon.png, favicon.svg, icon-192.png, icon-512.png)
   - Official logos in public/logos/official/
   - Android Launcher icons across all 5 mipmap densities (square, round, adaptive)
   - In-app references via BrandLogo / brand.config.ts
"""

import os
import sys
import numpy as np
from PIL import Image, ImageOps, ImageDraw

ROOT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
BRANDING_DIR = os.path.join(ROOT_DIR, 'assets', 'branding')
PUBLIC_DIR = os.path.join(ROOT_DIR, 'public')
OFFICIAL_LOGOS_DIR = os.path.join(PUBLIC_DIR, 'logos', 'official')
ANDROID_RES_DIR = os.path.join(ROOT_DIR, 'android', 'app', 'src', 'main', 'res')

os.makedirs(OFFICIAL_LOGOS_DIR, exist_ok=True)
os.makedirs(PUBLIC_DIR, exist_ok=True)

def extract_smooth(img, crop_box, bg_color_sample, is_dark_bg=False):
    crop = img.crop(crop_box)
    arr = np.array(crop).astype(float)
    bg = np.array(bg_color_sample).astype(float)
    dist = np.linalg.norm(arr - bg, axis=2)
    
    if is_dark_bg:
        alpha = np.clip((dist - 15) / 35, 0, 1) * 255
    else:
        alpha = np.clip((dist - 10) / 30, 0, 1) * 255
        
    res = np.dstack((arr, alpha)).astype(np.uint8)
    return Image.fromarray(res)

def generate_android_icons(dark_squircle_img):
    # Android launcher icon dimensions:
    # - Legacy full-bleed square / round icon size: 48, 72, 96, 144, 192
    # - Adaptive icon foreground size (108dp): 108, 162, 216, 324, 432
    densities = {
        'mipmap-mdpi': (48, 108),
        'mipmap-hdpi': (72, 162),
        'mipmap-xhdpi': (96, 216),
        'mipmap-xxhdpi': (144, 324),
        'mipmap-xxxhdpi': (192, 432),
    }
    for folder, (legacy_size, fg_size) in densities.items():
        folder_path = os.path.join(ANDROID_RES_DIR, folder)
        if os.path.exists(folder_path):
            # Square legacy icon
            sq = dark_squircle_img.resize((legacy_size, legacy_size), Image.Resampling.LANCZOS)
            sq.save(os.path.join(folder_path, 'ic_launcher.png'), optimize=True)

            # Round legacy icon
            mask = Image.new('L', (legacy_size, legacy_size), 0)
            draw = ImageDraw.Draw(mask)
            draw.ellipse((0, 0, legacy_size, legacy_size), fill=255)
            round_icon = ImageOps.fit(dark_squircle_img, (legacy_size, legacy_size), centering=(0.5, 0.5))
            round_icon.putalpha(mask)
            round_icon.save(os.path.join(folder_path, 'ic_launcher_round.png'), optimize=True)

            # Adaptive icon foreground — 108dp canvas with 72dp safe area (~66-70%)
            fg_canvas = Image.new('RGBA', (fg_size, fg_size), (0, 0, 0, 0))
            inner_size = int(fg_size * 0.72)
            fg_symbol = dark_squircle_img.resize((inner_size, inner_size), Image.Resampling.LANCZOS)
            offset = (fg_size - inner_size) // 2
            if fg_symbol.mode == 'RGBA':
                fg_canvas.paste(fg_symbol, (offset, offset), fg_symbol)
            else:
                fg_canvas.paste(fg_symbol, (offset, offset))
            fg_canvas.save(os.path.join(folder_path, 'ic_launcher_foreground.png'), optimize=True)
            print(f"  ✓ Android {folder} (legacy {legacy_size}x{legacy_size}, adaptive {fg_size}x{fg_size}) updated")

def generate_android_splash(logo_img):
    """Generate Android splash screens with centered logo on #F8F7F4 background."""
    splash_sizes = {
        'drawable': (480, 320),
        'drawable-port-mdpi': (320, 480),
        'drawable-port-hdpi': (480, 800),
        'drawable-port-xhdpi': (720, 1280),
        'drawable-port-xxhdpi': (960, 1600),
        'drawable-port-xxxhdpi': (1280, 1920),
        'drawable-land-mdpi': (480, 320),
        'drawable-land-hdpi': (800, 480),
        'drawable-land-xhdpi': (1280, 720),
        'drawable-land-xxhdpi': (1600, 960),
        'drawable-land-xxxhdpi': (1920, 1280),
    }
    bg_color = (248, 247, 244) # #F8F7F4 cream

    for folder, (width, height) in splash_sizes.items():
        folder_path = os.path.join(ANDROID_RES_DIR, folder)
        if os.path.exists(folder_path):
            canvas = Image.new('RGB', (width, height), bg_color)
            
            # Target logo width ~ 55% of canvas width or max 480px
            target_w = min(int(width * 0.55), 480)
            aspect = logo_img.width / logo_img.height
            target_h = int(target_w / aspect)
            
            # Resize logo
            resized_logo = logo_img.resize((target_w, target_h), Image.Resampling.LANCZOS)
            
            # Center on canvas
            x = (width - target_w) // 2
            y = (height - target_h) // 2
            
            if resized_logo.mode == 'RGBA':
                canvas.paste(resized_logo, (x, y), resized_logo)
            else:
                canvas.paste(resized_logo, (x, y))
                
            canvas.save(os.path.join(folder_path, 'splash.png'), optimize=True)
            print(f"  ✓ Android splash {folder} ({width}x{height}) updated")

def main():
    print("🚀 Starting HisaabPro Brand Asset Sync Engine...")
    
    master_sheet = os.path.join(BRANDING_DIR, 'master-sheet.png')
    master_icon = os.path.join(BRANDING_DIR, 'master-icon.png')
    master_logo = os.path.join(BRANDING_DIR, 'master-logo.png')

    if not os.path.exists(master_sheet) and not os.path.exists(master_icon):
        print(f"❌ Error: No master brand source found in {BRANDING_DIR}")
        print("Please place 'master-sheet.png' or 'master-icon.png' in assets/branding/")
        sys.exit(1)

    logo_for_splash = None

    if os.path.exists(master_icon):
        print(f"📦 Processing Master Icon: {master_icon}")
        icon_img = Image.open(master_icon)
        # Full 1024x1024 high quality master icon without downsizing
        icon_img.save(os.path.join(OFFICIAL_LOGOS_DIR, 'hisaabpro-icon-dark.png'), optimize=True)
        icon_img.save(os.path.join(OFFICIAL_LOGOS_DIR, 'hisaabpro-icon-1024.png'), optimize=True)
        icon_img.resize((512, 512), Image.Resampling.LANCZOS).save(os.path.join(PUBLIC_DIR, 'icon-512.png'), optimize=True)
        icon_img.resize((192, 192), Image.Resampling.LANCZOS).save(os.path.join(PUBLIC_DIR, 'icon-192.png'), optimize=True)
        icon_img.resize((64, 64), Image.Resampling.LANCZOS).save(os.path.join(PUBLIC_DIR, 'favicon.png'), optimize=True)
        print("  ✓ Full 1024px icon and Web/PWA icons generated (hisaabpro-icon-dark.png, icon-512.png, icon-192.png, favicon.png)")
        print("📱 Generating Android launcher icon densities...")
        generate_android_icons(icon_img)
        logo_for_splash = icon_img

    if os.path.exists(master_sheet):
        print(f"📦 Processing Master Logo Sheet: {master_sheet}")
        sheet = Image.open(master_sheet).convert('RGB')
        
        # 1. Dark App Icon Squircle (if no standalone master-icon)
        if not os.path.exists(master_icon):
            dark_squircle = sheet.crop((58, 58, 374, 374))
            dark_squircle.save(os.path.join(OFFICIAL_LOGOS_DIR, 'hisaabpro-icon-dark.png'))
            dark_squircle.save(os.path.join(PUBLIC_DIR, 'icon-512.png'))
            dark_squircle.resize((192, 192), Image.Resampling.LANCZOS).save(os.path.join(PUBLIC_DIR, 'icon-192.png'))
            dark_squircle.resize((64, 64), Image.Resampling.LANCZOS).save(os.path.join(PUBLIC_DIR, 'favicon.png'))
            print("  ✓ Web & PWA icons generated (icon-512.png, icon-192.png, favicon.png)")
            print("📱 Generating Android launcher icon densities...")
            generate_android_icons(dark_squircle)

        # 2. Light App Icon Squircle
        light_squircle = sheet.crop((398, 58, 714, 374))
        light_squircle.save(os.path.join(OFFICIAL_LOGOS_DIR, 'hisaabpro-icon-light.png'))

        # 3. Growth Leaf Icon Squircle
        growth_squircle = sheet.crop((738, 58, 1054, 374))
        growth_squircle.save(os.path.join(OFFICIAL_LOGOS_DIR, 'hisaabpro-icon-growth.png'))

        # 4. Light Horizontal Logo
        logo_light = extract_smooth(sheet, (562, 692, 988, 830), (247, 245, 239), is_dark_bg=False)
        logo_light.save(os.path.join(OFFICIAL_LOGOS_DIR, 'hisaabpro-logo-horizontal.png'))
        logo_light.save(os.path.join(PUBLIC_DIR, 'hisaabpro-logo.png'))
        logo_for_splash = logo_light
        print("  ✓ Horizontal brand logo generated (hisaabpro-logo-horizontal.png)")

        # 5. White / Dark Surface Horizontal Logo
        logo_dark = extract_smooth(sheet, (68, 692, 485, 830), (7, 60, 46), is_dark_bg=True)
        logo_dark.save(os.path.join(OFFICIAL_LOGOS_DIR, 'hisaabpro-logo-white.png'))
        print("  ✓ Dark-surface white logo generated (hisaabpro-logo-white.png)")

        # 6. Isolated H Leaf Mark
        mark = extract_smooth(sheet, (582, 698, 686, 820), (247, 245, 239), is_dark_bg=False)
        mark.save(os.path.join(OFFICIAL_LOGOS_DIR, 'hisaabpro-h-mark.png'))
        print("  ✓ Isolated brand mark generated (hisaabpro-h-mark.png)")

    if logo_for_splash:
        print("📱 Generating Android Splash screens...")
        generate_android_splash(logo_for_splash)

    print("✨ All brand assets generated and synced across Web, PWA, and Android successfully!")

if __name__ == '__main__':
    main()
