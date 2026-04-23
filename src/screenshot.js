'use strict';

const { chromium } = require('playwright');
const { assertSafeUrl, normalizeOptions } = require('./validation');

const DEFAULT_WIDTH = 1280;
const DEFAULT_HEIGHT = 720;
const DEFAULT_TIMEOUT = 30000;

/**
 * Toma un screenshot de una URL dada.
 * @param {object} options
 * @param {string} options.url - URL a capturar
 * @param {number} [options.width=1280] - Ancho del viewport
 * @param {number} [options.height=720] - Alto del viewport
 * @param {boolean} [options.fullPage=false] - Capturar página completa
 * @param {string} [options.format='png'] - Formato: 'png' o 'jpeg'
 * @param {number} [options.quality=80] - Calidad JPEG (1-100)
 * @param {number} [options.timeout=30000] - Timeout en ms
 * @param {string} [options.waitUntil='networkidle'] - Evento de espera
 * @returns {Promise<Buffer>} Buffer de imagen
 */
async function takeScreenshot(options = {}) {
  const normalizedOptions = normalizeOptions(options);
  const {
    url,
    width = DEFAULT_WIDTH,
    height = DEFAULT_HEIGHT,
    fullPage = false,
    format = 'png',
    quality = 80,
    timeout = DEFAULT_TIMEOUT,
    waitUntil = 'networkidle',
  } = normalizedOptions;

  if (!url) throw new Error('URL es requerida');

  // Validar URL
  let parsedUrl;
  try {
    parsedUrl = new URL(url);
  } catch {
    throw new Error(`URL inválida: ${url}`);
  }

  if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
    throw new Error('Solo se aceptan URLs con protocolo http o https');
  }

  await assertSafeUrl(parsedUrl);

  if (!['png', 'jpeg'].includes(format)) {
    throw new Error('Formato debe ser "png" o "jpeg"');
  }

  const browser = await chromium.launch({
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  });

  try {
    const context = await browser.newContext({
      viewport: { width: Number(width), height: Number(height) },
    });
    const page = await context.newPage();
    page.setDefaultTimeout(timeout);

    await page.goto(url, { waitUntil, timeout });

    const screenshotOptions = {
      fullPage: Boolean(fullPage),
      type: format,
    };

    if (format === 'jpeg') {
      screenshotOptions.quality = Number(quality);
    }

    const buffer = await page.screenshot(screenshotOptions);
    return buffer;
  } finally {
    await browser.close();
  }
}

module.exports = { takeScreenshot };
