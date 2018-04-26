#!/usr/bin/env node

'use strict';

const assert = require('assert');
const bns = require('bns');
const fs = require('bfile');
const {util, wire} = bns;
const {types} = wire;

const text = fs.readFileSync(`${__dirname}/data/root.zone`, 'utf8');
const records = wire.fromZone(text);

const glue = new Map();

for (const rr of records) {
  if (rr.type === types.A || rr.type === types.AAAA) {
    const name = rr.name.toLowerCase();

    if (!glue.has(name))
      glue.set(name, { name, inet4: null, inet6: null });

    const item = glue.get(name);

    switch (rr.type) {
      case types.A:
        item.inet4 = rr.data.address;
        break;
      case types.AAAA:
        item.inet6 = rr.data.address;
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
    domains.set(name, { ttl: 0, ds: [], ns: [], glue: [] });

  const item = domains.get(name);

  if (item.ttl === 0 || rr.ttl < item.ttl)
    item.ttl = rr.ttl;

  switch (rr.type) {
    case types.NS: {
      const ns = rr.data.ns.toLowerCase();
      const auth = glue.get(ns);
      assert(auth);

      if (auth.inet4)
        item.ns.push(auth.inet4);

      if (auth.inet6)
        item.ns.push(auth.inet6);

      const ips = [];

      if (auth.inet4)
        ips.push(auth.inet4);

      if (auth.inet6)
        ips.push(auth.inet6);

      if (ips.length > 0)
        item.glue.push(`${auth.name}@${ips.join(',')}`);
      else
        item.glue.push(auth.name);

      break;
    }
    case types.DS: {
      item.ds.push(rr.data.toJSON());
      break;
    }
  }
}

const out = Object.create(null);

let size = 0;

for (const [key, value] of domains) {
  size += key.length;
  size += 16;
  size += 40;
  out[key] = value;
}

fs.writeFileSync(
  `${__dirname}/build/root.json`,
  JSON.stringify(out, null, 2) + '\n');

console.log('Estimated size: %d', size);
