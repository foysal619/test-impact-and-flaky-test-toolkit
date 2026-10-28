#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import process from 'node:process';
import { buildDecision, resolveFrom } from '../src/core.mjs';

function parseArgs(argv) {
  const options = { shards: 1, format: 'json' };
  for (let index = 0; index < argv.length; index += 1) {
    const key = argv[index];
    if (!key.startsWith('--')) continue;
    options[key.slice(2)] = argv[index + 1];
    index += 1;
  }
  return options;
}

async function loadJson(file, fallback) {
  if (!file) return fallback;
  return JSON.parse(await readFile(resolveFrom(process.cwd(), file), 'utf8'));
}

const args = parseArgs(process.argv.slice(2));
if (!args.config || !args.changed) {
  console.error('Usage: test-impact --config quality-map.json --changed file1,file2 [--durations durations.json] [--history history.json] [--shards 2]');
  process.exit(2);
}

const decision = buildDecision({
  changedFiles: args.changed.split(','),
  config: await loadJson(args.config),
  durations: await loadJson(args.durations, {}),
  history: await loadJson(args.history, []),
  shardCount: Number(args.shards),
});

if (args.format === 'github') {
  console.log(JSON.stringify({ include: decision.shards.map((shard) => ({ shard: shard.shard, commands: shard.commands })) }));
} else {
  console.log(JSON.stringify(decision, null, 2));
}

if (args['fail-on-empty'] === 'true' && decision.groups.length === 0) process.exit(3);
