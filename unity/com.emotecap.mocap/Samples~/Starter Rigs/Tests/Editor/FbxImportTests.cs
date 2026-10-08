using System.IO;
using System.Linq;
using Newtonsoft.Json.Linq;
using NUnit.Framework;
using UnityEditor;
using UnityEngine;

namespace EmoteCap.Samples.Tests
{
    public class FbxImportTests
    {
        [TestCase("Sample_Raise_Right_Arm")]
        [TestCase("Quality_Tpose")]
        [TestCase("Quality_PosedStart")]
        [TestCase("Quality_Irregular")]
        [TestCase("Quality_Body")]
        [TestCase("Quality_Single")]
        [TestCase("Quality_Fingers")]
        public void RealBlenderFbxImportsHumanoidWithOriginalDurationAndSidecar(string name)
        {
            var path="Assets/EmoteCap/QualityExports/"+name+".fbx";
            AssetDatabase.ImportAsset(path,ImportAssetOptions.ForceUpdate);
            var fixture=JObject.Parse(File.ReadAllText(Path.ChangeExtension(path,".fixture.json")));
            var sidecar=JObject.Parse(File.ReadAllText(Path.ChangeExtension(path,".emotecap.json")));
            var importer=(ModelImporter)AssetImporter.GetAtPath(path);Assert.That(importer,Is.Not.Null);
            Assert.That(importer.animationType,Is.EqualTo(ModelImporterAnimationType.Human));
            var assets=AssetDatabase.LoadAllAssetsAtPath(path);
            var avatar=assets.OfType<Avatar>().Single();Assert.That(avatar.isValid&&avatar.isHuman,Is.True);
            var clip=assets.OfType<AnimationClip>().Single(value=>!value.name.StartsWith("__preview"));
            Assert.That(clip.humanMotion,Is.True);Assert.That(clip.name,Is.EqualTo((string)sidecar["name"]));
            var settings=AnimationUtility.GetAnimationClipSettings(clip);
            Assert.That(settings.loopTime,Is.EqualTo((bool)sidecar["loop"]));
            var duration=(double)fixture["frames"].Last["t"];
            var fps=(double)fixture["fps"];
            TestContext.WriteLine(name+" sourceDuration="+duration+" importedDuration="+clip.length+" fps="+fps);
            Assert.That(System.Math.Abs(clip.length-duration),Is.LessThanOrEqualTo(1/fps+1e-6));
            var prefab=AssetDatabase.LoadAssetAtPath<GameObject>(path);
            var instance=Object.Instantiate(prefab);
            try {
                var animator=instance.GetComponent<Animator>();Assert.That(animator.isHuman,Is.True);
                var hips=animator.GetBoneTransform(HumanBodyBones.Hips);
                var head=animator.GetBoneTransform(HumanBodyBones.Head);
                Assert.That(head.position.y,Is.GreaterThan(hips.position.y),"Actual imported bind pose must remain head-up");
                foreach(var bone in EmoteCapContract.DrivenBones.Take(name=="Quality_Body"?18:48))
                    Assert.That(animator.GetBoneTransform(bone),Is.Not.Null,bone.ToString());
            } finally {Object.DestroyImmediate(instance);}
        }
    }
}
