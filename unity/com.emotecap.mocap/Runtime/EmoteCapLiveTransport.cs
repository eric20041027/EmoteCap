using System;
using System.Net.WebSockets;
using System.Text;
using System.Threading;
using System.Threading.Tasks;

namespace EmoteCap
{
    internal interface ILiveTransport : IDisposable
    {
        WebSocketCloseStatus? CloseStatus { get; }
        Task ConnectAsync(Uri uri,CancellationToken token);
        Task SendAsync(string text,CancellationToken token);
        Task<string> ReceiveAsync(CancellationToken token);
        void Abort();
    }
    internal sealed class WebSocketLiveTransport : ILiveTransport
    {
        readonly WebSocket socket;
        readonly LiveMessageBuffer assembler=new LiveMessageBuffer();
        readonly byte[] fragment=new byte[4096];
        bool disposed;
        public WebSocketCloseStatus? CloseStatus => socket.CloseStatus;
        public WebSocketLiveTransport() : this(new ClientWebSocket()) {}
        internal WebSocketLiveTransport(WebSocket socket)
        { this.socket=socket??throw new ArgumentNullException(nameof(socket)); }
        public Task ConnectAsync(Uri uri,CancellationToken token) => ((ClientWebSocket)socket).ConnectAsync(uri,token);
        public Task SendAsync(string text,CancellationToken token)
        {
            var bytes=new UTF8Encoding(false,true).GetBytes(text);
            if(bytes.Length>16384)throw new LiveProtocolException("Live message is too large");
            return socket.SendAsync(new ArraySegment<byte>(bytes),WebSocketMessageType.Text,true,token);
        }
        public async Task<string> ReceiveAsync(CancellationToken token)
        {
            while(true) {
                var part=await socket.ReceiveAsync(new ArraySegment<byte>(fragment),token);
                if(part.MessageType==WebSocketMessageType.Close){assembler.Reset();return null;}
                if(part.MessageType!=WebSocketMessageType.Text){assembler.Reset();throw new LiveProtocolException("Text messages required");}
                var text=assembler.Append(fragment,0,part.Count,part.EndOfMessage);
                if(text!=null)return text;
            }
        }
        public void Abort() { if(!disposed)socket.Abort(); }
        public void Dispose()
        { if(disposed)return;disposed=true;assembler.Reset();socket.Dispose(); }
    }
}
