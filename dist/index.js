import { appendFile, readFile } from 'node:fs/promises';
import { buildDecision } from '../src/core.mjs';

const load = async (file, fallback) => file ? JSON.parse(await readFile(file, 'utf8')) : fallback;
const decision = buildDecision({
  changedFiles: (process.env.INPUT_CHANGED_FILES ?? '').split(/[\n,]/),
  config: await load(process.env.INPUT_CONFIG, { groups: [], globalPatterns: [] }),
  durations: await load(process.env.INPUT_DURATIONS, {}),
  history: await load(process.env.INPUT_HISTORY, []),
  shardCount: Number(process.env.INPUT_SHARDS ?? 1),
});

const matrix = JSON.stringify({ include: decision.shards.map((item) => ({ shard: item.shard, commands: item.commands })) });
const summary = JSON.stringify(decision);
if (process.env.GITHUB_OUTPUT) {
  await appendFile(process.env.GITHUB_OUTPUT, `matrix=${matrix}\ndecision=${summary}\n`);
} else {
  console.log(summary);
}
