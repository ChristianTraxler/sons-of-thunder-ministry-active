const puppeteer = require('puppeteer');
const path = require('path');
const { execSync } = require('child_process');
const fs = require('fs');

(async () => {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();

  // Letter size in pixels at 2x for crisp output (8.5 x 11 inches at 150 DPI)
  const PAGE_WIDTH = 1275;
  const PAGE_HEIGHT = 1650;

  await page.setViewport({ width: PAGE_WIDTH, height: PAGE_HEIGHT, deviceScaleFactor: 2 });

  const filePath = path.resolve(__dirname, 'index.html');
  await page.goto(`file://${filePath}`, { waitUntil: 'networkidle0' });

  // Inject styles for screenshot capture
  await page.addStyleTag({
    content: `
      /* Make navbar absolute so it only appears at top of page 1 */
      nav {
        position: absolute !important;
        background: rgba(13,10,5,0.97) !important;
      }

      /* Make all reveal elements visible */
      .reveal {
        opacity: 1 !important;
        transform: translateY(0) !important;
        transition: none !important;
      }

      /* Hide scroll-to-top button */
      #scrollTop { display: none !important; }

      /* Hide scroll cue */
      .scroll-cue { display: none !important; }

      /* Stop all animations */
      *, *::before, *::after {
        animation: none !important;
        transition: none !important;
      }

      /* Keep hero text visible */
      .hero-title {
        text-shadow: 0 0 40px rgba(201,168,76,0.35), 0 4px 20px rgba(0,0,0,0.8) !important;
      }

      /* Ensure hero stars are visible */
      .stars { opacity: 0.8 !important; }

      /* Lightning bolts hidden for clean look */
      .lightning-bolt { display: none !important; }
    `
  });

  // Wait for fonts to load
  await page.evaluate(() => document.fonts.ready);
  await new Promise(r => setTimeout(r, 1500));

  // Take a full-page screenshot (captures actual rendered pixels)
  const screenshotPath = path.resolve(__dirname, 'full-page.png');
  await page.screenshot({
    path: screenshotPath,
    fullPage: true,
    type: 'png',
  });

  console.log('Full-page screenshot captured.');

  // Get the actual dimensions of the screenshot
  const dimensions = await page.evaluate(() => ({
    width: document.documentElement.scrollWidth,
    height: document.documentElement.scrollHeight,
  }));

  console.log(`Page dimensions: ${dimensions.width}x${dimensions.height}`);

  // Now create a PDF by loading the screenshot into pages
  const totalHeight = dimensions.height;
  const pageCount = Math.ceil(totalHeight / PAGE_HEIGHT);

  console.log(`Will create ${pageCount} pages`);

  // Create an HTML page that tiles the screenshot into letter-sized pages
  const pdfHtml = `
  <!DOCTYPE html>
  <html>
  <head>
    <style>
      * { margin: 0; padding: 0; }
      @page { size: 8.5in 11in; margin: 0; }
      body { width: 8.5in; }
      .page {
        width: 8.5in;
        height: 11in;
        overflow: hidden;
        position: relative;
        page-break-after: always;
      }
      .page:last-child { page-break-after: auto; }
      .page img {
        position: absolute;
        left: 0;
        width: 8.5in;
      }
    </style>
  </head>
  <body>
    ${Array.from({ length: pageCount }, (_, i) => `
      <div class="page">
        <img src="file://${screenshotPath}" style="top: -${i * 11}in;" />
      </div>
    `).join('')}
  </body>
  </html>`;

  const pdfHtmlPath = path.resolve(__dirname, '_pdf-layout.html');
  fs.writeFileSync(pdfHtmlPath, pdfHtml);

  // Open the layout HTML and generate PDF
  const pdfPage = await browser.newPage();
  await pdfPage.goto(`file://${pdfHtmlPath}`, { waitUntil: 'networkidle0' });
  await new Promise(r => setTimeout(r, 500));

  const outputPath = path.resolve(__dirname, 'sons-of-thunder-ministry.pdf');
  await pdfPage.pdf({
    path: outputPath,
    width: '8.5in',
    height: '11in',
    printBackground: true,
    margin: { top: '0', right: '0', bottom: '0', left: '0' },
  });

  console.log(`PDF saved to: ${outputPath}`);

  // Clean up temp files
  fs.unlinkSync(screenshotPath);
  fs.unlinkSync(pdfHtmlPath);

  await browser.close();
})();
