// npm test
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { TOOLS, handleMcp, type McpTools } from './mcp';

const calls: string[] = [];
const tools: McpTools = {
  status: async () => ({ text: 'vault: 1,000 HEIST' }),
  talk: async (message, payout) => {
    calls.push(`${message}|${payout ?? ''}`);
    if (message === 'boom') throw new Error('Warden is asleep.');
    return { text: `Warden: no. (${message})` };
  },
  record: async () => ({ text: 'suspicion 20/100' }),
  hall: async () => ({ text: 'empty' }),
};
const rpc = (method: string, params?: object, id: number | null = 1) => ({ jsonrpc: '2.0', method, params, ...(id === null ? {} : { id }) });

test('initialize negotiates the version and advertises tools', async () => {
  const res = (await handleMcp(rpc('initialize', { protocolVersion: '2025-03-26', capabilities: {} }), tools)) as any;
  assert.equal(res.result.protocolVersion, '2025-03-26');
  assert.ok(res.result.capabilities.tools);
  assert.equal(res.result.serverInfo.name, 'warden');

  const future = (await handleMcp(rpc('initialize', { protocolVersion: '2099-01-01' }), tools)) as any;
  assert.equal(future.result.protocolVersion, '2025-06-18', 'unknown versions get one we support');
});

test('notifications get no response body', async () => {
  assert.equal(await handleMcp(rpc('notifications/initialized', undefined, null), tools), null);
});

test('tools/list returns every tool with a schema', async () => {
  const res = (await handleMcp(rpc('tools/list'), tools)) as any;
  assert.deepEqual(res.result.tools.map((t: any) => t.name), TOOLS.map((t) => t.name));
  assert.ok(res.result.tools.every((t: any) => t.inputSchema?.type === 'object'));
});

test('tools/call runs the tool and wraps its text', async () => {
  const res = (await handleMcp(rpc('tools/call', { name: 'talk_to_warden', arguments: { message: 'hi', payout_address: '0xabc' } }), tools)) as any;
  assert.deepEqual(res.result, { content: [{ type: 'text', text: 'Warden: no. (hi)' }], isError: false });
  assert.equal(calls.at(-1), 'hi|0xabc');
});

test('tool failures come back as isError results, bad calls as JSON-RPC errors', async () => {
  const failed = (await handleMcp(rpc('tools/call', { name: 'talk_to_warden', arguments: { message: 'boom' } }), tools)) as any;
  assert.equal(failed.result.isError, true);
  assert.equal(failed.result.content[0].text, 'Warden is asleep.');

  const empty = (await handleMcp(rpc('tools/call', { name: 'talk_to_warden', arguments: {} }), tools)) as any;
  assert.equal(empty.error.code, -32602);
  const unknown = (await handleMcp(rpc('tools/call', { name: 'drain_vault' }), tools)) as any;
  assert.equal(unknown.error.code, -32602);
  const method = (await handleMcp(rpc('resources/list'), tools)) as any;
  assert.equal(method.error.code, -32601);
  const batch = (await handleMcp([rpc('ping')], tools)) as any;
  assert.equal(batch.error.code, -32600);
});
