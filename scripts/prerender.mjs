/**
 * Prerender script: builds the site with Vite, then uses Playwright to
 * crawl every route and write the fully-rendered HTML back to dist/.
 *
 * Usage: node scripts/prerender.mjs
 * Expects `vite build` to have already run (dist/ must exist).
 */

import { preview } from "vite";
import { chromium } from "playwright";
import { writeFileSync, mkdirSync, readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const distDir = join(__dirname, "..", "dist");

async function discoverRoutes(page, baseUrl) {
  // Start from known entry points and crawl internal links
  const seen = new Set();
  const queue = ["/", "/about", "/posts"];

  while (queue.length > 0) {
    const route = queue.shift();
    if (seen.has(route)) continue;
    seen.add(route);

    await page.goto(`${baseUrl}${route}`, { waitUntil: "networkidle" });

    // Find all internal links
    const links = await page.evaluate(() =>
      Array.from(document.querySelectorAll("a[href]"))
        .map((a) => a.getAttribute("href"))
        .filter((href) => href && href.startsWith("/") && !href.startsWith("//"))
        .map((href) => href.split("#")[0].split("?")[0])
    );

    for (const link of links) {
      if (!seen.has(link)) {
        queue.push(link);
      }
    }
  }

  return Array.from(seen);
}

async function prerender() {
  console.log("Starting prerender...");

  // Start Vite preview server
  const server = await preview({
    preview: { port: 4173, strictPort: true },
  });
  const baseUrl = "http://localhost:4173";

  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();

  // Suppress WebGPU errors in headless mode
  page.on("pageerror", () => {});
  page.on("console", () => {});

  try {
    // Discover all routes by crawling
    console.log("Discovering routes...");
    const routes = await discoverRoutes(page, baseUrl);
    console.log(`Found ${routes.length} routes:`, routes);

    // Prerender each route
    for (const route of routes) {
      console.log(`Prerendering: ${route}`);
      await page.goto(`${baseUrl}${route}`, { waitUntil: "networkidle" });

      // Wait a bit for any animations/transitions to settle
      await page.waitForTimeout(500);

      // Get the full HTML — React will use createRoot and replace the
      // prerendered content on load, so no hydration marker needed.
      const html = await page.content();

      // Determine output path
      let outputPath;
      if (route === "/") {
        outputPath = join(distDir, "index.html");
      } else {
        // /posts/foo -> /posts/foo/index.html (for clean URLs)
        outputPath = join(distDir, route, "index.html");
      }

      mkdirSync(dirname(outputPath), { recursive: true });
      writeFileSync(outputPath, html);
      console.log(`  -> ${outputPath}`);
    }

    // Copy the root index.html as 404.html for SPA fallback
    const rootHtml = readFileSync(join(distDir, "index.html"), "utf-8");
    writeFileSync(join(distDir, "404.html"), rootHtml);
    console.log("Created 404.html");

    // Create .nojekyll for GitHub Pages
    writeFileSync(join(distDir, ".nojekyll"), "");
    console.log("Created .nojekyll");

    console.log("Prerender complete!");
  } finally {
    await browser.close();
    server.httpServer.close();
  }
}

prerender().catch((err) => {
  console.error("Prerender failed:", err);
  process.exit(1);
});
