import test from 'node:test';
import assert from 'node:assert/strict';
import { SourceMapConsumer, SourceNode } from 'source-map-js';
import {readFileSync} from 'node:fs';

test('installed dev tooling excludes the October2026 advisory ranges and matches its lock',()=>{
  const lock=JSON.parse(readFileSync(new URL('../package-lock.json',import.meta.url),'utf8'));
  for(const [name,minimum] of [['vite',[8,3,3]],['vitest',[5,0,3]],['@vitest/mocker',[5,0,3]]]) {
    const installed=JSON.parse(readFileSync(new URL(`../node_modules/${name}/package.json`,import.meta.url),'utf8')).version;
    const version=installed.split('.').map(Number);
    assert.ok(version.every(Number.isInteger)&&version.length===3,`${name} must be a stable version`);
    assert.ok(version[0]>minimum[0]||version[0]===minimum[0]&&(version[1]>minimum[1]||version[1]===minimum[1]&&version[2]>=minimum[2]),`${name} needs the advisory patch`);
    assert.equal(lock.packages[`node_modules/${name}`].version,installed);
  }
});

const basicMap = () => ({
  version: 3, sources: ['input.js'], names: [], mappings: 'AAAA',
  sourcesContent: ['console.log(1);\n'],
});

test('installed source-map consumer rejects dangerous section offsets before expansion', () => {
  assert.throws(() => new SourceMapConsumer({
    version: 3,
    sections: [{ offset: { line: 100000001, column: 0 }, map: basicMap() }],
  }));
});

test('installed source-map consumer preserves normal generated code', () => {
  const consumer = new SourceMapConsumer(basicMap());
  const node = SourceNode.fromStringWithSourceMap('console.log(1);\n', consumer);
  assert.equal(node.toString(), 'console.log(1);\n');
});
