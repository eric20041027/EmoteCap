#if UNITY_EDITOR
using System;
using System.Collections;
using System.Linq;
using System.Reflection;
using NUnit.Framework;
using UnityEditor;
using UnityEngine;
using UnityEngine.Animations;
using UnityEngine.Playables;
using UnityEngine.TestTools;

namespace EmoteCap.Samples.Tests
{
    public class ClipPlayerTests
    {
        static AnimationClip Clip(string name) => AssetDatabase.LoadAllAssetsAtPath("Assets/EmoteCap/QualityExports/"+name+".fbx")
            .OfType<AnimationClip>().Single(clip=>!clip.name.StartsWith("__preview"));
        static T Read<T>(EmoteCapClipPlayer player,string field) => (T)typeof(EmoteCapClipPlayer).GetField(field,BindingFlags.Instance|BindingFlags.NonPublic).GetValue(player);
        static GameObject Create(string name,bool loop,bool all,params AnimationClip[] clips)
        {
            var rig=UnityEngine.Object.Instantiate(AssetDatabase.LoadAssetAtPath<GameObject>("Assets/EmoteCap/StarterRigs/"+name+".prefab"));
            var player=rig.AddComponent<EmoteCapClipPlayer>();var data=new SerializedObject(player);
            var list=data.FindProperty("clips");list.arraySize=clips.Length;
            for(var i=0;i<clips.Length;i++)list.GetArrayElementAtIndex(i).objectReferenceValue=clips[i];
            // This imported source-only folder has no FBX models; preserve the explicitly supplied clips.
            data.FindProperty("editorFolder").stringValue="Assets/Samples/EmoteCap/Starter Rigs/Editor";
            data.FindProperty("showMenu").boolValue=false;data.FindProperty("loop").boolValue=loop;data.FindProperty("playAll").boolValue=all;
            data.ApplyModifiedPropertiesWithoutUndo();return rig;
        }
        static IEnumerator Until(Func<bool> predicate,float seconds=4)
        {
            var deadline=Time.realtimeSinceStartup+seconds;
            while(!predicate()&&Time.realtimeSinceStartup<deadline)yield return null;
            Assert.That(predicate(),Is.True,"The actual player must reach the expected state before deadline");
        }
        [UnityTest] public IEnumerator ActualPlayerAdvancesAndHoldsTheRaisedPoseOnBothRigs()
        {
            foreach(var name in new[]{"Standard","Tall"}) {
                var rig=Create(name,false,false,Clip("Sample_Raise_Right_Arm"));
                try {
                    var player=rig.GetComponent<EmoteCapClipPlayer>();var hand=rig.GetComponent<Animator>().GetBoneTransform(HumanBodyBones.RightHand);
                    var start=hand.position.y;yield return null;
                    yield return Until(()=>hand.position.y-start>.15f);
                    yield return Until(()=>Read<AnimationClipPlayable>(player,"current").GetSpeed()==0);
                    var held=hand.position;var clip=Read<AnimationClipPlayable>(player,"current");
                    Assert.That(clip.GetTime(),Is.EqualTo(Clip("Sample_Raise_Right_Arm").length-.001f).Within(.0001));
                    for(var i=0;i<5;i++)yield return null;
                    Assert.That(Vector3.Distance(hand.position,held),Is.LessThan(.001f));
                } finally {UnityEngine.Object.Destroy(rig);}
                yield return null;
            }
        }
        [UnityTest] public IEnumerator ActualPlayerLoopsAndPlayAllSwitchesItsRealClips()
        {
            foreach(var name in new[]{"Standard","Tall"}) {
                var rig=Create(name,true,false,Clip("Quality_Single"));
                try {
                    yield return null;var player=rig.GetComponent<EmoteCapClipPlayer>();
                    var previous=Read<AnimationClipPlayable>(player,"current").GetTime();var resets=0;
                    var deadline=Time.realtimeSinceStartup+2;
                    while(resets<2&&Time.realtimeSinceStartup<deadline) {
                        yield return null;var time=Read<AnimationClipPlayable>(player,"current").GetTime();
                        if(time<previous)resets++;previous=time;
                    }
                    Assert.That(resets,Is.GreaterThanOrEqualTo(2));
                } finally {UnityEngine.Object.Destroy(rig);}
                yield return null;
                rig=Create(name,false,true,Clip("Quality_Single"),Clip("Sample_Raise_Right_Arm"));
                try {
                    yield return null;var player=rig.GetComponent<EmoteCapClipPlayer>();
                    yield return Until(()=>Read<int>(player,"currentIndex")==1);
                    Assert.That(Read<AnimationClipPlayable>(player,"current").GetAnimationClip().name,Is.EqualTo("Sample_Raise_Right_Arm"));
                } finally {UnityEngine.Object.Destroy(rig);}
                yield return null;
            }
        }
        [UnityTest] public IEnumerator DisablingPlayerStopsItsOwnedGraphAndEnableResumes()
        {
            var rig=Create("Standard",true,false,Clip("Sample_Raise_Right_Arm"));
            try {
                yield return null;var player=rig.GetComponent<EmoteCapClipPlayer>();var graph=Read<PlayableGraph>(player,"graph");
                Assert.That(graph.IsPlaying(),Is.True);player.enabled=false;yield return null;
                Assert.That(graph.IsPlaying(),Is.False,"Disabling the component must stop its owned animation graph");
                player.enabled=true;yield return null;Assert.That(graph.IsPlaying(),Is.True);
                UnityEngine.Object.Destroy(rig);yield return null;Assert.That(graph.IsValid(),Is.False);
            } finally {if(rig!=null)UnityEngine.Object.Destroy(rig);}
        }
    }
}
#endif
