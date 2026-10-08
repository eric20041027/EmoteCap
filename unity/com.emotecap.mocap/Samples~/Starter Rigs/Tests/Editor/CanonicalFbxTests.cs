using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using Newtonsoft.Json.Linq;
using NUnit.Framework;
using UnityEditor;
using UnityEngine;

namespace EmoteCap.Samples.Tests
{
    public class CanonicalFbxTests
    {
        [TestCase("Sample_Raise_Right_Arm")] [TestCase("Quality_Tpose")] [TestCase("Quality_PosedStart")]
        [TestCase("Quality_Irregular")] [TestCase("Quality_Body")] [TestCase("Quality_Single")] [TestCase("Quality_Fingers")]
        public void ActualUnityGenericImportPreservesCanonicalHeadsAndBoneDirectionsAtEverySourceTime(string name)
        {
            var source="Assets/EmoteCap/QualityExports/"+name;
            var fixture=JObject.Parse(File.ReadAllText(source+".fixture.json"));
            var contract=JObject.Parse(File.ReadAllText(EmoteCap.Samples.Editor.StarterRigBuilder.SampleFolder()+"/bones.json"));
            var driven=((JArray)contract["driven"]).Select(value=>(string)value).ToArray();
            var skeleton=((JArray)contract["skeleton"]).Where(bone=>name!="Quality_Body"||Array.IndexOf(driven,(string)bone["name"])<18).ToArray();
            var folder="Assets/EmoteCapCanonicalTests-"+Guid.NewGuid().ToString("N");
            GameObject instance=null;
            try {
                AssetDatabase.CreateFolder("Assets",Path.GetFileName(folder));var path=folder+"/"+name+".fbx";
                File.Copy(source+".fbx",path,false);AssetDatabase.ImportAsset(path,ImportAssetOptions.ForceSynchronousImport);
                var importer=(ModelImporter)AssetImporter.GetAtPath(path);importer.animationType=ModelImporterAnimationType.Generic;
                importer.animationCompression=ModelImporterAnimationCompression.Off;importer.resampleCurves=false;importer.SaveAndReimport();
                var clip=AssetDatabase.LoadAllAssetsAtPath(path).OfType<AnimationClip>().Single(value=>!value.name.StartsWith("__preview"));
                instance=UnityEngine.Object.Instantiate(AssetDatabase.LoadAssetAtPath<GameObject>(path));
                var transforms=instance.GetComponentsInChildren<Transform>().ToDictionary(value=>value.name,value=>value);
                Vector3 Point(JToken vector) => EmoteCapContract.ToUnity((float)vector[0],(float)vector[1],(float)vector[2]);
                var rest=skeleton.ToDictionary(bone=>(string)bone["name"],bone=>Point(bone["head"]));
                var maxPosition=0f;var maxDirection=0f;
                foreach(var frame in fixture["frames"]) {
                    clip.SampleAnimation(instance,(float)frame["t"]);
                    var heads=new Dictionary<string,Vector3>();var deltas=new Dictionary<string,Quaternion>();
                    foreach(var bone in skeleton) {
                        var boneName=(string)bone["name"];var parent=(string)bone["parent"];var index=Array.IndexOf(driven,boneName);
                        var delta=index>=0?EmoteCapContract.ToUnity((float)frame["r"][index*4],(float)frame["r"][index*4+1],
                            (float)frame["r"][index*4+2],(float)frame["r"][index*4+3]):deltas[parent];
                        // Independent geometry oracle: world-delta rotates the canonical
                        // parent-relative rest offset. No imported rest transform is read.
                        var head=parent==null?Point(frame["h"]):heads[parent]+deltas[parent]*(rest[boneName]-rest[parent]);
                        heads.Add(boneName,head);deltas.Add(boneName,delta);
                        var actual=transforms[(string)bone["fbx"]];
                        maxPosition=Mathf.Max(maxPosition,Vector3.Distance(actual.position,head));
                        var expectedDirection=delta*(Point(bone["tail"])-rest[boneName]).normalized;
                        maxDirection=Mathf.Max(maxDirection,Vector3.Angle(actual.up,expectedDirection));
                    }
                }
                TestContext.WriteLine(name+" independentCanonicalPositionError="+maxPosition+"m directionError="+maxDirection+"degrees samples="+fixture["frames"].Count());
                Assert.That(maxPosition,Is.LessThanOrEqualTo(.001f));Assert.That(maxDirection,Is.LessThanOrEqualTo(.5f));
            } finally {
                if(instance!=null)UnityEngine.Object.DestroyImmediate(instance);
                if(AssetDatabase.IsValidFolder(folder))AssetDatabase.DeleteAsset(folder);
            }
        }
    }
}
