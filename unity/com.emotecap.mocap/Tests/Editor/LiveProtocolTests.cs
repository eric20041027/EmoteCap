using System;
using System.Linq;
using System.Text;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;
using NUnit.Framework;

namespace EmoteCap.Tests
{
    public class LiveProtocolTests
    {
        const string Session = "48e7caaf-68f4-4676-a0a3-d8bc04471b8e";
        const string Stream = "e31883cb-e2fb-46db-807c-3d274eed6ae8";
        const string OtherStream = "e31883cb-e2fb-46db-807c-3d274eed6ae9";
        const string Secret = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
        const string Code = Session + "." + Secret;

        static LiveProtocol Create()
        {
            PairingCredentials.TryParse(Code, out var credentials);
            return new LiveProtocol(credentials);
        }
        static JObject Hello(string stream = Stream) => new JObject {
            ["type"]="hello", ["version"]=2,
            ["bones"]=new JArray(EmoteCapContract.DrivenBones.Select(b => b.ToString())),
            ["sessionId"]=Session, ["role"]="sink", ["streamId"]=stream,
            ["expiresAt"]=DateTimeOffset.UtcNow.ToUnixTimeMilliseconds()+60000
        };
        static JObject Frame(double time = 181) => new JObject {
            ["type"]="frame", ["t"]=time, ["h"]=new JArray(0,.95,0),
            ["r"]=new JArray(Enumerable.Range(0,192).Select(i => i%4==3 ? 1.0 : 0.0))
        };
        static string Text(JObject value) => value.ToString(Formatting.None);
        static LiveProtocol Ready()
        {
            var protocol=Create(); protocol.Parse(Text(Hello())); return protocol;
        }

        [Test] public void ValidCredentialsProduceOnlyTheRequiredSinkHello()
        {
            Assert.That(PairingCredentials.TryParse(Code,out var credentials),Is.True);
            Assert.That(credentials.SessionId,Is.EqualTo(Session));
            Assert.That(credentials.ToString(),Does.Not.Contain(Secret));
            var hello=JObject.Parse(new LiveProtocol(credentials).HelloJSON());
            Assert.That(hello.Properties().Select(p=>p.Name),Is.EquivalentTo(new[]{"type","version","bones","sessionId","token"}));
            Assert.That((string)hello["token"],Is.EqualTo(Secret));
            Assert.That((string)hello["sessionId"],Is.EqualTo(Session));
            Assert.That((int)hello["version"],Is.EqualTo(2));
            Assert.That(hello["bones"].Count(),Is.EqualTo(48));
        }
        [TestCase(null)] [TestCase("")] [TestCase("short")]
        [TestCase("48e7caaf-68f4-1676-a0a3-d8bc04471b8e.aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa")]
        [TestCase("48e7caaf-68f4-4676-70a3-d8bc04471b8e.aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa")]
        [TestCase("48E7caaf-68f4-4676-a0a3-d8bc04471b8e.aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa")]
        [TestCase("48e7caaf-68f4-4676-a0a3-d8bc04471b8e.aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa=")]
        public void MalformedCredentialsCannotBeUsed(string value)
        { Assert.That(PairingCredentials.TryParse(value,out _),Is.False); }
        [Test] public void WhitespaceAndOverlongCredentialsAreRejected()
        {
            foreach(var code in new[]{" "+Code,Code+"\n",Code+"a",Code.Replace(".","..")})
                Assert.That(PairingCredentials.TryParse(code,out _),Is.False);
        }
        [Test] public void FrameBeforeAcknowledgementIsRejected()
        { Assert.Throws<LiveProtocolException>(()=>Create().Parse(Text(Frame()))); }
        [Test] public void ValidAcknowledgementAndLongLiveTimelineAreAccepted()
        {
            var protocol=Ready(); Assert.That(protocol.Acknowledged,Is.True);
            Assert.That(protocol.StreamId,Is.EqualTo(Stream));
            var frame=protocol.Parse(Text(Frame(181.123456789)));
            Assert.That(frame.t,Is.EqualTo(181.123456789));
            Assert.That(frame.r.Length,Is.EqualTo(192));
            Assert.That(frame.h[1],Is.EqualTo(.95f));
        }
        [TestCase("role","source")] [TestCase("sessionId","e31883cb-e2fb-46db-807c-3d274eed6ae8")]
        [TestCase("streamId","bad")] [TestCase("type","clip_ready")]
        public void IncompatibleAcknowledgementIsRejected(string field,string value)
        { var hello=Hello();hello[field]=value;Assert.Throws<LiveProtocolException>(()=>Create().Parse(Text(hello))); }
        [TestCase("true")] [TestCase("\"2\"")] [TestCase("2.0")] [TestCase("1")]
        public void VersionMustBeExactInteger(string value)
        { Assert.Throws<LiveProtocolException>(()=>Create().Parse(Text(Hello()).Replace("\"version\":2","\"version\":"+value))); }
        [TestCase("missing")] [TestCase("extra")] [TestCase("reordered-bones")]
        [TestCase("wrong-bone")] [TestCase("expired")] [TestCase("duplicate")]
        public void InvalidHelloShapeOrLifetimeIsRejected(string change)
        {
            var hello=Hello();
            if(change=="missing")hello.Remove("role");
            if(change=="extra")hello["token"]=Secret;
            if(change=="reordered-bones") { var bones=(JArray)hello["bones"]; var item=bones[0];bones[0]=bones[1];bones[1]=item; }
            if(change=="wrong-bone")hello["bones"][0]="head";
            if(change=="expired")hello["expiresAt"]=1;
            var text=Text(hello);
            if(change=="duplicate")text=text.Insert(1,"\"role\":\"sink\",");
            Assert.Throws<LiveProtocolException>(()=>Create().Parse(text));
        }
        [TestCase("negative")] [TestCase("bool")] [TestCase("string")]
        [TestCase("nan")] [TestCase("infinite")] [TestCase("overflow")]
        [TestCase("hips-horizontal")] [TestCase("hips-overflow")] [TestCase("short-rotations")]
        [TestCase("nonunit")] [TestCase("extra")] [TestCase("duplicate")]
        [TestCase("short-hips")] [TestCase("coerced-rotation")]
        public void InvalidPoseCannotReachTransforms(string change)
        {
            var frame=Frame();var text="";
            switch(change) {
                case "negative":frame["t"]=-1;break;
                case "bool":frame["t"]=true;break;
                case "string":frame["t"]="181";break;
                case "hips-horizontal":frame["h"][0]=.001;break;
                case "hips-overflow":frame["h"][1]=1e100;break;
                case "short-hips":((JArray)frame["h"]).RemoveAt(2);break;
                case "short-rotations":((JArray)frame["r"]).RemoveAt(191);break;
                case "nonunit":frame["r"][3]=.5;break;
                case "coerced-rotation":frame["r"][0]="0";break;
                case "extra":frame["token"]=Secret;break;
            }
            text=Text(frame);
            if(change=="duplicate")text=text.Insert(1,"\"t\":1,");
            if(change=="nan"||change=="infinite"||change=="overflow")text=text.Replace("\"t\":181.0","\"t\":"+(change=="nan"?"NaN":change=="infinite"?"Infinity":"1e400"));
            Assert.Throws<LiveProtocolException>(()=>Ready().Parse(text));
        }
        [Test] public void DuplicateOrReversedTimesRejectAndNewStreamsResetTiming()
        {
            var protocol=Ready();protocol.Parse(Text(Frame(200)));
            Assert.Throws<LiveProtocolException>(()=>protocol.Parse(Text(Frame(200))));
            Assert.Throws<LiveProtocolException>(()=>protocol.Parse(Text(Frame(199))));
            protocol.Parse(Text(Hello(OtherStream)));
            Assert.That(protocol.Parse(Text(Frame(0))).t,Is.Zero);
            protocol.Parse(Text(Hello(null)));
            Assert.That(protocol.StreamId,Is.Null);
            Assert.Throws<LiveProtocolException>(()=>protocol.Parse(Text(Frame(1))));
            protocol.Reset();Assert.That(protocol.Acknowledged,Is.False);
        }
        [TestCase("[]")] [TestCase("null")] [TestCase("{} {}")] [TestCase("{bad}")]
        [TestCase("{\"type\":\"hello\",\"x\":[[[[[[[[[0]]]]]]]]]} ")]
        public void MalformedOrDeepJsonIsRejected(string text)
        { Assert.Throws<LiveProtocolException>(()=>Create().Parse(text)); }
        [TestCase("single-quotes")] [TestCase("unquoted")] [TestCase("trailing-comma")]
        [TestCase("comment")] [TestCase("hex")] [TestCase("plus")]
        public void JsonNetExtensionsCannotRelaxTheWireGrammar(string change)
        {
            var text=Text(change=="hex"||change=="plus"?Frame():Hello());
            if(change=="single-quotes")text=text.Replace('"','\'');
            if(change=="unquoted")text=text.Replace("\"type\":","type:");
            if(change=="trailing-comma")text=text.Insert(text.Length-1,",");
            if(change=="comment")text="/*wire comment*/"+text;
            if(change=="hex")text=text.Replace("\"t\":181.0","\"t\":0xB5");
            if(change=="plus")text=text.Replace("\"t\":181.0","\"t\":+181.0");
            var protocol=change=="hex"||change=="plus"?Ready():Create();
            Assert.Throws<LiveProtocolException>(()=>protocol.Parse(text));
        }
        [Test] public void OversizedUtf8JsonIsRejectedBeforeParsing()
        { Assert.Throws<LiveProtocolException>(()=>Create().Parse(new string('界',6000))); }
        [Test] public void FragmentBufferPreservesSplitUtf8AndClearsAfterCompleteMessage()
        {
            var buffer=new LiveMessageBuffer();var bytes=Encoding.UTF8.GetBytes("a界z");
            Assert.That(buffer.Append(bytes,0,2,false),Is.Null);
            Assert.That(buffer.Append(bytes,2,bytes.Length-2,true),Is.EqualTo("a界z"));
            Assert.That(buffer.Append(new byte[]{65},0,1,true),Is.EqualTo("A"));
        }
        [Test] public void WholeMessageLimitAndInvalidUtf8ClearPendingFragments()
        {
            var buffer=new LiveMessageBuffer();var bytes=Enumerable.Repeat((byte)65,16384).ToArray();
            Assert.That(buffer.Append(bytes,0,16384,true).Length,Is.EqualTo(16384));
            buffer.Append(bytes,0,16384,false);
            Assert.Throws<LiveProtocolException>(()=>buffer.Append(bytes,0,1,true));
            Assert.That(buffer.Append(new byte[]{66},0,1,true),Is.EqualTo("B"));
            Assert.Throws<LiveProtocolException>(()=>buffer.Append(new byte[]{0xff},0,1,true));
            Assert.That(buffer.Append(new byte[]{67},0,1,true),Is.EqualTo("C"));
            buffer.Append(new byte[]{65},0,1,false);buffer.Reset();
            Assert.That(buffer.Append(new byte[]{68},0,1,true),Is.EqualTo("D"));
        }
    }
}
