/** Session-only processing admission; never part of a project or backup. */
export type SdkAuthorization = () => void;
export class ProcessingConsentError extends Error {}
export class ProcessingConsent {
  private value=false;
  private epoch=0;
  get allowed(): boolean { return this.value; }
  setAllowed(value: boolean): void {
    if(value!==this.value){this.value=value;this.epoch+=1;}
  }
  lease(): SdkAuthorization {
    if(!this.value)throw new ProcessingConsentError('Allow MediaPipe processing before starting camera or video.');
    const admitted=this.epoch;
    return()=>{
      if(!this.value||this.epoch!==admitted)throw new ProcessingConsentError('MediaPipe processing permission was withdrawn.');
    };
  }
}
