'use strict';

const request = require('supertest');

const mockLookup = jest.fn().mockImplementation(async (hostname) => {
  if (hostname === 'example.com') {
    return [{ address: '93.184.216.34', family: 4 }];
  }

  if (hostname === 'google.com') {
    return [{ address: '142.250.190.14', family: 4 }];
  }

  if (hostname === 'internal.example.test') {
    return [{ address: '10.0.0.8', family: 4 }];
  }

  return [{ address: '203.0.113.10', family: 4 }];
});

jest.mock('dns', () => ({
  promises: {
    lookup: (...args) => mockLookup(...args),
  },
}));

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

beforeEach(() => {
  delete process.env.ALLOW_PRIVATE_NETWORKS;
  mockLookup.mockClear();
});

describe('GET /health', () => {
  test('retorna status ok', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.service).toBe('screenshot-api');
    expect(res.body.timestamp).toBeDefined();
    expect(res.body.uptime).toBeGreaterThanOrEqual(0);
    expect(res.body.allowPrivateNetworks).toBe(false);
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
    const res = await request(app)
      .post('/screenshot')
      .send({ url: 'not-a-url' });
    expect(res.status).toBe(400);
  });

  test('retorna 400 para JSON malformado', async () => {
    const res = await request(app)
      .post('/screenshot')
      .set('Content-Type', 'application/json')
      .send('{"url":')
      .buffer(true);
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/json malformado/i);
  });

  test('retorna 400 para localhost', async () => {
    const res = await request(app)
      .post('/screenshot')
      .send({ url: 'http://localhost:3000/private' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/redes privadas/i);
  });

  test('retorna 400 para hostname que resuelve a IP privada', async () => {
    const res = await request(app)
      .post('/screenshot')
      .send({ url: 'http://internal.example.test/admin' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/redes privadas/i);
  });

  test('retorna 400 para width inválido', async () => {
    const res = await request(app)
      .post('/screenshot')
      .send({ url: 'https://example.com', width: 100 });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/width/i);
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

  test('GET retorna 400 con timeout inválido', async () => {
    const res = await request(app)
      .get('/screenshot?url=https://example.com&timeout=abc');
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/timeout/i);
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

  test('retorna 400 cuando urls contiene valores no string', async () => {
    const res = await request(app).post('/batch').send({ urls: ['https://example.com', 123] });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/urls/i);
  });

  test('retorna 400 cuando options no es objeto', async () => {
    const res = await request(app)
      .post('/batch')
      .send({ urls: ['https://example.com'], options: 'jpeg' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/options/i);
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

  test('marca error por URL privada sin romper el lote', async () => {
    const res = await request(app)
      .post('/batch')
      .send({ urls: ['https://example.com', 'http://internal.example.test'] });
    expect(res.status).toBe(200);
    expect(res.body.succeeded).toBe(1);
    expect(res.body.results[1].success).toBe(false);
  });
});

describe('Rutas no existentes', () => {
  test('retorna 404 para ruta desconocida', async () => {
    const res = await request(app).get('/api/unknown');
    expect(res.status).toBe(404);
  });
});
