import { chromium } from "@playwright/test";

(async () => {
  const b = await chromium.launch({ headless: false });
  const ctx = await b.newContext();
  const p = await ctx.newPage();

  await p.goto("https://playwright.dev/");
})();
