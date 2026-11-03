const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const net = require('node:net');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');

test('real backend provisions two SIP identities and reloads before returning credentials', { timeout: 15000 }, async t => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'telephony-http-test-'));
  const sockets = new Set();
  let reloads = 0;
  const esl = net.createServer(socket => {
    sockets.add(socket);
    socket.on('close', () => sockets.delete(socket));
    socket.on('error', () => {});
    socket.write('Content-Type: auth/request\n\n');
    let buffer = '';
    socket.on('data', chunk => {
      buffer += chunk;
      let boundary;
      while ((boundary = buffer.indexOf('\n\n')) >= 0) {
        const command = buffer.slice(0, boundary);
        buffer = buffer.slice(boundary + 2);
        if (command === 'auth test-secret') {
          socket.write('Content-Type: command/reply\nReply-Text: +OK accepted\n\n');
        } else if (command === 'api reloadxml') {
          reloads++;
          socket.write('Content-Type: api/response\nContent-Length: 4\n\n+OK\n');
        } else {
          socket.destroy(new Error(`Unexpected command: ${command}`));
        }
      }
    });
  });
  await new Promise(resolve => esl.listen(0, '127.0.0.1', resolve));
  const reserve = net.createServer();
  await new Promise(resolve => reserve.listen(0, '127.0.0.1', resolve));
  const port = reserve.address().port;
  await new Promise(resolve => reserve.close(resolve));
  const dbPath = path.join(dir, 'users.json');
  await fs.writeFile(dbPath, '[]');
  const child = spawn(process.execPath, ['src/index.js'], {
    cwd: path.join(__dirname, '../backend'),
    env: { ...process.env, PORT: String(port), AUTH_MODE: 'name', USERS_DB_PATH: dbPath,
      FREESWITCH_DIR_PATH: path.join(dir, 'directory'), FREESWITCH_HOST: '127.0.0.1',
      FREESWITCH_ESL_PORT: String(esl.address().port), FREESWITCH_ESL_PASSWORD: 'test-secret',
      FREESWITCH_SIP_DOMAIN: 'sip.example', SIP_WSS_URL: 'wss://phone.example:7443' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  t.after(async () => {
    if (child.exitCode === null) {
      child.kill();
      await new Promise(resolve => child.once('exit', resolve));
    }
    for (const socket of sockets) socket.destroy();
    await new Promise(resolve => esl.close(resolve));
    await fs.rm(dir, { recursive: true, force: true });
  });
  let output = '';
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Backend startup timeout: ${output}`)), 5000);
    const done = error => { clearTimeout(timer); error ? reject(error) : resolve(); };
    child.once('error', done);
    child.once('exit', code => done(new Error(`Backend exited ${code}: ${output}`)));
    child.stdout.on('data', chunk => { output += chunk; if (output.includes('Backend server running')) done(); });
    child.stderr.on('data', chunk => { output += chunk; });
  });
  const post = async (endpoint, body) => {
    const response = await fetch(`http://127.0.0.1:${port}${endpoint}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    });
    return { status: response.status, body: await response.json() };
  };
  const alice = await post('/api/auth/login', { username: 'Alice "Support"' });
  const bob = await post('/api/auth/login', { username: 'Bob' });
  for (const result of [alice, bob]) {
    assert.equal(result.status, 200);
    assert.equal(result.body.sipCredentials.domain, 'sip.example');
    assert.equal(result.body.sipCredentials.wssUrl, 'wss://phone.example:7443');
  }
  assert.notEqual(alice.body.user.extension, bob.body.user.extension);
  let xml = await fs.readFile(path.join(dir, 'directory/users.xml'), 'utf8');
  assert.ok(xml.includes('Alice &quot;Support&quot;'));
  assert.ok(xml.includes(`user id="${bob.body.user.extension}"`));
  const before = reloads;
  const changed = await post('/api/admin/user/bob/extension', { extension: 2500 });
  assert.equal(changed.status, 200);
  assert.ok(reloads > before);
  xml = await fs.readFile(path.join(dir, 'directory/users.xml'), 'utf8');
  assert.ok(xml.includes('user id="2500"'));
  assert.ok(!xml.includes(`user id="${bob.body.user.extension}"`));
  assert.equal((await post('/api/admin/user/bob/extension', { extension: 'abc' })).status, 400);
  const loggedInAgain = await post('/api/auth/login', { username: 'Bob' });
  assert.equal(loggedInAgain.body.sipCredentials.extension, '2500');
});
