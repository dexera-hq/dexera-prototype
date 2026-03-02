import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const openapiFile = join(root, 'contracts/openapi/bff.openapi.yaml');
const protoDir = join(root, 'contracts/proto');

const openapi = readFileSync(openapiFile, 'utf8');
if (!openapi.includes('openapi: 3.1.0')) {
  throw new Error('OpenAPI contract must declare version 3.1.0');
}
if (!openapi.includes('/health:') || !openapi.includes('/api/v1/placeholder:')) {
  throw new Error('OpenAPI contract must define /health and /api/v1/placeholder paths');
}

const protoFiles = readdirSync(protoDir).filter((file) => file.endsWith('.proto'));
if (protoFiles.length === 0) {
  throw new Error('No proto contracts found in contracts/proto');
}

for (const file of protoFiles) {
  const source = readFileSync(join(protoDir, file), 'utf8');
  if (!source.includes('syntax = "proto3";')) {
    throw new Error(`${file} must use proto3 syntax`);
  }
  if (!/service\s+\w+\s*\{/.test(source)) {
    throw new Error(`${file} must declare at least one service`);
  }
}

console.log(`Validated OpenAPI contract and ${protoFiles.length} proto contracts.`);
