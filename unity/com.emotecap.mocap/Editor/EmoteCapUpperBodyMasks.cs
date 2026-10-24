using System;
using UnityEditor;
using UnityEngine;

namespace EmoteCap.Editor
{
    /// <summary>Independent Humanoid override masks; never changes an Animator or controller.</summary>
    public static class EmoteCapUpperBodyMasks
    {
        public static AvatarMask CreateMask(bool includeTorso)
        {
            var mask = new AvatarMask { name = includeTorso ? "EmoteCap Upper Body With Torso" : "EmoteCap Arms And Head" };
            for (var i = 0; i < (int)AvatarMaskBodyPart.LastBodyPart; i++)
                mask.SetHumanoidBodyPartActive((AvatarMaskBodyPart)i, false);
            mask.SetHumanoidBodyPartActive(AvatarMaskBodyPart.Head, true);
            mask.SetHumanoidBodyPartActive(AvatarMaskBodyPart.LeftArm, true);
            mask.SetHumanoidBodyPartActive(AvatarMaskBodyPart.RightArm, true);
            mask.SetHumanoidBodyPartActive(AvatarMaskBodyPart.LeftFingers, true);
            mask.SetHumanoidBodyPartActive(AvatarMaskBodyPart.RightFingers, true);
            mask.SetHumanoidBodyPartActive(AvatarMaskBodyPart.Body, includeTorso);
            return mask;
        }

        public static AvatarMask CreateAsset(string folder, bool includeTorso)
        {
            if (folder == null || !(folder == "Assets" || folder.StartsWith("Assets/", StringComparison.Ordinal))
                || folder.Contains("\\") || Array.Exists(folder.Split('/'), part => part == "." || part == "..")
                || !AssetDatabase.IsValidFolder(folder))
                throw new ArgumentException("Choose an existing folder under Assets.", nameof(folder));
            var mask = CreateMask(includeTorso);
            try
            {
                var path = AssetDatabase.GenerateUniqueAssetPath(folder + "/" + mask.name + ".mask");
                AssetDatabase.CreateAsset(mask, path);
                AssetDatabase.SaveAssetIfDirty(mask);
                return mask;
            }
            catch
            {
                if (!AssetDatabase.Contains(mask)) UnityEngine.Object.DestroyImmediate(mask);
                throw;
            }
        }

        const string ArmsMenu = "Assets/Create/EmoteCap/Arms and Head Override Mask";
        const string TorsoMenu = "Assets/Create/EmoteCap/Upper Body Override Mask (includes torso)";
        [MenuItem(ArmsMenu)] static void CreateArmsMask() { CreateSelected(false); }
        [MenuItem(TorsoMenu)] static void CreateTorsoMask() { CreateSelected(true); }
        [MenuItem(ArmsMenu, true)]
        [MenuItem(TorsoMenu, true)]
        static bool CanCreateMask() { return !EditorApplication.isPlayingOrWillChangePlaymode && !EditorApplication.isCompiling; }
        static void CreateSelected(bool torso)
        {
            var folder = AssetDatabase.GetAssetPath(Selection.activeObject);
            if (!AssetDatabase.IsValidFolder(folder) || !(folder == "Assets" || folder.StartsWith("Assets/", StringComparison.Ordinal))) folder = "Assets";
            var mask = CreateAsset(folder, torso);
            Selection.activeObject = mask;
            EditorGUIUtility.PingObject(mask);
        }
    }
}
