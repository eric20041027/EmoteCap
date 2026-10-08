using System;
using System.Collections;
using System.Collections.Generic;
using System.Linq;
using System.Net.WebSockets;
using System.Reflection;
using System.Text;
using System.Threading;
using System.Threading.Tasks;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;
using NUnit.Framework;
using UnityEngine;
using UnityEngine.TestTools;

namespace EmoteCap.Tests
{
    public class LiveReceiverTests
    {
        const string Session="48e7caaf-68f4-4676-a0a3-d8bc04471b8e";
        const string Stream="e31883cb-e2fb-46db-807c-3d274eed6ae8";
        const string Secret="aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
        const string Code=Session+"."+Secret;
        readonly List<ReceiverTestRig> rigs=new List<ReceiverTestRig>();
        static string Hello(string stream=Stream) => new JObject {
            ["type"]="hello",["version"]=2,["sessionId"]=Session,["role"]="sink",
            ["bones"]=new JArray(EmoteCapContract.DrivenBones.Select(b=>b.ToString())),
            ["streamId"]=stream,["expiresAt"]=DateTimeOffset.UtcNow.ToUnixTimeMilliseconds()+60000
        }.ToString(Formatting.None);
        static string Frame(double t,float hips=.95f) => new JObject {
            ["type"]="frame",["t"]=t,["h"]=new JArray(0,hips,0),
            ["r"]=new JArray(Enumerable.Range(0,192).Select(i=>i%4==3?1.0:0.0))
        }.ToString(Formatting.None);
        static void Field(EmoteCapLiveLink receiver,string name,object value)
            => typeof(EmoteCapLiveLink).GetField(name,BindingFlags.Instance|BindingFlags.NonPublic).SetValue(receiver,value);
        EmoteCapLiveLink Create(FakeTransport transport=null)
        {
            var rig=ReceiverRigFactory.Create();rigs.Add(rig);
            Assert.That(rig.Avatar.isValid&&rig.Avatar.isHuman&&rig.Animator.isHuman,Is.True,"Owned test Humanoid must be valid before receiver assertions");
            Field(rig.Receiver,"port",1);Field(rig.Receiver,"smoothTime",0f);Field(rig.Receiver,"groundFeet",false);
            if(transport!=null)rig.Receiver.TransportFactory=()=>transport;
            return rig.Receiver;
        }
        static IEnumerator Until(Func<bool> condition,float seconds=2)
        {
            var deadline=Time.realtimeSinceStartup+seconds;
            while(!condition()&&Time.realtimeSinceStartup<deadline)yield return null;
            Assert.That(condition(),Is.True,"Expected receiver behavior before deadline");
        }
        [UnityTearDown] public IEnumerator Cleanup()
        {
            foreach(var rig in rigs){if(rig.Root!=null)UnityEngine.Object.Destroy(rig.Root);UnityEngine.Object.Destroy(rig.Avatar);}
            rigs.Clear();yield return null;
        }
        [UnityTest] public IEnumerator OriginalProceduralHumanoidIsValid()
        { Create();yield return null;Assert.That(rigs[0].Animator.isHuman,Is.True); }
        [UnityTest] public IEnumerator ReceiverDoesNotConnectBeforeExplicitPairing()
        {
            var transport=new FakeTransport();var receiver=Create(transport);yield return null;
            Assert.That(receiver.Status,Is.EqualTo("disconnected"));Assert.That(transport.ConnectCount,Is.Zero);
        }
        [UnityTest] public IEnumerator ValidPairingIsSentButNeverSerialized()
        {
            var transport=new FakeTransport();var receiver=Create(transport);yield return null;
            Assert.That(receiver.ConnectPairing(Code),Is.True);
            yield return Until(()=>transport.Sent!=null);
            var sent=JObject.Parse(transport.Sent);Assert.That((string)sent["token"],Is.EqualTo(Secret));
            Assert.That(UnityEngine.JsonUtility.ToJson(receiver),Does.Not.Contain(Secret));
            #if UNITY_EDITOR
            Assert.That(UnityEditor.EditorJsonUtility.ToJson(receiver),Does.Not.Contain(Secret));
            #endif
            Assert.That(receiver.Status,Does.Not.Contain(Secret));
        }
        [UnityTest] public IEnumerator InvalidPairingAndNonLoopbackEndpointCannotConnect()
        {
            var transport=new FakeTransport();var receiver=Create(transport);yield return null;
            Assert.That(receiver.ConnectPairing("bad"),Is.False);
            Field(receiver,"host","example.com");Assert.That(receiver.ConnectPairing(Code),Is.False);
            Assert.That(transport.ConnectCount,Is.Zero);Assert.That(receiver.Status,Does.Not.Contain(Secret));
        }
        [UnityTest] public IEnumerator AcceptedFramesAndNullSourceResetAreVisible()
        {
            var transport=new FakeTransport();var receiver=Create(transport);yield return null;
            Assert.That(receiver.ConnectPairing(Code),Is.True);
            transport.Push(Hello());transport.Push(Frame(181));
            yield return Until(()=>receiver.AcceptedFrameCount==1);
            Assert.That(receiver.LastFrameTimestamp,Is.EqualTo(181));
            transport.Push(Hello(null));yield return Until(()=>receiver.LastFrameTimestamp<0);
            transport.Push(Frame(182));yield return Until(()=>receiver.Status=="pairing rejected");
            Assert.That(receiver.AcceptedFrameCount,Is.EqualTo(1));
        }
        [UnityTest] public IEnumerator DisableRejectsLateAcknowledgement()
        {
            var transport=new FakeTransport();var receiver=Create(transport);yield return null;
            Assert.That(receiver.ConnectPairing(Code),Is.True);var generation=receiver.ConnectionGeneration;
            yield return Until(()=>transport.Pending!=null);receiver.enabled=false;
            transport.Push(Hello());yield return null;yield return null;
            Assert.That(receiver.ConnectionGeneration,Is.GreaterThan(generation));
            Assert.That(receiver.AcceptedFrameCount,Is.Zero);Assert.That(transport.Aborted,Is.True);
        }
        [UnityTest] public IEnumerator StopRejectsLateFrameAndDoesNotResumeOnEnable()
        {
            var transport=new FakeTransport();var receiver=Create(transport);yield return null;
            Assert.That(receiver.ConnectPairing(Code),Is.True);transport.Push(Hello());
            yield return Until(()=>receiver.Status=="waiting for frames");
            receiver.StopPairing();transport.Push(Frame(1));yield return null;yield return null;
            Assert.That(receiver.AcceptedFrameCount,Is.Zero);Assert.That(transport.Aborted,Is.True);
            receiver.enabled=false;receiver.enabled=true;yield return null;
            Assert.That(receiver.Status,Is.EqualTo("disconnected"));
        }
        [UnityTest] public IEnumerator NewConnectCannotReceiveTheOldConnectionsFrames()
        {
            var old=new FakeTransport();var current=new FakeTransport();var receiver=Create(old);yield return null;
            Assert.That(receiver.ConnectPairing(Code),Is.True);yield return Until(()=>old.Pending!=null);
            receiver.TransportFactory=()=>current;Assert.That(receiver.ConnectPairing(Code),Is.True);
            old.Push(Hello());old.Push(Frame(90));current.Push(Hello());current.Push(Frame(1));
            yield return Until(()=>receiver.AcceptedFrameCount==1);
            Assert.That(receiver.LastFrameTimestamp,Is.EqualTo(1));Assert.That(old.Aborted,Is.True);
        }
        [UnityTest] public IEnumerator DestroyAbortsTheOwnedPendingConnection()
        {
            var transport=new FakeTransport();var receiver=Create(transport);yield return null;
            Assert.That(receiver.ConnectPairing(Code),Is.True);yield return Until(()=>transport.Pending!=null);
            UnityEngine.Object.Destroy(receiver);yield return null;
            transport.Push(Hello());yield return null;Assert.That(transport.Aborted,Is.True);
        }
        [UnityTest] public IEnumerator DisableRejectsLateFrameAfterAcknowledgement()
        {
            var transport=new FakeTransport();var receiver=Create(transport);yield return null;
            Assert.That(receiver.ConnectPairing(Code),Is.True);transport.Push(Hello());
            yield return Until(()=>receiver.Status=="waiting for frames");receiver.enabled=false;
            transport.Push(Frame(1));yield return null;yield return null;
            Assert.That(receiver.AcceptedFrameCount,Is.Zero);Assert.That(transport.Aborted,Is.True);
        }
        [UnityTest] public IEnumerator StopDuringConnectCannotSendLateCredentials()
        {
            var transport=new FakeTransport {ConnectCompletion=new TaskCompletionSource<bool>()};
            var receiver=Create(transport);yield return null;
            Assert.That(receiver.ConnectPairing(Code),Is.True);receiver.StopPairing();
            transport.ConnectCompletion.TrySetResult(true);yield return null;yield return null;
            Assert.That(transport.Sent,Is.Null);Assert.That(transport.Aborted,Is.True);
            Assert.That(receiver.Status,Is.EqualTo("disconnected"));
        }
        [UnityTest] public IEnumerator BadAckAndPolicyClosureNeverRetry()
        {
            foreach(var policy in new[]{false,true}) {
                var transport=new FakeTransport();var receiver=Create(transport);yield return null;
                Assert.That(receiver.ConnectPairing(Code),Is.True);
                if(policy){transport.CloseStatus=WebSocketCloseStatus.PolicyViolation;transport.Push(null);}else transport.Push("{}");
                yield return Until(()=>receiver.Status=="pairing rejected");
                yield return new WaitForSecondsRealtime(2.2f);
                Assert.That(transport.ConnectCount,Is.EqualTo(1));Assert.That(receiver.AcceptedFrameCount,Is.Zero);
            }
        }
        [UnityTest] public IEnumerator NormalDisconnectWaitsThenReconnects()
        {
            var first=new FakeTransport();var second=new FakeTransport();var receiver=Create(first);var calls=0;
            receiver.TransportFactory=()=>++calls==1?first:second;yield return null;
            Assert.That(receiver.ConnectPairing(Code),Is.True);first.Push(Hello());first.Push(null);
            yield return new WaitForSecondsRealtime(1f);Assert.That(second.ConnectCount,Is.Zero);
            yield return Until(()=>second.ConnectCount==1,2);receiver.StopPairing();
        }
        [UnityTest] public IEnumerator AcknowledgementDeadlineAbortsWithoutRetry()
        {
            var transport=new FakeTransport();var receiver=Create(transport);yield return null;
            Assert.That(receiver.ConnectPairing(Code),Is.True);
            yield return Until(()=>receiver.Status=="pairing rejected",6);
            Assert.That(transport.Aborted,Is.True);Assert.That(transport.ConnectCount,Is.EqualTo(1));
        }
        [UnityTest] public IEnumerator OverflowedTargetPreservesThePreviousPose()
        {
            var transport=new FakeTransport();var receiver=Create(transport);
            rigs[0].Root.transform.localScale=Vector3.one*3;yield return null;
            Assert.That(receiver.ConnectPairing(Code),Is.True);transport.Push(Hello());transport.Push(Frame(1));
            yield return Until(()=>receiver.AcceptedFrameCount==1);yield return null;yield return null;
            var hips=rigs[0].Animator.GetBoneTransform(HumanBodyBones.Hips);var previous=hips.position;
            transport.Push(Frame(2,float.MaxValue/2));yield return Until(()=>receiver.AcceptedFrameCount==2);yield return null;
            Assert.That(hips.position,Is.EqualTo(previous));
            Assert.That(receiver.Status,Is.EqualTo("invalid pose target"));
        }
        [UnityTest] public IEnumerator LatestFrameWinsAndNewStreamRestartsItsTimeline()
        {
            var transport=new FakeTransport();var receiver=Create(transport);yield return null;
            Assert.That(receiver.ConnectPairing(Code),Is.True);
            transport.Push(Hello());transport.Push(Frame(1,1.2f));transport.Push(Frame(2,1.4f));
            yield return Until(()=>receiver.AcceptedFrameCount==2);yield return null;
            Assert.That(rigs[0].Animator.GetBoneTransform(HumanBodyBones.Hips).position.y,Is.EqualTo(1.4f).Within(.0001f));
            transport.Push(Hello("e31883cb-e2fb-46db-807c-3d274eed6ae9"));transport.Push(Frame(0,1.05f));
            yield return Until(()=>receiver.AcceptedFrameCount==3);yield return null;
            Assert.That(receiver.LastFrameTimestamp,Is.Zero);
            Assert.That(rigs[0].Animator.GetBoneTransform(HumanBodyBones.Hips).position.y,Is.EqualTo(1.05f).Within(.0001f));
        }
        [UnityTest] public IEnumerator RotatedRootRetainsCanonicalWorldDeltaRetargeting()
        {
            var transport=new FakeTransport();var receiver=Create(transport);
            rigs[0].Root.transform.rotation=Quaternion.Euler(0,37,0);yield return null;
            var root=rigs[0].Root.transform.rotation;
            var arm=rigs[0].Animator.GetBoneTransform(HumanBodyBones.RightUpperArm);var rest=arm.rotation;
            var frame=JObject.Parse(Frame(1));frame["r"][36]=Math.Sqrt(.5);frame["r"][39]=Math.Sqrt(.5);
            Assert.That(receiver.ConnectPairing(Code),Is.True);transport.Push(Hello());transport.Push(frame.ToString(Formatting.None));
            yield return Until(()=>receiver.AcceptedFrameCount==1);yield return null;
            var expected=root*Quaternion.Euler(90,0,0)*Quaternion.Inverse(root)*rest;
            Assert.That(Quaternion.Angle(arm.rotation,expected),Is.LessThan(.02f));
        }
        [Test] public void ProductionTransportRejectsBinaryAndOversizeFragments()
        {
            foreach(var frames in new[]{new[]{new RawPart(new byte[]{1},WebSocketMessageType.Binary,true)},
                new[]{new RawPart(new byte[16384],WebSocketMessageType.Text,false),new RawPart(new byte[]{1},WebSocketMessageType.Text,true)}}) {
                using(var transport=new WebSocketLiveTransport(new RawSocket(frames)))
                    Assert.ThrowsAsync<LiveProtocolException>(async()=>await transport.ReceiveAsync(CancellationToken.None));
            }
        }
        [Test] public void ProductionTransportPreservesSplitUtf8AndClearsOnClose()
        {
            var raw=Encoding.UTF8.GetBytes("a界z");
            using(var transport=new WebSocketLiveTransport(new RawSocket(new[]{
                new RawPart(raw.Take(2).ToArray(),WebSocketMessageType.Text,false),
                new RawPart(raw.Skip(2).ToArray(),WebSocketMessageType.Text,true)})))
                Assert.That(transport.ReceiveAsync(CancellationToken.None).GetAwaiter().GetResult(),Is.EqualTo("a界z"));
        }
        internal sealed class FakeTransport : ILiveTransport
        {
            readonly Queue<string> queued=new Queue<string>();
            internal TaskCompletionSource<string> Pending;
            internal TaskCompletionSource<bool> ConnectCompletion;
            internal int ConnectCount;internal string Sent;internal bool Aborted;
            public WebSocketCloseStatus? CloseStatus {get;set;}
            public Task ConnectAsync(Uri uri,CancellationToken token){ConnectCount++;return ConnectCompletion==null?Task.CompletedTask:ConnectCompletion.Task;}
            public Task SendAsync(string text,CancellationToken token){Sent=text;return Task.CompletedTask;}
            public Task<string> ReceiveAsync(CancellationToken token)
            {
                if(queued.Count>0)return Task.FromResult(queued.Dequeue());
                Pending=new TaskCompletionSource<string>();return Pending.Task;
            }
            internal void Push(string text){if(Pending!=null){var pending=Pending;Pending=null;pending.TrySetResult(text);}else queued.Enqueue(text);}
            public void Abort(){Aborted=true;}
            public void Dispose(){}
        }
        internal sealed class RawPart
        {
            internal readonly byte[] Bytes;internal readonly WebSocketMessageType Kind;internal readonly bool End;
            internal RawPart(byte[] bytes,WebSocketMessageType kind,bool end){Bytes=bytes;Kind=kind;End=end;}
        }
        internal sealed class RawSocket : WebSocket
        {
            readonly Queue<RawPart> parts;RawPart current;int offset;
            internal RawSocket(IEnumerable<RawPart> frames){parts=new Queue<RawPart>(frames);}
            public override WebSocketCloseStatus? CloseStatus=>null;
            public override string CloseStatusDescription=>null;
            public override WebSocketState State=>WebSocketState.Open;
            public override string SubProtocol=>null;
            public override void Abort(){}
            public override void Dispose(){}
            public override Task CloseAsync(WebSocketCloseStatus status,string description,CancellationToken token)=>Task.CompletedTask;
            public override Task CloseOutputAsync(WebSocketCloseStatus status,string description,CancellationToken token)=>Task.CompletedTask;
            public override Task SendAsync(ArraySegment<byte> bytes,WebSocketMessageType kind,bool end,CancellationToken token)=>Task.CompletedTask;
            public override Task<WebSocketReceiveResult> ReceiveAsync(ArraySegment<byte> bytes,CancellationToken token)
            {
                if(current==null){current=parts.Dequeue();offset=0;}
                var count=Math.Min(bytes.Count,current.Bytes.Length-offset);Array.Copy(current.Bytes,offset,bytes.Array,bytes.Offset,count);offset+=count;
                var end=offset==current.Bytes.Length&&current.End;var kind=current.Kind;
                if(offset==current.Bytes.Length)current=null;
                return Task.FromResult(new WebSocketReceiveResult(count,kind,end));
            }
        }
    }
}
