import puppeteer, { Browser } from 'puppeteer-core';
import sharp from 'sharp';

let browser: Browser | null = null;

async function getBrowser(): Promise<Browser> {
    if (!browser) {
        browser = await puppeteer.launch({
            executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/chromium',
            headless: true,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-gpu',
                '--disable-web-security',        // allow cross-origin asset loading
                '--allow-file-access-from-files',
            ],
        });
    }
    return browser;
}

export async function closeBrowser(): Promise<void> {
    await browser?.close();
    browser = null;
}

/**
 * Load the game's index.html in a headless browser, wait 1 second for
 * the first rendered frame, then screenshot and resize to thumbnail size.
 *
 * @param gameUrl - Full public URL to the game's index.html in MinIO
 * @returns JPEG Buffer (720px wide, 405px tall — 16:9)
 */
export async function captureScreenshot(gameUrl: string): Promise<Buffer> {
    const br = await getBrowser();
    const page = await br.newPage();

    try {
        await page.setViewport({ width: 1280, height: 720 });

        // Navigate and wait for network to settle
        await page.goto(gameUrl, {
            waitUntil: 'networkidle2',
            timeout: 30_000,
        });

        // Allow game's first frame to render
        await new Promise((r) => setTimeout(r, 1_500));

        const screenshotBuffer = await page.screenshot({
            type: 'jpeg',
            quality: 90,
            fullPage: false,
        });

        // Resize to standard thumbnail: 720x405 (16:9)
        const thumbnail = await sharp(screenshotBuffer as Buffer)
            .resize(720, 405, { fit: 'cover', position: 'centre' })
            .jpeg({ quality: 80, mozjpeg: true })
            .toBuffer();

        return thumbnail;
    } finally {
        await page.close();
    }
}

/**
 * Fallback thumbnail when Puppeteer fails — generate a gradient placeholder
 * with the game title rendered as text.
 */
export async function generatePlaceholderThumbnail(title: string): Promise<Buffer> {
    const svg = Buffer.from(`
    <svg width="720" height="405" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:#1a1a2e"/>
          <stop offset="100%" style="stop-color:#16213e"/>
        </linearGradient>
      </defs>
      <rect width="720" height="405" fill="url(#bg)"/>
      <text
        x="360" y="202"
        font-family="Arial, sans-serif"
        font-size="36"
        font-weight="bold"
        fill="white"
        text-anchor="middle"
        dominant-baseline="middle"
      >${title.slice(0, 40)}</text>
      <text
        x="360" y="258"
        font-family="Arial, sans-serif"
        font-size="16"
        fill="#6c63ff"
        text-anchor="middle"
      >GameReel</text>
    </svg>`);

    return sharp(svg)
        .jpeg({ quality: 80 })
        .toBuffer();
}
