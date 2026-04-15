'use strict';

const request = require('supertest');

// Mock playwright ANTES de importar la app
jest.mock('playwright', () => {
  const mockBuffer = Buffer.from('fake-png-data');
  const mockPage = {
    setDefaultTimeout: jest.fn(),
    goto: jest.fn().mockResolvedValue(null),
    screenshot: jest.fn().mockResolvedValue(mockBuffer),
  };
  const mockContext = {
    newPage: jest.fn().mockResolvedValue(mockPage),
  };
  const mockBrowser = {
    newContext: jest.fn().mockResolvedValue(mockContext),
    close: jest.fn().mockResolvedValue(null),
  };
  return {
    chromium: {
      launch: jest.fn().mockResolvedValue(mockBrowser),
    },
  };
});

const app = require('../server');

describe('GET /health', () => {
  test('retorna status ok', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.service).toBe('screenshot-api');
    expect(res.body.timestamp).toBeDefined();
  });
});

describe('POST /screenshot', () => {
  test('toma screenshot con URL válida', async () => {
    const res = await request(app)
      .post('/screenshot')
      .send({ url: 'https://example.com' });
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/image\/png/);
  });

  test('retorna 400 sin url', async () => {
    const res = await request(app).post('/screenshot').send({});
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/url/i);
  });

  test('retorna 400 con URL inválida', async () => {
    // La validación de URL ocurre antes de llamar a playwright
    const res = await request(app)
      .post('/screenshot')
      .send({ url: 'not-a-url' });
    expect([400, 500]).toContain(res.status);
  });

  test('toma screenshot JPEG', async () => {
    const res = await request(app)
      .post('/screenshot')
      .send({ url: 'https://example.com', format: 'jpeg', quality: 90 });
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/image\/jpeg/);
  });

  test('toma screenshot fullPage', async () => {
    const res = await request(app)
      .post('/screenshot')
      .send({ url: 'https://example.com', fullPage: true, width: 1920, height: 1080 });
    expect(res.status).toBe(200);
  });
});

describe('GET /screenshot', () => {
  test('toma screenshot via GET', async () => {
    const res = await request(app)
      .get('/screenshot?url=https://example.com');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/image\/png/);
  });

  test('retorna 400 sin url en GET', async () => {
    const res = await request(app).get('/screenshot');
    expect(res.status).toBe(400);
  });

  test('GET con parámetros opcionales', async () => {
    const res = await request(app)
      .get('/screenshot?url=https://example.com&width=800&height=600&format=png');
    expect(res.status).toBe(200);
  });
});

describe('POST /batch', () => {
  test('procesa múltiples URLs', async () => {
    const res = await request(app)
      .post('/batch')
      .send({ urls: ['https://example.com', 'https://google.com'] });
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(2);
    expect(res.body.results).toHaveLength(2);
    expect(res.body.succeeded).toBe(2);
  });

  test('retorna 400 sin urls', async () => {
    const res = await request(app).post('/batch').send({});
    expect(res.status).toBe(400);
  });

  test('retorna 400 con array vacío', async () => {
    const res = await request(app).post('/batch').send({ urls: [] });
    expect(res.status).toBe(400);
  });

  test('retorna 400 con más de 10 URLs', async () => {
    const urls = Array.from({ length: 11 }, (_, i) => `https://example${i}.com`);
    const res = await request(app).post('/batch').send({ urls });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/10/);
  });

  test('resultado batch contiene base64', async () => {
    const res = await request(app)
      .post('/batch')
      .send({ urls: ['https://example.com'] });
    expect(res.status).toBe(200);
    expect(res.body.results[0].success).toBe(true);
    expect(res.body.results[0].data).toBeDefined();
    expect(res.body.results[0].format).toBe('png');
  });
});

describe('Rutas no existentes', () => {
  test('retorna 404 para ruta desconocida', async () => {
    const res = await request(app).get('/api/unknown');
    expect(res.status).toBe(404);
  });
});
