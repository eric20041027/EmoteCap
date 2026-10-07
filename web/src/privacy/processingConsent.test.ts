import { describe, expect, it } from 'vitest';
import { ProcessingConsent, ProcessingConsentError } from './processingConsent';

describe('session SDK permission',()=>{
  it('starts denied with no lease',()=>{
    const consent=new ProcessingConsent();expect(consent.allowed).toBe(false);
    expect(()=>consent.lease()).toThrow(ProcessingConsentError);
  });
  it('admitted lease is invalid after withdrawal',()=>{
    const consent=new ProcessingConsent();consent.setAllowed(true);const lease=consent.lease();
    expect(()=>lease()).not.toThrow();consent.setAllowed(false);
    expect(lease).toThrow(ProcessingConsentError);
  });
  it('regrant never revives an old in-flight lease',()=>{
    const consent=new ProcessingConsent();consent.setAllowed(true);const old=consent.lease();
    consent.setAllowed(false);consent.setAllowed(true);
    expect(old).toThrow(ProcessingConsentError);expect(()=>consent.lease()()).not.toThrow();
  });
  it('same-value UI updates do not invalidate admitted work',()=>{
    const consent=new ProcessingConsent();consent.setAllowed(true);const lease=consent.lease();
    consent.setAllowed(true);expect(()=>lease()).not.toThrow();
  });
  it('a fresh session does not inherit another session choice',()=>{
    const first=new ProcessingConsent();first.setAllowed(true);
    const second=new ProcessingConsent();expect(second.allowed).toBe(false);
    expect(()=>second.lease()).toThrow(ProcessingConsentError);
  });
});
