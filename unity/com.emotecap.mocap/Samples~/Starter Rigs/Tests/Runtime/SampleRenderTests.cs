#if UNITY_EDITOR
using System;
using System.Collections;
using System.IO;
using System.Linq;
using System.Reflection;
using Newtonsoft.Json.Linq;
using NUnit.Framework;
using UnityEditor.SceneManagement;
using UnityEngine;
using UnityEngine.Animations;
using UnityEngine.Playables;
using UnityEngine.Rendering;
using UnityEngine.SceneManagement;
using UnityEngine.TestTools;

namespace EmoteCap.Samples.Tests
{
    public class SampleRenderTests
    {
        static Texture2D Capture(Camera camera)
        {
            var target=new RenderTexture(512,384,24);var previous=RenderTexture.active;var original=camera.targetTexture;
            try {
                camera.targetTexture=target;camera.Render();RenderTexture.active=target;
                var image=new Texture2D(512,384,TextureFormat.RGB24,false);image.ReadPixels(new Rect(0,0,512,384),0,0);image.Apply();return image;
            } finally {camera.targetTexture=original;RenderTexture.active=previous;target.Release();UnityEngine.Object.Destroy(target);}
        }
        static int[] ColoredBounds(Texture2D image,bool blue)
        {
            var pixels=image.GetPixels32();var count=0;var maxY=0;
            for(var i=0;i<pixels.Length;i++) {
                var color=pixels[i];var matches=blue?color.b>38&&color.b>color.r*1.3f&&color.g>color.r*1.2f:
                    color.r>38&&color.r>color.b*1.6f&&color.r>color.g*1.2f;
                if(matches){count++;maxY=Mathf.Max(maxY,i/image.width);}
            }
            return new[]{count,maxY};
        }
        static void Pose(EmoteCapClipPlayer player,double time)
        {
            var fields=BindingFlags.Instance|BindingFlags.NonPublic;
            var graph=(PlayableGraph)typeof(EmoteCapClipPlayer).GetField("graph",fields).GetValue(player);
            var current=(AnimationClipPlayable)typeof(EmoteCapClipPlayer).GetField("current",fields).GetValue(player);
            graph.Stop();current.SetTime(time);graph.Evaluate(0);
        }
        static void Save(Texture2D image,string path)
        {using(var file=new FileStream(path,FileMode.CreateNew,FileAccess.Write)) {var bytes=image.EncodeToPNG();file.Write(bytes,0,bytes.Length);}}
        [UnityTest] public IEnumerator SavedSceneActuallyRendersBothColoredCharactersAndTheirRaisedPose()
        {
            Assert.That(SystemInfo.graphicsDeviceType,Is.Not.EqualTo(GraphicsDeviceType.Null),"Actual graphics context is required; do not skip or call no-graphics success");
            var path="Assets/EmoteCap/StarterRigs/StarterScene.unity";
            yield return EditorSceneManager.LoadSceneInPlayMode(path,new LoadSceneParameters(LoadSceneMode.Additive));
            var scene=SceneManager.GetSceneByPath(path);Texture2D first=null;Texture2D raised=null;
            try {
                yield return null;
                var roots=scene.GetRootGameObjects();var players=roots.SelectMany(root=>root.GetComponentsInChildren<EmoteCapClipPlayer>()).ToArray();
                Assert.That(players.Length,Is.EqualTo(2));var camera=roots.SelectMany(root=>root.GetComponentsInChildren<Camera>()).Single();
                foreach(var player in players)Pose(player,0);yield return null;first=Capture(camera);
                var firstHands=players.Select(player=>player.GetComponent<Animator>().GetBoneTransform(HumanBodyBones.RightHand).position.y).ToArray();
                foreach(var player in players)Pose(player,1);yield return null;raised=Capture(camera);
                var raisedHands=players.Select(player=>player.GetComponent<Animator>().GetBoneTransform(HumanBodyBones.RightHand).position.y).ToArray();
                var firstBlue=ColoredBounds(first,true);var firstOrange=ColoredBounds(first,false);
                var nextBlue=ColoredBounds(raised,true);var nextOrange=ColoredBounds(raised,false);
                TestContext.WriteLine("blue="+string.Join(",",firstBlue)+"→"+string.Join(",",nextBlue)+" orange="+string.Join(",",firstOrange)+"→"+string.Join(",",nextOrange));
                var folder=Environment.GetEnvironmentVariable("EMOTECAP_UNITY_QUALITY_ROOT");Assert.That(string.IsNullOrEmpty(folder),Is.False);
                var id=Guid.NewGuid().ToString("N");Save(first,Path.Combine(folder,"sample-tpose-"+id+".png"));Save(raised,Path.Combine(folder,"sample-raised-"+id+".png"));
                var report=new JObject {["schema"]="emotecap-original-sample-render-v1",["graphicsDevice"]=SystemInfo.graphicsDeviceName,
                    ["blueTpose"]=new JArray(firstBlue),["blueRaised"]=new JArray(nextBlue),["orangeTpose"]=new JArray(firstOrange),["orangeRaised"]=new JArray(nextOrange),
                    ["firstHands"]=new JArray(firstHands),["raisedHands"]=new JArray(raisedHands)};
                using(var file=new FileStream(Path.Combine(folder,"render-"+id+".json"),FileMode.CreateNew,FileAccess.Write))using(var writer=new StreamWriter(file))writer.Write(report.ToString());
                Assert.That(firstBlue[0],Is.GreaterThan(100));Assert.That(firstOrange[0],Is.GreaterThan(100));
                Assert.That(nextBlue[1]-firstBlue[1],Is.GreaterThan(3));Assert.That(nextOrange[1]-firstOrange[1],Is.GreaterThan(3));
            } finally {
                if(first!=null)UnityEngine.Object.Destroy(first);if(raised!=null)UnityEngine.Object.Destroy(raised);
                if(scene.IsValid()&&scene.isLoaded)SceneManager.UnloadSceneAsync(scene);
            }
            yield return null;
        }
    }
}
#endif
