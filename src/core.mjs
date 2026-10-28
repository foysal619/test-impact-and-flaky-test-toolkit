import path from 'node:path';

const normalize = (value) => value.replaceAll('\\', '/').replace(/^\.\//, '');

export function globToRegExp(glob) {
  const normalized = normalize(glob);
  let source = '';

  for (let index = 0; index < normalized.length; index += 1) {
    const character = normalized[index];
    const next = normalized[index + 1];

    if (character === '*' && next === '*') {
      const followedBySlash = normalized[index + 2] === '/';
      source += followedBySlash ? '(?:.*/)?' : '.*';
      index += followedBySlash ? 2 : 1;
    } else if (character === '*') {
      source += '[^/]*';
    } else if (character === '?') {
      source += '[^/]';
    } else {
      source += character.replace(/[.+^${}()|[\]\\]/g, '\\$&');
    }
  }
  return new RegExp(`^${source}$`);
}

const matchesAny = (file, patterns = []) => patterns.some((pattern) => globToRegExp(pattern).test(normalize(file)));

export function selectImpactedGroups(changedFiles, config) {
  const changed = [...new Set(changedFiles.map(normalize).filter(Boolean))].sort();
  const globalChange = changed.some((file) => matchesAny(file, config.globalPatterns));
  const groups = config.groups
    .filter((group) => globalChange || changed.some((file) => matchesAny(file, group.owns)))
    .map((group) => ({
      id: group.id,
      command: group.command,
      reason: globalChange
        ? 'global quality infrastructure changed'
        : changed.filter((file) => matchesAny(file, group.owns)),
    }))
    .sort((a, b) => a.id.localeCompare(b.id));

  return { changedFiles: changed, globalChange, groups };
}

export function buildDurationAwareShards(groups, durations = {}, shardCount = 1) {
  const count = Math.max(1, Math.min(Number(shardCount) || 1, Math.max(groups.length, 1)));
  const shards = Array.from({ length: count }, (_, index) => ({ shard: index + 1, estimatedSeconds: 0, groups: [] }));
  const ranked = [...groups].sort((a, b) => (durations[b.id] ?? 60) - (durations[a.id] ?? 60) || a.id.localeCompare(b.id));

  for (const group of ranked) {
    shards.sort((a, b) => a.estimatedSeconds - b.estimatedSeconds || a.shard - b.shard);
    shards[0].groups.push(group);
    shards[0].estimatedSeconds += durations[group.id] ?? 60;
  }

  return shards
    .sort((a, b) => a.shard - b.shard)
    .map((shard) => ({ ...shard, commands: shard.groups.map((group) => group.command) }));
}

export function classifyFlakiness(history, policy = {}) {
  const minimumRuns = policy.minimumRuns ?? 10;
  const quarantineThreshold = policy.quarantineThreshold ?? 0.2;
  const releaseThreshold = policy.releaseThreshold ?? 0.05;

  return history.map((test) => {
    const runs = test.passed + test.failed;
    const failureRate = runs === 0 ? 0 : test.failed / runs;
    let status = 'observe';
    if (runs >= minimumRuns && failureRate >= quarantineThreshold) status = 'quarantine';
    else if (runs >= minimumRuns && failureRate <= releaseThreshold) status = 'stable';
    return { ...test, runs, failureRate: Number(failureRate.toFixed(4)), status };
  }).sort((a, b) => b.failureRate - a.failureRate || a.test.localeCompare(b.test));
}

export function buildDecision({ changedFiles, config, durations = {}, shardCount = 1, history = [] }) {
  const impact = selectImpactedGroups(changedFiles, config);
  const shards = buildDurationAwareShards(impact.groups, durations, shardCount);
  const flakiness = classifyFlakiness(history, config.flakyPolicy);
  return {
    generatedAt: new Date().toISOString(),
    ...impact,
    shards,
    flakiness,
    releaseRisk: flakiness.some((item) => item.status === 'quarantine') ? 'review' : 'normal',
  };
}

export function resolveFrom(base, file) {
  return path.resolve(base, file);
}
