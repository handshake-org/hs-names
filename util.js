'use strict';

const TLD = new Set([
  'arpa',
  'com',
  'edu',
  'gov',
  'int',
  'mil',
  'net',
  'org'
]);

// https://www.icann.org/resources/pages/string-evaluation-completion-2014-02-19-en
// https://en.wikipedia.org/wiki/Proposed_top-level_domain#Internationalized_country_code_top-level_domains
const ICCTLD = new Set([
  'xn--lgbbat1ad8j',
  'xn--y9a3aq',
  'xn--54b7fta0cc',
  'xn--90ais',
  'xn--90ae',
  'xn--fiqs8s',
  'xn--fiqz9s',
  'xn--wgbh1c',
  'xn--e1a4c',
  'xn--node',
  'xn--qxam',
  'xn--j6w193g',
  'xn--h2brj9c',
  'xn--mgbbh1a71e',
  'xn--fpcrj9c3d',
  'xn--gecrj9c',
  'xn--s9brj9c',
  'xn--45brj9c',
  'xn--xkc2dl3a5ee0h',
  'xn--2scrj9c',
  'xn--rvc1e0am3e',
  'xn--45br5cyl',
  'xn--3hcrj9c',
  'xn--mgbbh1a',
  'xn--h2breg3eve',
  'xn--h2brj9c8c',
  'xn--mgbgu82a',
  'xn--mgba3a4f16a',
  'xn--mgba3a4fra',
  'xn--mgbtx2b',
  'xn--mgbayh7gpa',
  'xn--80ao21a',
  'xn--3e0b707e',
  'xn--mix891f',
  'xn--mix082f',
  'xn--d1alf',
  'xn--mgbx4cd0ab',
  'xn--mgbah1a3hjkrd',
  'xn--l1acc',
  'xn--mgbc0a9azcg',
  'xn--mgb9awbf',
  'xn--mgbai9azgqp6j',
  'xn--mgbai9a5eva00b',
  'xn--ygbi2ammx',
  'xn--wgbl6a',
  'xn--p1ai',
  'xn--mgberp4a5d4ar',
  'xn--mgberp4a5d4a87g',
  'xn--mgbqly7c0a67fbc',
  'xn--mgbqly7cvafr',
  'xn--90a3ac',
  'xn--yfro4i67o',
  'xn--clchc0ea0b2g2a9gcd',
  'xn--fzc2c9e2c',
  'xn--xkc2al3hye2a',
  'xn--mgbpl2fh',
  'xn--ogbpf8fl',
  'xn--mgbtf8fl',
  'xn--kpry57d',
  'xn--kprw13d',
  'xn--nnx388a',
  'xn--o3cw4h',
  'xn--pgbs0dh',
  'xn--j1amh',
  'xn--mgbaam7a8h',
  'xn--mgb2ddes',
  'xn--qxa6a',
  'xn--4dbrk0ce',
  'xn--wgv71a',
  'xn--vcst06ab2a',
  'xn--q7ce6a',
  'xn--mgbb7fyab'
]);

exports.isHSK = function isHSK(name) {
  if (name.length === 0)
    return false;

  if (name.length > 63)
    return false;

  if (!/^[a-z0-9\-_]+$/.test(name))
    return false;

  if (/^[\-_]|[\-_]$/.test(name))
    return false;

  return true;
};

exports.isTLD = function isTLD(tld) {
  return TLD.has(tld);
};

exports.isCCTLD = function isCCTLD(tld) {
  return tld.length === 2 || ICCTLD.has(tld);
};

exports.isGTLD = function isGTLD(tld) {
  return !exports.isTLD(tld) && !exports.isCCTLD(tld);
};

exports.compare = function compare(a, b) {
  const len = Math.min(a.length, b.length);

  for (let i = 0; i < len; i++) {
    const x = a.charCodeAt(i);
    const y = b.charCodeAt(i);

    if (x < y)
      return -1;

    if (x > y)
      return 1;
  }

  if (a.length < b.length)
    return -1;

  if (a.length > b.length)
    return 1;

  return 0;
};
