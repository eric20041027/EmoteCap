#if UNITY_EDITOR
using System;
using System.Collections;
using System.IO;
using System.Linq;
using Newtonsoft.Json.Linq;
using NUnit.Framework;
using UnityEditor;
using UnityEngine;
using UnityEngine.Animations;
using UnityEngine.Playables;
using UnityEngine.TestTools;

namespace EmoteCap.Samples.Tests
{
    public class FbxPlaybackTests
    {
        static AnimationClip Imported(string name) => AssetDatabase.LoadAllAssetsAtPath("Assets/EmoteCap/QualityExports/"+name+".fbx")
            .OfType<AnimationClip>().Single(clip=>!clip.name.StartsWith("__preview"));
        static GameObject Rig(string name) => UnityEngine.Object.Instantiate(AssetDatabase.LoadAssetAtPath<GameObject>(
            "Assets/EmoteCap/StarterRigs/"+name+".prefab"));
        static bool Finite(Vector3 value) => !float.IsNaN(value.x)&&!float.IsInfinity(value.x)&&
            !float.IsNaN(value.y)&&!float.IsInfinity(value.y)&&!float.IsNaN(value.z)&&!float.IsInfinity(value.z);
        [UnityTest] public IEnumerator ActualMirroredAndFrozenFbxCannotPassTheRightHandAcceptance()
        {
            foreach(var name in new[]{"Negative_Mirrored","Negative_Frozen"}) {
                var rig=Rig("Standard");var animator=rig.GetComponent<Animator>();var clip=Imported(name);
                var graph=PlayableGraph.Create("Owned negative motion acceptance");
                try {
                    graph.SetTimeUpdateMode(DirectorUpdateMode.Manual);var output=AnimationPlayableOutput.Create(graph,"Negative",animator);
                    var playable=AnimationClipPlayable.Create(graph,clip);playable.SetApplyFootIK(false);output.SetSourcePlayable(playable);graph.Play();
                    var right=animator.GetBoneTransform(HumanBodyBones.RightHand);var left=animator.GetBoneTransform(HumanBodyBones.LeftHand);
                    playable.SetTime(0);graph.Evaluate(0);var firstRight=right.position;var firstLeft=left.position;
                    var rise=0f;var leftMotion=0f;
                    var fixture=JObject.Parse(File.ReadAllText("Assets/EmoteCap/QualityExports/"+name+".fixture.json"));
                    foreach(var frame in fixture["frames"]) {
                        playable.SetTime((double)frame["t"]);graph.Evaluate(0);
                        rise=Mathf.Max(rise,right.position.y-firstRight.y);leftMotion=Mathf.Max(leftMotion,Vector3.Distance(left.position,firstLeft));
                    }
                    TestContext.WriteLine(name+" rightRise="+rise+" leftMotion="+leftMotion);
                    Assert.That(rise>.15f&&leftMotion<.05f,Is.False,"Real malformed motion must fail the same positive acceptance predicate");
                    if(name=="Negative_Mirrored")Assert.That(leftMotion,Is.GreaterThan(.15f));
                    else Assert.That(leftMotion,Is.LessThan(.001f));
                } finally {if(graph.IsValid())graph.Destroy();UnityEngine.Object.Destroy(rig);}
                yield return null;
            }
        }
        [UnityTest] public IEnumerator EveryRealFixtureStaysFiniteAndHeadUpOnBothRigProportions()
        {
            foreach(var name in new[]{"Quality_Tpose","Quality_PosedStart","Quality_Irregular","Quality_Body","Quality_Single","Quality_Fingers"})
            foreach(var rigName in new[]{"Standard","Tall"}) {
                var rig=Rig(rigName);var animator=rig.GetComponent<Animator>();var graph=PlayableGraph.Create("Owned all-fixture playback");
                try {
                    graph.SetTimeUpdateMode(DirectorUpdateMode.Manual);var output=AnimationPlayableOutput.Create(graph,"Fixture",animator);
                    var playable=AnimationClipPlayable.Create(graph,Imported(name));playable.SetApplyFootIK(false);output.SetSourcePlayable(playable);graph.Play();
                    var fixture=JObject.Parse(File.ReadAllText("Assets/EmoteCap/QualityExports/"+name+".fixture.json"));
                    var finger=animator.GetBoneTransform(HumanBodyBones.RightIndexProximal);Quaternion? firstFinger=null;var fingerMovement=0f;
                    foreach(var frame in fixture["frames"]) {
                        playable.SetTime((double)frame["t"]);graph.Evaluate(0);
                        foreach(var bone in EmoteCapContract.DrivenBones)Assert.That(Finite(animator.GetBoneTransform(bone).position),Is.True,bone.ToString());
                        Assert.That(animator.GetBoneTransform(HumanBodyBones.Head).position.y,Is.GreaterThan(animator.GetBoneTransform(HumanBodyBones.Hips).position.y));
                        if(firstFinger.HasValue)fingerMovement=Mathf.Max(fingerMovement,Quaternion.Angle(firstFinger.Value,finger.rotation));else firstFinger=finger.rotation;
                    }
                    TestContext.WriteLine(name+" rig="+rigName+" frames="+fixture["frames"].Count()+" fingerMovement="+fingerMovement);
                    if(name=="Quality_Fingers")Assert.That(fingerMovement,Is.GreaterThan(1f),"Moving finger source cannot become a frozen Humanoid finger clip");
                } finally {if(graph.IsValid())graph.Destroy();UnityEngine.Object.Destroy(rig);}
                yield return null;
            }
        }
        [UnityTest] public IEnumerator SingleFrameHumanoidActuallyHoldsItsPosedSourceOnBothRigs()
        {
            var clip=Imported("Quality_Single");
            foreach(var name in new[]{"Standard","Tall"}) {
                var rig=Rig(name);var animator=rig.GetComponent<Animator>();
                var right=animator.GetBoneTransform(HumanBodyBones.RightHand);
                var rest=rig.transform.InverseTransformPoint(right.position);
                var graph=PlayableGraph.Create("Owned single-frame Humanoid hold");
                try {
                    graph.SetTimeUpdateMode(DirectorUpdateMode.Manual);
                    var output=AnimationPlayableOutput.Create(graph,"Single pose",animator);
                    var playable=AnimationClipPlayable.Create(graph,clip);playable.SetApplyFootIK(false);
                    output.SetSourcePlayable(playable);graph.Play();
                    Vector3? first=null;
                    foreach(var time in new[]{0,clip.length*.5f,Mathf.Max(0,clip.length-.0001f)}) {
                        playable.SetTime(time);graph.Evaluate(0);
                        var point=rig.transform.InverseTransformPoint(right.position);
                        Assert.That(Finite(point),Is.True);
                        Assert.That(point.y-rest.y,Is.GreaterThan(.15f),"The sole posed source cannot become an empty/T-pose clip");
                        if(first.HasValue)Assert.That(Vector3.Distance(point,first.Value),Is.LessThan(.001f));
                        else first=point;
                    }
                    TestContext.WriteLine(name+" singleFrameDuration="+clip.length+" posedRise="+(first.Value.y-rest.y));
                } finally {if(graph.IsValid())graph.Destroy();UnityEngine.Object.Destroy(rig);}
                yield return null;
            }
        }
        [UnityTest] public IEnumerator RealHumanoidClipMovesTheRightHandOnBothProportionsAndRotatedRoots()
        {
            var clip=Imported("Sample_Raise_Right_Arm");
            var fixture=JObject.Parse(File.ReadAllText("Assets/EmoteCap/QualityExports/Sample_Raise_Right_Arm.fixture.json"));
            foreach(var name in new[]{"Standard","Tall"})foreach(var rootAngle in new[]{0f,37f}) {
                var rig=Rig(name);rig.transform.rotation=Quaternion.Euler(0,rootAngle,0);
                var animator=rig.GetComponent<Animator>();animator.applyRootMotion=false;
                var graph=PlayableGraph.Create("Owned original rig FBX qualification");
                try {
                    graph.SetTimeUpdateMode(DirectorUpdateMode.Manual);
                    var output=AnimationPlayableOutput.Create(graph,"Real imported Humanoid",animator);
                    var playable=AnimationClipPlayable.Create(graph,clip);playable.SetApplyFootIK(false);
                    output.SetSourcePlayable(playable);graph.Play();
                    var right=animator.GetBoneTransform(HumanBodyBones.RightHand);var left=animator.GetBoneTransform(HumanBodyBones.LeftHand);
                    var hips=animator.GetBoneTransform(HumanBodyBones.Hips);var head=animator.GetBoneTransform(HumanBodyBones.Head);
                    playable.SetTime(0);graph.Evaluate(0);yield return null;
                    var initialRight=rig.transform.InverseTransformPoint(right.position);
                    var initialLeft=rig.transform.InverseTransformPoint(left.position);
                    var rootPosition=rig.transform.position;
                    var joints=EmoteCapContract.DrivenBones.Select(animator.GetBoneTransform).ToArray();
                    var lengths=joints.Select(joint=>joint.parent!=null?Vector3.Distance(joint.position,joint.parent.position):0).ToArray();
                    var samples=new JArray();var rightRise=0f;var leftMotion=0f;
                    foreach(var frame in fixture["frames"]) {
                        var time=(double)frame["t"];playable.SetTime(time);graph.Evaluate(0);
                        var rightPoint=rig.transform.InverseTransformPoint(right.position);var leftPoint=rig.transform.InverseTransformPoint(left.position);
                        rightRise=Mathf.Max(rightRise,rightPoint.y-initialRight.y);leftMotion=Mathf.Max(leftMotion,Vector3.Distance(leftPoint,initialLeft));
                        Assert.That(head.position.y,Is.GreaterThan(hips.position.y));
                        Assert.That(Vector3.Distance(rig.transform.position,rootPosition),Is.LessThan(.001f));
                        for(var i=0;i<joints.Length;i++) {
                            Assert.That(Finite(joints[i].position)&&Finite(joints[i].localPosition),Is.True,joints[i].name);
                            // Hips-to-GameObject is root translation, not a limb segment.
                            // Humanoid body/hips translation is measured separately below.
                            if(i>0)Assert.That(Vector3.Distance(joints[i].position,joints[i].parent.position),Is.EqualTo(lengths[i]).Within(.001f),joints[i].name);
                        }
                        var mesh=new Mesh();rig.GetComponent<SkinnedMeshRenderer>().BakeMesh(mesh);
                        try {Assert.That(mesh.vertices.All(Finite),Is.True);}
                        finally {UnityEngine.Object.Destroy(mesh);}
                        samples.Add(new JObject {["t"]=time,["right"]=new JArray(rightPoint.x,rightPoint.y,rightPoint.z),
                            ["left"]=new JArray(leftPoint.x,leftPoint.y,leftPoint.z),["headY"]=head.position.y,["hipsY"]=hips.position.y});
                    }
                    TestContext.WriteLine(name+" rootAngle="+rootAngle+" rightRise="+rightRise+" leftMotion="+leftMotion+" samples="+samples.Count);
                    Assert.That(rightRise,Is.GreaterThan(.15f),"An unmoving or mirrored clip cannot qualify the sample");
                    Assert.That(leftMotion,Is.LessThan(.05f),"The source moves the right hand, not the left hand");
                    var outputRoot=Environment.GetEnvironmentVariable("EMOTECAP_UNITY_QUALITY_ROOT");
                    Assert.That(string.IsNullOrEmpty(outputRoot),Is.False,"Owned measurement output is required");
                    var report=new JObject {["rig"]=name,["rootAngle"]=rootAngle,["rightRise"]=rightRise,["leftMotion"]=leftMotion,["samples"]=samples};
                    using(var stream=new FileStream(Path.Combine(outputRoot,"playback-"+Guid.NewGuid().ToString("N")+".json"),FileMode.CreateNew,FileAccess.Write))
                    using(var writer=new StreamWriter(stream))writer.Write(report.ToString());
                } finally {if(graph.IsValid())graph.Destroy();UnityEngine.Object.Destroy(rig);}
                yield return null;
            }
        }
    }
}
#endif
