const fs = require('fs');
const path = require('path');
const https = require('https');

const OUT = path.join('d:/code/shopify-theme/assets');
const ASSET_BASE = 'https://mind-heart-53521212.figma.site/_assets/v11';
const VIDEO_BASE = 'https://mind-heart-53521212.figma.site/_videos/v1';
const MAX_BYTES = 18 * 1024 * 1024;

const IMAGES = {
  'os-hero-mark.svg': '81e405ef1e5763ccbc49a2e23ee2f5ec21868308.svg',
  'os-ceo-bg.svg': '44e87a59f53c96898a05163bed2f8d8bbea8c224.svg',
  'os-ceo-1.png': '1323aaa74cde58ad7343be0a5de5bcef13017f6c.png',
  'os-ceo-2.png': '85a6bf1d4fe720d04d30ef1cf07477479286f5a9.png',
  'os-ceo-tag.svg': '9608a3bf5c3df62aacde306f0a5bc0f23cd6cda4.svg',
  'os-mission-icon.png': 'ab5a73b700ceb5a66dc5957be5e3b8aad23b6091.png',
  'os-vision-icon.png': '1d6215c04cf277ec10b09b10ee5ed62453e8f71e.png',
  'os-rule.svg': 'f4557f4e97f060fde63a715e6fa9dfd3653ade0b.svg',
  'os-values-line.svg': '8b21e57438446123bfee8c0c2a534513c4515e0b.svg',
  'os-lead-patrick.png': '4a782677c9907a899d2e84025df9fda627b7fbf8.png',
  'os-lead-shelly.png': '5a45cef3c985f7964fd6f04020f73a021850f52c.png',
  'os-lead-lorenz.png': 'dc0daa0599cf1e7890ac477b6fd8c91f8bc1743a.png',
  'os-lead-alana.png': 'dd46b740bdec4d3fe0852fbab0c2855306beb4e4.png',
  'os-lead-elizabeth.png': '8606670d35448bf9a7c0b601a64c49b9be7e86de.png',
  'os-expert-beat.png': '14b9e6914bc9f1111966be55232cfa8990739462.png',
  'os-expert-bercin.png': 'bb37886d23428b36d5a6703f3aa1e71fd1d15929.png',
  'os-expert-daniel.png': '70734a58f670e934fa9e18fa958676614dedc858.png',
  'os-expert-iddah.png': 'a7fddb20a7074e9dc372d79b62756ec3622de6d2.png',
  'os-avatar-1.png': '3d90b6de863f4a0f6cfb9e8f77617b9ea7caeff1.png',
  'os-avatar-2.png': 'c543bcdfc727d87f2710b5345cea3b7eb76daab1.png',
  'os-avatar-3.png': '26b8a07235b9d48b395528564d6124a59d29f6e3.png',
  'os-avatar-more.svg': '8d90f000de5e274a0c256afc80b101856c4f87b8.svg',
};

const VIDEOS = {
  'os-hero.mp4': 'cf35e8be90772b3ab01cf2fb07d3d88607a4d291',
  'os-who.mp4': '9d111e59b40b7ea7e50837a852bb6a4b1c53a99c',
  'os-people.mp4': '70bd9d70447180d47d644737320fb4e353597bd3',
};

function fetchBuffer(url) {
  return new Promise((resolve, reject) => {
    https
      .get(url, { headers: { 'User-Agent': 'Mozilla/5.0 VectraTheme/1.0' } }, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          fetchBuffer(res.headers.location).then(resolve, reject);
          return;
        }
        if (res.statusCode !== 200) {
          reject(new Error(String(res.statusCode)));
          res.resume();
          return;
        }
        const chunks = [];
        let size = 0;
        res.on('data', (c) => {
          size += c.length;
          if (size > MAX_BYTES) {
            res.destroy();
            reject(new Error('too-large'));
            return;
          }
          chunks.push(c);
        });
        res.on('end', () => resolve(Buffer.concat(chunks)));
      })
      .on('error', reject);
  });
}

async function save(name, url) {
  const buf = await fetchBuffer(url);
  fs.writeFileSync(path.join(OUT, name), buf);
  console.log('OK', name, buf.length);
  return true;
}

(async () => {
  let ok = 0;
  let fail = 0;
  for (const [name, hash] of Object.entries(IMAGES)) {
    try {
      await save(name, `${ASSET_BASE}/${hash}`);
      ok += 1;
    } catch (e) {
      fail += 1;
      console.error('FAIL', name, e.message);
    }
  }
  for (const [name, hash] of Object.entries(VIDEOS)) {
    try {
      await save(name, `${VIDEO_BASE}/${hash}`);
      ok += 1;
    } catch (e) {
      fail += 1;
      console.error('FAIL', name, e.message);
    }
  }
  console.log(JSON.stringify({ ok, fail }));
})();
