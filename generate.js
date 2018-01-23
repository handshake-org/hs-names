#!/usr/bin/env node

'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const BLACKLIST = require('./names/blacklist.json');
const CUSTOM = require('./names/custom.json');
const TLD = require('./names/tld.json');
const CCTLD = require('./names/cctld.json');
const GTLD = require('./names/gtld.json');
const ALEXA = require('./names/alexa.json');

function compile() {
  const table = Object.create(null);
  const names = [];

  const insert = (name, tld, rank) => {
    assert(!table[name]);
    const data = [name, tld, rank, 0];
    table[name] = data;
    names.push(data);
  };

  // Custom TLDs (e.g. `.eth`).
  for (const name of CUSTOM)
    insert(name, '', 0);

  // Original TLDs (com, net, org, etc).
  for (const name of TLD)
    insert(name, '', 0);

  // Country Code TLDs (e.g. `.io`).
  for (const name of CCTLD)
    insert(name, '', 0);

  assert(ALEXA.length >= 100000);

  // Alexa top 100,000 second-level domains.
  for (let i = 0; i < 100000; i++) {
    const domain = ALEXA[i];
    const parts = domain.split('.');
    const rank = i + 1;

    assert(parts.length >= 2);

    const name = parts.shift();
    assert(name.length > 0);

    // Cannot be longer than 64 bytes.
    if (name.length > 64)
      continue;

    // Single letter domains only
    // reserved for the alexa top 1,000.
    if (rank > 1000) {
      if (name.length === 1)
        continue;
    }

    // Ignore deeply nested domains.
    if (parts.length > 2)
      continue;

    // Third-level domain.
    if (parts.length === 2) {
      const [sld, tld] = parts;

      // Country Codes only (e.g. co.uk).
      if (tld.length !== 2)
        continue;

      // The SLD must be a known TLD (or `co`).
      switch (sld) {
        case 'com':
        case 'org':
        case 'net':
        case 'edu':
        case 'gov':
        case 'mil':
        case 'co':
          break;
        default:
          continue;
      }
    }

    const tld = parts.join('.');

    // Cannot contain non alphanumeric characters.
    if (!/^[a-z0-9\-_]+$/.test(name))
      continue;

    // Cannot have leading/trailing dashes/underscores.
    if (/^[\-_]|[\-_]$/.test(name))
      continue;

    // Ignore blacklist.
    if (BLACKLIST.indexOf(name) !== -1)
      continue;

    // Check for collisions.
    const item = table[name];

    if (item) {
      // Collision (keep the higher ranked one).
      item[3] += 1;
      continue;
    }

    insert(name, tld, rank);
  }

  // Sort lexicographically.
  names.sort(([a], [b]) => {
    return a.localeCompare(b);
  });

  return names;
}

/*
 * Execute
 */

const names = compile();

{
  let out = '';

  out += '\'use strict\';\n';
  out += '\n';
  out += '// Format:\n';
  out += '// [name]: [[owner-tld], [alexa-rank], [collisions]]\n';
  out += 'module.exports = {\n';

  for (const [name, tld, rank, collisions] of names)
    out += `  '${name}': ['${tld}', ${rank}, ${collisions}],\n`;

  out += '};\n';

  fs.writeFileSync(path.resolve(__dirname, 'names.js'), out);
}

{
  let out = '';

  out += '\'use strict\';\n';
  out += '\n';
  out += 'module.exports = new Set([\n';

  for (const [name] of names)
    out += `  '${name}',\n`;

  out += ']);\n';

  fs.writeFileSync(path.resolve(__dirname, 'names.min.js'), out);
}
