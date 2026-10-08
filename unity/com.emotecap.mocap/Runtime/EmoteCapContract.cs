using UnityEngine;

namespace EmoteCap
{
    /// <summary>
    /// Mirror of contracts/bones.json (driven bones, v2: 18 body + 30 finger). Keep the order identical to "driven".
    /// </summary>
    public static class EmoteCapContract
    {
        public const int Version = 2;
        public const float HipsRestHeight = 0.95f;

        public static readonly HumanBodyBones[] DrivenBones =
        {
            HumanBodyBones.Hips, HumanBodyBones.Spine, HumanBodyBones.Chest, HumanBodyBones.UpperChest,
            HumanBodyBones.Neck, HumanBodyBones.Head,
            HumanBodyBones.LeftUpperArm, HumanBodyBones.LeftLowerArm, HumanBodyBones.LeftHand,
            HumanBodyBones.RightUpperArm, HumanBodyBones.RightLowerArm, HumanBodyBones.RightHand,
            HumanBodyBones.LeftUpperLeg, HumanBodyBones.LeftLowerLeg, HumanBodyBones.LeftFoot,
            HumanBodyBones.RightUpperLeg, HumanBodyBones.RightLowerLeg, HumanBodyBones.RightFoot,
            HumanBodyBones.LeftThumbProximal, HumanBodyBones.LeftThumbIntermediate, HumanBodyBones.LeftThumbDistal,
            HumanBodyBones.LeftIndexProximal, HumanBodyBones.LeftIndexIntermediate, HumanBodyBones.LeftIndexDistal,
            HumanBodyBones.LeftMiddleProximal, HumanBodyBones.LeftMiddleIntermediate, HumanBodyBones.LeftMiddleDistal,
            HumanBodyBones.LeftRingProximal, HumanBodyBones.LeftRingIntermediate, HumanBodyBones.LeftRingDistal,
            HumanBodyBones.LeftLittleProximal, HumanBodyBones.LeftLittleIntermediate, HumanBodyBones.LeftLittleDistal,
            HumanBodyBones.RightThumbProximal, HumanBodyBones.RightThumbIntermediate, HumanBodyBones.RightThumbDistal,
            HumanBodyBones.RightIndexProximal, HumanBodyBones.RightIndexIntermediate, HumanBodyBones.RightIndexDistal,
            HumanBodyBones.RightMiddleProximal, HumanBodyBones.RightMiddleIntermediate, HumanBodyBones.RightMiddleDistal,
            HumanBodyBones.RightRingProximal, HumanBodyBones.RightRingIntermediate, HumanBodyBones.RightRingDistal,
            HumanBodyBones.RightLittleProximal, HumanBodyBones.RightLittleIntermediate, HumanBodyBones.RightLittleDistal,
        };

        /// <summary>Canonical position (right-handed, +Y up, character faces +Z) to Unity.</summary>
        public static Vector3 ToUnity(float x, float y, float z) => new Vector3(-x, y, z);

        /// <summary>Canonical quaternion (x, y, z, w) to Unity.</summary>
        public static Quaternion ToUnity(float x, float y, float z, float w) => new Quaternion(x, -y, -z, w);
    }

    /// <summary>Live Link wire message; fields unused by a message type stay default. JsonUtility-compatible.</summary>
    [System.Serializable]
    public class LiveMessage
    {
        public string type;
        public double t;
        public int version;
        public string[] bones;
        public string sessionId;
        public string role;
        public string streamId;
        public double expiresAt;
        public float[] h;
        public float[] r;
        public string name;
        public string url;
        public bool loop;
    }
}
