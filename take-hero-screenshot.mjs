import { chromium } from "playwright";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 820 },
    deviceScaleFactor: 2, // retina for crisp image
  });
  const page = await context.newPage();

  // Log in
  await page.goto("http://localhost:3000/login");
  await page.waitForTimeout(2000);

  // Fill email
  const emailInput = page.locator('input[type="email"]');
  await emailInput.fill("khan@ezaccounts.ca");

  // Fill password
  const passwordInput = page.locator('input[type="password"]');
  await passwordInput.fill("Admin12345");

  // Submit
  await page.locator('button[type="submit"]').click();
  await page.waitForTimeout(3500);

  // Navigate to board
  await page.goto("http://localhost:3000/workspace/1/board/1");
  await page.waitForTimeout(3000);

  // Hide scrollbars and header chrome for a clean shot
  await page.addStyleTag({
    content: `
      * { scrollbar-width: none !important; }
      *::-webkit-scrollbar { display: none !important; }
    `,
  });

  // Screenshot just the main content area
  const outPath = path.join(__dirname, "apps/web/public/hero-dashboard.png");

  await page.screenshot({
    path: outPath,
    clip: { x: 60, y: 60, width: 1160, height: 700 },
  });

  console.log("Screenshot saved to:", outPath);
  await browser.close();
})();
