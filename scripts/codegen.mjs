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
  openapiSource.match(/\n\s*title:\s*(.+)/)?.[1]?.trim().replace(/^['"]|['"]$/g, '') ??
  'Dexera BFF API';
const openapiVersion =
  openapiSource.match(/\n\s*version:\s*(.+)/)?.[1]?.trim().replace(/^['"]|['"]$/g, '') ?? '0.0.0';
const bffPaths = [
  ...openapiSource.matchAll(/^\s{2}(\/[a-zA-Z0-9_\/-]+):\s*$/gm),
].map((match) => match[1]);

const openapiTypes = `// AUTO-GENERATED FILE. DO NOT EDIT.
// Source: contracts/openapi/bff.openapi.yaml

export type BffPublicPath = ${bffPaths.map((path) => `'${path}'`).join(' | ')};

export const BFF_PUBLIC_PATHS = ${JSON.stringify(bffPaths, null, 2)} as const;

export interface BffHealthResponse {
  status: 'ok';
  service: string;
  timestamp: string;
}

export interface BffPlaceholderResponse {
  message: string;
  source: string;
}

export interface BffQuoteRequest {
  chainId: number;
  sellToken: string;
  buyToken: string;
  sellAmount: string;
  wallet: string;
  slippageBps?: number;
  affiliateTag?: string;
}

export interface BffQuoteResponse {
  quoteId: string;
  chainId: number;
  sellToken: string;
  buyToken: string;
  sellAmount: string;
  estimatedOut: string;
  price: string;
  expiresAt: string;
  source: string;
}

export interface BffBuildTransactionRequest {
  quoteId: string;
  wallet: string;
}

export interface BffUnsignedTransaction {
  to: string;
  data: string;
  value: string;
  gasLimit: string;
  maxFeePerGas: string;
  maxPriorityFeePerGas: string;
  chainId: number;
}

export interface BffBuildTransactionResponse {
  buildId: string;
  quoteId: string;
  wallet: string;
  unsignedTx: BffUnsignedTransaction;
  warnings: string[];
  simulated: boolean;
  source: string;
}

export interface BffPosition {
  positionId: string;
  chainId: number;
  protocol: string;
  asset: string;
  balance: string;
  usdValue: string;
  unrealizedPnlUsd: string;
  lastUpdatedAt: string;
}

export interface BffPositionsResponse {
  wallet: string;
  chainId?: number;
  positions: BffPosition[];
  source: string;
}

export const BFF_OPENAPI_INFO = {
  title: ${JSON.stringify(openapiTitle)},
  version: ${JSON.stringify(openapiVersion)},
} as const;
`;

writeFileSync(join(openapiOutDir, 'bff.ts'), openapiTypes);
writeFileSync(
  join(openapiOutDir, 'index.ts'),
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
  const rpcMatches = [...(serviceMatch?.[2]?.matchAll(/rpc\s+(\w+)\((\w+)\)\s+returns\s+\((\w+)\);/g) ?? [])];

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
    .map((rpc) => `  ${rpc[1][0].toLowerCase()}${rpc[1].slice(1)}(input: ${rpc[2]}): Promise<${rpc[3]}>;`)
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
