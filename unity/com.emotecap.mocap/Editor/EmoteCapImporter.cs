using System;
using System.IO;
using UnityEditor;
using UnityEngine;

namespace EmoteCap.Editor
{
    /// <summary>
    /// Imports EmoteCap FBX clips under Assets/EmoteCap/ as in-place Humanoid animations.
    /// Clip name and looping come from the &lt;name&gt;.emotecap.json sidecar written next to each FBX.
    /// </summary>
    public class EmoteCapImporter : AssetPostprocessor
    {
        const string Folder = "Assets/EmoteCap/";

        [Serializable]
        class Sidecar
        {
            public string name;
            public bool loop;
            public int fps;
        }

        bool IsEmoteCapFbx =>
            assetPath.StartsWith(Folder, StringComparison.Ordinal) &&
            assetPath.EndsWith(".fbx", StringComparison.OrdinalIgnoreCase);

        void OnPreprocessModel()
        {
            if (!IsEmoteCapFbx) return;
            var importer = (ModelImporter)assetImporter;
            importer.animationType = ModelImporterAnimationType.Human;
            importer.avatarSetup = ModelImporterAvatarSetup.CreateFromThisModel;
            importer.importAnimation = true;
            importer.materialImportMode = ModelImporterMaterialImportMode.None;
        }

        void OnPreprocessAnimation()
        {
            if (!IsEmoteCapFbx) return;
            var importer = (ModelImporter)assetImporter;
            var clips = importer.defaultClipAnimations;
            if (clips == null || clips.Length == 0) return;

            var sidecar = ReadSidecar();
            var clipName = sidecar?.name ?? Path.GetFileNameWithoutExtension(assetPath);
            var loop = sidecar != null && sidecar.loop;
            foreach (var clip in clips)
            {
                // Unity does not generate Humanoid muscle curves for a zero-length
                // take. One output frame holds the sole pose without a rest preroll.
                if(clip.lastFrame<=clip.firstFrame)clip.lastFrame=clip.firstFrame+1;
                clip.name = clipName;
                clip.loopTime = loop;
                clip.loopPose = loop;
                // In-place animation: bake root rotation and position into the pose.
                clip.lockRootRotation = true;
                clip.keepOriginalOrientation = true;
                clip.lockRootHeightY = true;
                clip.keepOriginalPositionY = true;
                clip.lockRootPositionXZ = true;
                clip.keepOriginalPositionXZ = true;
            }
            importer.clipAnimations = clips;
        }

        Sidecar ReadSidecar()
        {
            var directory = Path.GetDirectoryName(assetPath) ?? string.Empty;
            var path = Path.Combine(directory, Path.GetFileNameWithoutExtension(assetPath) + ".emotecap.json");
            return File.Exists(path) ? JsonUtility.FromJson<Sidecar>(File.ReadAllText(path)) : null;
        }
    }
}
