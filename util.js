'use strict';

exports.isHSK = function isHSK(name) {
  if (name.length === 0)
    return false;

  if (name.length > 64)
    return false;

  if (!/^[a-z0-9\-_]+$/.test(name))
    return false;

  if (/^[\-_]|[\-_]$/.test(name))
    return false;

  return true;
};

exports.isTLD = function isTLD(name) {
  switch (name) {
    case 'arpa':
    case 'com':
    case 'edu':
    case 'gov':
    case 'int':
    case 'mil':
    case 'net':
    case 'org':
      return true;
  }
  return false;
};

exports.isCCTLD = function isCCTLD(name) {
  return name.length === 2 || name.startsWith('xn--');
};

exports.isGTLD = function isGTLD(name) {
  return !exports.isTLD(name) && !exports.isCCTLD(name);
};

exports.compare = function compare(a, b) {
  const len = Math.min(a.length, b.length);

  for (let i = 0; i < len; i++) {
    if (a[i] < b[i])
      return -1;

    if (a[i] > b[i])
      return 1;
  }

  if (a.length < b.length)
    return -1;

  if (a.length > b.length)
    return 1;

  return 0;
};
