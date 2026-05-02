'use strict';

const express = require('express');
const routes = require('./src/routes');

const PORT = process.env.PORT || 3000;
const app = express();

app.use(express.json({ limit: '1mb' }));
app.set('trust proxy', 1);

// Rutas
app.use('/', routes);

// 404
app.use((req, res) => {
  res.status(404).json({ error: 'Ruta no encontrada' });
});

// Error handler
app.use((err, req, res, _next) => {
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    return res.status(400).json({ error: 'JSON malformado' });
  }

  console.error('[server] Error no manejado:', err);
  res.status(500).json({ error: 'Error interno del servidor' });
});

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Screenshot API corriendo en puerto ${PORT}`);
    console.log(`Health: http://localhost:${PORT}/health`);
  });
}

module.exports = app;
