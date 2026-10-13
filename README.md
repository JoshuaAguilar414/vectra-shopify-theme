# VECTRA Shopify Theme

Shopify Online Store theme for VECTRA International.

## Stack

- Liquid theme (VECTRA branding, custom page templates)
- Shopify Customer Accounts for storefront login
- Theme assets and sections under the repo root

## Pretty URL redirects

Client-side fallbacks live in [`snippets/vectra-redirects.liquid`](snippets/vectra-redirects.liquid). Mirror the same map in **Shopify Admin → Navigation → URL redirects** for real 301s.

## Local development

```bash
shopify theme dev
```

Push or publish with the Shopify CLI when ready.
