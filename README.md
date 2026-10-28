# Test Impact & Flaky-Test Toolkit

[![Quality](https://github.com/foysal619/test-impact-and-flaky-test-toolkit/actions/workflows/quality.yml/badge.svg)](https://github.com/foysal619/test-impact-and-flaky-test-toolkit/actions/workflows/quality.yml)

A dependency-free Node.js CLI and reusable GitHub Action for making faster, evidence-based test decisions. It maps changed files to owned quality suites, balances the selected suites across shards using historical durations, and classifies flaky tests with a minimum evidence policy.

## Why this exists

Large regression suites are often treated as one indivisible job. That wastes feedback time and makes flaky retries look like a test strategy. This toolkit keeps the decision explicit:

```text
changed files → ownership rules → impacted groups → balanced shards
                                      ↓
                         flaky history → release risk
```

## Capabilities

- deterministic glob-based test impact selection;
- global-change rules for shared quality infrastructure;
- longest-processing-time sharding using historical duration data;
- flaky-test classification as `stable`, `observe`, or `quarantine`;
- JSON and GitHub Actions matrix output;
- dependency-free runtime and offline unit tests;
- reusable JavaScript action running on Node 24.

## Quick start

```bash
npm test
npm run example

node bin/test-impact.mjs \
  --config examples/quality-map.json \
  --changed src/api/users.ts,src/shared/auth.ts \
  --durations examples/durations.json \
  --history examples/history.json \
  --shards 2
```

The ownership map keeps test intent in version control:

```json
{
  "globalPatterns": ["package.json", ".github/workflows/**"],
  "groups": [
    { "id": "api-contract", "command": "npm run test:api", "owns": ["src/api/**", "src/shared/**"] },
    { "id": "web-smoke", "command": "npm run test:web:smoke", "owns": ["src/web/**", "src/shared/**"] }
  ]
}
```

## GitHub Action

```yaml
- uses: foysal619/test-impact-and-flaky-test-toolkit@main
  id: impact
  with:
    changed_files: ${{ steps.changes.outputs.files }}
    config: examples/quality-map.json
    durations: examples/durations.json
    history: examples/history.json
    shards: 3

- run: echo '${{ steps.impact.outputs.matrix }}'
```

For production use, pin the action to a released commit SHA instead of `main`.

## Flaky-test policy

A failing test is not automatically flaky. Classification only begins after `minimumRuns`; high failure rates are quarantined for investigation, low failure rates become stable evidence, and insufficient history remains under observation. Quarantine is visible as `releaseRisk: review`—it never silently turns a failed check green.

## Design principles

- Selection rules are reviewable configuration, not hidden heuristics.
- Missing duration history receives a conservative 60-second estimate.
- Sharding is stable and deterministic for the same inputs.
- The action exposes evidence; the consuming pipeline owns the final release decision.

## Project structure

```text
src/core.mjs       selection, sharding, and flaky policy
bin/               command-line interface
dist/              dependency-free GitHub Action entrypoint
examples/          realistic quality map and historical evidence
tests/             offline deterministic tests
```

## Roadmap

- Git diff collection and CODEOWNERS import;
- JUnit/Playwright report ingestion;
- trend persistence through workflow artifacts;
- semantic releases and immutable action tags.

## License

MIT
