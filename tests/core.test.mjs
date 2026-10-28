import assert from 'node:assert/strict';
import test from 'node:test';
import { buildDecision, buildDurationAwareShards, classifyFlakiness, globToRegExp, selectImpactedGroups } from '../src/core.mjs';

const config = {
  globalPatterns: ['package.json', '.github/workflows/**'],
  flakyPolicy: { minimumRuns: 10, quarantineThreshold: 0.2, releaseThreshold: 0.05 },
  groups: [
    { id: 'api', command: 'test api', owns: ['src/api/**', 'src/shared/**'] },
    { id: 'web', command: 'test web', owns: ['src/web/**', 'src/shared/**'] },
    { id: 'mobile', command: 'test mobile', owns: ['src/mobile/**'] },
  ],
};

test('glob matching handles nested and single-level paths', () => {
  assert.equal(globToRegExp('src/**').test('src/api/users.ts'), true);
  assert.equal(globToRegExp('src/*.ts').test('src/api/users.ts'), false);
});

test('selects only groups owned by changed files', () => {
  const result = selectImpactedGroups(['src/api/users.ts'], config);
  assert.deepEqual(result.groups.map(({ id }) => id), ['api']);
  assert.deepEqual(result.groups[0].reason, ['src/api/users.ts']);
});

test('global changes select every quality group', () => {
  const result = selectImpactedGroups(['package.json'], config);
  assert.equal(result.globalChange, true);
  assert.deepEqual(result.groups.map(({ id }) => id), ['api', 'mobile', 'web']);
});

test('duration-aware sharding balances longest groups first', () => {
  const groups = config.groups.map(({ id, command }) => ({ id, command }));
  const shards = buildDurationAwareShards(groups, { api: 120, web: 100, mobile: 20 }, 2);
  assert.deepEqual(shards.map((item) => item.estimatedSeconds), [120, 120]);
});

test('flaky policy quarantines only statistically useful failures', () => {
  const result = classifyFlakiness([
    { test: 'unstable', passed: 8, failed: 2 },
    { test: 'stable', passed: 20, failed: 0 },
    { test: 'too-new', passed: 2, failed: 2 },
  ], config.flakyPolicy);
  assert.equal(result.find(({ test }) => test === 'unstable').status, 'quarantine');
  assert.equal(result.find(({ test }) => test === 'stable').status, 'stable');
  assert.equal(result.find(({ test }) => test === 'too-new').status, 'observe');
});

test('decision exposes a review risk when quarantine exists', () => {
  const result = buildDecision({
    changedFiles: ['src/shared/auth.ts'],
    config,
    shardCount: 2,
    history: [{ test: 'unstable', passed: 8, failed: 2 }],
  });
  assert.equal(result.groups.length, 2);
  assert.equal(result.releaseRisk, 'review');
});
