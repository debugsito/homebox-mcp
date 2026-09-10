/**
 * Prueba de humo del MCP por stdio: levanta el servidor como subproceso, se
 * conecta con el cliente del SDK y ejerce el handshake, el listado y una
 * llamada real contra HomeBox.
 *
 *   npx tsx scripts/smoke-mcp.ts
 */
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

async function main() {
  const transport = new StdioClientTransport({
    command: 'npx',
    args: ['tsx', 'src/mcp/stdio.ts'],
  });

  const client = new Client({ name: 'smoke-test', version: '0.0.0' });
  await client.connect(transport);
  console.log('handshake OK ->', JSON.stringify(client.getServerVersion()));

  const { tools } = await client.listTools();
  console.log(`\ntools expuestas: ${tools.length}`);
  for (const t of tools) {
    const a = t.annotations ?? {};
    const modo = a.readOnlyHint ? 'lectura ' : a.destructiveHint ? 'modifica' : 'crea    ';
    console.log(`  ${modo}  ${t.name}`);
  }

  const { resources } = await client.listResources();
  console.log(`\nrecursos: ${resources.map((r) => r.uri).join(', ')}`);

  const res = await client.readResource({ uri: 'homebox://locations' });
  const texto = String(res.contents[0]?.text ?? '');
  console.log(`  el árbol trae ${texto.split('\n').length} ubicaciones`);

  const call = await client.callTool({ name: 'find_item', arguments: { query: 'hdmi' } });
  const content = call.content as { text?: string }[];
  const parsed = JSON.parse(content[0]?.text ?? '{}');
  console.log('\nfind_item("hdmi"):');
  for (const m of parsed.matches ?? []) {
    console.log(`  ${m.name}`);
    console.log(`  -> ${m.locationPath}`);
  }

  await client.close();
  console.log('\nOK');
}

main().catch((err) => {
  console.error('smoke falló:', err instanceof Error ? err.message : err);
  process.exit(1);
});
