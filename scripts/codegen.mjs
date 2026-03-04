import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';

const root = process.cwd();
const openapiPath = join(root, 'contracts/openapi/bff.openapi.yaml');
const protoDir = join(root, 'contracts/proto');
const openapiOutDir = join(root, 'packages/api-types/src/generated/openapi');
const protoOutDir = join(root, 'packages/api-types/src/generated/proto');

mkdirSync(openapiOutDir, { recursive: true });
mkdirSync(protoOutDir, { recursive: true });

const openapiSource = readFileSync(openapiPath, 'utf8');
const openapiTitle =
  openapiSource
    .match(/\n\s*title:\s*(.+)/)?.[1]
    ?.trim()
    .replace(/^['"]|['"]$/g, '') ?? 'Dexera BFF API';
const openapiVersion =
  openapiSource
    .match(/\n\s*version:\s*(.+)/)?.[1]
    ?.trim()
    .replace(/^['"]|['"]$/g, '') ?? '0.0.0';
const bffPaths = [...openapiSource.matchAll(/^\s{2}(\/[a-zA-Z0-9_\/-]+):\s*$/gm)].map(
  (match) => match[1],
);

const openapiTypes = `// AUTO-GENERATED FILE. DO NOT EDIT.
// Source: contracts/openapi/bff.openapi.yaml

export type BffPublicPath = ${bffPaths.map((path) => `'${path}'`).join(' | ')};

export const BFF_PUBLIC_PATHS = ${JSON.stringify(bffPaths, null, 2)} as const;

export type BffVenueId = 'hyperliquid' | 'aster';
export type BffPerpOrderSide = 'buy' | 'sell';
export type BffPerpOrderType = 'market' | 'limit';
export type BffPerpPositionDirection = 'long' | 'short';
export type BffPerpPositionStatus = 'open' | 'closed' | 'liquidated';

export interface BffHealthResponse {
  status: 'ok';
  service: string;
  timestamp: string;
}

export interface BffPlaceholderResponse {
  message: string;
  source: string;
}

export interface BffWalletChallengeRequest {
  address: string;
}

export interface BffWalletChallengeResponse {
  challengeId: string;
  message: string;
  issuedAt: string;
  expiresAt: string;
}

export interface BffWalletVerifyRequest {
  address: string;
  challengeId: string;
  signature: string;
  venue: BffVenueId;
}

export interface BffWalletVerifyResponse {
  ownershipVerified: boolean;
  venue: BffVenueId;
  eligible: boolean;
  reason: string;
  checkedAt: string;
  source: string;
}

export interface BffPerpOrderRequest {
  accountId: string;
  venue: BffVenueId;
  instrument: string;
  side: BffPerpOrderSide;
  type: BffPerpOrderType;
  size: string;
  limitPrice?: string;
  leverage?: string;
  reduceOnly?: boolean;
  clientOrderId?: string;
}

export interface BffBuildUnsignedActionRequest {
  order: BffPerpOrderRequest;
}

export interface BffPerpOrderPreviewResponse {
  previewId: string;
  accountId: string;
  venue: BffVenueId;
  instrument: string;
  side: BffPerpOrderSide;
  type: BffPerpOrderType;
  size: string;
  limitPrice?: string;
  markPrice?: string;
  estimatedNotional: string;
  estimatedFee: string;
  expiresAt: string;
  source: string;
}

export interface BffUnsignedActionPayload {
  id: string;
  accountId: string;
  venue: BffVenueId;
  kind: 'perp_order_action';
  action: Record<string, unknown>;
}

export interface BffBuildUnsignedActionResponse {
  orderId: string;
  signingPolicy: 'client-signing-only';
  disclaimer: string;
  unsignedActionPayload: BffUnsignedActionPayload;
}

export interface BffPerpPosition {
  positionId: string;
  accountId: string;
  venue: BffVenueId;
  instrument: string;
  direction: BffPerpPositionDirection;
  status: BffPerpPositionStatus;
  size: string;
  entryPrice: string;
  markPrice: string;
  notionalValue: string;
  leverage?: string;
  unrealizedPnlUsd: string;
  lastUpdatedAt: string;
}

export interface BffPerpPositionsResponse {
  accountId: string;
  venue: BffVenueId;
  positions: BffPerpPosition[];
  source: string;
}

export const BFF_OPENAPI_INFO = {
  title: ${JSON.stringify(openapiTitle)},
  version: ${JSON.stringify(openapiVersion)},
} as const;
`;

const openapiDts = `// AUTO-GENERATED FILE. DO NOT EDIT.
// Source: contracts/openapi/bff.openapi.yaml

export type BffPublicPath = ${bffPaths.map((path) => `'${path}'`).join(' | ')};
export declare const BFF_PUBLIC_PATHS: readonly ${JSON.stringify(bffPaths)};

export type BffVenueId = 'hyperliquid' | 'aster';
export type BffPerpOrderSide = 'buy' | 'sell';
export type BffPerpOrderType = 'market' | 'limit';
export type BffPerpPositionDirection = 'long' | 'short';
export type BffPerpPositionStatus = 'open' | 'closed' | 'liquidated';

export interface BffHealthResponse {
  status: 'ok';
  service: string;
  timestamp: string;
}

export interface BffPlaceholderResponse {
  message: string;
  source: string;
}

export interface BffWalletChallengeRequest {
  address: string;
}

export interface BffWalletChallengeResponse {
  challengeId: string;
  message: string;
  issuedAt: string;
  expiresAt: string;
}

export interface BffWalletVerifyRequest {
  address: string;
  challengeId: string;
  signature: string;
  venue: BffVenueId;
}

export interface BffWalletVerifyResponse {
  ownershipVerified: boolean;
  venue: BffVenueId;
  eligible: boolean;
  reason: string;
  checkedAt: string;
  source: string;
}

export interface BffPerpOrderRequest {
  accountId: string;
  venue: BffVenueId;
  instrument: string;
  side: BffPerpOrderSide;
  type: BffPerpOrderType;
  size: string;
  limitPrice?: string;
  leverage?: string;
  reduceOnly?: boolean;
  clientOrderId?: string;
}

export interface BffBuildUnsignedActionRequest {
  order: BffPerpOrderRequest;
}

export interface BffPerpOrderPreviewResponse {
  previewId: string;
  accountId: string;
  venue: BffVenueId;
  instrument: string;
  side: BffPerpOrderSide;
  type: BffPerpOrderType;
  size: string;
  limitPrice?: string;
  markPrice?: string;
  estimatedNotional: string;
  estimatedFee: string;
  expiresAt: string;
  source: string;
}

export interface BffUnsignedActionPayload {
  id: string;
  accountId: string;
  venue: BffVenueId;
  kind: 'perp_order_action';
  action: Record<string, unknown>;
}

export interface BffBuildUnsignedActionResponse {
  orderId: string;
  signingPolicy: 'client-signing-only';
  disclaimer: string;
  unsignedActionPayload: BffUnsignedActionPayload;
}

export interface BffPerpPosition {
  positionId: string;
  accountId: string;
  venue: BffVenueId;
  instrument: string;
  direction: BffPerpPositionDirection;
  status: BffPerpPositionStatus;
  size: string;
  entryPrice: string;
  markPrice: string;
  notionalValue: string;
  leverage?: string;
  unrealizedPnlUsd: string;
  lastUpdatedAt: string;
}

export interface BffPerpPositionsResponse {
  accountId: string;
  venue: BffVenueId;
  positions: BffPerpPosition[];
  source: string;
}

export declare const BFF_OPENAPI_INFO: {
  readonly title: ${JSON.stringify(openapiTitle)};
  readonly version: ${JSON.stringify(openapiVersion)};
};
`;

const openapiJs = `// AUTO-GENERATED FILE. DO NOT EDIT.
// Source: contracts/openapi/bff.openapi.yaml

export const BFF_PUBLIC_PATHS = ${JSON.stringify(bffPaths, null, 2)};

export const BFF_OPENAPI_INFO = {
  title: ${JSON.stringify(openapiTitle)},
  version: ${JSON.stringify(openapiVersion)},
};
`;

writeFileSync(join(openapiOutDir, 'bff.ts'), openapiTypes);
writeFileSync(join(openapiOutDir, 'bff.d.ts'), openapiDts);
writeFileSync(join(openapiOutDir, 'bff.js'), openapiJs);
writeFileSync(
  join(openapiOutDir, 'index.ts'),
  "// AUTO-GENERATED FILE. DO NOT EDIT.\nexport * from './bff';\n",
);
writeFileSync(
  join(openapiOutDir, 'index.d.ts'),
  "// AUTO-GENERATED FILE. DO NOT EDIT.\nexport * from './bff';\n",
);
writeFileSync(
  join(openapiOutDir, 'index.js'),
  "// AUTO-GENERATED FILE. DO NOT EDIT.\nexport * from './bff';\n",
);

const protoFiles = ['market_data.proto', 'execution.proto', 'portfolio.proto'];

const mapProtoTypeToTs = (protoType) => {
  switch (protoType) {
    case 'string':
      return 'string';
    case 'bool':
      return 'boolean';
    case 'int32':
    case 'int64':
    case 'uint32':
    case 'uint64':
    case 'float':
    case 'double':
      return 'number';
    default:
      return protoType;
  }
};

const protoExportLines = [];
const toAlias = (fileStem) =>
  fileStem === 'market_data'
    ? 'marketData'
    : fileStem.replace(/_([a-z])/g, (_, char) => char.toUpperCase());

for (const fileName of protoFiles) {
  const source = readFileSync(join(protoDir, fileName), 'utf8');
  const packageName = source.match(/package\s+([a-zA-Z0-9_.]+)\s*;/)?.[1] ?? 'dexera.unknown.v1';

  const messageMatches = [...source.matchAll(/message\s+(\w+)\s*\{([\s\S]*?)\}/g)];
  const serviceMatch = source.match(/service\s+(\w+)\s*\{([\s\S]*?)\}/);
  const serviceName = serviceMatch?.[1] ?? 'UnknownService';
  const rpcMatches = [
    ...(serviceMatch?.[2]?.matchAll(/rpc\s+(\w+)\((\w+)\)\s+returns\s+\((\w+)\);/g) ?? []),
  ];

  const messageInterfaces = messageMatches
    .map((match) => {
      const name = match[1];
      const body = match[2] ?? '';
      const fields = [...body.matchAll(/\s*(\w+)\s+(\w+)\s*=\s*\d+\s*;/g)];
      if (fields.length === 0) {
        return `export type ${name} = Record<string, never>;`;
      }
      const tsFields = fields
        .map((field) => `  ${field[2]}: ${mapProtoTypeToTs(field[1])};`)
        .join('\n');
      return `export interface ${name} {\n${tsFields ? `${tsFields}\n` : ''}}`;
    })
    .join('\n\n');

  const rpcMethods = rpcMatches
    .map(
      (rpc) =>
        `  ${rpc[1][0].toLowerCase()}${rpc[1].slice(1)}(input: ${rpc[2]}): Promise<${rpc[3]}>;`,
    )
    .join('\n');

  const fileStem = basename(fileName, '.proto');
  const outputFile = `${fileStem}.ts`;

  const generated = `// AUTO-GENERATED FILE. DO NOT EDIT.
// Source: contracts/proto/${fileName}

export const packageName = ${JSON.stringify(packageName)};
export const serviceName = ${JSON.stringify(serviceName)};

${messageInterfaces}

export interface ${serviceName}Client {
${rpcMethods}
}
`;

  writeFileSync(join(protoOutDir, outputFile), generated);
  protoExportLines.push(`export * as ${toAlias(fileStem)} from './${fileStem}';`);
}

writeFileSync(
  join(protoOutDir, 'index.ts'),
  `// AUTO-GENERATED FILE. DO NOT EDIT.\n${protoExportLines.join('\n')}\n`,
);

const apiTypeRoot = join(root, 'packages/api-types/src');
mkdirSync(dirname(join(apiTypeRoot, 'index.ts')), { recursive: true });
writeFileSync(
  join(apiTypeRoot, 'index.ts'),
  "// AUTO-GENERATED ENTRYPOINT EXPORTS.\nexport * from './generated/openapi';\nexport * from './generated/proto';\n",
);

console.log('Code generation complete.');
