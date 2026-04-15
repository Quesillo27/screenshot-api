FROM mcr.microsoft.com/playwright:v1.40.0-jammy

WORKDIR /app

# Instalar dependencias primero (cache layer)
COPY package*.json ./
RUN npm ci --omit=dev

# Copiar código fuente
COPY server.js ./
COPY src/ ./src/

# Usuario no-root para seguridad
RUN groupadd -r appuser && useradd -r -g appuser appuser
RUN chown -R appuser:appuser /app
USER appuser

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health', r => process.exit(r.statusCode===200?0:1))"

CMD ["node", "server.js"]
