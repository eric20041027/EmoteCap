/** Acknowledged source with one management lane and no motion-frame queue. */
import {CONTRACT_VERSION,DRIVEN_BONES,type MotionFrame} from '../motion';
import {HttpFailure} from '../cloud/transport';
import {canonicalId,createSession,revokeSession,type PairingSession} from './sessionsApi';
export type LiveLinkStatus='off'|'connecting'|'live'|'error';
export interface SocketLike {
  readonly readyState:number;readonly bufferedAmount:number;
  onopen:(()=>void)|null;onclose:((event:{code:number;reason:string})=>void)|null;
  onerror:(()=>void)|null;onmessage:((event:{data:unknown})=>void)|null;
  send(data:string):void;close():void;
}
export interface LiveLinkOptions {
  url:string;createSocket?:(url:string)=>SocketLike;maxBufferedBytes?:number;reconnectDelayMs?:number;
  createSession?:()=>Promise<PairingSession>;revokeSession?:(session:PairingSession)=>Promise<void>;now?:()=>number;
}
interface FailedPairing {readonly id:string;readonly code:string;readonly expiresAt:number}
export interface LiveLinkSnapshot {
  readonly status:LiveLinkStatus;readonly pairingCode:string|null;readonly expiresAt:number|null;readonly error:string|null;
  readonly cleanupWarning:string|null;readonly failedPairings:readonly FailedPairing[];
}
const OPEN=1,round=(value:number)=>Math.round(value*1e5)/1e5;
const finite=(value:unknown):value is number=>typeof value==='number'&&Number.isFinite(value);
function validPose(frame:MotionFrame):boolean {
  return !!frame&&finite(frame.t)&&frame.t>=0&&Array.isArray(frame.h)&&frame.h.length===3&&frame.h.every(finite)
    &&Math.abs(frame.h[0])<=1e-6&&Math.abs(frame.h[2])<=1e-6&&Array.isArray(frame.r)&&frame.r.length===192&&frame.r.every(finite)
    &&Array.from({length:48},(_,i)=>Math.hypot(...frame.r.slice(i*4,i*4+4))).every(norm=>norm>=.98&&norm<=1.02);
}
function safeFailure(error:unknown):string {
  if(error instanceof HttpFailure)return `Local pairing request returned HTTP ${error.status}`;
  if(error instanceof DOMException&&error.name==='TimeoutError')return 'Local pairing request timed out';
  return 'Local pairing could not be confirmed';
}
export function defaultLiveLinkUrl():string {
  return `${window.location.protocol==='https:'?'wss':'ws'}://${window.location.host}/ws/live?role=source`;
}
export class LiveLinkSender {
  private state:LiveLinkSnapshot=Object.freeze({status:'off',pairingCode:null,expiresAt:null,error:null,cleanupWarning:null,failedPairings:Object.freeze([])});
  private listeners=new Set<()=>void>();private running=false;private generation=0;
  private socket:SocketLike|null=null;private acknowledged:SocketLike|null=null;private session:PairingSession|null=null;
  private management:Promise<void>|null=null;private pendingRevoke:PairingSession|null=null;private failed=new Map<string,PairingSession>();private retryRequested=false;
  private uncertainCreation=false;
  private reconnectTimer:ReturnType<typeof setTimeout>|null=null;private ackTimer:ReturnType<typeof setTimeout>|null=null;
  private origin=0;private lastT=-1;private readonly factory:(url:string)=>SocketLike;
  private readonly create:()=>Promise<PairingSession>;private readonly revoke:(session:PairingSession)=>Promise<void>;private readonly now:()=>number;
  constructor(private readonly options:LiveLinkOptions,private readonly onStatus:(status:LiveLinkStatus)=>void=()=>{}){
    this.factory=options.createSocket??(url=>new WebSocket(url) as unknown as SocketLike);
    this.create=options.createSession??createSession;this.revoke=options.revokeSession??revokeSession;this.now=options.now??(()=>performance.now());
  }
  readonly getSnapshot=()=>this.state;
  readonly subscribe=(listener:()=>void)=>{this.listeners.add(listener);return()=>this.listeners.delete(listener);};
  private publish(patch:Partial<LiveLinkSnapshot>){
    const old=this.state.status;this.state=Object.freeze({...this.state,...patch});if(old!==this.state.status)this.onStatus(this.state.status);
    for(const listener of this.listeners)listener();
  }
  start():void {
    if(this.running)return;this.running=true;this.generation++;
    if(this.session){this.pendingRevoke=this.session;this.session=null;}
    this.clearConnection();this.publish({status:'connecting',pairingCode:null,expiresAt:null,error:null});this.manageSoon();
  }
  stop():void {
    this.running=false;this.generation++;this.clearConnection();
    if(this.session){this.pendingRevoke=this.session;this.session=null;}
    this.publish({status:'off',pairingCode:null,expiresAt:null,error:null});this.manageSoon();
  }
  retryCleanup=()=>{this.retryRequested=true;this.manageSoon();};
  private manageSoon(){
    if(this.management)return;
    this.management=this.manage().finally(()=>{
      this.management=null;if(this.pendingRevoke||this.retryRequested||(this.running&&!this.session))this.manageSoon();
    });
  }
  private cleanupState(){
    const failedPairings=Object.freeze([...this.failed.values()].map(s=>Object.freeze({id:s.id,code:s.pairingCode,expiresAt:s.expiresAt})));
    const warnings=[];
    if(failedPairings.length)warnings.push('A stopped pairing could not be revoked. Its code remains valid until the service expires it. Retry cleanup or restart the local service.');
    if(this.uncertainCreation)warnings.push('Previous pairing creation was not confirmed. Any unconfirmed code expires within one hour; restart the local service to invalidate it.');
    this.publish({failedPairings,cleanupWarning:warnings.join(' ')||null});
  }
  private async invalidate(session:PairingSession){
    try{await this.revoke(session);this.failed.delete(session.id);this.cleanupState();}
    catch{this.failed.set(session.id,session);this.cleanupState();}
  }
  private async manage(){
    while(true){
      if(this.pendingRevoke){const previous=this.pendingRevoke;this.pendingRevoke=null;await this.invalidate(previous);continue;}
      if(this.retryRequested){this.retryRequested=false;for(const previous of [...this.failed.values()])await this.invalidate(previous);continue;}
      if(!this.running||this.session)return;
      if(this.failed.size>=4){this.running=false;this.publish({status:'error',error:'Four pairing cleanups are unconfirmed. Retry cleanup before creating another.'});return;}
      const generation=this.generation;
      try{
        const session=Object.freeze({...await this.create()});
        if(!this.running||generation!==this.generation){this.pendingRevoke=session;continue;}
        this.session=session;this.publish({pairingCode:session.pairingCode,expiresAt:session.expiresAt});this.connect(generation);return;
      }catch(error){
        if(!(error instanceof HttpFailure)){this.uncertainCreation=true;this.cleanupState();}
        if(generation===this.generation&&this.running){this.running=false;this.publish({status:'error',error:safeFailure(error)});return;}
      }
    }
  }
  private clearAck(){if(this.ackTimer!==null)clearTimeout(this.ackTimer);this.ackTimer=null;}
  private clearConnection(){
    this.clearAck();if(this.reconnectTimer!==null)clearTimeout(this.reconnectTimer);this.reconnectTimer=null;
    const socket=this.socket;this.socket=null;this.acknowledged=null;
    if(socket){socket.onopen=null;socket.onclose=null;socket.onerror=null;socket.onmessage=null;try{socket.close();}catch{}}
  }
  private fail(message:string){this.running=false;this.clearConnection();this.publish({status:'error',error:message});}
  private connect(generation:number){
    if(!this.running||generation!==this.generation||!this.session)return;
    const session=this.session;
    if(session.expiresAt<=Date.now()){this.fail('Live Link pairing expired. Stop and create a new pairing.');return;}
    this.publish({status:'connecting'});let socket:SocketLike;
    try{socket=this.factory(this.options.url);}catch{this.fail('Live Link connection could not be opened');return;}
    this.socket=socket;const owns=()=>this.socket===socket&&this.running&&this.generation===generation;
    this.ackTimer=setTimeout(()=>{if(owns())this.fail('Live Link handshake timed out. Stop and try again.');},5000);
    socket.onopen=()=>{
      if(!owns())return;
      try{socket.send(JSON.stringify({type:'hello',version:CONTRACT_VERSION,bones:DRIVEN_BONES,sessionId:session.id,token:session.sourceToken}));}
      catch{this.fail('Live Link hello could not be sent');return;}
    };
    socket.onmessage=event=>{
      if(!owns())return;
      try{
        if(typeof event.data!=='string'||event.data.length>16384||new TextEncoder().encode(event.data).length>16384)throw new Error();
        const value=JSON.parse(event.data);
        if(!value||typeof value!=='object'||Object.keys(value).sort().join(',')!=='bones,expiresAt,role,sessionId,streamId,type,version'
          ||value.type!=='hello'||value.version!==CONTRACT_VERSION||value.role!=='source'||value.sessionId!==session.id||!canonicalId(value.streamId)
          ||value.expiresAt!==session.expiresAt||!Array.isArray(value.bones)||value.bones.length!==DRIVEN_BONES.length
          ||value.bones.some((bone:unknown,index:number)=>bone!==DRIVEN_BONES[index]))throw new Error();
        if(this.acknowledged===socket)return;
        this.clearAck();this.acknowledged=socket;this.origin=this.now();this.lastT=-1;this.publish({status:'live',error:null});
      }catch{this.fail('Live Link handshake does not match the local protocol. Stop and update the service.');}
    };
    socket.onclose=event=>{
      if(!owns())return;this.socket=null;this.acknowledged=null;this.clearAck();
      if(event.code===1008){this.fail('Live Link pairing was rejected or expired. Stop and create a new pairing.');return;}
      this.publish({status:'connecting'});this.reconnectTimer=setTimeout(()=>this.connect(generation),this.options.reconnectDelayMs??2000);
    };
    socket.onerror=()=>{if(owns()){try{socket.close();}catch{this.fail('Live Link connection failed');}}};
  }
  send(frame:MotionFrame):boolean {
    const socket=this.socket;
    if(!socket||socket!==this.acknowledged||this.state.status!=='live'||socket.readyState!==OPEN
      ||socket.bufferedAmount>(this.options.maxBufferedBytes??65536)||!validPose(frame))return false;
    const t=Math.max(0,round((this.now()-this.origin)/1000),this.lastT+1e-5);
    if(!finite(t)||t<=this.lastT)return false;
    const text=JSON.stringify({type:'frame',t,h:[...frame.h],r:[...frame.r]});
    if(new TextEncoder().encode(text).length>16384)return false;
    try{socket.send(text);this.lastT=t;return true;}catch{this.fail('Live Link frame could not be sent');return false;}
  }
}
