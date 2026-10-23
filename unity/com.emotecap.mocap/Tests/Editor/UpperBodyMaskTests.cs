using System;
using System.IO;
using EmoteCap.Editor;
using NUnit.Framework;
using UnityEditor;
using UnityEditor.Animations;
using UnityEngine;

namespace EmoteCap.Tests
{
    public class UpperBodyMaskTests
    {
        [TestCase(false)]
        [TestCase(true)]
        public void MaskEnablesOnlyItsDeclaredHumanoidGroups(bool torso)
        {
            var mask = EmoteCapUpperBodyMasks.CreateMask(torso);
            try
            {
                for (var i = 0; i < (int)AvatarMaskBodyPart.LastBodyPart; i++)
                {
                    var part = (AvatarMaskBodyPart)i;
                    var expected = part == AvatarMaskBodyPart.Head || part == AvatarMaskBodyPart.LeftArm
                        || part == AvatarMaskBodyPart.RightArm || part == AvatarMaskBodyPart.LeftFingers
                        || part == AvatarMaskBodyPart.RightFingers || torso && part == AvatarMaskBodyPart.Body;
                    Assert.That(mask.GetHumanoidBodyPartActive(part), Is.EqualTo(expected), part.ToString());
                }
            }
            finally { UnityEngine.Object.DestroyImmediate(mask); }
        }

        [Test]
        public void SavedMasksUseUniquePathsAndPreserveExistingControllerAndMask()
        {
            var leaf = "EmoteCapMaskTest-" + Guid.NewGuid().ToString("N");
            var folder = "Assets/" + leaf;
            AssetDatabase.CreateFolder("Assets", leaf);
            try
            {
                var unrelated = new AvatarMask();
                var unrelatedPath = folder + "/Unrelated.mask";
                AssetDatabase.CreateAsset(unrelated, unrelatedPath);
                AssetDatabase.SaveAssetIfDirty(unrelated);
                var unrelatedBefore = File.ReadAllBytes(unrelatedPath);
                unrelated.SetHumanoidBodyPartActive(AvatarMaskBodyPart.Head, false);
                EditorUtility.SetDirty(unrelated);
                var controller = AnimatorController.CreateAnimatorControllerAtPath(folder + "/Locomotion.controller");
                AssetDatabase.SaveAssetIfDirty(controller);
                var controllerBefore = EditorJsonUtility.ToJson(controller);
                var first = EmoteCapUpperBodyMasks.CreateAsset(folder, false);
                var firstPath = AssetDatabase.GetAssetPath(first);
                var firstGuid = AssetDatabase.AssetPathToGUID(firstPath);
                var second = EmoteCapUpperBodyMasks.CreateAsset(folder, false);
                Assert.That(EditorUtility.IsDirty(unrelated), Is.True, "Unrelated edits must remain unsaved");
                Assert.That(File.ReadAllBytes(unrelatedPath), Is.EqualTo(unrelatedBefore));
                Assert.That(AssetDatabase.GetAssetPath(second), Is.Not.EqualTo(firstPath));
                Assert.That(AssetDatabase.AssetPathToGUID(firstPath), Is.EqualTo(firstGuid));
                Assert.That(EditorJsonUtility.ToJson(controller), Is.EqualTo(controllerBefore));
                AssetDatabase.ImportAsset(firstPath, ImportAssetOptions.ForceUpdate);
                Assert.That(AssetDatabase.LoadAssetAtPath<AvatarMask>(firstPath)
                    .GetHumanoidBodyPartActive(AvatarMaskBodyPart.Root), Is.False);
            }
            finally { AssetDatabase.DeleteAsset(folder); }
        }
    }
}
