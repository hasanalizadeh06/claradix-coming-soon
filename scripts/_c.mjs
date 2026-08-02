import { chromium } from "playwright";
const b = await chromium.launch({ channel: "chrome" });
const p = await b.newPage({ viewport: { width: 1280, height: 1360 }, deviceScaleFactor: 1.4 });
await p.goto("file:///" + process.cwd().replace(/\/g,"/") + "/shots/cmp.html");
await p.waitForTimeout(900);
await p.screenshot({ path: "shots/width-compare.png", fullPage: true });
await b.close(); console.log("ok");
