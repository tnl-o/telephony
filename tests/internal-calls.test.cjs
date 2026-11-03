const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');
const net = require('node:net');
const { EventEmitter } = require('node:events');
const UserService = require('../backend/src/userService');
const root = path.resolve(__dirname, '..');

function backend(env = {}, service = {}, socketNet = net) {
  const routes = new Map();
  const app = { use() {}, get() {}, post(route, handler) { routes.set(route, handler); } };
  const express = () => app;
  express.json = () => () => {};
  const context = {
    require(name) {
      if (name === 'express') return express;
      if (name === 'cors') return () => () => {};
      if (name === 'ws') return { Server: class { on() {} } };
      if (name === 'http') return { createServer: () => ({}) };
      if (name === 'net') return socketNet;
      if (name === 'dotenv') return { config() {} };
      if (name === './ldap') return class {};
      if (name === './userService') return class { constructor() { return service; } };
      if (name === './simpleAuth') return require('../backend/src/simpleAuth');
      throw new Error(`Unexpected dependency ${name}`);
    },
    process: { env, on() {} }, console: { log() {}, error() {} },
    Buffer, URL, setTimeout, clearTimeout,
  };
  vm.createContext(context);
  const source = fs.readFileSync(path.join(root, 'backend/src/index.js'), 'utf8')
    .replace(/start\(\);\s*$/, '');
  vm.runInContext(source, context);
  return { context, routes };
}

test('direct WSS follows the actual UI hostname in LAN and dev', () => {
  const { context } = backend();
  assert.equal(context.buildSipWssUrl({ get: h => h === 'host' ? '192.168.0.11:8443' : undefined }),
    'wss://192.168.0.11:7443');
  assert.equal(context.buildSipWssUrl({ get: h => h === 'host' ? '[::1]:8443' : undefined }),
    'wss://[::1]:7443');
});

test('explicit WSS endpoint takes precedence', () => {
  const { context } = backend({ SIP_WSS_URL: 'wss://phone.example:7443' });
  assert.equal(context.buildSipWssUrl({ get() {} }), 'wss://phone.example:7443');
});

test('directory escapes names and passwords and propagates write failures', async t => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'telephony-call-test-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const users = new UserService(path.join(dir, 'users.json'));
  users.users = [{ extension: 1000, username: 'alice', displayName: 'Alice "A&B"', sipPassword: 'x"&<>' }];
  await users.generateFreeSwitchDirectory(path.join(dir, 'directory'));
  const xml = fs.readFileSync(path.join(dir, 'directory/users.xml'), 'utf8');
  assert.ok(xml.includes('Alice &quot;A&amp;B&quot;'));
  assert.ok(xml.includes('value="x&quot;&amp;&lt;&gt;"'));
  fs.writeFileSync(path.join(dir, 'users.json'), '[]');
  await assert.rejects(users.generateFreeSwitchDirectory(path.join(dir, 'users.json', 'invalid')));
});

test('extension API rejects malformed numbers before modifying directory', async () => {
  let writes = 0;
  const service = { async updateUserExtension() { writes++; return {}; } };
  const { routes } = backend({}, service);
  for (const extension of ['abc', '2500abc', 2500.5, null, true, [], {}]) {
    let status = 200;
    const res = { status(value) { status = value; return this; }, json() {} };
    await routes.get('/api/admin/user/:username/extension')({ params: { username: 'alice' }, body: { extension } }, res);
    assert.equal(status, 400, `invalid extension ${JSON.stringify(extension)}`);
  }
  assert.equal(writes, 0);
});

test('extension change regenerates directory and awaits acknowledged reload', async () => {
  const actions = [];
  const service = {
    async updateUserExtension() { actions.push('update'); return { extension: 2500 }; },
    async generateFreeSwitchDirectory() { actions.push('directory'); },
  };
  const { context, routes } = backend({}, service);
  context.reloadFreeSwitchXml = async () => { actions.push('reload'); };
  const res = { status() { return this; }, json() { actions.push('response'); } };
  await routes.get('/api/admin/user/:username/extension')({ params: { username: 'alice' }, body: { extension: '2500' } }, res);
  assert.deepEqual(actions, ['update', 'directory', 'reload', 'response']);
});

test('SIP directory is synchronized on every login, including recovery after a failed reload', async () => {
  const actions = [];
  const user = { username: 'alice', extension: 1000, sipPassword: 'test' };
  const service = {
    findByUsername() { return user; },
    async updateUserInfo() { return user; },
    async generateFreeSwitchDirectory() { actions.push('directory'); },
    async setOnlineStatus() { return user; }, async persistOnlineStatus() {},
  };
  const { context, routes } = backend({ FREESWITCH_SIP_DOMAIN: 'sip.example' }, service);
  context.reloadFreeSwitchXml = async () => { actions.push('reload'); };
  let body;
  await routes.get('/api/auth/login')({ body: { username: 'alice' }, get: () => 'phone.example' },
    { status() { return this; }, json(value) { body = value; } });
  assert.deepEqual(actions, ['directory', 'reload']);
  assert.equal(body.sipCredentials.domain, 'sip.example');
});

test('ESL waits for auth greeting and full reload reply across split TCP frames', async () => {
  const writes = [];
  let socket;
  const fakeNet = { createConnection() {
    socket = new EventEmitter();
    socket.write = data => writes.push(data);
    socket.destroy = () => {};
    socket.end = () => {};
    return socket;
  } };
  const { context } = backend({}, {}, fakeNet);
  let settled = false;
  const pending = context.reloadFreeSwitchXml(1, 100).then(() => { settled = true; });
  socket.emit('connect');
  assert.equal(writes.length, 0, 'wait for auth/request');
  socket.emit('data', Buffer.from('Content-Type: auth/request\n\n'));
  assert.deepEqual(writes, ['auth ClueCon\n\n']);
  socket.emit('data', Buffer.from('Content-Type: command/reply\nReply-Text: +OK accepted\n\n'));
  await Promise.resolve();
  assert.equal(settled, false, 'auth success is not reload success');
  assert.deepEqual(writes, ['auth ClueCon\n\n', 'api reloadxml\n\n']);
  socket.emit('data', Buffer.from('Content-Type: api/response\r\nContent-Length: 4\r\n\r\n+O'));
  await Promise.resolve();
  assert.equal(settled, false);
  socket.emit('data', Buffer.from('K\n'));
  await pending;
});

test('ESL rejects negative reply, premature disconnect and timeout', async () => {
  for (const failure of ['auth', 'api', 'close', 'timeout']) {
    let socket;
    const fakeNet = { createConnection() {
      socket = new EventEmitter(); socket.write = () => {}; socket.destroy = () => {}; socket.end = () => {};
      return socket;
    } };
    const { context } = backend({}, {}, fakeNet);
    const pending = context.reloadFreeSwitchXml(1, 20);
    const rejected = assert.rejects(pending);
    if (failure === 'close') socket.emit('close');
    else if (failure !== 'timeout') {
      socket.emit('data', Buffer.from('Content-Type: auth/request\n\n'));
      socket.emit('data', Buffer.from(`Content-Type: command/reply\nReply-Text: ${failure === 'auth' ? '-ERR denied' : '+OK accepted'}\n\n`));
      if (failure === 'api') socket.emit('data', Buffer.from('Content-Type: api/response\nContent-Length: 5\n\n-ERR\n'));
    }
    await rejected;
  }
});

function frontend() {
  class UA extends EventEmitter { start() {} stop() {} isRegistered() { return true; } call() { this.calls = (this.calls || 0) + 1; } }
  const context = { JsSIP: { WebSocketInterface: class {}, UA }, console,
    window: { location: { hostname: 'phone.example', host: 'phone.example:8443' } } };
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(path.join(root, 'frontend/src/services/webrtc.js'), 'utf8')
    .replace("import JsSIP from 'jssip';", '')
    .replace('export default new WebRTCService();', 'globalThis.service = new WebRTCService();'), context);
  context.service.connect({ extension: '1000', sipPassword: 'test', sipDomain: 'sip.example' });
  return context.service;
}

test('incoming INVITE creates incoming state and answer operates on that session', () => {
  const service = frontend();
  const session = new EventEmitter(); let answered = false;
  session.answer = () => { answered = true; };
  const seen = [];
  service.setOnNewRTCSession((current, originator) => seen.push([current, originator]));
  service.ua.emit('newRTCSession', { session, originator: 'remote' });
  assert.equal(seen[0][0], session); assert.equal(seen[0][1], 'remote');
  service.answer(); assert.equal(answered, true);
});

test('second incoming call is rejected without losing the first call', () => {
  const service = frontend();
  const first = new EventEmitter(), second = new EventEmitter();
  let rejected;
  second.terminate = options => { rejected = options.status_code; };
  service.ua.emit('newRTCSession', { session: first, originator: 'remote' });
  service.ua.emit('newRTCSession', { session: second, originator: 'remote' });
  assert.equal(rejected, 486);
  assert.equal(service.session, first);
  assert.throws(() => service.call('1001'), /разговор|вызов/i);
});

test('accepted and confirmed enter active once; stale events cannot clear a newer call', () => {
  const service = frontend();
  const first = new EventEmitter(); const states = [];
  service.setOnCallStateChange(state => states.push(state));
  service.ua.emit('newRTCSession', { session: first, originator: 'local' });
  first.emit('accepted'); first.emit('confirmed');
  assert.equal(states.filter(s => s === 'active').length, 1);
  first.emit('ended');
  const second = new EventEmitter();
  service.ua.emit('newRTCSession', { session: second, originator: 'remote' });
  first.emit('failed', { cause: 'late' });
  assert.equal(service.session, second);
});

test('internal dialplan resolves the registered WSS contact instead of dialing the SIP domain', () => {
  const xml = fs.readFileSync(path.join(root, 'freeswitch/conf/dialplan/default.xml'), 'utf8');
  assert.match(xml, /sofia_contact\(internal\/\$\{destination_number\}@\$\$\{domain_name\}\)/);
  assert.doesNotMatch(xml, /sip_force_contact=true/);
});

test('both Docker environments share generated SIP users and the website certificate with FS', () => {
  for (const file of ['docker-compose.yml', 'dev/docker-compose.yml']) {
    const yaml = fs.readFileSync(path.join(root, file), 'utf8');
    assert.match(yaml, /FREESWITCH_SIP_DOMAIN/);
    assert.match(yaml, /source: freeswitch_directory/);
    assert.match(yaml, /target: \/etc\/freeswitch\/directory\/default/);
    assert.match(yaml, /ssl:\/etc\/nginx_ssl:ro/);
    assert.doesNotMatch(yaml, /local-extensions\.xml:.*:ro/);
  }
  const entrypoint = fs.readFileSync(path.join(root, 'freeswitch/docker-entrypoint.sh'), 'utf8');
  assert.match(entrypoint, /\/etc\/nginx_ssl\/cert\.pem/);
  assert.match(entrypoint, /\/etc\/nginx_ssl\/key\.pem/);
});

test('overlapping logins cannot publish an older directory over a newer subscriber', async t => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'telephony-directory-race-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const users = new UserService(path.join(dir, 'users.json'));
  users.users = [{ extension: 1000, username: 'alice', sipPassword: 'alice' }];
  const originalRename = fs.promises.rename;
  let releaseFirst, signalFirst;
  const firstReachedRename = new Promise(resolve => { signalFirst = resolve; });
  const firstGate = new Promise(resolve => { releaseFirst = resolve; });
  let renames = 0;
  t.mock.method(fs.promises, 'rename', async (...args) => {
    if (++renames === 1) { signalFirst(); await firstGate; }
    return originalRename(...args);
  });
  const first = users.generateFreeSwitchDirectory(dir);
  await firstReachedRename;
  users.users.push({ extension: 1001, username: 'bob', sipPassword: 'bob' });
  const second = users.generateFreeSwitchDirectory(dir);
  await new Promise(resolve => setTimeout(resolve, 30));
  const writesBeforeRelease = renames;
  releaseFirst();
  await Promise.all([first, second]);
  assert.equal(writesBeforeRelease, 1, 'later writers must wait for the earlier publication');
  assert.match(fs.readFileSync(path.join(dir, 'users.xml'), 'utf8'), /user id="1001"/);
});
