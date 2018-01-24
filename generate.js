#!/usr/bin/env node

'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const util = require('./util');

const BLACKLIST = require('./names/blacklist.json');
const CUSTOM = require('./names/custom.json');
const TLD = require('./names/tld.json');
const CCTLD = require('./names/cctld.json');
// const GTLD = require('./names/gtld.json');
const ALEXA = require('./names/alexa.json');
const WORDS = require('./names/words.json');
const blacklist = new Set(BLACKLIST);
const words = new Set(WORDS);

function ignore(domain, reason) {
  console.error('Ignoring %s (reason=%s).', domain, reason);
}

function compile() {
  const table = new Map();
  const names = [];

  const insert = (name, tld, rank) => {
    // Ignore blacklist.
    if (blacklist.has(name)) {
      ignore(`${name}.${tld}`, 'blacklist');
      return;
    }

    // Check for collisions.
    const item = table.get(name);
    if (item) {
      item[3] += 1;
      return;
    }

    const data = [name, tld, rank, 0];
    table.set(name, data);
    names.push(data);
  };

  // Custom TLDs (e.g. `.hsk`).
  for (const name of CUSTOM)
    insert(name, '', 0);

  // Original TLDs (com, net, org, etc).
  for (const name of TLD)
    insert(name, '', 0);

  // Country Code TLDs (e.g. `.io`).
  for (const name of CCTLD)
    insert(name, '', 0);

  // Generic TLDs (e.g. `.lol`).
  // for (const name of GTLD)
  //   insert(name, '', 0);

  assert(ALEXA.length >= 100000);

  // Alexa top 100,000 second-level domains.
  for (let i = 0; i < 100000; i++) {
    const domain = ALEXA[i];
    const parts = domain.split('.');
    const rank = i + 1;

    assert(parts.length >= 2);

    // Strip and ignore `www`.
    if (parts[0] === 'www') {
      parts.shift();
      if (parts.length === 1) {
        ignore(domain, 'plain-www');
        continue;
      }
    }

    // Get lowest-level name.
    const name = parts.shift();

    // Check blacklist early.
    if (blacklist.has(name)) {
      ignore(domain, 'blacklist');
      continue;
    }

    // Check for collisions early.
    const item = table.get(name);
    if (item) {
      item[3] += 1;
      continue;
    }

    // Must match HSK standards.
    if (!util.isHSK(name)) {
      ignore(domain, 'invalid');
      continue;
    }

    // Ignore single letter domains.
    if (name.length === 1) {
      ignore(domain, 'one-letter');
      continue;
    }

    // Ignore two-letter domains after 50k.
    // Ignore english words after 50k.
    if (rank > 50000) {
      if (name.length === 2) {
        ignore(domain, 'two-letter');
        continue;
      }
      if (words.has(name)) {
        ignore(domain, 'english-word');
        continue;
      }
    }

    // Ignore deeply nested domains.
    if (parts.length > 2) {
      ignore(domain, 'deeply-nested');
      continue;
    }

    // Third-level domain.
    if (parts.length === 2) {
      const [sld, tld] = parts;

      // Country Codes only (e.g. co.uk, com.cn).
      if (!util.isCCTLD(tld)) {
        ignore(domain, 'deeply-nested');
        continue;
      }

      // The SLD must be a known TLD
      // (or a widley used second-level
      // domain like `co` or `ac`).
      // Prioritize SLDs that have at
      // least 3 in the top 100k.
      switch (sld) {
        case 'com':
        case 'edu':
        case 'gov':
        case 'mil':
        case 'net':
        case 'org':
        case 'co': // common everywhere (1795)
        case 'ac': // common everywhere (572)
        case 'go': // govt for jp, kr, id, ke, th, tz (169)
        case 'gob': // govt for mx, ar, ve, pe, es (134)
        case 'nic': // govt for in (97)
        case 'or': // common in jp, kr, id (64)
        case 'ne': // common in jp (55)
        case 'gouv': // govt for fr (32)
        case 'jus': // govt for br (28)
        case 'gc': // govt for ca (19)
        case 'lg': // common in jp (15)
        case 'in': // common in th (14)
        case 'govt': // govt for nz (11)
        case 'gv': // common in au (8)
        case 'spb': // common in ru (6)
        case 'on': // ontario domain for ca (6)
        case 'gen': // common in tr (6)
        case 'res': // common in in (6)
        case 'qc': // quebec domain for ca (5)
        case 'kiev': // kiev domain for ua (5)
        case 'fi': // common in cr (4)
        case 'ab': // alberta domain for ca (3)
        case 'dn': // common in ua (3)
        case 'ed': // common in ao and jp (3)
          break;
        default:
          ignore(domain, 'invalid-second-level');
          continue;
      }
    }

    const tld = parts.join('.');

    insert(name, tld, rank);
  }

  // Sort lexicographically.
  names.sort(([a], [b]) => {
    return util.compare(a, b);
  });

  return names;
}

/*
 * Execute
 */

const names = compile();

{
  let out = '';

  out += '{\n';

  for (const [name, tld, rank, collisions] of names)
    out += `  "${name}": ["${tld}", ${rank}, ${collisions}],\n`;

  out = out.slice(0, -2) + '\n';
  out += '}\n';

  fs.writeFileSync(path.resolve(__dirname, 'reserved.json'), out);
}

{
  let out = '';

  out += '\'use strict\';\n';
  out += '\n';
  out += 'module.exports = new Set([\n';

  for (const [name] of names)
    out += `  '${name}',\n`;

  out = out.slice(0, -2) + '\n';
  out += ']);\n';

  fs.writeFileSync(path.resolve(__dirname, 'reserved.js'), out);
}
