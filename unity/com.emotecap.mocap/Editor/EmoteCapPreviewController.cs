using System;
using System.IO;
using System.Linq;
using UnityEditor;
using UnityEditor.Animations;
using UnityEngine;

namespace EmoteCap.Editor
{
    /// <summary>
    /// Demo convenience: after an export, every Animator Controller named "EmoteCapClips" is rebuilt as a
    /// playlist of that export's clips (in take order), so a preview character plays them back to back, looping.
    /// Menu: EmoteCap > Play Latest Export rebuilds it from the newest export on demand.
    /// </summary>
    public class EmoteCapPreviewController : AssetPostprocessor
    {
        const string Folder = "Assets/EmoteCap/";
        const string ControllerName = "EmoteCapClips";
        /// <summary>Clips written within this many seconds of the newest one belong to the same export.</summary>
        const double BatchWindowSeconds = 10;
        const float CrossFadeSeconds = 0.2f;

        static void OnPostprocessAllAssets(string[] imported, string[] deleted, string[] moved, string[] movedFrom)
        {
            var batch = imported.Where(IsClipFbx).ToArray();
            if (batch.Length > 0) BuildPlaylist(batch);
        }

        [MenuItem("EmoteCap/Play Latest Export")]
        static void PlayLatestExport()
        {
            var all = AssetDatabase.FindAssets("t:Model", new[] { Folder.TrimEnd('/') })
                .Select(AssetDatabase.GUIDToAssetPath)
                .Where(IsClipFbx)
                .ToArray();
            if (all.Length == 0)
            {
                Debug.LogWarning("EmoteCap: no clips in Assets/EmoteCap yet. Export one from the web app first.");
                return;
            }
            var newest = all.Max(WriteTime);
            BuildPlaylist(all.Where(path => (newest - WriteTime(path)).TotalSeconds <= BatchWindowSeconds).ToArray());
        }

        static bool IsClipFbx(string path) =>
            path.StartsWith(Folder, StringComparison.Ordinal) &&
            !System.Text.RegularExpressions.Regex.IsMatch(path,"^Assets/EmoteCap/StarterRigs(?:Tests-[a-f0-9]{32})?/") &&
            path.EndsWith(".fbx", StringComparison.OrdinalIgnoreCase);

        static DateTime WriteTime(string path) => File.GetLastWriteTimeUtc(path);

        static void BuildPlaylist(string[] fbxPaths)
        {
            // The server writes an export's clips in take order, so write time gives the playback order.
            var clips = fbxPaths
                .OrderBy(WriteTime)
                .Select(path => AssetDatabase.LoadAllAssetsAtPath(path)
                    .OfType<AnimationClip>()
                    .FirstOrDefault(clip => !clip.name.StartsWith("__preview", StringComparison.Ordinal)))
                .Where(clip => clip != null)
                .ToArray();
            if (clips.Length == 0) return;

            foreach (var guid in AssetDatabase.FindAssets($"{ControllerName} t:AnimatorController"))
            {
                var path = AssetDatabase.GUIDToAssetPath(guid);
                if (Path.GetFileNameWithoutExtension(path) != ControllerName) continue;
                Rebuild(AssetDatabase.LoadAssetAtPath<AnimatorController>(path), clips);
                Debug.Log($"EmoteCap: {path} now plays {string.Join(" → ", clips.Select(clip => clip.name))}");
            }
            AssetDatabase.SaveAssets();
        }

        static void Rebuild(AnimatorController controller, AnimationClip[] clips)
        {
            var machine = controller.layers[0].stateMachine;
            foreach (var child in machine.states.ToArray()) machine.RemoveState(child.state);

            var states = clips.Select((clip, i) =>
            {
                var state = machine.AddState(clip.name, new Vector3(260 + 240 * i, 120, 0));
                state.motion = clip;
                state.iKOnFeet = true;
                return state;
            }).ToArray();
            machine.defaultState = states[0];

            // Chain the clips and loop back to the first (a single clip transitions to itself and replays).
            for (var i = 0; i < states.Length; i++)
            {
                var transition = states[i].AddTransition(states[(i + 1) % states.Length]);
                transition.hasExitTime = true;
                transition.exitTime = 1f;
                transition.hasFixedDuration = true;
                transition.duration = CrossFadeSeconds;
            }
            EditorUtility.SetDirty(controller);
        }
    }
}
