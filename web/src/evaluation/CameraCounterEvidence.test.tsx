import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {describe,expect,it} from 'vitest';
import {CameraCounterEvidence} from './CameraCounterEvidence';

describe('camera counter evidence presentation',()=>{
  it.each(['stalled','insufficient','unavailable'] as const)('warns when %s inputs cannot establish throughput',progress=>{
    const html=renderToStaticMarkup(createElement(CameraCounterEvidence,{progress}));
    expect(html).toContain('role="status"');expect(html).toContain(progress);
    expect(html).toContain('cannot establish fresh-camera throughput');
  });
  it('does not warn that advancing input counters are unavailable',()=>{
    const html=renderToStaticMarkup(createElement(CameraCounterEvidence,{progress:'advancing'}));
    expect(html).toContain('advancing');expect(html).not.toContain('cannot establish');
  });
});
