using System.IO;
using System.Linq;
using UnityEditor;
using UnityEditor.Animations;
using UnityEngine;

namespace EmoteCap.Editor
{
    /// <summary>
    /// Demo convenience: whenever a new EmoteCap clip is imported, point the default state of every
    /// Animator Controller named "EmoteCapClips" at it, so a preview character plays the latest take.
    /// </summary>
    public class EmoteCapPreviewController : AssetPostprocessor
    {
        const string Folder = "Assets/EmoteCap/";
        const string ControllerName = "EmoteCapClips";

        static void OnPostprocessAllAssets(string[] imported, string[] deleted, string[] moved, string[] movedFrom)
        {
            var newest = imported
                .Where(p => p.StartsWith(Folder) && p.EndsWith(".fbx", System.StringComparison.OrdinalIgnoreCase))
                .LastOrDefault();
            if (newest == null) return;

            var clip = AssetDatabase.LoadAllAssetsAtPath(newest)
                .OfType<AnimationClip>()
                .FirstOrDefault(c => !c.name.StartsWith("__preview"));
            if (clip == null) return;

            foreach (var guid in AssetDatabase.FindAssets($"{ControllerName} t:AnimatorController"))
            {
                var path = AssetDatabase.GUIDToAssetPath(guid);
                if (Path.GetFileNameWithoutExtension(path) != ControllerName) continue;
                var controller = AssetDatabase.LoadAssetAtPath<AnimatorController>(path);
                var state = controller.layers[0].stateMachine.defaultState;
                if (state == null) continue;
                state.motion = clip;
                state.name = clip.name;
                state.iKOnFeet = true;
                EditorUtility.SetDirty(controller);
                Debug.Log($"EmoteCap: {path} now plays {clip.name}");
            }
            AssetDatabase.SaveAssets();
        }
    }
}
