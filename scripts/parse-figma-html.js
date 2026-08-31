const fs = require('fs');
const path = require('path');

const htmlPath = 'c:/Users/devil/Pictures/VECTRA - Website Mockup (4th Pass Review).html';
const html = fs.readFileSync(htmlPath, 'utf8');
const css = [...html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map((m) => m[1]).join('\n');

function rule(className) {
  const re = new RegExp(`\\.${className.replace(/\./g, '\\.')}\\s*\\{[^}]+\\}`, 'g');
  return css.match(re) || [];
}

function chunkAround(text, radius = 700) {
  const idx = html.indexOf(text);
  if (idx < 0) return null;
  return html.slice(idx - radius, idx + text.length + radius);
}

function inlineStyles(text) {
  const chunk = chunkAround(text);
  if (!chunk) return [];
  return [...new Set([...chunk.matchAll(/style="([^"]{0,400})"/g)].map((m) => m[1]))];
}

const specs = {
  heroGlass: {
    rules: [...rule('css-r2zup7'), ...rule('css-p42x24'), ...rule('css-3k2cp9')],
    inline: inlineStyles('css-r2zup7 css-3k2cp9 css-p42x24'),
  },
  heroTitle: {
    rules: rule('css-6owhw0'),
    inline: inlineStyles('>Who We Are<'),
  },
  heroBody: {
    inline: inlineStyles('>Who We Are<'),
  },
  heroFloat: {
    rules: rule('css-mbpa6e'),
    inline: inlineStyles('Learn How We Can Help'),
  },
  joinUs: {
    inline: inlineStyles('>Join us<'),
  },
  trustedHeading: {
    rules: [...rule('css-a1bctj'), ...rule('css-4i0kw2')],
    inline: inlineStyles('Trusted partnership. Practical implementation.'),
  },
  trustedBtn: {
    rules: rule('css-dpvin9'),
    inline: inlineStyles('Explore case studies→'),
  },
  esgSection: {
    rules: [...rule('css-7i33qm'), ...rule('css-oakrow'), ...rule('css-atgcpy')],
    inline: inlineStyles('Your Trusted</p>'),
  },
  esgHeading: {
    rules: rule('css-22l4m3'),
    inline: inlineStyles('Your Trusted</p>'),
  },
  whyVectra: {
    inline: inlineStyles('Why VECTRA'),
  },
  impactHeading: {
    inline: inlineStyles('Enabling P'),
  },
};

console.log(JSON.stringify(specs, null, 2));

// Extract all css rules with font-size
const fontRules = [...css.matchAll(/\.css-[a-z0-9]+\s*\{[^}]*font-size:[^}]+}/g)].slice(0, 40);
console.log('\n=== FONT RULES (sample) ===');
fontRules.forEach((m) => console.log(m[0].slice(0, 200)));

// Section order from HTML text markers
const markers = [
  'Who We Are',
  'Trusted partnership',
  'Your Trusted',
  'Why VECTRA',
  'VECTRA Solutions',
  'Relevant Topics',
  'Tested in real crises',
  'Frequently Asked Questions',
  'Our latest Articles',
  'Careers',
  'Don\u2019t Know Where To Start',
];
console.log('\n=== SECTION ORDER ===');
markers.forEach((m) => {
  const idx = html.indexOf(m);
  console.log(m, idx >= 0 ? `pos ${idx}` : 'MISSING');
});
