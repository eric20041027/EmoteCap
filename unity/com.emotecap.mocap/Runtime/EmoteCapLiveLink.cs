using System;
using System.Diagnostics;
using System.Linq;
using System.Net.WebSockets;
using System.Threading;
using System.Threading.Tasks;
using UnityEngine;

namespace EmoteCap
{
    /// <summary>
    /// Explicit, paired loopback receiver for canonical EmoteCap Live Link frames.
    /// Requirements: the character is in its T-pose bind pose when Play starts (Mixamo characters are),
    /// and its Animator has an Avatar but no Animator Controller (a controller would overwrite the pose).
    /// </summary>
    [RequireComponent(typeof(Animator))]
    public class EmoteCapLiveLink : MonoBehaviour
    {
        [SerializeField] string host = "localhost";
        [SerializeField] int port = 8787;
        [SerializeField] bool applyHipsHeight = true;
        [Tooltip("Seconds to ease toward each new frame; smooths 30 fps tracking on a 60+ fps display. 0 = off.")]
        [Range(0f, 0.2f)]
        [SerializeField] float smoothTime = 0.05f;
        [Tooltip("Keep the lowest sole on the floor: never below it, and pulled down when floating less than Airborne Threshold.")]
        [SerializeField] bool groundFeet = true;
        [Tooltip("Soles higher than this above the floor are treated as a jump and left in the air (meters).")]
        [SerializeField] float airborneThreshold = 0.04f;
        [SerializeField] bool showStatus = true;

        public string Status { get; private set; } = "disconnected";
        [field:NonSerialized]
        internal Func<ILiveTransport> TransportFactory { get; set; }
        public int ConnectionGeneration { get; private set; }
        public int AcceptedFrameCount { get; private set; }
        public double LastFrameTimestamp { get; private set; } = -1;

        const float ReconnectDelaySeconds = 2f;

        Transform[] bones;
        Quaternion[] restWorld;
        Quaternion[] targetWorld;
        Quaternion[] shownWorld;
        float targetHipsHeight;
        float shownHipsHeight;
        bool hasTarget;
        readonly Transform[] soleJoints = new Transform[4];
        readonly float[] soleHeights = new float[4];
        Quaternion rootRest;
        float restHipsHeight;
        volatile LiveMessage latest;
        LiveMessage applied;
        CancellationTokenSource cancellation;
        ILiveTransport activeTransport;
        Task receiveTask;

        void Start()
        { InitializeRig(); }

        bool InitializeRig()
        {
            if(bones!=null)return true;
            var animator = GetComponent<Animator>();
            if (animator.avatar == null || !animator.isHuman)
            {
                Status="Humanoid Avatar required";return false;
            }
            if (animator.runtimeAnimatorController != null)
            {
                UnityEngine.Debug.LogWarning("EmoteCap Live Link: remove the Animator Controller, it overrides live poses.", this);
            }

            bones = EmoteCapContract.DrivenBones.Select(animator.GetBoneTransform).ToArray();
            if(bones[0]==null){bones=null;Status="Humanoid hips required";return false;}
            restWorld = bones.Select(bone => bone != null ? bone.rotation : Quaternion.identity).ToArray();
            rootRest = transform.rotation;
            restHipsHeight = bones[0].position.y - transform.position.y;
            if(!Finite(restHipsHeight)||restHipsHeight<=0||!Finite(rootRest)) {
                bones=null;Status="Valid bind pose required";return false;
            }
            targetWorld = (Quaternion[])restWorld.Clone();
            shownWorld = (Quaternion[])restWorld.Clone();
            targetHipsHeight = shownHipsHeight = restHipsHeight;
            RecordSoleHeights(animator);

            return true;
        }

        public bool ConnectPairing(string code)
        {
            StopPairing();
            if(!Application.isPlaying||!isActiveAndEnabled){Status="Enter Play mode with an enabled receiver";return false;}
            if(!PairingCredentials.TryParse(code,out var credentials)){Status="Invalid pairing code";return false;}
            if(!(string.Equals(host,"localhost",StringComparison.OrdinalIgnoreCase)||host=="127.0.0.1"||host=="::1")||port<1||port>65535) {
                Status="Loopback endpoint required";return false;
            }
            if(!InitializeRig())return false;
            var endpoint=new UriBuilder("ws",host,port,"/ws/live") {Query="role=sink"}.Uri;
            AcceptedFrameCount=0;cancellation=new CancellationTokenSource();
            receiveTask=ReceiveLoopAsync(credentials,endpoint,ConnectionGeneration,cancellation.Token);
            return true;
        }
        public void StopPairing()
        {
            ConnectionGeneration++;ClearStream();
            var owner=cancellation;cancellation=null;
            var transport=activeTransport;activeTransport=null;
            if(transport!=null)transport.Abort();
            receiveTask=null;
            if(owner!=null){owner.Cancel();owner.Dispose();}
            Status="disconnected";
        }
        void OnDisable() { StopPairing(); }
        void OnDestroy() { StopPairing(); }
        bool Current(int generation) => this!=null&&isActiveAndEnabled&&generation==ConnectionGeneration;
        void ClearStream() {latest=null;applied=null;hasTarget=false;LastFrameTimestamp=-1;}
        static bool Finite(float value) => !float.IsNaN(value)&&!float.IsInfinity(value);
        static bool Finite(Quaternion value) => Finite(value.x)&&Finite(value.y)&&Finite(value.z)&&Finite(value.w);
        static bool Finite(Vector3 value) => Finite(value.x)&&Finite(value.y)&&Finite(value.z);
        static bool TryLocalPosition(Transform joint,Vector3 world,out Vector3 local)
        {
            local=joint.parent!=null?joint.parent.InverseTransformPoint(world):world;
            return Finite(world)&&Finite(local)&&
                (joint.parent==null||Finite(joint.parent.TransformPoint(local)));
        }

        void LateUpdate()
        {
            var frame = latest;
            if (frame != null && frame != applied)
            {
                applied = frame;
                if(!SetTargets(frame)){hasTarget=false;Status="invalid pose target";return;}
            }
            if (!hasTarget) return;

            // Ease toward the latest frame every rendered frame instead of snapping 30 times a second.
            var blend = smoothTime > 0f ? 1f - Mathf.Exp(-Time.deltaTime / smoothTime) : 1f;
            var nextWorld=new Quaternion[bones.Length];
            for (var i = 0; i < bones.Length; i++)
            {
                if (bones[i] == null) continue;
                nextWorld[i]=Quaternion.Slerp(shownWorld[i],targetWorld[i],blend);
                if(!Finite(nextWorld[i])){hasTarget=false;Status="invalid pose target";return;}
            }
            var nextHeight=Mathf.Lerp(shownHipsHeight,targetHipsHeight,blend);
            if(applyHipsHeight&&(!Finite(nextHeight)||!Finite(transform.position.y+nextHeight))) {
                hasTarget=false;Status="invalid pose target";return;
            }
            var hips=bones[0];var position=hips.position;
            if(applyHipsHeight)position.y=transform.position.y+nextHeight;
            if(!TryLocalPosition(hips,position,out var nextLocal)) {
                hasTarget=false;Status="invalid pose target";return;
            }
            // Grounding depends on the proposed rotations. Keep local snapshots until
            // its final world-to-local conversion has passed, then commit display state.
            var previousRotations=bones.Select(bone=>bone!=null?bone.localRotation:Quaternion.identity).ToArray();
            var previousPosition=hips.localPosition;
            for(var i=0;i<bones.Length;i++)if(bones[i]!=null)bones[i].rotation=nextWorld[i];
            if (applyHipsHeight)
            {
                hips.localPosition=nextLocal;
            }
            if (groundFeet&&!GroundLowestSole()) {
                for(var i=0;i<bones.Length;i++)if(bones[i]!=null)bones[i].localRotation=previousRotations[i];
                hips.localPosition=previousPosition;
                hasTarget=false;Status="invalid pose target";return;
            }
            System.Array.Copy(nextWorld,shownWorld,nextWorld.Length);
            if(applyHipsHeight)shownHipsHeight=nextHeight;
        }

        bool SetTargets(LiveMessage frame)
        {
            var next=new Quaternion[bones.Length];
            for (var i = 0; i < bones.Length; i++)
            {
                if (bones[i] == null) continue;
                var delta = EmoteCapContract.ToUnity(frame.r[i * 4], frame.r[i * 4 + 1], frame.r[i * 4 + 2], frame.r[i * 4 + 3]);
                // The delta is expressed in the character's own frame; rotate it into world space.
                next[i] = rootRest * delta * Quaternion.Inverse(rootRest) * restWorld[i];
                if(!Finite(next[i]))return false;
            }
            var height=targetHipsHeight;
            if (frame.h != null && frame.h.Length == 3)
            {
                height = restHipsHeight * (frame.h[1] / EmoteCapContract.HipsRestHeight);
                if(!Finite(height)||!Finite(transform.position.y+height))return false;
            }
            targetWorld=next;targetHipsHeight=height;
            if (hasTarget) return true;
            System.Array.Copy(targetWorld, shownWorld, targetWorld.Length);
            shownHipsHeight = targetHipsHeight;
            hasTarget = true;
            return true;
        }

        /// <summary>Bind-pose height of each ankle and toe joint above the floor (the character's own sole thickness).</summary>
        void RecordSoleHeights(Animator animator)
        {
            var joints = new[] { HumanBodyBones.LeftFoot, HumanBodyBones.RightFoot, HumanBodyBones.LeftToes, HumanBodyBones.RightToes };
            for (var i = 0; i < joints.Length; i++)
            {
                soleJoints[i] = animator.GetBoneTransform(joints[i]);
                if (soleJoints[i] != null) soleHeights[i] = soleJoints[i].position.y - transform.position.y;
            }
        }

        bool GroundLowestSole()
        {
            var lowest = float.PositiveInfinity;
            for (var i = 0; i < soleJoints.Length; i++)
            {
                if (soleJoints[i] != null) {
                    var height=soleJoints[i].position.y-soleHeights[i];
                    if(!Finite(height))return false;
                    lowest=Mathf.Min(lowest,height);
                }
            }
            if (float.IsPositiveInfinity(lowest)) return true;
            var floatHeight = lowest - transform.position.y;
            if(!Finite(floatHeight))return false;
            // Below the floor: always lift. Slightly above: pull down (proportion mismatch). Well above: a jump.
            if (floatHeight < airborneThreshold) {
                var world=bones[0].position-Vector3.up*floatHeight;
                if(!TryLocalPosition(bones[0],world,out var local))return false;
                bones[0].localPosition=local;
            }
            return true;
        }

        static async Task<T> Deadline<T>(Task<T> operation,double seconds,CancellationToken token)
        {
            if(seconds<=0)throw new TimeoutException();
            using(var timeout=CancellationTokenSource.CreateLinkedTokenSource(token)) {
                var alarm=Task.Delay(TimeSpan.FromSeconds(Math.Min(seconds,3600)),timeout.Token);
                if(await Task.WhenAny(operation,alarm)!=operation) {
                    _=operation.ContinueWith(task=>{var observed=task.Exception;},CancellationToken.None,
                        TaskContinuationOptions.OnlyOnFaulted|TaskContinuationOptions.ExecuteSynchronously,TaskScheduler.Default);
                    token.ThrowIfCancellationRequested();throw new TimeoutException();
                }
                timeout.Cancel();token.ThrowIfCancellationRequested();return await operation;
            }
        }
        static Task Deadline(Task operation,double seconds,CancellationToken token)
            => Deadline(Complete(operation),seconds,token);
        static async Task<bool> Complete(Task operation) {await operation;return true;}

        async Task ReceiveLoopAsync(PairingCredentials credentials,Uri endpoint,int generation,CancellationToken token)
        {
            while(Current(generation)&&!token.IsCancellationRequested) {
                ILiveTransport transport=null;
                try {
                    var protocol=new LiveProtocol(credentials);var helloClock=Stopwatch.StartNew();
                    Status="connecting";transport=TransportFactory!=null?TransportFactory():new WebSocketLiveTransport();
                    activeTransport=transport;
                    await Deadline(transport.ConnectAsync(endpoint,token),5-helloClock.Elapsed.TotalSeconds,token);
                    if(!Current(generation))return;
                    await Deadline(transport.SendAsync(protocol.HelloJSON(),token),5-helloClock.Elapsed.TotalSeconds,token);
                    var lifetime=Stopwatch.StartNew();double remaining=5;
                    while(Current(generation)&&!token.IsCancellationRequested) {
                        var budget=protocol.Acknowledged?remaining-lifetime.Elapsed.TotalSeconds:5-helloClock.Elapsed.TotalSeconds;
                        var text=await Deadline(transport.ReceiveAsync(token),budget,token);
                        if(!Current(generation))return;
                        if(text==null) {
                            if(transport.CloseStatus==WebSocketCloseStatus.PolicyViolation||transport.CloseStatus==WebSocketCloseStatus.ProtocolError||
                                transport.CloseStatus==WebSocketCloseStatus.InvalidMessageType||transport.CloseStatus==WebSocketCloseStatus.InvalidPayloadData)
                                throw new LiveProtocolException("Pairing rejected");
                            break;
                        }
                        var message=protocol.Parse(text);
                        if(message.type=="hello") {
                            ClearStream();remaining=Math.Min(3600,(message.expiresAt-DateTimeOffset.UtcNow.ToUnixTimeMilliseconds())/1000);
                            lifetime.Restart();Status=message.streamId==null?"waiting for Studio":"waiting for frames";
                        } else {
                            latest=message;AcceptedFrameCount++;LastFrameTimestamp=message.t;Status="receiving";
                        }
                    }
                } catch(OperationCanceledException) {return;}
                catch(Exception error) when(error is LiveProtocolException||error is TimeoutException) {
                    if(Current(generation)){ClearStream();Status="pairing rejected";}return;
                } catch(Exception) {
                    if(Current(generation))Status="connection interrupted";
                } finally {
                    if(ReferenceEquals(activeTransport,transport))activeTransport=null;
                    if(transport!=null){transport.Abort();transport.Dispose();}
                }
                if(!Current(generation))return;
                ClearStream();Status="reconnecting";
                try {await Task.Delay(TimeSpan.FromSeconds(ReconnectDelaySeconds),token);}
                catch(OperationCanceledException){return;}
            }
        }

        void OnGUI()
        {
            if (showStatus) GUI.Label(new Rect(10, 10, 600, 24), $"EmoteCap Live Link: {Status}");
        }
    }
}
