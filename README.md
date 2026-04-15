# Screenshot API

![Node](https://img.shields.io/badge/node-20+-green) ![Express](https://img.shields.io/badge/express-4.x-blue) ![Playwright](https://img.shields.io/badge/playwright-1.40-orange) ![License](https://img.shields.io/badge/license-MIT-lightgrey)

API REST para tomar screenshots de cualquier URL usando Playwright (Chromium headless). Soporta PNG/JPEG, viewport configurable, página completa, y captura en lote de hasta 10 URLs simultáneas.

## Instalación en 3 comandos

```bash
git clone https://github.com/Quesillo27/screenshot-api
cd screenshot-api
npm install && npx playwright install chromium --with-deps
```

## Uso

```bash
npm start   # inicia el servicio en puerto 3000
```

Con Docker:
```bash
docker build -t screenshot-api .
docker run -p 3000:3000 screenshot-api
```

## Ejemplo

```bash
# Screenshot básico (PNG)
curl -X POST http://localhost:3000/screenshot \
  -H "Content-Type: application/json" \
  -d '{"url": "https://example.com"}' \
  --output screenshot.png

# Screenshot JPEG full-page con viewport personalizado
curl -X POST http://localhost:3000/screenshot \
  -H "Content-Type: application/json" \
  -d '{"url": "https://github.com", "format": "jpeg", "quality": 90, "fullPage": true, "width": 1920}' \
  --output github-full.jpg

# Via GET (simple)
curl "http://localhost:3000/screenshot?url=https://example.com" --output out.png

# Lote de múltiples URLs → devuelve JSON con base64
curl -X POST http://localhost:3000/batch \
  -H "Content-Type: application/json" \
  -d '{"urls": ["https://example.com", "https://google.com"]}' | jq '.results[0].size'
# → 45823
```

## API / Endpoints disponibles

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| `POST` | `/screenshot` | Toma screenshot, devuelve imagen |
| `GET` | `/screenshot?url=...` | Igual pero via query params |
| `POST` | `/batch` | Hasta 10 URLs en paralelo → JSON con base64 |
| `GET` | `/health` | Health check |

### POST `/screenshot` — Body JSON

| Campo | Tipo | Default | Descripción |
|-------|------|---------|-------------|
| `url` | string | **requerido** | URL a capturar (http/https) |
| `width` | number | 1280 | Ancho del viewport en px |
| `height` | number | 720 | Alto del viewport en px |
| `fullPage` | boolean | false | Capturar toda la página |
| `format` | string | `"png"` | Formato: `"png"` o `"jpeg"` |
| `quality` | number | 80 | Calidad JPEG (1-100) |
| `timeout` | number | 30000 | Timeout en ms |
| `waitUntil` | string | `"networkidle"` | Evento: `load`, `domcontentloaded`, `networkidle` |

### POST `/batch` — Body JSON

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `urls` | string[] | Array de URLs (máx. 10) |
| `options` | object | Opciones comunes (width, height, format, etc.) |

Respuesta:
```json
{
  "total": 2,
  "succeeded": 2,
  "results": [
    { "url": "https://example.com", "success": true, "data": "<base64>", "format": "png", "size": 45823 }
  ]
}
```

## Variables de entorno

| Variable | Default | Descripción |
|----------|---------|-------------|
| `PORT` | 3000 | Puerto del servidor |

## Contribuir

PRs bienvenidos. Corre `npm test` antes de enviar.

```bash
npm test
```
