# Contributing to Lens

Thanks for your interest in contributing to Lens! This project maps Philippine
administrative divisions and overlays official census, economic, and election data, so
accuracy matters as much as code quality. This guide covers how to report issues, propose
data corrections, and submit code changes.

By participating in this project, you agree to abide by our
[Code of Conduct](./CODE_OF_CONDUCT.md).

## Ways to Contribute

### Reporting data or boundary errors

This is one of the most valuable ways to help. If you spot a wrong boundary, a missing
division, a PSGC mismatch, or incorrect statistics:

1. Open an [issue](https://github.com/Shiiroi/mapa/issues) describing the problem.
2. Include the specific place (name and/or PSGC code) and level (region, province,
   city/municipality, barangay).
3. Where possible, cite an authoritative source — a PSA publication, COMELEC transparency
   portal entry, COA report, or an official LGU/legal citation (e.g. a Republic Act or
   Executive Order). See [`DATA_CORRECTIONS.md`](./DATA_CORRECTIONS.md) for examples of how
   past corrections have been documented.

### Reporting bugs

Open an issue with:

- Steps to reproduce
- What you expected to happen vs. what actually happened
- Browser/OS if it's a frontend issue
- Screenshots if relevant (especially for map rendering issues)

### Suggesting features

Open an issue describing the use case and what problem it solves. Since this is a
solo-maintained project, keep in mind that not every suggestion can be implemented
quickly — but they're all welcome for discussion.

### Code contributions

Bug fixes, performance improvements, accessibility fixes, and small well-scoped features
are all welcome via pull request.

## Development Setup

Full setup instructions live in the [README](./README.md#getting-started). The short
version:

**Prerequisites**: Node.js 20+, pnpm, a Supabase project, and optionally Python 3.11+ if
you need to work on the COMELEC scraper.

```bash
cd frontend
pnpm install
```

Create `frontend/.env` with your Supabase URL and keys (see README for the exact
variables), then apply the migrations in `supabase/migrations/` to your Supabase project.

To get data into your local database, use one of:

```bash
pnpm setup     # seeds from source CSVs (transparent, reproducible)
pnpm restore   # restores from committed DB backup snapshots (faster)
```

Then run the app:

```bash
pnpm dev
```

## Making Changes

1. **Fork** the repository and create a branch off `main`:
   `git checkout -b fix/short-description` or `feat/short-description`.
2. **Keep changes focused** — one fix or feature per PR makes review much faster.
3. **Write clear commit messages** describing what changed and why (Conventional Commits
   style, e.g. `fix: correct PSGC code for Alangilan`, is appreciated but not required).
4. **Match existing code style** — the project uses TypeScript, React, and Tailwind
   conventions already present in `frontend/src/`. Run any existing lint/build scripts
   before submitting (`pnpm build` at minimum, to catch type errors).
5. **Test your changes locally** against a real Supabase instance where the change touches
   data, seeding, or map rendering.

## Data Contributions

Because Lens surfaces official government statistics and boundaries, data-related PRs and
issues are held to a higher bar than typical UI changes:

- Any correction to boundaries, PSGC codes, population, GDP, LGU financial data, or
  election results must cite an authoritative source (PSA, COMELEC, COA, an LGU
  certification, or applicable law/EO/RA).
- If your change affects the seed scripts (`frontend/scripts/seed-*.ts`) or source CSVs
  under `frontend/data-sets/data/clean/`, explain how the new data was derived or
  re-extracted from the original source, so it stays reproducible.
- Significant corrections should be added to [`DATA_CORRECTIONS.md`](./DATA_CORRECTIONS.md)
  following the existing format.

## Pull Request Process

1. Push your branch and open a PR against `main`.
2. In the PR description, explain **what** changed and **why**, and link any related issue.
3. For data changes, include the source citation described above.
4. The maintainer will review as time allows — this is a solo-maintained project, so
   there's no fixed SLA, but all PRs will get a response.
5. Once approved, the maintainer will merge — please don't force-push over review
   comments without a heads-up.

## License

By contributing to Lens, you agree that your contributions will be licensed under the
project's [MIT License](./LICENSE). Contributions involving third-party data must respect
the licenses noted in [`NOTICE.md`](./NOTICE.md).
