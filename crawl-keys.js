#!/usr/bin/env node

'use strict';

const assert = require('assert');
const fs = require('bfile');
const StubResolver = require('bns/lib/resolver/stub');
const constants = require('bns/lib/constants');
const dnssec = require('bns/lib/dnssec');
const wire = require('bns/lib/wire');
const root = require('./build/root.json');
const {types, DSRecord} = wire;
const {hashes} = constants;

const names = Object.keys(root).sort();

const stub = new StubResolver({
  rd: true,
  cd: true,
  edns: true,
  ednsSize: 4096,
  dnssec: true,
  maxAttempts: 10,
  maxTimeout: 3000,
  hosts: [
    ['localhost.', '127.0.0.1'],
    ['localhost.', '::1']
  ],
  // Note: safe to use a 3rd-party resolver,
  // we verify the DS record hashes below.
  servers: ['8.8.8.8', '8.8.4.4']
});

const records = [];

(async () => {
  await stub.open();

  for (const name of names) {
    const zone = root[name];

    if (zone.ds.length === 0)
      continue;

    console.log(`Crawling ${name}..`);

    const ds = zone.ds.map(json => DSRecord.fromJSON(json));
    const dsMap = new Map();

    for (const rd of ds) {
      if (!dsMap.get(rd.keyTag))
        dsMap.set(rd.keyTag, new Map());

      const map = dsMap.get(rd.keyTag);
      map.set(rd.digestType, rd);
    }

    let res;

    try {
      res = await stub.lookup(name, types.DNSKEY);
    } catch (e) {
      console.log(`Could not lookup: ${name}`);
      continue;
    }

    let found = 0;

    for (const rr of res.answer) {
      if (rr.type !== types.DNSKEY)
        continue;

      const rd = rr.data;
      const map = dsMap.get(rd.keyTag());

      if (!map)
        continue;

      for (const parent of map.values()) {
        const ds = dnssec.createDS(rr, parent.digestType);

        if (!ds)
          continue;

        if (parent.digestType === hashes.SHA1 && map.size > 1)
          continue;

        if (!ds.data.digest.equals(parent.digest))
          continue;

        if (ds.data.algorithm !== parent.algorithm)
          continue;

        console.log(rr.toString());

        found += 1;
        records.push(rr);

        break;
      }
    }

    if (found)
      records.push(null);

    if (found < dsMap.size)
      console.log(`Missing DNS keys for: ${name} (${found} < ${dsMap.size}).`);

    console.log('');

    await new Promise(r => setTimeout(r, 500));
  }

  let text = '';

  for (const rr of records) {
    if (!rr) {
      text += '\n';
      continue;
    }
    text += rr.toString() + '\n';
  }

  fs.writeFileSync(`${__dirname}/build/keys.zone`, text);

  await stub.close();
})().catch((err) => {
  console.error(err.stack);
  process.exit(1);
});
