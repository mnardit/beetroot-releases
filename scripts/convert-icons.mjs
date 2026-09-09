import sharp from "sharp";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const src = join(root, "Gemini_Generated_Image_mj207hmj207hmj20.png");
const iconsDir = join(root, "src-tauri", "icons");

async function convert() {
  // 1. Create 1024x1024 app-icon.png (master)
  await sharp(src).resize(1024, 1024).png().toFile(join(root, "app-icon.png"));
  console.log("✓ app-icon.png (1024x1024)");

  // 2. Tray light (white silhouette for dark taskbars)
  // Extract alpha, make everything white where opaque
  const trayBuf = await sharp(src).resize(32, 32).ensureAlpha().raw().toBuffer();
  const whiteBuf = Buffer.alloc(trayBuf.length);
  for (let i = 0; i < trayBuf.length; i += 4) {
    const alpha = trayBuf[i + 3];
    whiteBuf[i] = 255; // R
    whiteBuf[i + 1] = 255; // G
    whiteBuf[i + 2] = 255; // B
    whiteBuf[i + 3] = alpha > 30 ? 255 : 0; // binary alpha
  }
  await sharp(whiteBuf, { raw: { width: 32, height: 32, channels: 4 } })
    .png()
    .toFile(join(iconsDir, "tray-light.png"));
  console.log("✓ tray-light.png (32x32 white silhouette)");

  // 3. Tray dark (dark silhouette for light taskbars)
  const darkBuf = Buffer.alloc(trayBuf.length);
  for (let i = 0; i < trayBuf.length; i += 4) {
    const alpha = trayBuf[i + 3];
    darkBuf[i] = 26; // R (#1a)
    darkBuf[i + 1] = 26; // G
    darkBuf[i + 2] = 26; // B
    darkBuf[i + 3] = alpha > 30 ? 255 : 0;
  }
  await sharp(darkBuf, { raw: { width: 32, height: 32, channels: 4 } })
    .png()
    .toFile(join(iconsDir, "tray-dark.png"));
  console.log("✓ tray-dark.png (32x32 dark silhouette)");

  console.log("\n✓ Done! Now run: npx tauri icon app-icon.png");
}

convert().catch(console.error);
