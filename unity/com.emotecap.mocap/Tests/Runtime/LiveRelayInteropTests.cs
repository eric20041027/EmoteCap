using System;
using System.Collections;
using System.Collections.Generic;
using System.Net.Http;
using System.Reflection;
using System.Text;
using System.Threading.Tasks;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;
using NUnit.Framework;
using UnityEngine;
using UnityEngine.TestTools;

namespace EmoteCap.Tests
{
    public class LiveRelayInteropTests
    {
        readonly List<ReceiverTestRig> rigs=new List<ReceiverTestRig>();
        Uri endpoint;
        [SetUp] public void OwnedFixtureIsRequired()
        {
            var value=Environment.GetEnvironmentVariable("EMOTECAP_TEST_RELAY_URL");
            Assert.That(Uri.TryCreate(value,UriKind.Absolute,out endpoint)&&endpoint.Scheme=="http"&&
                endpoint.Host=="127.0.0.1"&&endpoint.UserInfo==""&&endpoint.Query==""&&endpoint.Fragment=="",Is.True,
                "Run this suite with scripts/unity-relay-test.py and its owned relay");
        }
        async Task<JObject> Api(string path,JObject payload=null)
        {
            using(var handler=new HttpClientHandler {UseProxy=false})
            using(var client=new HttpClient(handler) {Timeout=TimeSpan.FromSeconds(5),MaxResponseContentBufferSize=16384}) {
                var url=new Uri(endpoint,path);
                using(var reply=payload==null?await client.GetAsync(url):await client.PostAsync(url,
                    new StringContent(payload.ToString(Formatting.None),Encoding.UTF8,"application/json"))) {
                    if(!reply.IsSuccessStatusCode)throw new InvalidOperationException("Owned fixture control failed");
                    return JObject.Parse(await reply.Content.ReadAsStringAsync());
                }
            }
        }
        static IEnumerator Done(Task operation)
        {
            var deadline=Time.realtimeSinceStartup+6;
            while(!operation.IsCompleted&&Time.realtimeSinceStartup<deadline)yield return null;
            Assert.That(operation.IsCompleted,Is.True,"Owned fixture operation must complete");
            operation.GetAwaiter().GetResult();
        }
        static IEnumerator Until(Func<bool> condition,float seconds=5)
        {
            var deadline=Time.realtimeSinceStartup+seconds;
            while(!condition()&&Time.realtimeSinceStartup<deadline)yield return null;
            Assert.That(condition(),Is.True,"Real receiver behavior must occur before deadline");
        }
        EmoteCapLiveLink Receiver()
        {
            var rig=ReceiverRigFactory.Create();rigs.Add(rig);
            Assert.That(rig.Avatar.isValid&&rig.Avatar.isHuman,Is.True);
            typeof(EmoteCapLiveLink).GetField("host",BindingFlags.Instance|BindingFlags.NonPublic).SetValue(rig.Receiver,"127.0.0.1");
            typeof(EmoteCapLiveLink).GetField("port",BindingFlags.Instance|BindingFlags.NonPublic).SetValue(rig.Receiver,endpoint.Port);
            return rig.Receiver; // No transport injection: actual default ClientWebSocket.
        }
        Task<JObject> Post(string path) => Api(path,new JObject());
        Task<JObject> Issue(double seconds=60) => Api("/fixture/issue",new JObject {["ttlSeconds"]=seconds});
        Task<JObject> Send(string id,double t,double height=.95) => Api("/fixture/source/"+id+"/frame",new JObject {["t"]=t,["height"]=height});
        IEnumerator Sinks(int expected)
        {
            var deadline=Time.realtimeSinceStartup+5;var actual=-1;
            while(actual!=expected&&Time.realtimeSinceStartup<deadline) {
                var info=Api("/fixture/info");yield return Done(info);actual=(int)info.Result["sinks"];
                if(actual!=expected)yield return null;
            }
            Assert.That(actual,Is.EqualTo(expected));
        }
        [UnityTearDown] public IEnumerator Cleanup()
        {
            foreach(var rig in rigs){if(rig.Root!=null)UnityEngine.Object.Destroy(rig.Root);UnityEngine.Object.Destroy(rig.Avatar);}
            rigs.Clear();yield return null;yield return Done(Post("/fixture/reset"));
        }
        [UnityTest] public IEnumerator PairedRelayDeliversItsFixtureAndStopClosesSink()
        {
            var issued=Issue();yield return Done(issued);var id=(string)issued.Result["id"];
            var receiver=Receiver();yield return null;
            Assert.That(receiver.ConnectPairing((string)issued.Result["pairingCode"]),Is.True);
            yield return Until(()=>receiver.Status=="waiting for Studio");yield return Sinks(1);
            yield return Done(Post("/fixture/source/"+id+"/start"));yield return Done(Send(id,181));
            yield return Until(()=>receiver.AcceptedFrameCount==1);
            Assert.That(receiver.LastFrameTimestamp,Is.EqualTo(181));
            receiver.StopPairing();yield return Sinks(0);
        }
        [UnityTest] public IEnumerator WrongSecretAndRevokedCodeNeverDrivePose()
        {
            var issued=Issue();yield return Done(issued);var id=(string)issued.Result["id"];
            var code=(string)issued.Result["pairingCode"];var wrong=code.Substring(0,79)+(code[79]=='a'?"b":"a");
            var receiver=Receiver();yield return null;
            Assert.That(receiver.ConnectPairing(wrong),Is.True);
            yield return Until(()=>receiver.Status=="pairing rejected");Assert.That(receiver.AcceptedFrameCount,Is.Zero);
            Assert.That(receiver.ConnectPairing(code),Is.True);yield return Sinks(1);
            yield return Done(Post("/fixture/source/"+id+"/start"));yield return Done(Send(id,1));
            yield return Until(()=>receiver.AcceptedFrameCount==1);
            yield return Done(Post("/fixture/revoke/"+id));yield return Until(()=>receiver.Status=="pairing rejected");
            Assert.That(receiver.ConnectPairing(code),Is.True);
            yield return Until(()=>receiver.Status=="pairing rejected");Assert.That(receiver.AcceptedFrameCount,Is.Zero);
            yield return Sinks(0);
        }
        [UnityTest] public IEnumerator NewSourceRestartsTimeAfterNullSourceAnnouncement()
        {
            var issued=Issue();yield return Done(issued);var id=(string)issued.Result["id"];
            var receiver=Receiver();yield return null;Assert.That(receiver.ConnectPairing((string)issued.Result["pairingCode"]),Is.True);
            yield return Until(()=>receiver.Status=="waiting for Studio");
            yield return Done(Post("/fixture/source/"+id+"/start"));yield return Done(Send(id,20));
            yield return Until(()=>receiver.LastFrameTimestamp==20);
            yield return Done(Post("/fixture/source/"+id+"/stop"));yield return Until(()=>receiver.LastFrameTimestamp<0);
            yield return Done(Post("/fixture/source/"+id+"/start"));yield return Done(Send(id,0,1.15));
            yield return Until(()=>receiver.AcceptedFrameCount==2);Assert.That(receiver.LastFrameTimestamp,Is.Zero);
        }
        [UnityTest] public IEnumerator PairingsAndCompetingSourceStayIsolated()
        {
            var first=Issue();yield return Done(first);var second=Issue();yield return Done(second);
            var idA=(string)first.Result["id"];var idB=(string)second.Result["id"];
            var a=Receiver();var b=Receiver();yield return null;
            Assert.That(a.ConnectPairing((string)first.Result["pairingCode"]),Is.True);
            Assert.That(b.ConnectPairing((string)second.Result["pairingCode"]),Is.True);yield return Sinks(2);
            yield return Done(Post("/fixture/source/"+idA+"/start"));yield return Done(Post("/fixture/source/"+idB+"/start"));
            yield return Done(Send(idA,11));yield return Done(Send(idB,22));
            yield return Until(()=>a.AcceptedFrameCount==1&&b.AcceptedFrameCount==1);
            Assert.That(a.LastFrameTimestamp,Is.EqualTo(11));Assert.That(b.LastFrameTimestamp,Is.EqualTo(22));
            var compete=Post("/fixture/source/"+idA+"/compete");yield return Done(compete);
            Assert.That((bool)compete.Result["rejected"],Is.True);
            yield return Done(Send(idA,12));yield return Until(()=>a.AcceptedFrameCount==2);
            Assert.That(b.AcceptedFrameCount,Is.EqualTo(1));Assert.That(b.LastFrameTimestamp,Is.EqualTo(22));
        }
        [UnityTest] public IEnumerator ExpiredPairingStopsWithoutRetry()
        {
            var issued=Issue(2);yield return Done(issued);var id=(string)issued.Result["id"];
            var receiver=Receiver();yield return null;Assert.That(receiver.ConnectPairing((string)issued.Result["pairingCode"]),Is.True);
            yield return Until(()=>receiver.Status=="waiting for Studio");
            yield return Done(Post("/fixture/source/"+id+"/start"));yield return Done(Send(id,1));
            yield return Until(()=>receiver.AcceptedFrameCount==1);
            yield return Until(()=>receiver.Status=="pairing rejected");yield return new WaitForSecondsRealtime(2.2f);
            yield return Sinks(0);Assert.That(receiver.AcceptedFrameCount,Is.EqualTo(1));
        }
        [UnityTest] public IEnumerator OrdinaryClosureReconnectsThenReceivesNewFrame()
        {
            var issued=Issue();yield return Done(issued);var id=(string)issued.Result["id"];
            var receiver=Receiver();yield return null;Assert.That(receiver.ConnectPairing((string)issued.Result["pairingCode"]),Is.True);
            yield return Until(()=>receiver.Status=="waiting for Studio");
            yield return Done(Post("/fixture/source/"+id+"/start"));yield return Done(Send(id,1));
            yield return Until(()=>receiver.AcceptedFrameCount==1);yield return Done(Post("/fixture/drop/"+id));
            yield return Until(()=>receiver.Status=="reconnecting");yield return Sinks(0);yield return Sinks(1);
            yield return Done(Send(id,2));yield return Until(()=>receiver.AcceptedFrameCount==2);
            Assert.That(receiver.LastFrameTimestamp,Is.EqualTo(2));
        }
        [UnityTest] public IEnumerator DisableClosesRealSinkAndRejectsFurtherSourceFrames()
        {
            var issued=Issue();yield return Done(issued);var id=(string)issued.Result["id"];
            var receiver=Receiver();yield return null;Assert.That(receiver.ConnectPairing((string)issued.Result["pairingCode"]),Is.True);
            yield return Until(()=>receiver.Status=="waiting for Studio");
            yield return Done(Post("/fixture/source/"+id+"/start"));yield return Done(Send(id,1));
            yield return Until(()=>receiver.AcceptedFrameCount==1);receiver.enabled=false;yield return Sinks(0);
            yield return Done(Send(id,2));yield return new WaitForSecondsRealtime(.2f);
            Assert.That(receiver.AcceptedFrameCount,Is.EqualTo(1));receiver.enabled=true;yield return null;
            Assert.That(receiver.Status,Is.EqualTo("disconnected"));yield return Sinks(0);
        }
    }
}
