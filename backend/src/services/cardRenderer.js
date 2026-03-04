/**
 * Card Renderer Service — Puppeteer
 * ══════════════════════════════════
 *
 * Renders ID card templates in a headless browser and captures
 * them as PNG images + a 2-page PDF (front + back).
 *
 * Flow:
 *   1. Launch (or reuse) a Puppeteer browser instance.
 *   2. Open a new page pointing at the frontend's /render-card route.
 *   3. Pass card data + styling via URL hash (to avoid server round-trips).
 *   4. Wait for the card to render.
 *   5. Screenshot the front and back card elements.
 *   6. Combine into a 2-page PDF.
 *   7. Return { pngBuffer, pdfBuffer, pdfBase64 }.
 *
 * Environment:
 *   FRONTEND_URL  — The base URL of the running frontend (default: http://localhost:5173)
 */

const puppeteer = require("puppeteer");

let browserInstance = null;

/**
 * Get or launch a shared Puppeteer browser instance.
 */
const getBrowser = async () => {
  if (browserInstance && browserInstance.connected) {
    return browserInstance;
  }

  browserInstance = await puppeteer.launch({
    headless: "new",
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-gpu",
      "--font-render-hinting=none",
    ],
  });

  // Auto-cleanup on disconnect
  browserInstance.on("disconnected", () => {
    browserInstance = null;
  });

  return browserInstance;
};

/**
 * Render a card and capture front + back as PNG buffers and a combined PDF.
 *
 * @param {object} params
 * @param {object} params.data         – Member data (name, role, etc.)
 * @param {string} params.template     – "custom" | "corporate" | "event" | "student"
 * @param {string} params.orgName      – Organization name
 * @param {string} params.logoUrl      – Logo URL
 * @param {object} params.cardStyles   – Card style overrides
 * @param {object} params.gradientColors – { start, end }
 * @param {object} params.fieldVisibility – Which fields to show
 * @param {string} params.orientation  – "horizontal" | "vertical"
 * @param {string} params.validityText – Validity text shown on back
 * @param {object} params.watermark    – Watermark config
 * @returns {Promise<{ frontPng: Buffer, backPng: Buffer, pdfBuffer: Buffer, pdfBase64: string }>}
 */
const renderCard = async (params) => {
  const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173";

  // Encode all card data into the URL hash so the render page can read it
  const payload = {
    data: params.data,
    template: params.template || "custom",
    orgName: params.orgName || "",
    logoUrl: params.logoUrl || "",
    cardStyles: params.cardStyles || {},
    gradientColors: params.gradientColors || {
      start: "#1152d4",
      end: "#ef4444",
    },
    fieldVisibility: params.fieldVisibility || {},
    orientation: params.orientation || "horizontal",
    validityText: params.validityText || "Valid for 1 year from issue",
    watermark: params.watermark || {},
  };

  const encodedPayload = encodeURIComponent(JSON.stringify(payload));
  const renderUrl = `${frontendUrl}/render-card#${encodedPayload}`;

  const browser = await getBrowser();
  const page = await browser.newPage();

  try {
    // Set viewport to card dimensions (CR-80 at 2x for quality)
    const isVertical = params.orientation === "vertical";
    const viewportWidth = isVertical ? 700 : 900;
    const viewportHeight = isVertical ? 1000 : 700;

    await page.setViewport({
      width: viewportWidth,
      height: viewportHeight,
      deviceScaleFactor: 2,
    });

    // Navigate to the render page
    await page.goto(renderUrl, {
      waitUntil: "networkidle0",
      timeout: 30000,
    });

    // Wait for the card to be rendered (the render page sets a data attr)
    await page.waitForSelector("[data-render-ready='true']", {
      timeout: 15000,
    });

    // Small delay for fonts / images to settle
    await new Promise((r) => setTimeout(r, 500));

    // Screenshot the front card
    const frontEl = await page.$("#card-front");
    if (!frontEl)
      throw new Error("Card front element not found on render page");

    const frontPng = await frontEl.screenshot({
      type: "png",
      omitBackground: true,
    });

    // Screenshot the back card
    const backEl = await page.$("#card-back");
    let backPng = null;
    if (backEl) {
      backPng = await backEl.screenshot({
        type: "png",
        omitBackground: true,
      });
    }

    // Generate a 2-page PDF using the page's built-in PDF functionality
    // We'll use a simpler approach: embed the PNGs into a PDF via the page
    const pdfResult = await page.evaluate(() => {
      // The render page exposes a global function that returns the PDF base64
      if (typeof window.__generatePDF === "function") {
        return window.__generatePDF();
      }
      return null;
    });

    let pdfBuffer = null;
    let pdfBase64 = null;

    if (pdfResult) {
      pdfBase64 = pdfResult;
      pdfBuffer = Buffer.from(pdfResult, "base64");
    }

    return { frontPng, backPng, pdfBuffer, pdfBase64 };
  } finally {
    await page.close();
  }
};

/**
 * Gracefully close the shared browser instance.
 */
const closeBrowser = async () => {
  if (browserInstance) {
    await browserInstance.close();
    browserInstance = null;
  }
};

module.exports = { renderCard, closeBrowser, getBrowser };
