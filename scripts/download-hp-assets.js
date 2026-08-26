const fs = require('fs');
const path = require('path');
const https = require('https');

const OUT = path.join('d:/code/shopify-theme/assets');
const BASE = 'https://mind-heart-53521212.figma.site/_assets/v11';

// Correct mapping from live Figma site asset hashes
const MAP = {
  'hp-hero.png': 'e5f2730422a9a0516df81d548f5c3f4383f99969.png?w=1920',
  'hp-logo.png': 'f1f1bad320cc916c9d3f257211cb366de698a572.png',
  'hp-arrow.svg': '33469c114cd0dac188b171519c338a0fcdfa79a7.svg',
  'hp-arrow-green.svg': '92b1edc95f4a73dc0740d86ef2953eac763cdc86.svg',
  'hp-nav-arrow.svg': 'd640d7e5d10a7b2543900785147430e0c5cd06a1.svg',
  'hp-chevron-circle.svg': '4cfa6bb3f0d11e89962d1245674fd2ddd7350694.svg',
  'hp-lang.png': 'e75326688c7e0ce3e0b991e45c67a26e49052254.png',
  'hp-login.png': 'f07515ab5f0a8f7807c77ab21d02c5eb476eb902.png',
  'hp-join.png': 'bc13c1ac5973c68a13ce0a8ee907baaf2e4e4828.png',
  'hp-search.svg': '0685459e32edff05fd3eb063fd02eb497a64febb.svg',
  'hp-stat-experts.svg': '2aa84d5c3d30bc5aa22e0223be701b70d39e52a5.svg',
  'hp-stat-years.svg': '04bc1f8ed6131d5f2b4ccb694c07e6404c9cefd5.svg',
  'hp-stat-clients.svg': 'd7f84708970746d1c9ccb78c71253ff08356d7a9.svg',
  'hp-trust-rings.svg': '3ae3aa304c98c68f502975e04936044b6352be01.svg',
  'hp-solution-1.png': 'add817f67c59297c528c5d57486a2794644fb47c.png?w=1600',
  'hp-solution-2.png': 'd7047ac7e66609406a0cb2e3fa6ac8ad2faf5cca.png?w=1200',
  'hp-solution-3.png': 'd9fea5c48820c581c90942feb5bfc3997b28135f.png?w=1400',
  'hp-solution-4.png': '6a69557ce365aa215c5c28bca6a6e51af0a2c987.png?w=1400',
  'hp-why.png': '98b18fd88fbc107def3e73f0c7affa6539c876eb.png?w=1400',
  'hp-pillar-1.svg': 'be208e26a6843edcaa8fc4443996531be291a3b4.svg',
  'hp-pillar-2.svg': '0741b53e27e031962e5853d5e609fc42e3000a0a.svg',
  'hp-pillar-3.svg': '7710da89715977538c6f4fe9c6dc34d7e755efbe.svg',
  'hp-pillar-4.svg': '2ff6aff392536da49f749783879fa1d814bae954.svg',
  'hp-course-1.png': '514da1e5ddd8e93543da62a9818e4183b5547b3a.png?w=1200',
  'hp-course-2.png': '01d26f601c057ccb6b54759c020d48ae5de18cf3.png?w=1200',
  'hp-course-3.png': '78626510a1ed0aa2ddc4170280cbb69d727b4968.png?w=1200',
  'hp-course-4.png': 'ae8b362b8368e8b200e58c921e1c7c274608a975.png?w=1200',
  'hp-partner-otto.png': 'f9891ea3bc104013ef4392a154f93dad123a8da6.png?w=900',
  'hp-partner-crh.png': 'c581678ac8eabd45e9273d17ceb6fa657d364dc9.png?w=900',
  'hp-partner-kodak.png': '8dd632f9a55b50e7d1bc55dc9197d46aa4f6588a.png?w=900',
  'hp-stars.svg': '4493177661cba0a154e2d4fdc63f8f638115a5cc.svg',
  'hp-faq-deco.svg': 'e32a206de7923ab33785965a484773cdcaf81be2.svg',
  'hp-icon-email.svg': 'da137306dcbc6716d83295ef75678ab141a500e1.svg',
  'hp-icon-phone.svg': '7c0e54b37d57d95df328b0e4ee1f7b87844a7372.svg',
  'hp-icon-pin.svg': '484bca36e3874bd30d1d6dd79807ed0314378e3d.svg',
  'hp-faq-shape.svg': '9a4f80a5b924a881fc96b20219bb1f7c8ca734ab.svg',
  'hp-acc-open.svg': '56f1265cfe47c63f7fdb66a187b51b98638147e0.svg',
  'hp-filter-caret.svg': '0e9cac18fb38ceff59e651bd8dbe6faf67915d9e.svg',
  'hp-search-icon.svg': 'e0ec4ed4ef8237895a3a80fa63d32b7a5c5526b6.svg',
  'hp-search-line.svg': 'a9632d09f2f205d1b1c518746226d1bba977dae8.svg',
  'hp-footer-deco.svg': '25f249ff37aacd0d621128d9dde1900d921cb4ef.svg',
  'hp-social.svg': '8edaf1fb1163eb6b857092f513083a6fc9fdc561.svg',
  'hp-form-arrow.svg': '93cc8265b424a74e452dcdc26a67466ed862ff51.svg',
  'hp-trusted-badge.png': 'b41ebe7f372998e58fd90186457d5a5fae6bb454.png',
  'hp-btn-arrow.svg': '54db3b2d66b85bf4c6ca264ed1363beb759e512d.svg',
  'hp-label-left.svg': 'e205076c7ecd44be81c212b46ad88ffcb4b695e2.svg',
  'hp-label-right.svg': '59d55f26f31ee92b3fed74cf7b852de115d005dc.svg',
  'hp-positive-o.png': '40443357d31f7ee0d6f2740d326787e56c0d6a5b.png',
  'hp-positive-icon.png': '6fbd7c62e521082467b9d6192e09d91235f198a5.png',
  'hp-logo-1.png': '28a1d7e111c00e8a7fc45b900983e7447e9874e4.png',
  'hp-logo-2.png': 'cb8e65114981244bc1e02bd76e369c2e9275bc0b.png',
  'hp-logo-3.png': 'ac45449dcc22ca95791fd9c0955f7d62850045d2.png',
  'hp-logo-4.png': '6d954c5378f5454c87d56a92dde5a7e971b55b62.png',
  'hp-logo-5.png': '8a2d48622811fffd9cd7f129941b6807667d0916.png',
  'hp-logo-6.png': 'fc0d652f27cfacfaf98915d93a3a90bbb65771bf.png',
  'hp-logo-7.png': 'a4cdfe52a81d802c9aaf6b7bf6d694343cbedde4.png',
  'hp-logo-8.png': 'e1d133cc580029cb6b8074e5aae5a7dda46406b4.png',
  'hp-logo-9.png': 'b45406e535c5bbc9c26b808cd8cbca66f572f9e7.png',
  'hp-logo-10.png': '08b090be3b1f1972589bc05ef1d4cf3d74f30fca.png',
  'hp-article-1.png': 'add817f67c59297c528c5d57486a2794644fb47c.png?w=900',
  'hp-article-2.png': 'd7047ac7e66609406a0cb2e3fa6ac8ad2faf5cca.png?w=900',
  'hp-article-3.png': 'd9fea5c48820c581c90942feb5bfc3997b28135f.png?w=900',
  'hp-solutions-deco.svg': 'b60fa7f0659ea2f02abdb087da397e25a4aaccba.svg',
  'hp-read-more.svg': '719a266252a5218b2949396a1eb9c52f5ad8ede0.svg',
  'hp-careers.png': '98b18fd88fbc107def3e73f0c7affa6539c876eb.png?w=1600',
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
          reject(new Error(`${res.statusCode}`));
          res.resume();
          return;
        }
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => resolve(Buffer.concat(chunks)));
      })
      .on('error', reject);
  });
}

(async () => {
  let ok = 0;
  let fail = 0;
  for (const [name, hash] of Object.entries(MAP)) {
    const url = `${BASE}/${hash}`;
    try {
      const buf = await fetchBuffer(url);
      fs.writeFileSync(path.join(OUT, name), buf);
      ok += 1;
      console.log('OK', name, buf.length);
    } catch (e) {
      fail += 1;
      console.error('FAIL', name, e.message);
    }
  }
  console.log(JSON.stringify({ ok, fail }));
})();
