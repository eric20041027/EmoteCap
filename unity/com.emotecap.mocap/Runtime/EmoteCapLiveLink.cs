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
        [Tooltip("Seconds to ease toward each new frame; smooths 30 fps tracking on a 60+ fps display. 0 = off.")]
        [Range(0f, 0.2f)]
        [SerializeField] float smoothTime = 0.05f;
        [Tooltip("Keep the lowest sole on the floor: never below it, and pulled down when floating less than Airborne Threshold.")]
        [SerializeField] bool groundFeet = true;
        [Tooltip("Soles higher than this above the floor are treated as a jump and left in the air (meters).")]
        [SerializeField] float airborneThreshold = 0.04f;
        [SerializeField] bool showStatus = true;

        public string Status { get; private set; } = "idle";

        const float ReconnectDelaySeconds = 2f;
        const int ReceiveBufferBytes = 64 * 1024;

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
            targetWorld = (Quaternion[])restWorld.Clone();
            shownWorld = (Quaternion[])restWorld.Clone();
            targetHipsHeight = shownHipsHeight = restHipsHeight;
            RecordSoleHeights(animator);

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
            if (frame != null && frame != applied)
            {
                applied = frame;
                SetTargets(frame);
            }
            if (!hasTarget) return;

            // Ease toward the latest frame every rendered frame instead of snapping 30 times a second.
            var blend = smoothTime > 0f ? 1f - Mathf.Exp(-Time.deltaTime / smoothTime) : 1f;
            for (var i = 0; i < bones.Length; i++)
            {
                if (bones[i] == null) continue;
                shownWorld[i] = Quaternion.Slerp(shownWorld[i], targetWorld[i], blend);
                bones[i].rotation = shownWorld[i];
            }

            if (applyHipsHeight)
            {
                shownHipsHeight = Mathf.Lerp(shownHipsHeight, targetHipsHeight, blend);
                var hips = bones[0];
                var position = hips.position;
                position.y = transform.position.y + shownHipsHeight;
                hips.position = position;
            }

            if (groundFeet) GroundLowestSole();
        }

        void SetTargets(LiveMessage frame)
        {
            for (var i = 0; i < bones.Length; i++)
            {
                if (bones[i] == null) continue;
                var delta = EmoteCapContract.ToUnity(frame.r[i * 4], frame.r[i * 4 + 1], frame.r[i * 4 + 2], frame.r[i * 4 + 3]);
                // The delta is expressed in the character's own frame; rotate it into world space.
                targetWorld[i] = rootRest * delta * Quaternion.Inverse(rootRest) * restWorld[i];
            }
            if (frame.h != null && frame.h.Length == 3)
            {
                targetHipsHeight = restHipsHeight * (frame.h[1] / EmoteCapContract.HipsRestHeight);
            }
            if (hasTarget) return;
            System.Array.Copy(targetWorld, shownWorld, targetWorld.Length);
            shownHipsHeight = targetHipsHeight;
            hasTarget = true;
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

        void GroundLowestSole()
        {
            var lowest = float.PositiveInfinity;
            for (var i = 0; i < soleJoints.Length; i++)
            {
                if (soleJoints[i] != null) lowest = Mathf.Min(lowest, soleJoints[i].position.y - soleHeights[i]);
            }
            if (float.IsPositiveInfinity(lowest)) return;
            var floatHeight = lowest - transform.position.y;
            // Below the floor: always lift. Slightly above: pull down (proportion mismatch). Well above: a jump.
            if (floatHeight < airborneThreshold) bones[0].position -= Vector3.up * floatHeight;
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
