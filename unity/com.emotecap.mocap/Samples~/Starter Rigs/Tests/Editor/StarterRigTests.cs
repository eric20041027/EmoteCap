using System;
using System.IO;
using System.Linq;
using EmoteCap.Samples.Editor;
using NUnit.Framework;
using UnityEditor;
using UnityEngine;

namespace EmoteCap.Samples.Tests
{
    public class StarterRigTests
    {
        string ownedFolder;
        [TearDown] public void Cleanup()
        {
            if(ownedFolder!=null&&AssetDatabase.IsValidFolder(ownedFolder))AssetDatabase.DeleteAsset(ownedFolder);
            ownedFolder=null;
        }
        static void DestroyRig(GameObject rig)
        {
            var animator=rig.GetComponent<Animator>();
            if(animator!=null&&animator.avatar!=null)UnityEngine.Object.DestroyImmediate(animator.avatar);
            foreach(var skin in rig.GetComponentsInChildren<SkinnedMeshRenderer>()) {
                UnityEngine.Object.DestroyImmediate(skin.sharedMesh);
                foreach(var material in skin.sharedMaterials)UnityEngine.Object.DestroyImmediate(material);
            }
            UnityEngine.Object.DestroyImmediate(rig);
        }
        [TestCase(false)] [TestCase(true)] public void OriginalRigHasAllDrivenMappings(bool tall)
        {
            var rig=StarterRigBuilder.CreateRig(tall);
            try {
                var animator=rig.GetComponent<Animator>();Assert.That(animator,Is.Not.Null);
                Assert.That(animator.avatar.isValid&&animator.isHuman,Is.True);
                foreach(var bone in EmoteCapContract.DrivenBones)Assert.That(animator.GetBoneTransform(bone),Is.Not.Null,bone.ToString());
                var skin=rig.GetComponentInChildren<SkinnedMeshRenderer>();Assert.That(skin,Is.Not.Null);
                var mesh=skin.sharedMesh;Assert.That(mesh.vertexCount,Is.GreaterThan(0));
                Assert.That(mesh.boneWeights.Length,Is.EqualTo(mesh.vertexCount));
                Assert.That(skin.bones.Length,Is.EqualTo(52));
                Assert.That(mesh.bindposes.Length,Is.EqualTo(skin.bones.Length));
                Assert.That(mesh.boneWeights.All(weight=>weight.weight0==1&&weight.boneIndex0>=0&&weight.boneIndex0<skin.bones.Length),Is.True);
                Assert.That(mesh.vertices.All(v=>!float.IsNaN(v.x)&&!float.IsInfinity(v.x)&&!float.IsNaN(v.y)&&!float.IsInfinity(v.y)&&!float.IsNaN(v.z)&&!float.IsInfinity(v.z)),Is.True);
            } finally {DestroyRig(rig);}
        }
        [Test] public void TallRigHasDifferentLimbToTorsoRatios()
        {
            var standard=StarterRigBuilder.CreateRig(false);var tall=StarterRigBuilder.CreateRig(true);
            try {
                float Ratio(GameObject rig) {
                    var animator=rig.GetComponent<Animator>();Assert.That(animator,Is.Not.Null);
                    var arm=Vector3.Distance(animator.GetBoneTransform(HumanBodyBones.RightUpperArm).position,animator.GetBoneTransform(HumanBodyBones.RightHand).position);
                    var torso=Vector3.Distance(animator.GetBoneTransform(HumanBodyBones.Hips).position,animator.GetBoneTransform(HumanBodyBones.Neck).position);
                    return arm/torso;
                }
                Assert.That(Ratio(tall)/Ratio(standard),Is.GreaterThan(1.15f));
                Assert.That(standard.transform.localScale,Is.EqualTo(Vector3.one));
                Assert.That(tall.transform.localScale,Is.EqualTo(Vector3.one));
            } finally {DestroyRig(standard);DestroyRig(tall);}
        }
        [Test] public void SavedPrefabsReloadWithPersistentAvatarMeshAndMaterial()
        {
            ownedFolder="Assets/EmoteCap/StarterRigsTests-"+Guid.NewGuid().ToString("N");
            var paths=StarterRigBuilder.BuildAssets(ownedFolder);
            Assert.That(paths.Length,Is.EqualTo(2));AssetDatabase.SaveAssets();AssetDatabase.Refresh();
            foreach(var path in paths) {
                var prefab=AssetDatabase.LoadAssetAtPath<GameObject>(path);Assert.That(prefab,Is.Not.Null);
                var animator=prefab.GetComponent<Animator>();Assert.That(animator.avatar.isValid&&animator.avatar.isHuman,Is.True);
                Assert.That(AssetDatabase.Contains(animator.avatar),Is.True);
                var skin=prefab.GetComponentInChildren<SkinnedMeshRenderer>();
                Assert.That(AssetDatabase.Contains(skin.sharedMesh),Is.True);
                Assert.That(AssetDatabase.Contains(skin.sharedMaterial),Is.True);
                var instance=UnityEngine.Object.Instantiate(prefab);
                try {Assert.That(instance.GetComponent<Animator>().isHuman,Is.True);}
                finally {UnityEngine.Object.DestroyImmediate(instance);}
            }
            var before=Directory.GetFiles(ownedFolder,"*",SearchOption.AllDirectories).OrderBy(path=>path).Select(File.ReadAllBytes).ToArray();
            Assert.Throws<InvalidOperationException>(()=>StarterRigBuilder.BuildAssets(ownedFolder));
            var after=Directory.GetFiles(ownedFolder,"*",SearchOption.AllDirectories).OrderBy(path=>path).Select(File.ReadAllBytes).ToArray();
            Assert.That(after.Length,Is.EqualTo(before.Length));
            for(var i=0;i<before.Length;i++)CollectionAssert.AreEqual(before[i],after[i]);
        }
        [TestCase("Assets/../foreign")] [TestCase("Packages/StarterRigs")] [TestCase("Assets/Other/StarterRigs")]
        public void BuilderRejectsForeignDestination(string path)
        { Assert.Throws<ArgumentException>(()=>StarterRigBuilder.BuildAssets(path)); }
        [Test] public void PreparedPrefabsRemainValidAfterFreshEditorImport()
        {
            // The independent executeMethod editor must have persisted these first.
            foreach(var name in new[]{"Standard","Tall"}) {
                var prefab=AssetDatabase.LoadAssetAtPath<GameObject>(StarterRigBuilder.Destination+"/"+name+".prefab");
                Assert.That(prefab,Is.Not.Null,"Owned preparation must persist the sample before this new Editor starts");
                var animator=prefab.GetComponent<Animator>();
                Assert.That(animator.avatar.isValid&&animator.avatar.isHuman,Is.True);
                Assert.That(AssetDatabase.GetAssetPath(animator.avatar),Does.StartWith(StarterRigBuilder.Destination+"/"));
                var skin=prefab.GetComponent<SkinnedMeshRenderer>();
                Assert.That(AssetDatabase.GetAssetPath(skin.sharedMesh),Does.StartWith(StarterRigBuilder.Destination+"/"));
                Assert.That(AssetDatabase.GetAssetPath(skin.sharedMaterial),Does.StartWith(StarterRigBuilder.Destination+"/"));
                foreach(var bone in EmoteCapContract.DrivenBones)Assert.That(animator.GetBoneTransform(bone),Is.Not.Null);
            }
        }
    }
}
