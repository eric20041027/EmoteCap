using System;
using System.IO;
using System.Linq;
using System.Text;
using System.Text.RegularExpressions;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;

namespace EmoteCap
{
    public readonly struct PairingCredentials
    {
        readonly string sessionId;
        readonly string secret;
        public string SessionId => sessionId;
        internal string Secret => secret;
        PairingCredentials(string sessionId,string secret)
        { this.sessionId=sessionId;this.secret=secret; }
        internal static bool IsIdentity(string value)
        {
            return value!=null && value.Length==36 && Guid.TryParseExact(value,"D",out var id)
                && id.ToString("D")==value && value[14]=='4' && "89ab".Contains(value[19]);
        }
        public static bool TryParse(string value,out PairingCredentials credentials)
        {
            credentials=default;
            if(value==null||value.Length!=80||value[36]!='.'||!IsIdentity(value.Substring(0,36)))return false;
            var token=value.Substring(37);
            if(token.Any(c=>!(c>='a'&&c<='z'||c>='A'&&c<='Z'||c>='0'&&c<='9'||c=='_'||c=='-')))return false;
            credentials=new PairingCredentials(value.Substring(0,36),token);return true;
        }
        public override string ToString() => "Pairing credentials";
    }
    public sealed class LiveProtocolException : Exception
    { public LiveProtocolException(string message) : base(message) {} }
    public sealed class LiveProtocol
    {
        readonly PairingCredentials credentials;
        static readonly UTF8Encoding Utf8=new UTF8Encoding(false,true);
        // Lexical gate only: JsonTextReader still owns JSON structure and token parsing.
        // Newtonsoft otherwise accepts single quotes, comments, hex and trailing commas.
        static readonly Regex JsonLexeme=new Regex(
            "\\G(?:[ \\t\\r\\n]+|\"(?:[^\"\\\\\\x00-\\x1f]|\\\\(?:[\"\\\\/bfnrt]|u[0-9a-fA-F]{4}))*\"|"+
            "-?(?:0|[1-9][0-9]*)(?:\\.[0-9]+)?(?:[eE][+-]?[0-9]+)?|true|false|null|[{}\\[\\],:])",
            RegexOptions.CultureInvariant,TimeSpan.FromSeconds(1));
        double? lastTime;
        double expiresAt;
        public bool Acknowledged { get; private set; }
        public string StreamId { get; private set; }
        public LiveProtocol(PairingCredentials credentials)
        {
            if(!PairingCredentials.IsIdentity(credentials.SessionId))throw new ArgumentException("Invalid pairing credentials");
            this.credentials=credentials;
        }
        public string HelloJSON() => new JObject {
            ["type"]="hello",["version"]=2,
            ["bones"]=new JArray(EmoteCapContract.DrivenBones.Select(b=>b.ToString())),
            ["sessionId"]=credentials.SessionId,["token"]=credentials.Secret
        }.ToString(Formatting.None);
        static LiveProtocolException Invalid() => new LiveProtocolException("Incompatible live message");
        static void Fields(JObject obj,params string[] fields)
        {
            if(!obj.Properties().Select(p=>p.Name).OrderBy(n=>n,StringComparer.Ordinal)
                .SequenceEqual(fields.OrderBy(n=>n,StringComparer.Ordinal)))throw Invalid();
        }
        static string String(JToken token)
        { if(token==null||token.Type!=JTokenType.String)throw Invalid();return (string)token; }
        static double Number(JToken token)
        {
            if(token==null||(token.Type!=JTokenType.Integer&&token.Type!=JTokenType.Float))throw Invalid();
            var number=token.Value<double>();
            if(double.IsNaN(number)||double.IsInfinity(number))throw Invalid();return number;
        }
        static float[] Numbers(JToken token,int count)
        {
            if(!(token is JArray list)||list.Count!=count)throw Invalid();
            return list.Select(item=> {
                var number=Number(item);
                if(number>float.MaxValue||number< -float.MaxValue)throw Invalid();
                return (float)number;
            }).ToArray();
        }
        static JObject Object(string text)
        {
            if(text==null||Utf8.GetByteCount(text)>16384)throw Invalid();
            var position=0;var previous="";
            while(position<text.Length) {
                var match=JsonLexeme.Match(text,position);
                if(!match.Success||match.Index!=position)throw Invalid();
                position+=match.Length;var lexeme=match.Value;
                if(string.IsNullOrWhiteSpace(lexeme))continue;
                if((lexeme=="}"||lexeme=="]")&&previous==",")throw Invalid();
                if(lexeme[0]!='"'&&lexeme.Length>1||char.IsDigit(lexeme[0])) {
                    if(position<text.Length&&!" \t\r\n{}[],:".Contains(text[position]))throw Invalid();
                }
                previous=lexeme;
            }
            using(var input=new StringReader(text))
            using(var reader=new JsonTextReader(input) { MaxDepth=8,DateParseHandling=DateParseHandling.None })
            {
                var token=JToken.ReadFrom(reader,new JsonLoadSettings { DuplicatePropertyNameHandling=DuplicatePropertyNameHandling.Error });
                if(!(token is JObject obj)||reader.Read())throw Invalid();return obj;
            }
        }
        public LiveMessage Parse(string text)
        {
            try {
                var obj=Object(text);var kind=String(obj["type"]);
                if(kind=="hello") {
                    Fields(obj,"type","version","bones","sessionId","role","streamId","expiresAt");
                    if(obj["version"].Type!=JTokenType.Integer||Number(obj["version"])!=2||
                        String(obj["sessionId"])!=credentials.SessionId||String(obj["role"])!="sink")throw Invalid();
                    if(!(obj["bones"] is JArray names)||names.Count!=48||
                        !names.Select(String).SequenceEqual(EmoteCapContract.DrivenBones.Select(b=>b.ToString())))throw Invalid();
                    var stream=obj["streamId"].Type==JTokenType.Null?null:String(obj["streamId"]);
                    if(stream!=null&&!PairingCredentials.IsIdentity(stream))throw Invalid();
                    var expiry=Number(obj["expiresAt"]);
                    if(expiry<=DateTimeOffset.UtcNow.ToUnixTimeMilliseconds())throw Invalid();
                    Reset();Acknowledged=true;StreamId=stream;expiresAt=expiry;
                    return new LiveMessage {type="hello",version=2,sessionId=credentials.SessionId,role="sink",streamId=stream,expiresAt=expiry};
                }
                if(kind!="frame"||!Acknowledged||StreamId==null||expiresAt<=DateTimeOffset.UtcNow.ToUnixTimeMilliseconds())throw Invalid();
                Fields(obj,"type","t","h","r");
                var time=Number(obj["t"]);
                if(time<0||(lastTime.HasValue&&time<=lastTime.Value))throw Invalid();
                var hips=Numbers(obj["h"],3);var rotations=Numbers(obj["r"],192);
                if(Math.Abs(Number(obj["h"][0]))>1e-6||Math.Abs(Number(obj["h"][2]))>1e-6)throw Invalid();
                for(var i=0;i<192;i+=4) {
                    double squared=0;
                    for(var j=0;j<4;j++){var value=Number(obj["r"][i+j]);squared+=value*value;}
                    if(squared<.98*.98||squared>1.02*1.02)throw Invalid();
                }
                lastTime=time;return new LiveMessage {type="frame",t=time,h=hips,r=rotations};
            } catch(LiveProtocolException) { Reset();throw; }
            catch(Exception error) when(error is JsonException||error is ArgumentException||error is FormatException||
                error is OverflowException||error is InvalidCastException||error is RegexMatchTimeoutException) {
                Reset();throw Invalid();
            }
        }
        public void Reset() { Acknowledged=false;StreamId=null;lastTime=null;expiresAt=0; }
    }
    public sealed class LiveMessageBuffer
    {
        readonly byte[] pending=new byte[16384];
        static readonly UTF8Encoding Utf8=new UTF8Encoding(false,true);
        int length;
        public string Append(byte[] bytes,int offset,int count,bool end)
        {
            try {
                if(bytes==null||offset<0||count<0||offset>bytes.Length-count||count>pending.Length-length)
                    throw new LiveProtocolException("Invalid live fragment");
                Buffer.BlockCopy(bytes,offset,pending,length,count);length+=count;
                if(!end)return null;
                var text=Utf8.GetString(pending,0,length);Reset();return text;
            } catch(DecoderFallbackException) { Reset();throw new LiveProtocolException("Invalid live UTF-8"); }
            catch(LiveProtocolException) { Reset();throw; }
        }
        public void Reset() { Array.Clear(pending,0,length);length=0; }
    }
}
