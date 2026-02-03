# Annotarium

Landing page for [annotarium.org](https://annotarium.org) — a free, browser-based LaTeX PDF annotator designed for academic marking and feedback in mathematics and STEM subjects.

Annotarium runs entirely in the browser and focuses on high-quality mathematical annotation, non-destructive workflows, and privacy-first design.

## Features (overview)

- LaTeX-quality mathematical annotations
- Vector-quality PDF export
- Non-destructive `.annot` format (PDF + annotations stored separately)
- Browser-only by default (no installation required)
- Designed for academic marking and feedback workflows

## Pages

- `/` — Main landing page
- `/faq.html` — Frequently asked questions
- `/privacy.html` — Privacy policy
- `/security.html` — Security information

## Repository scope

This repository contains **only** the static landing site for Annotarium.
The Annotarium application source code is maintained separately and is not part of this repository.

## Development

Styles are built with Tailwind CSS. Fonts are self-hosted (Inter).

```bash
npm install
npm run watch:css   # rebuild styles on change
```