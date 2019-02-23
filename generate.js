#!/usr/bin/env node

'use strict';

const assert = require('assert');
const Path = require('path');
const fs = require('bfile');
const bio = require('bufio');
const util = require('./util');
const floor = Math.floor;

const BLACKLIST = require('./names/blacklist.json');
const CUSTOM = require('./names/custom.json');
const VALUES = require('./names/values.json');
const RTLD = require('./names/rtld.json');
const ALEXA = require('./names/alexa.json');
const WORDS = require('./names/words.json');
const TRADEMARKS = require('./names/trademarks.json');
const blacklist = new Set(BLACKLIST);
const words = new Set(WORDS);
const values = new Map(VALUES);

const VALID_PATH = Path.resolve(__dirname, 'build', 'valid.json');
const INVALID_PATH = Path.resolve(__dirname, 'build', 'invalid.json');
const NAMES_JSON = Path.resolve(__dirname, 'build', 'names.json');
const NAMES_DB = Path.resolve(__dirname, 'build', 'names.db');

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
      if (cache.rank === -2)
        invalidate(domain, rank, 'existing-naming-project', cache);
      else if (cache.rank === -1)
        invalidate(domain, rank, 'trademarked', cache);
      else
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

  // Custom TLDs (these are domains
  // for existing naming projects).
  for (const [name, domain] of CUSTOM) {
    const tld = domain.split('.').slice(1).join('.');

    assert(!blacklist.has(name));

    insert(domain, -2, name, tld);
  }

  // Trademarked TLDs (these are domains
  // who submitted a trademark claim).
  for (const [name, domain] of TRADEMARKS) {
    const tld = domain.split('.').slice(1).join('.');

    assert(!blacklist.has(name));

    insert(domain, -1, name, tld);
  }

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

    // Must match HNS standards.
    if (!util.isHNS(name)) {
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

function sortRank(a, b) {
  if (a.rank < b.rank)
    return -1;

  if (a.rank > b.rank)
    return 1;

  return util.compare(a.name, b.name);
}

function sortHash(a, b) {
  return a.hash.compare(b.hash);
}

/*
 * Execute
 */

const [names, invalid] = compile();
const items = [];

const SHARE = 102e6 * 1e6; // 7.5%
const HALF_SHARE = floor(SHARE / 2);
const NAME_VALUE = floor(HALF_SHARE / (names.length - embargoes.size));
const ROOT_VALUE =
  NAME_VALUE + floor(HALF_SHARE / (RTLD.length - embargoes.size));

// Note: One of the naming/CA recipients preferred to use an address instead of
// a name to redeem their coins. As such, their coins are given to them in the
// faucet merkle tree instead.
const EXTRA_VALUE = 10200000 * 1e6;

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

  fs.writeFileSync(VALID_PATH, out);
}

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

/*
 * Compile
 */

let totalTLDS = 0;
let totalValue = 0;
let totalEmbargoes = 0;

for (const {name, domain, rank} of names) {
  let flags = 0;
  let custom = -1;

  if (rank === 0) {
    flags |= 1; // Root
    totalTLDS += 1;
  }

  if (embargoes.has(domain)) {
    flags |= 2; // Embargoed
    totalEmbargoes += 1;
  }

  if (values.has(domain)) {
    flags |= 4; // Custom Value
    custom = values.get(domain) * 1e6;
    values.delete(domain);
  }

  if (!(flags & 2)) {
    if (flags & 1)
      totalValue += ROOT_VALUE;
    else
      totalValue += NAME_VALUE;

    if (flags & 4)
      totalValue += custom;
  }

  const hash = util.hashName(name);
  const hex = hash.toString('hex');
  const target = `${domain}.`;

  items.push({
    name,
    hash,
    hex,
    target,
    flags,
    custom
  });
}

assert.strictEqual(totalTLDS, RTLD.length);
assert.strictEqual(totalEmbargoes, embargoes.size);
assert(totalValue + EXTRA_VALUE <= SHARE * 2);
assert.strictEqual(totalValue + EXTRA_VALUE, 203999999936738);

if (values.size !== 0) {
  console.error('Custom values not satisfied:');
  console.error(values);
  process.exit(1);
}

items.sort(sortHash);

{
  const ZERO_HASH = Array(32 + 1).join('00');

  const json = [
    '{',
    `  "${ZERO_HASH}": [${items.length}, ${NAME_VALUE}, ${ROOT_VALUE}],`
  ];

  for (const {hex, target, flags, custom} of items) {
    if (custom !== -1)
      json.push(`  "${hex}": ["${target}", ${flags}, ${custom}],`);
    else
      json.push(`  "${hex}": ["${target}", ${flags}],`);
  }

  json[json.length - 1] = json[json.length - 1].slice(0, -1);
  json.push('}');
  json.push('');

  const out = json.join('\n');

  fs.writeFileSync(NAMES_JSON, out);
}

{
  const bw = bio.write(30 << 20);
  const {data} = bw;

  bw.writeU32(items.length);
  bw.writeU64(NAME_VALUE);
  bw.writeU64(ROOT_VALUE);

  const offsets = [];

  for (const item of items) {
    bw.writeBytes(item.hash);
    offsets.push(bw.offset);
    bw.writeU32(0);
  }

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const {offset} = bw;
    const pos = offsets[i];

    bio.writeU32(data, offset, pos);

    assert(item.target.length <= 255);

    const index = item.target.indexOf('.');
    assert(index !== -1);

    bw.writeU8(item.target.length);
    bw.writeString(item.target, 'ascii');
    bw.writeU8(item.flags);
    bw.writeU8(index);

    if (item.custom !== -1)
      bw.writeU64(item.custom);
  }

  const raw = bw.slice();

  fs.writeFileSync(NAMES_DB, raw);
}
