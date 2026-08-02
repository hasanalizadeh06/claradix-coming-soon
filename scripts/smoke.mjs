import { chromium } from 'playwright';
import { createServer } from 'vite';

const server = await createServer({ server: { port: 5199 } });
await server.listen();

const browser = await chromium.launch({ args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1536, height: 1024 } });

const errors = [];
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', e => errors.push('PAGEERROR: ' + e.message));

await page.goto('http://localhost:5199/', { waitUntil: 'networkidle' });
await page.waitForTimeout(5000);
console.log('sceneTime after 5s:', await page.evaluate(() => window.__sceneTime ?? null));

for (const at of [0.6, 4.1, 10.5, 16.0]) {
  await page.evaluate((v) => window.__claradixSeek?.(v), at);
  await page.waitForTimeout(500);
  await page.screenshot({ path: `shots/new-${at}.png` });
}
console.log(errors.length ? 'ERRORS:\n' + errors.slice(0,10).join('\n---\n') : 'no console errors');
await browser.close();
await server.close();
