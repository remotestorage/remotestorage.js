import 'mocha';
import { expect } from 'chai';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { Solid } from '../../build/solid.js';

describe('Solid conditional HTTP operations', () => {
  let server, pod, bytes, revision;
  const nativeFetch = globalThis.fetch;

  beforeEach(async () => {
    bytes = Buffer.from([0, 255, 128, 65]);
    revision = 1;
    server = createServer(async (request, response) => {
      const tag = '"' + revision + '"';
      if (request.method === 'GET') {
        if (request.headers['if-none-match'] === tag) {
          response.writeHead(304, { ETag: tag }).end();
        } else {
          response.writeHead(200, { ETag: tag, 'Content-Type': 'application/octet-stream' }).end(bytes);
        }
        return;
      }
      if (request.headers['if-match'] && request.headers['if-match'] !== tag ||
          request.headers['if-none-match'] === '*') {
        response.writeHead(412, { ETag: tag }).end();
        return;
      }
      if (request.method === 'DELETE') {
        response.writeHead(204).end();
        bytes = null;
        return;
      }
      const parts = [];
      for await (const part of request) { parts.push(part); }
      bytes = Buffer.concat(parts);
      revision++;
      response.writeHead(204, { ETag: '"' + revision + '"' }).end();
    });
    server.listen(0, '127.0.0.1');
    await once(server, 'listening');
    pod = 'http://127.0.0.1:' + server.address().port + '/';
  });

  afterEach(async () => {
    const closed = new Promise(resolve => server.close(resolve));
    server.closeAllConnections();
    await closed;
  });

  function client() {
    const adapter = new Solid({ _emit() {} });
    adapter.selectedPodURL = pod;
    adapter.connected = true;
    adapter.session.fetch = nativeFetch;
    return adapter;
  }

  it('preserves a binary round trip through real HTTP requests', async () => {
    const solid = client();
    const original = await solid.get('/file');
    expect([...new Uint8Array(original.body)]).to.deep.equal([0, 255, 128, 65]);
    const changed = new Uint8Array([255, 0, 254, 128]);
    const written = await solid.put('/file', changed, 'application/octet-stream', { ifMatch: original.revision });
    expect(written.statusCode).to.equal(201);
    expect(written.revision).to.equal('2');
    const read = await solid.get('/file');
    expect([...new Uint8Array(read.body)]).to.deep.equal([...changed]);
    expect((await solid.get('/file', { ifNoneMatch: read.revision })).statusCode).to.equal(304);
  });

  it('protects a newer write from a stale writer and stale deletion', async () => {
    const first = client();
    const second = client();
    const a = await first.get('/file');
    const b = await second.get('/file');
    await first.put('/file', 'newest', 'text/plain', { ifMatch: a.revision });
    const staleWrite = await second.put('/file', 'stale', 'text/plain', { ifMatch: b.revision });
    const staleDelete = await second.delete('/file', { ifMatch: b.revision });
    expect(staleWrite.statusCode).to.equal(412);
    expect(staleDelete.statusCode).to.equal(412);
    expect(bytes.toString()).to.equal('newest');
  });

  it('does not overwrite an existing file when creating with If-None-Match', async () => {
    const solid = client();
    const result = await solid.put('/file', 'unexpected', 'text/plain', { ifNoneMatch: '*' });
    expect(result.statusCode).to.equal(412);
    expect([...bytes]).to.deep.equal([0, 255, 128, 65]);
  });
});
