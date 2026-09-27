using System.Collections.Generic;
using UnityEngine;

namespace EmoteCap
{
    /// <summary>
    /// Gives a Humanoid (e.g. one driven by EmoteCap Live Link) physical body parts so it can push props around.
    /// Each limb gets a kinematic capsule that follows its bones with MovePosition/MoveRotation in FixedUpdate,
    /// so physics sees real velocities and a fast swing knocks things over. Proxies live outside the character
    /// hierarchy, so they never fight the animation.
    /// </summary>
    [RequireComponent(typeof(Animator))]
    public class EmoteCapBodyColliders : MonoBehaviour
    {
        [SerializeField] float limbRadius = 0.05f;
        [SerializeField] float handRadius = 0.06f;
        [SerializeField] float footRadius = 0.055f;
        [SerializeField] float headRadius = 0.11f;
        [SerializeField] float torsoRadius = 0.13f;

        class Proxy
        {
            public Transform from;
            public Transform to;
            public float radius;
            public Rigidbody body;
            public CapsuleCollider capsule;
        }

        readonly List<Proxy> proxies = new List<Proxy>();
        Transform container;

        void Start()
        {
            var animator = GetComponent<Animator>();
            if (!animator.isHuman)
            {
                Debug.LogError("EmoteCap Body Colliders needs a Humanoid Animator.", this);
                enabled = false;
                return;
            }
            container = new GameObject($"{name} Body Colliders").transform;

            // Limb segments: capsule from one bone to the next.
            Add(animator, HumanBodyBones.LeftUpperArm, HumanBodyBones.LeftLowerArm, limbRadius);
            Add(animator, HumanBodyBones.LeftLowerArm, HumanBodyBones.LeftHand, limbRadius);
            Add(animator, HumanBodyBones.RightUpperArm, HumanBodyBones.RightLowerArm, limbRadius);
            Add(animator, HumanBodyBones.RightLowerArm, HumanBodyBones.RightHand, limbRadius);
            Add(animator, HumanBodyBones.LeftUpperLeg, HumanBodyBones.LeftLowerLeg, limbRadius);
            Add(animator, HumanBodyBones.LeftLowerLeg, HumanBodyBones.LeftFoot, limbRadius);
            Add(animator, HumanBodyBones.RightUpperLeg, HumanBodyBones.RightLowerLeg, limbRadius);
            Add(animator, HumanBodyBones.RightLowerLeg, HumanBodyBones.RightFoot, limbRadius);
            Add(animator, HumanBodyBones.Hips, HumanBodyBones.Neck, torsoRadius);
            // Hands, feet and head: short capsules toward the fingertips / toes / top of the head.
            Add(animator, HumanBodyBones.LeftHand, HumanBodyBones.LeftMiddleProximal, handRadius);
            Add(animator, HumanBodyBones.RightHand, HumanBodyBones.RightMiddleProximal, handRadius);
            Add(animator, HumanBodyBones.LeftFoot, HumanBodyBones.LeftToes, footRadius);
            Add(animator, HumanBodyBones.RightFoot, HumanBodyBones.RightToes, footRadius);
            Add(animator, HumanBodyBones.Neck, HumanBodyBones.Head, headRadius);
        }

        void Add(Animator animator, HumanBodyBones fromBone, HumanBodyBones toBone, float radius)
        {
            var from = animator.GetBoneTransform(fromBone);
            var to = animator.GetBoneTransform(toBone);
            if (from == null || to == null) return;

            var go = new GameObject($"{fromBone} Collider");
            go.transform.SetParent(container, false);
            var body = go.AddComponent<Rigidbody>();
            body.isKinematic = true;
            body.interpolation = RigidbodyInterpolation.Interpolate;
            body.collisionDetectionMode = CollisionDetectionMode.ContinuousSpeculative;
            var capsule = go.AddComponent<CapsuleCollider>();
            capsule.direction = 1; // local Y runs from bone to bone
            capsule.radius = radius;
            proxies.Add(new Proxy { from = from, to = to, radius = radius, body = body, capsule = capsule });
            Follow(proxies[proxies.Count - 1], teleport: true);
        }

        void FixedUpdate()
        {
            foreach (var proxy in proxies) Follow(proxy, teleport: false);
        }

        static void Follow(Proxy proxy, bool teleport)
        {
            var a = proxy.from.position;
            var b = proxy.to.position;
            var along = b - a;
            var length = along.magnitude;
            var center = (a + b) * 0.5f;
            var rotation = length > 1e-4f ? Quaternion.FromToRotation(Vector3.up, along / length) : proxy.from.rotation;
            proxy.capsule.height = length + 2f * proxy.radius;
            if (teleport)
            {
                proxy.body.transform.SetPositionAndRotation(center, rotation);
                return;
            }
            proxy.body.MovePosition(center);
            proxy.body.MoveRotation(rotation);
        }

        void OnDestroy()
        {
            if (container != null) Destroy(container.gameObject);
        }
    }
}
