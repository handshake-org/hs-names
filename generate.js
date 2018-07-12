#!/usr/bin/env node

'use strict';

const assert = require('assert');
const Path = require('path');
const fs = require('bfile');
const util = require('./util');

const BLACKLIST = require('./names/blacklist.json');
const CUSTOM = require('./names/custom.json');
const TLD = require('./names/tld.json');
const CCTLD = require('./names/cctld.json');
const GTLD = require('./names/gtld.json');
const RTLD = require('./names/rtld.json');
const ALEXA = require('./names/alexa.json');
const WORDS = require('./names/words.json');
const blacklist = new Set(BLACKLIST);
const words = new Set(WORDS);

const RESERVED_JSON = Path.resolve(__dirname, 'build', 'reserved-names.json');
const RESERVED_JS = Path.resolve(__dirname, 'build', 'reserved.js');
const HASHED_JS = Path.resolve(__dirname, 'build', 'hashed.js');
const INVALID_PATH = Path.resolve(__dirname, 'build', 'invalid-names.json');
const SHARE = 102e6 * 1e6; // 7.5%

// This part is not fun.
//
// Explanation:
//
// The United States has trade
// embargoes against a number of
// countries on the grounds of
// human rights violations, among
// other things.
//
// In particular, the US state
// department reserves this right:
// "Authority to prohibit any U.S.
// citizen from engaging in a
// financial transaction with a
// terrorist-list government
// without a Treasury Department
// license."
//
// See: https://www.state.gov/j/ct/rls/crt/2009/140889.htm
//
// Whether we find these embargoes
// justified or not, the fact is,
// several handshake contributors
// are American citizens and must
// abide by American laws.
//
// The handshake blockchain is not a
// system of money or funding, but to
// avoid creating some kind of
// international incident, we do not
// allow any handshake coins to be
// redeemed as a reward for name
// claiming by these countries.
// Offering claim rewards could be
// seen as "funding" of these nations'
// governments.
//
// If Nathan Fielder has taught us
// anything, it's that wikipedia has
// good answers to legal questions,
// so take a look at wikipedia for
// more info:
//   https://en.wikipedia.org/wiki/United_States_embargoes
//   https://en.wikipedia.org/wiki/United_States_embargoes#Countries
const embargoes = new Set([
  'ir', // Iran
  'xn--mgba3a4f16a', // Iran (punycode)
  'kp', // North Korea
  'sy', // Syria
  'xn--ogbpf8fl', // Syria (punycode)
  'sd', // Sudan
  'xn--mgbpl2fh', // Sudan (punycode)

  // Sanctions exist for these countries,
  // despite them not being specifically
  // listed as "terrorist governments".
  'cu', // Cuba
  've'  // Venezuela
]);

/*
 * Compilation
 */

function compile() {
  const table = new Map();
  const names = [];
  const invalid = [];

  const invalidate = (domain, rank, reason, winner = null) => {
    const name = domain;

    invalid.push({
      domain,
      rank,
      name,
      reason,
      winner
    });

    if (winner)
      reason += ` with ${winner.domain} (${winner.rank})`;

    console.error('Ignoring %s (%d) (reason=%s).', domain, rank, reason);
  };

  const insert = (domain, rank, name, tld) => {
    // Ignore blacklist.
    if (blacklist.has(name)) {
      invalidate(domain, rank, 'blacklist');
      return;
    }

    // Check for collisions.
    const cache = table.get(name);
    if (cache) {
      invalidate(domain, rank, 'collision', cache);
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

  // Custom TLDs.
  for (const name of CUSTOM)
    insert(name, -1, name, '');

  // Root TLDs.
  for (const name of RTLD)
    insert(name, 0, name, '');

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
      invalidate(domain, rank, 'plain-www');
      continue;
    }

    // Ignore deeply nested domains.
    if (parts.length > 3) {
      invalidate(domain, rank, 'deeply-nested');
      continue;
    }

    // Third-level domain.
    if (parts.length === 3) {
      const [, sld, tld] = parts;

      // Country Codes only (e.g. co.uk, com.cn).
      if (!util.isCCTLD(tld)) {
        invalidate(domain, rank, 'deeply-nested');
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
          invalidate(domain, rank, 'deeply-nested');
          continue;
      }
    }

    // Get lowest-level name.
    const name = parts.shift();

    // Must match HSK standards.
    if (!util.isHSK(name)) {
      invalidate(domain, rank, 'formatting');
      continue;
    }

    // Ignore single letter domains.
    if (name.length === 1) {
      invalidate(domain, rank, 'one-letter');
      continue;
    }

    // Use stricter rules after rank 50k.
    if (rank > 50000) {
      // Ignore two-letter domains after 50k.
      if (name.length === 2) {
        invalidate(domain, rank, 'two-letter');
        continue;
      }
      // Ignore english words after 50k.
      if (words.has(name)) {
        invalidate(domain, rank, 'english-word');
        continue;
      }
    }

    const tld = parts.join('.');

    insert(domain, rank, name, tld);
  }

  return [names, invalid];
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

const [names, invalid] = compile();

{
  const json = [];

  json.push('[');

  invalid.sort(sortRank);

  for (const {domain, rank, reason, winner} of invalid) {
    if (winner) {
      const wd = winner.domain;
      const wr = winner.rank;
      json.push(`  ["${domain}", ${rank}, "${reason}", ["${wd}", ${wr}]],`);
    } else {
      json.push(`  ["${domain}", ${rank}, "${reason}"],`);
    }
  }

  json[json.length - 1] = json[json.length - 1].slice(0, -1);
  json.push(']');
  json.push('');

  const out = json.join('\n');

  fs.writeFileSync(INVALID_PATH, out);
}

{
  const json = [];

  json.push('{');

  names.sort(sortRank);

  for (const {name, tld, rank, collisions} of names)
    json.push(`  "${name}": ["${tld}", ${rank}, ${collisions}],`);

  json[json.length - 1] = json[json.length - 1].slice(0, -1);
  json.push('}');
  json.push('');

  const out = json.join('\n');

  fs.writeFileSync(RESERVED_JSON, out);
}

function getList() {
  const VALUE = Math.floor(SHARE / (names.length - embargoes.size));
  const TLD_VALUE = VALUE + Math.floor(SHARE / (RTLD.length - embargoes.size));
  const items = [];

  names.sort(sortAlpha);

  for (const {name, domain, rank} of names) {
    let root = false;
    let value = VALUE;

    if (rank === 0) {
      root = true;
      value = TLD_VALUE;
    }

    if (embargoes.has(domain))
      value = 0;

    items.push({
      name: name,
      hash: util.hashName(name),
      target: `${domain}.`,
      value,
      root
    });
  }

  return items;
}

function generateJS(items) {
  const code = [
    `'use strict';`,
    '',
    '/* eslint max-len: off */',
    '',
    'const reserved = {'
  ];

  for (const {name, target, value, root} of items) {
    const tld = root ? '1' : '0';
    code.push(`  '${name}': ['${target}', ${value}, ${tld}],`);
  }

  code[code.length - 1] = code[code.length - 1].slice(0, -1);
  code.push('};');
  code.push('');
  code.push('');

  const extra = [
    'const map = new Map();',
    '',
    'for (const key of Object.keys(reserved)) {',
    '  const item = reserved[key];',
    '  map.set(key, {',
    '    target: item[0],',
    '    value: item[1],',
    '    root: item[2] === 1',
    '  });',
    '}',
    '',
    'module.exports = map;',
    ''
  ];

  const out = code.join('\n') + extra.join('\n');

  fs.writeFileSync(RESERVED_JS, out);
}

function generateHashedJS(items) {
  const code = [
    `'use strict';`,
    '',
    '/* eslint max-len: off */',
    '',
    'const reserved = {'
  ];

  for (const {hash, name, target, value, root} of items) {
    const tld = root ? '1' : '0';
    code.push(`  '${hash}': ['${name}', '${target}', ${value}, ${tld}],`);
  }

  code[code.length - 1] = code[code.length - 1].slice(0, -1);
  code.push('};');
  code.push('');
  code.push('');

  const extra = [
    'const map = new Map();',
    '',
    'for (const key of Object.keys(reserved)) {',
    '  const item = reserved[key];',
    '  map.set(key, {',
    '    name: item[0],',
    '    target: item[1],',
    '    value: item[2],',
    '    root: item[3] === 1',
    '  });',
    '}',
    '',
    'module.exports = map;',
    ''
  ];

  const out = code.join('\n') + extra.join('\n');

  fs.writeFileSync(HASHED_JS, out);
}

const items = getList();

generateJS(items);
generateHashedJS(items);

{
  let total = 0;

  for (const item of items)
    total += item.value;

  console.log('Final value: %d out of %d.', total / 1e6, (SHARE * 2) / 1e6);
}
