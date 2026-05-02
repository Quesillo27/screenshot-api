'use strict';

const express = require('express');
const { takeScreenshot } = require('./screenshot');
const { isPlainObject } = require('./validation');

const router = express.Router();

function handleScreenshotError(res, err) {
  if (err.message.includes('inválida')
    || err.message.includes('requerida')
    || err.message.includes('protocolo')
    || err.message.includes('localhost')
    || err.message.includes('debe')) {
    return res.status(400).json({ error: err.message });
  }

  if (err.message.includes('Timeout') || err.message.toLowerCase().includes('timeout')) {
    return res.status(504).json({ error: 'Timeout al cargar la página', detail: err.message });
  }

  console.error('[screenshot] Error:', err.message);
  return res.status(500).json({ error: 'Error al tomar el screenshot', detail: err.message });
}

/**
 * POST /screenshot
 * Body JSON: { url, width, height, fullPage, format, quality, timeout, waitUntil }
 * Retorna: imagen PNG/JPEG
 */
router.post('/screenshot', async (req, res) => {
  const { url, width, height, fullPage, format = 'png', quality, timeout, waitUntil } = req.body || {};

  if (!url) {
    return res.status(400).json({ error: 'Campo "url" es requerido' });
  }

  try {
    const buffer = await takeScreenshot({ url, width, height, fullPage, format, quality, timeout, waitUntil });
    const mimeType = format === 'jpeg' ? 'image/jpeg' : 'image/png';
    res.set('Content-Type', mimeType);
    res.set('Content-Length', buffer.length);
    res.send(buffer);
  } catch (err) {
    return handleScreenshotError(res, err);
  }
});

/**
 * GET /screenshot?url=...&width=...&height=...&fullPage=...&format=...
 * Alternativa GET para casos simples
 */
router.get('/screenshot', async (req, res) => {
  const { url, width, height, fullPage, format = 'png', quality, timeout } = req.query;

  if (!url) {
    return res.status(400).json({ error: 'Parámetro "url" es requerido' });
  }

  try {
    const buffer = await takeScreenshot({
      url,
      width: width ? Number(width) : undefined,
      height: height ? Number(height) : undefined,
      fullPage: fullPage === 'true',
      format,
      quality: quality ? Number(quality) : undefined,
      timeout: timeout ? Number(timeout) : undefined,
    });
    const mimeType = format === 'jpeg' ? 'image/jpeg' : 'image/png';
    res.set('Content-Type', mimeType);
    res.set('Content-Length', buffer.length);
    res.send(buffer);
  } catch (err) {
    return handleScreenshotError(res, err);
  }
});

/**
 * POST /batch
 * Body JSON: { urls: [...], options: { width, height, fullPage, format } }
 * Retorna: JSON con base64 de cada screenshot
 */
router.post('/batch', async (req, res) => {
  const { urls, options = {} } = req.body || {};

  if (!Array.isArray(urls) || urls.length === 0) {
    return res.status(400).json({ error: 'Campo "urls" debe ser un array no vacío' });
  }

  if (urls.length > 10) {
    return res.status(400).json({ error: 'Máximo 10 URLs por lote' });
  }

  if (urls.some((url) => typeof url !== 'string' || url.trim() === '')) {
    return res.status(400).json({ error: 'Cada elemento de "urls" debe ser una URL string no vacía' });
  }

  if (!isPlainObject(options)) {
    return res.status(400).json({ error: 'Campo "options" debe ser un objeto JSON' });
  }

  const results = await Promise.allSettled(
    urls.map(async (url) => {
      const buffer = await takeScreenshot({ url, ...options });
      return {
        url,
        data: buffer.toString('base64'),
        format: options.format || 'png',
        size: buffer.length,
      };
    })
  );

  const response = results.map((result, i) => {
    if (result.status === 'fulfilled') {
      return { url: urls[i], success: true, ...result.value };
    }
    return { url: urls[i], success: false, error: result.reason?.message || 'Error desconocido' };
  });

  res.json({ results: response, total: urls.length, succeeded: response.filter((r) => r.success).length });
});

/**
 * GET /health
 */
router.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'screenshot-api',
    timestamp: new Date().toISOString(),
    uptime: Math.round(process.uptime()),
    allowPrivateNetworks: process.env.ALLOW_PRIVATE_NETWORKS === 'true',
  });
});

module.exports = router;
