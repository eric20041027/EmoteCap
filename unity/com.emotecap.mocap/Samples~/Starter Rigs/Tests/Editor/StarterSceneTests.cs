using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using EmoteCap.Samples.Editor;
using NUnit.Framework;
using UnityEditor;
using UnityEditor.Animations;
using UnityEditor.SceneManagement;
using UnityEngine;
using UnityEngine.SceneManagement;

namespace EmoteCap.Samples.Tests
{
    public class StarterSceneTests
    {
        string folder;
        string sentinelFolder;
        readonly HashSet<Scene> originalScenes=new HashSet<Scene>();
        [SetUp] public void Setup()
        {
            var active=SceneManager.GetActiveScene();
            if(string.IsNullOrEmpty(active.path)) {
                Assert.That(Application.dataPath.Replace('\\','/'),Does.Contain("/.superpowers/sdd/2026-10-08-unity-quality/"));
                Assert.That(EditorSceneManager.SaveScene(active,"Assets/EmoteCap/SceneTestBaseline-"+Guid.NewGuid().ToString("N")+".unity"),Is.True);
            }
            originalScenes.Clear();
            for(var i=0;i<SceneManager.sceneCount;i++)originalScenes.Add(SceneManager.GetSceneAt(i));
            folder=StarterRigBuilder.Destination+"Tests-"+Guid.NewGuid().ToString("N");
        }
        [TearDown] public void Cleanup()
        {
            for(var i=SceneManager.sceneCount-1;i>=0;i--) {
                var scene=SceneManager.GetSceneAt(i);
                if(!originalScenes.Contains(scene))EditorSceneManager.CloseScene(scene,true);
            }
            if(AssetDatabase.IsValidFolder(folder))AssetDatabase.DeleteAsset(folder);
            if(sentinelFolder!=null&&AssetDatabase.IsValidFolder(sentinelFolder))AssetDatabase.DeleteAsset(sentinelFolder);
            sentinelFolder=null;
        }
        [Test] public void SampleSceneSavesAndReloadsBothPlayersAndVisibleDependencies()
        {
            var active=SceneManager.GetActiveScene();
            var scene=StarterRigBuilder.BuildScene(folder,false);
            Assert.That(scene.path,Is.EqualTo(folder+"/StarterScene.unity"));
            Assert.That(File.Exists(scene.path),Is.True);
            Assert.That(SceneManager.GetActiveScene().handle,Is.EqualTo(active.handle));
            EditorSceneManager.CloseScene(scene,true);
            scene=EditorSceneManager.OpenScene(folder+"/StarterScene.unity",OpenSceneMode.Additive);
            var roots=scene.GetRootGameObjects();
            var players=roots.SelectMany(root=>root.GetComponentsInChildren<EmoteCapClipPlayer>()).ToArray();
            Assert.That(players.Length,Is.EqualTo(2));
            Assert.That(roots.SelectMany(root=>root.GetComponentsInChildren<Camera>()).Count(),Is.EqualTo(1));
            Assert.That(roots.SelectMany(root=>root.GetComponentsInChildren<Light>()).Count(),Is.GreaterThan(0));
            foreach(var player in players) {
                var animator=player.GetComponent<Animator>();Assert.That(animator.isHuman&&animator.avatar.isValid,Is.True);
                var skin=player.GetComponent<SkinnedMeshRenderer>();
                Assert.That(AssetDatabase.Contains(skin.sharedMesh)&&AssetDatabase.Contains(skin.sharedMaterial),Is.True);
                var data=new SerializedObject(player);var clip=(AnimationClip)data.FindProperty("clips").GetArrayElementAtIndex(0).objectReferenceValue;
                Assert.That(clip.humanMotion,Is.True);Assert.That(data.FindProperty("editorFolder").stringValue,Is.EqualTo(folder));
                Assert.That(player.transform.position.y+skin.sharedMesh.bounds.min.y,Is.EqualTo(0).Within(.0001f));
            }
            Assert.That(players.Count(player=>new SerializedObject(player).FindProperty("showMenu").boolValue),Is.EqualTo(1));
        }
        [Test] public void ExistingSceneDestinationRejectsWithoutChangingAnySceneOrAsset()
        {
            AssetDatabase.CreateFolder("Assets/EmoteCap",Path.GetFileName(folder));
            var sentinel=folder+"/sentinel.txt";File.WriteAllText(sentinel,"original user asset");
            var count=SceneManager.sceneCount;var active=SceneManager.GetActiveScene().handle;
            Assert.Throws<InvalidOperationException>(()=>StarterRigBuilder.BuildScene(folder,true));
            Assert.That(SceneManager.sceneCount,Is.EqualTo(count));Assert.That(SceneManager.GetActiveScene().handle,Is.EqualTo(active));
            Assert.That(File.ReadAllText(sentinel),Is.EqualTo("original user asset"));
        }
        [Test] public void ForeignSceneDestinationRejectsBeforeCreatingAnyScene()
        {
            var count=SceneManager.sceneCount;
            Assert.Throws<ArgumentException>(()=>StarterRigBuilder.BuildScene("Assets/Other/StarterRigs",true));
            Assert.That(SceneManager.sceneCount,Is.EqualTo(count));
        }
        [Test] public void CreatingSampleCannotRebuildAnExistingUserPlaylistController()
        {
            sentinelFolder="Assets/EmoteCap/UserPlaylistTest-"+Guid.NewGuid().ToString("N");
            AssetDatabase.CreateFolder("Assets/EmoteCap",Path.GetFileName(sentinelFolder));
            var path=sentinelFolder+"/EmoteCapClips.controller";
            var controller=AnimatorController.CreateAnimatorControllerAtPath(path);
            controller.layers[0].stateMachine.AddState("Original user state");AssetDatabase.SaveAssets();
            var before=File.ReadAllBytes(path);
            StarterRigBuilder.BuildScene(folder,false);
            CollectionAssert.AreEqual(before,File.ReadAllBytes(path),"Creating only a sample must preserve an unrelated user controller");
        }
    }
}
