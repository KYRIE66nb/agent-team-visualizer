import { chromium } from 'playwright';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const outPath = path.resolve(__dirname, '..', 'assets', 'screenshot.png');
const htmlPath = path.resolve(__dirname, '..', 'assets', 'readme-screenshot.html');
const url = 'file://' + htmlPath;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1400, height: 820 } });
await page.goto(url);
await page.waitForTimeout(200);
await page.screenshot({ path: outPath, fullPage: true });
await browser.close();
console.log(outPath);
