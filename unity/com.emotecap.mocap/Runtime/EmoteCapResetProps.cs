using System.Collections.Generic;
using UnityEngine;

namespace EmoteCap
{
    /// <summary>
    /// Remembers where every Rigidbody under this object starts and puts them all back on R or the on-screen button,
    /// so a playground can be knocked over again and again.
    /// </summary>
    public class EmoteCapResetProps : MonoBehaviour
    {
        struct StartPose
        {
            public Rigidbody body;
            public Vector3 position;
            public Quaternion rotation;
        }

        [SerializeField] bool showButton = true;

        readonly List<StartPose> poses = new List<StartPose>();

        void Start()
        {
            foreach (var body in GetComponentsInChildren<Rigidbody>())
            {
                poses.Add(new StartPose { body = body, position = body.position, rotation = body.rotation });
            }
        }

        public void ResetAll()
        {
            foreach (var pose in poses)
            {
                if (pose.body == null) continue;
#if UNITY_6000_0_OR_NEWER
                pose.body.linearVelocity = Vector3.zero;
#else
                pose.body.velocity = Vector3.zero;
#endif
                pose.body.angularVelocity = Vector3.zero;
                pose.body.transform.SetPositionAndRotation(pose.position, pose.rotation);
                pose.body.position = pose.position;
                pose.body.rotation = pose.rotation;
            }
        }

        void OnGUI()
        {
            // IMGUI events work with both the old Input Manager and the new Input System.
            var e = Event.current;
            if (e.type == EventType.KeyDown && e.keyCode == KeyCode.R) ResetAll();
            if (showButton && GUI.Button(new Rect(10, 40, 150, 30), "Reset props (R)")) ResetAll();
        }
    }
}
