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
      glue.set(name, { name, inet4: null, inet6: null });

    const item = glue.get(name);

    switch (rr.type) {
      case types.A:
        if (item.inet4)
          console.log('Duplicate IPv4 address for: %s', name);
        item.inet4 = rr.data.address;
        break;
      case types.AAAA:
        if (item.inet6)
          console.log('Duplicate IPv6 address for: %s', name);
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
    domains.set(name, { ttl: 0, ds: [], ns: [] });

  const item = domains.get(name);

  if (item.ttl === 0 || rr.ttl < item.ttl)
    item.ttl = rr.ttl;

  switch (rr.type) {
    case types.NS: {
      const ns = rr.data.ns.toLowerCase();
      const auth = glue.get(ns);
      assert(auth);

      const ips = [];

      if (auth.inet4)
        ips.push(auth.inet4);

      if (auth.inet6)
        ips.push(auth.inet6);

      if (ips.length === 0) {
        console.log('No glue found for: %s', ns);
        item.ns.push(auth.name);
      } else {
        item.ns.push(`${auth.name}@${ips.join(',')}`);
      }

      break;
    }
    case types.DS: {
      item.ds.push(rr.data.toJSON());
      break;
    }
  }
}

const out = Object.create(null);

for (const [key, value] of domains)
  out[key] = value;

fs.writeFileSync(ZONE_JSON, JSON.stringify(out, null, 2) + '\n');
