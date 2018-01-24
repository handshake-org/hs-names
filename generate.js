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

/*
 * Compilation
 */

function compile() {
  const table = new Map();
  const names = [];
  const invalid = [];
  const collisions = [];

  const ignore = (domain, rank, reason) => {
    const name = domain;
    invalid.push({
      domain,
      rank,
      name,
      reason
    });
    console.error('Ignoring %s (%d) (reason=%s).', domain, rank, reason);
  };

  const collide = (domain, rank, winner) => {
    const name = domain;
    collisions.push({
      domain,
      rank,
      name,
      winner
    });
    console.error('%s (%d) collided with %s (%d).',
      domain, rank, winner.domain, winner.rank);
  };

  const insert = (domain, rank, name, tld) => {
    // Ignore blacklist.
    if (blacklist.has(name)) {
      ignore(domain, rank, 'blacklist');
      return;
    }

    // Check for collisions.
    const cache = table.get(name);
    if (cache) {
      collide(domain, rank, cache);
      cache.collisions += 1;
      return;
    }

    const item = {
      domain,
      rank,
      name,
      tld,
      collisions: 0
    };

    table.set(name, item);
    names.push(item);
  };

  // Custom TLDs (e.g. `.hsk`).
  for (const name of CUSTOM)
    insert(name, 0, name, '');

  // Original TLDs (com, net, org, etc).
  for (const name of TLD)
    insert(name, 0, name, '');

  // Country Code TLDs (e.g. `.io`).
  for (const name of CCTLD)
    insert(name, 0, name, '');

  // Generic TLDs (e.g. `.lol`).
  // for (const name of GTLD)
  //   insert(name, 0, name, '');

  assert(ALEXA.length >= 100000);

  // Alexa top 100,000 second-level domains.
  for (let i = 0; i < 100000; i++) {
    const domain = ALEXA[i];
    const parts = domain.split('.');
    const rank = i + 1;

    // Strip leading `www`.
    while (parts.length > 2 && parts[0] === 'www')
      parts.shift();

    assert(parts.length >= 2);

    // Ignore plain `www`.
    if (parts[0] === 'www') {
      ignore(domain, rank, 'plain-www');
      continue;
    }

    // Get lowest-level name.
    const name = parts.shift();

    // Check blacklist early.
    if (blacklist.has(name)) {
      ignore(domain, rank, 'blacklist');
      continue;
    }

    // Must match HSK standards.
    if (!util.isHSK(name)) {
      ignore(domain, rank, 'formatting');
      continue;
    }

    // Ignore single letter domains.
    if (name.length === 1) {
      ignore(domain, rank, 'one-letter');
      continue;
    }

    // Ignore two-letter domains after 50k.
    // Ignore english words after 50k.
    if (rank > 50000) {
      if (name.length === 2) {
        ignore(domain, rank, 'two-letter');
        continue;
      }
      if (words.has(name)) {
        ignore(domain, rank, 'english-word');
        continue;
      }
    }

    // Ignore deeply nested domains.
    if (parts.length > 2) {
      ignore(domain, rank, 'deeply-nested');
      continue;
    }

    // Third-level domain.
    if (parts.length === 2) {
      const [sld, tld] = parts;

      // Country Codes only (e.g. co.uk, com.cn).
      if (!util.isCCTLD(tld)) {
        ignore(domain, rank, 'deeply-nested');
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
          ignore(domain, rank, 'deeply-nested');
          continue;
      }
    }

    const tld = parts.join('.');

    insert(domain, rank, name, tld);
  }

  return [names, invalid, collisions];
}

/*
 * Helpers
 */

function sortAlpha(a, b) {
  return util.compare(a.name, b.name);
}

function sortRank(a, b) {
  if (a.rank < b.rank)
    return -1;

  if (a.rank > b.rank)
    return 1;

  return util.compare(a.name, b.name);
}

/*
 * Execute
 */

const [names, invalid, collisions] = compile();

{
  let out = '';

  out += '{\n';

  names.sort(sortRank);

  for (const {name, tld, rank, collisions} of names)
    out += `  "${name}": ["${tld}", ${rank}, ${collisions}],\n`;

  out = out.slice(0, -2) + '\n';
  out += '}\n';

  fs.writeFileSync(path.resolve(__dirname, 'build', 'reserved.json'), out);
}

{
  let out = '';

  out += '\'use strict\';\n';
  out += '\n';
  out += 'module.exports = new Set([\n';

  names.sort(sortAlpha);

  for (const {name} of names)
    out += `  '${name}',\n`;

  out = out.slice(0, -2) + '\n';
  out += ']);\n';

  fs.writeFileSync(path.resolve(__dirname, 'build', 'reserved.js'), out);
}

{
  let out = '';

  out += '[\n';

  invalid.sort(sortRank);

  for (const {domain, rank, reason} of invalid)
    out += `  ["${domain}", ${rank}, "${reason}"],\n`;

  out = out.slice(0, -2) + '\n';
  out += ']\n';

  fs.writeFileSync(path.resolve(__dirname, 'build', 'invalid.json'), out);
}

{
  let out = '';

  out += '[\n';

  collisions.sort(sortRank);

  for (const {domain, rank, winner} of collisions)
    out += `  ["${domain}", ${rank}, "${winner.domain}", ${winner.rank}],\n`;

  out = out.slice(0, -2) + '\n';
  out += ']\n';

  fs.writeFileSync(path.resolve(__dirname, 'build', 'collisions.json'), out);
}
