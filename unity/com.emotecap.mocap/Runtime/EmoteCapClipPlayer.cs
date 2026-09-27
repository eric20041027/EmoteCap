using System.Collections.Generic;
using System.Linq;
using UnityEngine;
using UnityEngine.Animations;
using UnityEngine.Playables;

namespace EmoteCap
{
    /// <summary>
    /// Plays EmoteCap clips on a Humanoid with an on-screen menu: pick a clip, toggle Loop, or play all in order.
    /// In the Editor the list is read from Assets/EmoteCap (newest first; Refresh picks up new exports);
    /// in a build it uses the serialized list. Takes over the Animator via Playables, so no controller is needed.
    /// </summary>
    [RequireComponent(typeof(Animator))]
    public class EmoteCapClipPlayer : MonoBehaviour
    {
        [SerializeField] List<AnimationClip> clips = new List<AnimationClip>();
        [SerializeField] string editorFolder = "Assets/EmoteCap";
        [SerializeField] bool loop = true;
        [SerializeField] bool playAll;
        [SerializeField] bool showMenu = true;

        const float MenuWidth = 260f;
        const float EndEpsilon = 1e-3f;

        PlayableGraph graph;
        AnimationPlayableOutput output;
        AnimationClipPlayable current;
        int currentIndex = -1;
        Vector2 scroll;

        void Start()
        {
            var animator = GetComponent<Animator>();
            animator.runtimeAnimatorController = null;
            animator.applyRootMotion = false;
            graph = PlayableGraph.Create($"{name} EmoteCap Clip Player");
            graph.SetTimeUpdateMode(DirectorUpdateMode.GameTime);
            output = AnimationPlayableOutput.Create(graph, "Animation", animator);
            RefreshClips();
            if (clips.Count > 0) Play(0);
            graph.Play();
        }

        void OnDestroy()
        {
            if (graph.IsValid()) graph.Destroy();
        }

        public void Play(int index)
        {
            if (index < 0 || index >= clips.Count || clips[index] == null) return;
            if (current.IsValid()) current.Destroy();
            current = AnimationClipPlayable.Create(graph, clips[index]);
            current.SetApplyFootIK(true);
            output.SetSourcePlayable(current);
            currentIndex = index;
        }

        void Update()
        {
            if (!current.IsValid() || currentIndex < 0) return;
            var length = clips[currentIndex].length;
            if (current.GetTime() < length) return;
            if (playAll && clips.Count > 1) Play((currentIndex + 1) % clips.Count);
            else if (loop) current.SetTime(0);
            else
            {
                current.SetTime(Mathf.Max(0f, length - EndEpsilon)); // hold the last pose
                current.SetSpeed(0);
            }
        }

        void Restart()
        {
            if (currentIndex >= 0) Play(currentIndex);
        }

        void RefreshClips()
        {
#if UNITY_EDITOR
            var folder = editorFolder.TrimEnd('/');
            if (!UnityEditor.AssetDatabase.IsValidFolder(folder)) return;
            var found = UnityEditor.AssetDatabase.FindAssets("t:Model", new[] { folder })
                .Select(UnityEditor.AssetDatabase.GUIDToAssetPath)
                .OrderByDescending(path => System.IO.File.GetLastWriteTimeUtc(path))
                .Select(path => UnityEditor.AssetDatabase.LoadAllAssetsAtPath(path)
                    .OfType<AnimationClip>()
                    .FirstOrDefault(clip => !clip.name.StartsWith("__preview", System.StringComparison.Ordinal)))
                .Where(clip => clip != null)
                .ToList();
            if (found.Count > 0) clips = found;
#endif
        }

        void OnGUI()
        {
            if (!showMenu) return;
            GUILayout.BeginArea(new Rect(Screen.width - MenuWidth - 10, 10, MenuWidth, Screen.height - 20), GUI.skin.box);
            GUILayout.Label("<b>EmoteCap clips</b>", new GUIStyle(GUI.skin.label) { richText = true, fontSize = 15 });

            var newLoop = GUILayout.Toggle(loop, " Loop");
            if (newLoop != loop)
            {
                loop = newLoop;
                Restart();
            }
            var newPlayAll = GUILayout.Toggle(playAll, " Play all in order");
            if (newPlayAll != playAll)
            {
                playAll = newPlayAll;
                Restart();
            }
#if UNITY_EDITOR
            if (GUILayout.Button("Refresh (new exports)"))
            {
                RefreshClips();
                if (clips.Count > 0) Play(0);
            }
#endif
            GUILayout.Space(6);
            scroll = GUILayout.BeginScrollView(scroll);
            for (var i = 0; i < clips.Count; i++)
            {
                if (clips[i] == null) continue;
                var previous = GUI.color;
                if (i == currentIndex) GUI.color = new Color(0.55f, 0.85f, 1f);
                if (GUILayout.Button((i == currentIndex ? "▶ " : "   ") + clips[i].name, GUILayout.Height(28))) Play(i);
                GUI.color = previous;
            }
            if (clips.Count == 0) GUILayout.Label("No clips yet. Export one from the web app.");
            GUILayout.EndScrollView();
            GUILayout.EndArea();
        }
    }
}
