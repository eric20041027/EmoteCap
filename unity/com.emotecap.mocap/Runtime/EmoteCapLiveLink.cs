using System;
using System.Linq;
using System.Net.WebSockets;
using System.Text;
using System.Threading;
using System.Threading.Tasks;
using UnityEngine;

namespace EmoteCap
{
    /// <summary>
    /// Drives a Humanoid character from EmoteCap Live Link frames (ws://host:port/ws/live?role=sink).
    /// Requirements: the character is in its T-pose bind pose when Play starts (Mixamo characters are),
    /// and its Animator has an Avatar but no Animator Controller (a controller would overwrite the pose).
    /// </summary>
    [RequireComponent(typeof(Animator))]
    public class EmoteCapLiveLink : MonoBehaviour
    {
        [SerializeField] string host = "localhost";
        [SerializeField] int port = 8787;
        [SerializeField] bool applyHipsHeight = true;
        [SerializeField] bool showStatus = true;

        public string Status { get; private set; } = "idle";

        const float ReconnectDelaySeconds = 2f;
        const int ReceiveBufferBytes = 64 * 1024;

        Transform[] bones;
        Quaternion[] restWorld;
        Quaternion rootRest;
        float restHipsHeight;
        volatile LiveMessage latest;
        LiveMessage applied;
        CancellationTokenSource cancellation;

        void Start()
        {
            var animator = GetComponent<Animator>();
            if (animator.avatar == null || !animator.isHuman)
            {
                Debug.LogError("EmoteCap Live Link needs a Humanoid Avatar on this Animator.", this);
                enabled = false;
                return;
            }
            if (animator.runtimeAnimatorController != null)
            {
                Debug.LogWarning("EmoteCap Live Link: remove the Animator Controller, it overrides live poses.", this);
            }

            bones = EmoteCapContract.DrivenBones.Select(animator.GetBoneTransform).ToArray();
            restWorld = bones.Select(bone => bone != null ? bone.rotation : Quaternion.identity).ToArray();
            rootRest = transform.rotation;
            restHipsHeight = bones[0].position.y - transform.position.y;

            cancellation = new CancellationTokenSource();
            _ = ReceiveLoopAsync(cancellation.Token);
        }

        void OnDestroy()
        {
            cancellation?.Cancel();
        }

        void LateUpdate()
        {
            var frame = latest;
            if (frame == null || frame == applied) return;
            applied = frame;

            for (var i = 0; i < bones.Length; i++)
            {
                if (bones[i] == null) continue;
                var delta = EmoteCapContract.ToUnity(frame.r[i * 4], frame.r[i * 4 + 1], frame.r[i * 4 + 2], frame.r[i * 4 + 3]);
                // The delta is expressed in the character's own frame; rotate it into world space.
                var worldDelta = rootRest * delta * Quaternion.Inverse(rootRest);
                bones[i].rotation = worldDelta * restWorld[i];
            }

            if (applyHipsHeight && frame.h != null && frame.h.Length == 3)
            {
                var hips = bones[0];
                var position = hips.position;
                position.y = transform.position.y + restHipsHeight * (frame.h[1] / EmoteCapContract.HipsRestHeight);
                hips.position = position;
            }
        }

        async Task ReceiveLoopAsync(CancellationToken token)
        {
            var buffer = new byte[ReceiveBufferBytes];
            while (!token.IsCancellationRequested)
            {
                using (var socket = new ClientWebSocket())
                {
                    try
                    {
                        Status = $"connecting to {host}:{port}";
                        await socket.ConnectAsync(new Uri($"ws://{host}:{port}/ws/live?role=sink"), token);
                        Status = "connected";
                        await ReadMessagesAsync(socket, buffer, token);
                        Status = "disconnected";
                    }
                    catch (OperationCanceledException)
                    {
                        return;
                    }
                    catch (Exception e)
                    {
                        Status = $"disconnected: {e.Message}";
                    }
                }
                try
                {
                    await Task.Delay(TimeSpan.FromSeconds(ReconnectDelaySeconds), token);
                }
                catch (OperationCanceledException)
                {
                    return;
                }
            }
        }

        async Task ReadMessagesAsync(ClientWebSocket socket, byte[] buffer, CancellationToken token)
        {
            var message = new StringBuilder();
            while (socket.State == WebSocketState.Open && !token.IsCancellationRequested)
            {
                var result = await socket.ReceiveAsync(new ArraySegment<byte>(buffer), token);
                if (result.MessageType == WebSocketMessageType.Close) return;
                message.Append(Encoding.UTF8.GetString(buffer, 0, result.Count));
                if (!result.EndOfMessage) continue;
                Handle(message.ToString());
                message.Clear();
            }
        }

        void Handle(string json)
        {
            try
            {
                var parsed = JsonUtility.FromJson<LiveMessage>(json);
                if (parsed != null && parsed.type == "frame" && parsed.r != null && parsed.r.Length == EmoteCapContract.DrivenBones.Length * 4)
                {
                    latest = parsed;
                }
            }
            catch (ArgumentException e)
            {
                Status = $"bad message: {e.Message}";
            }
        }

        void OnGUI()
        {
            if (showStatus) GUI.Label(new Rect(10, 10, 600, 24), $"EmoteCap Live Link: {Status}");
        }
    }
}
