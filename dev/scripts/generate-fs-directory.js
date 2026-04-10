/**
 * Generates FreeSWITCH directory users for dev (shared SIP password).
 * Usage: node generate-fs-directory.js [password]
 * Default password: devsip
 */
const fs = require('fs');
const path = require('path');

const password = process.argv[2] || 'devsip';
const min = 1000;
const max = 1039;
const domain = '100.64.0.10';

const lines = [
  '<?xml version="1.0" encoding="utf-8"?>',
  '<include>',
  `  <domain name="${domain}">`,
  '    <groups>',
  '      <group name="default">',
  '        <users>'
];

for (let ext = min; ext <= max; ext++) {
  lines.push(`          <user id="${ext}">`);
  lines.push('            <params>');
  lines.push(`              <param name="password" value="${password}"/>`);
  lines.push('            </params>');
  lines.push('            <variables>');
  lines.push('              <variable name="user_context" value="default"/>');
  lines.push(`              <variable name="effective_caller_id_number" value="${ext}"/>`);
  lines.push(`              <variable name="effective_caller_id_name" value="Ext ${ext}"/>`);
  lines.push('            </variables>');
  lines.push('          </user>');
}

lines.push('        </users>');
lines.push('      </group>');
lines.push('    </groups>');
lines.push('  </domain>');
lines.push('</include>');

const out = path.join(__dirname, '..', 'freeswitch', 'directory', 'local-extensions.xml');
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, lines.join('\n') + '\n', 'utf8');
console.log('Wrote', out, `(${min}-${max}, password=${password})`);
