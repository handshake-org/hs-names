#!/usr/bin/env node

'use strict';

const assert = require('assert');
const Path = require('path');
const fs = require('bfile');
const constants = require('bns/lib/constants');
const StubResolver = require('bns/lib/resolver/stub');
const root = require('./build/root.json');
const {types} = constants;

const TXT_PATH = Path.resolve(__dirname, 'build', 'txt.zone');

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
  servers: ['8.8.8.8', '8.8.4.4']
});

const records = [];

(async () => {
  await stub.open();

  for (const name of names) {
    console.log(`Crawling ${name}..`);

    let res;

    try {
      res = await stub.lookup(name, types.TXT);
    } catch (e) {
      console.log(`Could not lookup: ${name}`);
      continue;
    }

    let saw = false;

    for (const rr of res.answer) {
      if (rr.type !== types.TXT)
        continue;

      if (!saw) {
        console.log('TXT record found for: %s', name);
        saw = true;
      }

      records.push(rr);
    }

    if (saw)
      records.push(null);

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

  fs.writeFileSync(TXT_PATH, text);

  await stub.close();
})().catch((err) => {
  console.error(err.stack);
  process.exit(1);
});
