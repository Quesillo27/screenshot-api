'use strict';

const dns = require('dns').promises;
const net = require('net');

const ALLOWED_WAIT_UNTIL = new Set(['load', 'domcontentloaded', 'networkidle', 'commit']);

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function toInteger(value, fieldName) {
  const parsed = Number(value);

  if (!Number.isInteger(parsed)) {
    throw new Error(`${fieldName} debe ser un entero válido`);
  }

  return parsed;
}

function assertRange(value, fieldName, min, max) {
  if (value < min || value > max) {
    throw new Error(`${fieldName} debe estar entre ${min} y ${max}`);
  }
}

function isPrivateIpv4(ip) {
  const parts = ip.split('.').map(Number);

  return parts[0] === 10
    || parts[0] === 127
    || (parts[0] === 169 && parts[1] === 254)
    || (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31)
    || (parts[0] === 192 && parts[1] === 168)
    || (parts[0] === 100 && parts[1] >= 64 && parts[1] <= 127)
    || parts[0] === 0;
}

function isPrivateIpv6(ip) {
  const normalized = ip.toLowerCase();

  return normalized === '::1'
    || normalized === '::'
    || normalized.startsWith('fc')
    || normalized.startsWith('fd')
    || normalized.startsWith('fe80:')
    || normalized.startsWith('::ffff:127.')
    || normalized.startsWith('::ffff:10.')
    || normalized.startsWith('::ffff:192.168.')
    || /^::ffff:172\.(1[6-9]|2\d|3[0-1])\./.test(normalized);
}

function isPrivateIp(ip) {
  const version = net.isIP(ip);

  if (version === 4) {
    return isPrivateIpv4(ip);
  }

  if (version === 6) {
    return isPrivateIpv6(ip);
  }

  return false;
}

async function assertSafeUrl(parsedUrl) {
  if (process.env.ALLOW_PRIVATE_NETWORKS === 'true') {
    return;
  }

  const hostname = parsedUrl.hostname.toLowerCase();

  if (hostname === 'localhost' || hostname.endsWith('.local')) {
    throw new Error('No se permiten URLs de localhost o redes privadas');
  }

  if (isPrivateIp(hostname)) {
    throw new Error('No se permiten URLs de localhost o redes privadas');
  }

  const addresses = await dns.lookup(hostname, { all: true, verbatim: true });

  if (addresses.some((entry) => isPrivateIp(entry.address))) {
    throw new Error('No se permiten URLs de localhost o redes privadas');
  }
}

function normalizeOptions(options = {}) {
  const normalized = { ...options };

  if (normalized.width !== undefined) {
    normalized.width = toInteger(normalized.width, 'width');
    assertRange(normalized.width, 'width', 320, 3840);
  }

  if (normalized.height !== undefined) {
    normalized.height = toInteger(normalized.height, 'height');
    assertRange(normalized.height, 'height', 240, 3840);
  }

  if (normalized.timeout !== undefined) {
    normalized.timeout = toInteger(normalized.timeout, 'timeout');
    assertRange(normalized.timeout, 'timeout', 1000, 120000);
  }

  if (normalized.quality !== undefined) {
    normalized.quality = toInteger(normalized.quality, 'quality');
    assertRange(normalized.quality, 'quality', 1, 100);
  }

  if (normalized.waitUntil !== undefined && !ALLOWED_WAIT_UNTIL.has(normalized.waitUntil)) {
    throw new Error(`waitUntil debe ser uno de: ${Array.from(ALLOWED_WAIT_UNTIL).join(', ')}`);
  }

  return normalized;
}

module.exports = {
  assertSafeUrl,
  isPlainObject,
  normalizeOptions,
};
