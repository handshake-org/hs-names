# handshake-names

The handshake blockchain pre-reserves the top ~100,000 domain names from the
Alexa top 1 million domain names. Since the handshake blockchain only thinks in
terms of top-level domains, existing domains on the Alexa top 1 million are
"converted" to TLDs.

For example:

- `google.com` -> `google`
- `bbc.co.uk` -> `bbc`

Note that this is an "added bonus" reserved for popular domains. All existing
domains under `.com`, `.net`, `.org`, and so on will continue to work normally
on Handshake.

Amazon regularly updates the Alexa list. Our script snapshots the alexa list
and processes them to pick the reserved names. Feel free to audit the
`download`, `update.js`, and `generate.js` scripts.

## Rules

In order to have your domain pre-reserved, there are a few rules implemented in
`generate.js` that it must conform to:

1. The domain's deepest subdomain must not be in the blacklist. This includes:
  - `example` - ICANN Reserved.
  - `invalid` - ICANN Reserved.
  - `local` - mDNS.
  - `localhost` - ICANN Reserved.
  - `test` - ICANN Reserved.
2. The domain's deepest subdomain must not be a pseudo-TLD for an existing
   naming project. This includes:
  - `bit` - Namecoin.
  - `eth` - Ethereum Name Service.
  - `exit` - Tor.
  - `gnu` - GNUnet (GNS).
  - `i2p` - Invisible Internet Project.
  - `onion` - Tor.
  - `tor` - OnioNS.
  - `zkey` - GNS.
3. The domain's deepest subdomain must not be a trademarked name. See
   `names/trademarks.json` for a list.
4. The domain must not collide with an existing top-level domain in ICANN's
   root zone, as all existing TLDs are also pre-reserved. For example,
   `google.com` would lose to `google`.
5. The domain must not collide with a higher-ranked domain. For example,
   `google.co.uk` would lose to `google.com`. Only the owner of the
   _higher-ranked_ domain is able to redeem it.
6. The domain must not be deeply nested. `bbc.co.uk` will work, but
   `jeffs-blog.wordpress.com` will not (see `generate.js` for acceptable
   third-level domains).
7. The domain must abide by Handshake policy standards (no leading or trailing
   hyphens or underscores).
8. The domain must not be a single letter.
9. If the domain is ranked lower than 50,000, the domain must not be two
   letters.
10. If the domain is ranked lower than 50,000, the domain must not be an
   English word.

The `download` script was last run on June 4th, 2018, at 6:18pm PDT. This is
the _final_ snapshot of reserved names that will make it into the consensus
rules.

``` bash
$ wget https://s3.amazonaws.com/alexa-static/top-1m.csv.zip
--2018-06-04 18:18:41--  https://s3.amazonaws.com/alexa-static/top-1m.csv.zip
Loaded CA certificate '/etc/ssl/certs/ca-certificates.crt'
Resolving s3.amazonaws.com (s3.amazonaws.com)... 52.216.101.237
Connecting to s3.amazonaws.com (s3.amazonaws.com)|52.216.101.237|:443... connected.
HTTP request sent, awaiting response...
  HTTP/1.1 200 OK
  x-amz-id-2: CosxkcThDsFZKLaQWRoYiKyWYGI7Fsztt+mlx2hF1rwC17bmAjE9gUNqorpd7fITyNAhUgUfJNg=
  x-amz-request-id: F5EBF95C3AD7C4C8
  Date: Tue, 05 Jun 2018 01:19:20 GMT
  Last-Modified: Mon, 04 Jun 2018 10:21:50 GMT
  ETag: "dc6996eec4392c268a52789d50949995"
  x-amz-meta-alexa-last-modified: 20180604102149
  Accept-Ranges: bytes
  Content-Type: application/zip
  Content-Length: 9762651
  Server: AmazonS3
Length: 9762651 (9.3M) [application/zip]
Saving to: ‘top-1m.csv.zip’
```

Note that the root zone will continue to be updated until mainnet launch.

## Why isn't my domain on the reserved list?

If you didn't make the cut, please do not be worried! You will still own your
regular second-level domain names under their existing TLD (you just won't
get a pre-reserved top-level domain as an extra bonus).

However, if your domain was in the Alexa top 100,000 on June 4th, you may be
wondering why you are not in the reserved list. If your domain conformed to all
the rules listed above, you may have "lost" to a higher-ranked domain with the
same name. Please see `build/invalid.json` for a full list of domains and their
reasons for being excluded. If you believe there was a mistake, please post an
issue.

## Which domains made the cut?

Please have a look at `build/valid.json` for a full list of pre-reserved names
and their pre-converted counterparts.

## Late Additions

Names which were added _after_ the final snapshot:

- `charity` - A new gTLD added on ICANN's system.
- `inc` - A new gTLD added on ICANN's system.
- `ss` - ccTLD for South Sudan.
- `xn--mgbah1a3hjkrd` - iccTLD for Mauritania.

Names which were removed _after_ the final snapshot:

- `goodhands` - A gTLD removed from ICANN's system.
- `jlc` - A gTLD removed from ICANN's system.
- `panerai` - A gTLD removed from ICANN's system.
- `spiegel` - A gTLD removed from ICANN's system.
- `statoil` - A gTLD removed from ICANN's system.
- `telecity` - A gTLD removed from ICANN's system.
- `vista` - A gTLD removed from ICANN's system.
- `epost` - A gTLD removed from ICANN's system.
- `zippo` - A gTLD removed from ICANN's system.
- `blanco` - A gTLD removed from ICANN's system.
- `active` - A gTLD removed from ICANN's system.
