import test from 'node:test';
import assert from 'node:assert/strict';
import { SourceMapConsumer, SourceNode } from 'source-map-js';

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
