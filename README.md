# IronCAP AI Marketplace

**Live app:** [https://01-quantum.github.io/ai-marketpace/](https://01-quantum.github.io/ai-marketpace/)

A privacy-preserving machine learning marketplace for Fully Homomorphic Encryption (FHE) encrypted inference. The platform walks through a four-step workflow where data owners encrypt datasets locally, model owners run inference on ciphertext inside a secure enclave, and results are decrypted only by the data owner with their private key.

## Features

- **Landing overview** — role-based introduction to the FHE inference workflow
- **Data Owner workspace** — key generation, local encryption, and encrypted dataset upload
- **Model Owner workspace** — review incoming ciphertext, run encrypted inference, return results
- **Decrypt & view result** — data owner decrypts predictions locally with audit trail
- **Model Builder Studio** — design decision tree / logistic regression models and publish to the enclave

Built with Angular 21, standalone components, and a shared dark-theme UI (top bar, workflow stepper, panels, tables, sidebars).

## Development

Start the local dev server:

```bash
npm start
```

Open [http://localhost:4200/](http://localhost:4200/). The app reloads automatically when source files change.

## Build

Production build:

```bash
npm run build
```

Output is written to `dist/ai-marketpace/`.

## Deploy to GitHub Pages

```bash
npm run deploy:gh-pages
```

Then in the GitHub repo: **Settings → Pages → Deploy from branch → `gh-pages` / root**.

The live site is served at `/ai-marketpace/` (project site). If the repo is renamed, update `baseHref` in `angular.json` under the `gh-pages` configuration.

## Tests

```bash
npm test
```

## Tech stack

- [Angular](https://angular.dev/) 21
- [Lucide Angular](https://lucide.dev/) icons
- [Vitest](https://vitest.dev/) for unit tests
