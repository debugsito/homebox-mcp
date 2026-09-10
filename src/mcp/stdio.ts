/**
 * Entrada del MCP por stdio, para clientes locales como Claude Code.
 *
 *   npm run mcp
 *
 * stdout es el canal del protocolo, asi que los logs tienen que ir a stderr o
 * el cliente ve JSON-RPC corrupto.
 */
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { buildMcpServer } from './build-server.js';

async function main() {
  const server = buildMcpServer();
  await server.connect(new StdioServerTransport());
}

main().catch((err) => {
  process.stderr.write(`MCP stdio falló: ${err instanceof Error ? err.message : err}\n`);
  process.exit(1);
});
