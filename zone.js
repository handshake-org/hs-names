#!/usr/bin/env node

'use strict';

const assert = require('assert');
const Path = require('path');
const fs = require('bfile');
const util = require('bns/lib/util');
const wire = require('bns/lib/wire');
const {types} = wire;

const ZONE_FILE = Path.resolve(__dirname, 'data', 'root.zone');
const ZONE_JSON = Path.resolve(__dirname, 'build', 'root.json');

const text = fs.readFileSync(ZONE_FILE, 'utf8');
const records = wire.fromZone(text);

const glue = new Map();

for (const rr of records) {
  if (rr.type === types.A || rr.type === types.AAAA) {
    const name = rr.name.toLowerCase();

    if (!glue.has(name))
      glue.set(name, { name, inet4: [], inet6: [] });

    const item = glue.get(name);

    switch (rr.type) {
      case types.A:
        item.inet4.push(rr.data.address);
        break;
      case types.AAAA:
        item.inet6.push(rr.data.address);
        break;
    }
  }
}

const domains = new Map();

for (const rr of records) {
  if (util.countLabels(rr.name) !== 1)
    continue;

  if (rr.type !== types.NS && rr.type !== types.DS)
    continue;

  const name = rr.name.toLowerCase();

  if (!domains.has(name))
    domains.set(name, []);

  const records = domains.get(name);

  switch (rr.type) {
    case types.NS: {
      const ns = rr.data.ns.toLowerCase();
      const auth = glue.get(ns);
      assert(auth);

      records.push({
        type: 'NS',
        ns
      });

      for (const address of auth.inet4) {
        records.push({
          type: 'GLUE4',
          ns,
          address
        });
      }

      for (const address of auth.inet6) {
        records.push({
          type: 'GLUE6',
          ns,
          address
        });
      }

      break;
    }
    case types.DS: {
      records.push({
        type: 'DS',
        keyTag: rr.data.keyTag,
        algorithm: rr.data.algorithm,
        digestType: rr.data.digestType,
        digest: rr.data.digest.toString('hex')
      });
      break;
    }
  }
}

function cmp(a, b) {
  return a.type.localeCompare(b.type);
}

const out = Object.create(null);

for (const [key, value] of domains)
  out[key] = { records: value.sort(cmp) };

fs.writeFileSync(ZONE_JSON, JSON.stringify(out, null, 2) + '\n');
