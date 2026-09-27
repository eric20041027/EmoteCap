using UnityEngine;

namespace EmoteCap
{
    /// <summary>
    /// Mirror of contracts/bones.json (driven bones, v1). Keep the order identical to "driven".
    /// </summary>
    public static class EmoteCapContract
    {
        public const int Version = 1;
        public const float HipsRestHeight = 0.95f;

        public static readonly HumanBodyBones[] DrivenBones =
        {
            HumanBodyBones.Hips, HumanBodyBones.Spine, HumanBodyBones.Chest, HumanBodyBones.UpperChest,
            HumanBodyBones.Neck, HumanBodyBones.Head,
            HumanBodyBones.LeftUpperArm, HumanBodyBones.LeftLowerArm, HumanBodyBones.LeftHand,
            HumanBodyBones.RightUpperArm, HumanBodyBones.RightLowerArm, HumanBodyBones.RightHand,
            HumanBodyBones.LeftUpperLeg, HumanBodyBones.LeftLowerLeg, HumanBodyBones.LeftFoot,
            HumanBodyBones.RightUpperLeg, HumanBodyBones.RightLowerLeg, HumanBodyBones.RightFoot,
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
        public float t;
        public float[] h;
        public float[] r;
        public string name;
        public string url;
        public bool loop;
    }
}
