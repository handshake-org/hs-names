#!/usr/bin/env node

'use strict';

// TLD Resources:
// https://www.icann.org/resources/pages/tlds-2012-02-25-en
// https://data.iana.org/TLD/tlds-alpha-by-domain.txt

// SLD Resources:
// https://www.google.com/search?q=alexa+top+100000
// https://www.quora.com/What-are-the-top-100-000-most-visited-websites
// https://s3.amazonaws.com/alexa-static/top-1m.csv.zip

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const bns = require('bns');
const util = require('./util');
const {wire} = bns;

const TLD_PATH = path.resolve(__dirname, 'data', 'tlds-alpha-by-domain.txt');
const ALEXA_PATH = path.resolve(__dirname, 'data', 'top-1m.csv');
const ROOT_PATH = path.resolve(__dirname, 'data', 'root.zone');

const BLACKLIST = [
  'bit', // Namecoin
  'eth', // ENS
  'example', // ICANN reserved
  'handshake', // Permanently Disallowed (to prevent phishing)
  'hns', // Permanently Disallowed (to prevent phishing)
  'hsk', // Permanently Disallowed (to prevent phishing)
  'i2p', // Invisible Internet Project
  'invalid', // ICANN reserved
  'local', // mDNS
  'localhost', // ICANN reserved
  'onion', // Tor
  'test' // ICANN reserved
];

const CUSTOM = [];

const TLD = [
  'arpa',
  'com',
  'edu',
  'gov',
  'int',
  'mil',
  'net',
  'org'
];

const CCTLD = (() => {
  const data = fs.readFileSync(TLD_PATH, 'utf8');
  const lines = data.split('\n');
  const result = [];

  for (const line of lines) {
    const name = line.trim().toLowerCase();

    if (name.length === 0)
      continue;

    if (name[0] === '#')
      continue;

    assert(name.length <= 63);

    // ccTLDs only!
    if (util.isCCTLD(name))
      result.push(name);
  }

  return result;
})();

const GTLD = (() => {
  const data = fs.readFileSync(TLD_PATH, 'utf8');
  const lines = data.split('\n');
  const result = [];

  for (const line of lines) {
    const name = line.trim().toLowerCase();

    if (name.length === 0)
      continue;

    if (name[0] === '#')
      continue;

    assert(name.length <= 63);

    // gTLDs only!
    if (util.isGTLD(name))
      result.push(name);
  }

  return result;
})();

const RTLD = (() => {
  const text = fs.readFileSync(ROOT_PATH, 'utf8');
  const records = wire.fromZone(text);
  const set = new Set();
  const result = [];

  for (const rr of records) {
    if (bns.util.countLabels(rr.name) !== 1)
      continue;

    const name = rr.name.toLowerCase();

    if (set.has(name))
      continue;

    set.add(name);

    result.push(bns.util.trimFQDN(name));
  }

  return result;
})();

const ALEXA = (() => {
  const data = fs.readFileSync(ALEXA_PATH, 'utf8');
  const lines = data.split('\n');
  const result = [];

  let cur = 1;

  for (const line of lines) {
    const ln = line.trim().toLowerCase();

    if (ln.length === 0)
      continue;

    const items = ln.split(/\s*,\s*/);
    assert(items.length === 2);

    const [num, domain] = items;
    const rank = parseInt(num, 10);

    assert((rank >>> 0) === rank);

    // No idea why alexa does this.
    if (rank !== cur) {
      assert(rank > cur);
      console.error('Warning: rank inconsistency!');
      console.error('Rank %d is missing.', cur);
      cur = rank;
    }

    result.push(domain);
    cur += 1;
  }

  assert(result.length === 1000000);

  return result;
})();

const WORDS = (() => {
  const data = fs.readFileSync('/usr/share/dict/words', 'utf8');
  const lines = data.split('\n');
  const result = [];

  for (const line of lines) {
    const word = line.trim();

    if (util.isHSK(word))
      result.push(word);
  }

  return result;
})();

fs.writeFileSync(
  path.resolve(__dirname, 'names', 'blacklist.json'),
  JSON.stringify(BLACKLIST, null, 2) + '\n');

fs.writeFileSync(
  path.resolve(__dirname, 'names', 'custom.json'),
  JSON.stringify(CUSTOM, null, 2) + '\n');

fs.writeFileSync(
  path.resolve(__dirname, 'names', 'tld.json'),
  JSON.stringify(TLD, null, 2) + '\n');

fs.writeFileSync(
  path.resolve(__dirname, 'names', 'cctld.json'),
  JSON.stringify(CCTLD, null, 2) + '\n');

fs.writeFileSync(
  path.resolve(__dirname, 'names', 'gtld.json'),
  JSON.stringify(GTLD, null, 2) + '\n');

fs.writeFileSync(
  path.resolve(__dirname, 'names', 'rtld.json'),
  JSON.stringify(RTLD, null, 2) + '\n');

fs.writeFileSync(
  path.resolve(__dirname, 'names', 'alexa.json'),
  JSON.stringify(ALEXA, null, 2) + '\n');

fs.writeFileSync(
  path.resolve(__dirname, 'names', 'words.json'),
  JSON.stringify(WORDS, null, 2) + '\n');
