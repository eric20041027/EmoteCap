using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Security.Cryptography;
using System.Text.RegularExpressions;
using Newtonsoft.Json.Linq;
using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine;
using UnityEngine.SceneManagement;
namespace EmoteCap.Samples.Editor
{
    public static class StarterRigBuilder
    {
        public const string Destination="Assets/EmoteCap/StarterRigs";
        static string VerifySampleAnimation()
        {
            var folder=SampleFolder()+"/Animations";
            var proof=JObject.Parse(File.ReadAllText(folder+"/provenance.json"));
            var records=(JArray)proof["files"];
            var names=new[]{"Sample_Raise_Right_Arm.fbx","Sample_Raise_Right_Arm.emotecap.json","Sample_Raise_Right_Arm.fixture.json"};
            if((string)proof["schema"]!="emotecap-original-sample-animation-v1"||records==null||records.Count!=3||
                !records.Select(record=>(string)record["path"]).OrderBy(value=>value,StringComparer.Ordinal)
                    .SequenceEqual(names.OrderBy(value=>value,StringComparer.Ordinal)))
                throw new InvalidOperationException("The original sample animation material is incomplete.");
            foreach(var record in records) {
                var path=folder+"/"+(string)record["path"];
                if(!File.Exists(path)||(File.GetAttributes(path)&FileAttributes.ReparsePoint)!=0||new FileInfo(path).Length!=(long)record["bytes"])
                    throw new InvalidOperationException("The original sample animation material differs from its provenance.");
                using(var hash=SHA256.Create())using(var stream=File.OpenRead(path))
                    if(BitConverter.ToString(hash.ComputeHash(stream)).Replace("-","").ToLowerInvariant()!=(string)record["sha256"])
                        throw new InvalidOperationException("The original sample animation material differs from its provenance.");
            }
            return folder;
        }
        [MenuItem("EmoteCap/Create Starter Scene")]
        public static void CreateScene() {BuildScene(Destination,true);}
        public static Scene BuildScene(string destination,bool activateScene)
        {
            CheckDestination(destination);var animation=VerifySampleAnimation();
            if(activateScene&&!EditorSceneManager.SaveCurrentModifiedScenesIfUserWantsTo())return default;
            var prefabs=BuildAssets(destination);
            foreach(var suffix in new[]{".emotecap.json",".fbx"})
                File.Copy(animation+"/Sample_Raise_Right_Arm"+suffix,destination+"/Sample_Raise_Right_Arm"+suffix,false);
            var fbx=destination+"/Sample_Raise_Right_Arm.fbx";
            AssetDatabase.ImportAsset(fbx,ImportAssetOptions.ForceSynchronousImport);
            var clip=AssetDatabase.LoadAllAssetsAtPath(fbx).OfType<AnimationClip>().Single(value=>!value.name.StartsWith("__preview",StringComparison.Ordinal));
            if(!clip.humanMotion)throw new InvalidOperationException("The original sample FBX must import as a Humanoid clip.");
            var previous=SceneManager.GetActiveScene();
            var scene=EditorSceneManager.NewScene(NewSceneSetup.EmptyScene,activateScene?NewSceneMode.Single:NewSceneMode.Additive);
            SceneManager.SetActiveScene(scene);
            try {
                for(var i=0;i<prefabs.Length;i++) {
                    var rig=(GameObject)PrefabUtility.InstantiatePrefab(AssetDatabase.LoadAssetAtPath<GameObject>(prefabs[i]),scene);
                    var skin=rig.GetComponent<SkinnedMeshRenderer>();rig.transform.position=new Vector3(i==0?-.8f:.8f,-skin.sharedMesh.bounds.min.y,0);
                    var player=rig.AddComponent<EmoteCapClipPlayer>();
                    var data=new SerializedObject(player);var list=data.FindProperty("clips");list.arraySize=1;
                    list.GetArrayElementAtIndex(0).objectReferenceValue=clip;
                    data.FindProperty("editorFolder").stringValue=destination;data.FindProperty("showMenu").boolValue=i==0;
                    data.ApplyModifiedPropertiesWithoutUndo();
                }
                var camera=new GameObject("Starter Camera").AddComponent<Camera>();
                camera.transform.position=new Vector3(0,1.3f,4);camera.transform.LookAt(new Vector3(0,1,0));
                camera.clearFlags=CameraClearFlags.SolidColor;camera.backgroundColor=new Color(.12f,.14f,.18f);
                var light=new GameObject("Starter Light").AddComponent<Light>();light.type=LightType.Directional;
                light.transform.rotation=Quaternion.Euler(50,-30,0);light.intensity=1;
                var floor=GameObject.CreatePrimitive(PrimitiveType.Cube);floor.name="Starter Floor";
                floor.transform.position=new Vector3(0,-.02f,0);floor.transform.localScale=new Vector3(5,.04f,3);
                var material=new Material(Shader.Find("Standard")) {name="Starter Floor Material",color=new Color(.3f,.32f,.35f)};
                AssetDatabase.CreateAsset(material,destination+"/Floor.material.asset");floor.GetComponent<MeshRenderer>().sharedMaterial=material;
                if(!EditorSceneManager.SaveScene(scene,destination+"/StarterScene.unity"))throw new InvalidOperationException("Could not save the Starter Scene.");
                AssetDatabase.SaveAssets();return scene;
            } finally {if(!activateScene&&previous.IsValid()&&previous.isLoaded)SceneManager.SetActiveScene(previous);}
        }
        public static string SampleFolder()
        {
            var paths=AssetDatabase.FindAssets("StarterRigBuilder t:MonoScript")
                .Select(AssetDatabase.GUIDToAssetPath)
                .Where(path=>path.EndsWith("/Starter Rigs/Editor/StarterRigBuilder.cs",StringComparison.Ordinal)).ToArray();
            if(paths.Length!=1)throw new InvalidOperationException("Import exactly one Starter Rigs sample into this project.");
            return Path.GetDirectoryName(Path.GetDirectoryName(paths[0])).Replace('\\','/');
        }
        static Vector3 Vector(JToken token) => EmoteCapContract.ToUnity((float)token[0],(float)token[1],(float)token[2]);
        static float SegmentScale(string name,bool tall)
        {
            if(!tall)return 1;
            if(name.Contains("Leg")||name.Contains("Foot")||name.Contains("ToeBase"))return 1.20f;
            if(name.Contains("Arm")||name.Contains("Hand")||name.Contains("Thumb")||name.Contains("Index")||
                name.Contains("Middle")||name.Contains("Ring")||name.Contains("Little")||name.Contains("Shoulder"))return 1.15f;
            return .90f;
        }
        public static GameObject CreateRig(bool tall)
        {
            var contract=JObject.Parse(File.ReadAllText(SampleFolder()+"/bones.json"));
            var skeleton=(JArray)contract["skeleton"];
            if((int)contract["version"]!=2||skeleton.Count!=52||((JArray)contract["driven"]).Count!=48)
                throw new InvalidOperationException("Starter Rigs requires the canonical v2 skeleton.");
            var root=new GameObject(tall?"Tall":"Standard");
            var nodes=new Dictionary<string,Transform>();var heads=new Dictionary<string,Vector3>();
            foreach(var bone in skeleton) {
                var name=(string)bone["name"];var parent=(string)bone["parent"];
                var head=Vector(bone["head"]);heads.Add(name,head);
                var node=new GameObject(name).transform;
                node.SetParent(parent!=null?nodes[parent]:root.transform,false);
                node.localPosition=parent!=null?(head-heads[parent])*SegmentScale(name,tall):new Vector3(0,tall?1.10f:.95f,0);
                nodes.Add(name,node);
            }
            var description=new HumanDescription {
                human=nodes.Select(pair=> {
                    var name=pair.Key.Replace("ToeBase","Toes");
                    var mapped=(HumanBodyBones)Enum.Parse(typeof(HumanBodyBones),name);
                    return new HumanBone {boneName=pair.Key,humanName=HumanTrait.BoneName[(int)mapped],
                        limit=new HumanLimit {useDefaultValues=true}};
                }).ToArray(),
                skeleton=root.GetComponentsInChildren<Transform>().Select(node=>new SkeletonBone {
                    name=node.name,position=node.localPosition,rotation=node.localRotation,scale=node.localScale}).ToArray(),
                upperArmTwist=.5f,lowerArmTwist=.5f,upperLegTwist=.5f,lowerLegTwist=.5f,
                armStretch=.05f,legStretch=.05f,feetSpacing=0,hasTranslationDoF=false
            };
            var avatar=AvatarBuilder.BuildHumanAvatar(root,description);avatar.name=root.name+" Avatar";
            if(!avatar.isValid||!avatar.isHuman) {
                UnityEngine.Object.DestroyImmediate(avatar);UnityEngine.Object.DestroyImmediate(root);
                throw new InvalidOperationException("Generated Starter Rig is not a valid Humanoid.");
            }
            var animator=root.AddComponent<Animator>();animator.avatar=avatar;animator.applyRootMotion=false;
            var mesh=BuildMesh(skeleton,nodes,tall);mesh.name=root.name+" Mesh";
            var skin=root.AddComponent<SkinnedMeshRenderer>();skin.sharedMesh=mesh;
            skin.bones=nodes.Values.ToArray();skin.rootBone=nodes["Hips"];skin.updateWhenOffscreen=true;
            var shader=Shader.Find("Standard");
            if(shader==null)shader=Shader.Find("Universal Render Pipeline/Lit");
            if(shader==null)throw new InvalidOperationException("A supported lit shader is required for the Starter Rigs sample.");
            skin.sharedMaterial=new Material(shader) {name=root.name+" Material",color=tall?new Color(.9f,.55f,.2f):new Color(.2f,.65f,.9f)};
            return root;
        }
        static Mesh BuildMesh(JArray skeleton,Dictionary<string,Transform> nodes,bool tall)
        {
            var vertices=new List<Vector3>();var triangles=new List<int>();var weights=new List<BoneWeight>();
            var index=0;
            foreach(var bone in skeleton) {
                var name=(string)bone["name"];var start=nodes[name].position;
                var end=start+(Vector(bone["tail"])-Vector(bone["head"]))*SegmentScale(name,tall);
                var axis=(end-start).normalized;
                var side=Vector3.Cross(axis,Mathf.Abs(axis.z)<.9f?Vector3.forward:Vector3.up).normalized;
                var depth=Vector3.Cross(axis,side).normalized;
                var finger=name.Contains("Thumb")||name.Contains("Index")||name.Contains("Middle")||name.Contains("Ring")||name.Contains("Little");
                var width=finger?.008f:(name=="Hips"||name=="Spine"||name=="Chest"||name=="UpperChest"||name=="Head"?.07f:.035f);
                var offset=vertices.Count;
                for(var cap=0;cap<2;cap++)foreach(var corner in new[]{new Vector2(-1,-1),new Vector2(1,-1),new Vector2(1,1),new Vector2(-1,1)}) {
                    vertices.Add((cap==0?start:end)+side*corner.x*width+depth*corner.y*width);
                    weights.Add(new BoneWeight {boneIndex0=index,weight0=1});
                }
                foreach(var value in new[]{0,2,1,0,3,2,4,5,6,4,6,7,0,1,5,0,5,4,1,2,6,1,6,5,2,3,7,2,7,6,3,0,4,3,4,7})triangles.Add(offset+value);
                index++;
            }
            var mesh=new Mesh {vertices=vertices.ToArray(),triangles=triangles.ToArray(),boneWeights=weights.ToArray(),
                bindposes=nodes.Values.Select(node=>node.worldToLocalMatrix).ToArray()};
            mesh.RecalculateNormals();mesh.RecalculateBounds();return mesh;
        }
        static void CheckDestination(string destination)
        {
            if(destination==null||!Regex.IsMatch(destination,"^Assets/EmoteCap/StarterRigs(?:Tests-[a-f0-9]{32})?$"))
                throw new ArgumentException("Use the owned Starter Rigs destination.",nameof(destination));
            var path=Path.GetFullPath(destination);
            for(var ancestor=Path.GetDirectoryName(path);ancestor!=null;ancestor=Path.GetDirectoryName(ancestor)) {
                if(Directory.Exists(ancestor)&&(File.GetAttributes(ancestor)&FileAttributes.ReparsePoint)!=0)
                    throw new ArgumentException("Starter Rigs destinations cannot contain links.",nameof(destination));
            }
            if(Directory.Exists(path)||File.Exists(path)||File.Exists(path+".meta"))
                throw new InvalidOperationException("Starter Rigs destination already exists; existing assets are preserved.");
        }
        public static string[] BuildAssets(string destination)
        {
            CheckDestination(destination);
            if(!AssetDatabase.IsValidFolder("Assets/EmoteCap"))AssetDatabase.CreateFolder("Assets","EmoteCap");
            AssetDatabase.CreateFolder("Assets/EmoteCap",Path.GetFileName(destination));
            var paths=new List<string>();
            foreach(var tall in new[]{false,true}) {
                var rig=CreateRig(tall);
                try {
                    var animator=rig.GetComponent<Animator>();var skin=rig.GetComponent<SkinnedMeshRenderer>();
                    AssetDatabase.CreateAsset(animator.avatar,destination+"/"+rig.name+".avatar.asset");
                    AssetDatabase.CreateAsset(skin.sharedMesh,destination+"/"+rig.name+".mesh.asset");
                    AssetDatabase.CreateAsset(skin.sharedMaterial,destination+"/"+rig.name+".material.asset");
                    var path=destination+"/"+rig.name+".prefab";
                    if(PrefabUtility.SaveAsPrefabAsset(rig,path)==null)throw new InvalidOperationException("Could not save the Starter Rig prefab.");
                    paths.Add(path);
                } finally {UnityEngine.Object.DestroyImmediate(rig);}
            }
            AssetDatabase.SaveAssets();return paths.ToArray();
        }
        public static void PrepareQualification()
        {
            var output=Environment.GetEnvironmentVariable("EMOTECAP_UNITY_QUALITY_ROOT");
            var project=Path.GetFullPath(Path.Combine(Application.dataPath,".."));
            var normalized=project.Replace('\\','/');
            const string marker="/.superpowers/sdd/2026-10-08-unity-quality/";
            var index=normalized.IndexOf(marker,StringComparison.Ordinal);
            if(index<0||string.IsNullOrEmpty(output))throw new InvalidOperationException("Use the owned Unity quality project and output.");
            var work=normalized.Substring(0,index+marker.Length);
            var fullOutput=Path.GetFullPath(output).Replace('\\','/');
            if(!fullOutput.StartsWith(work,StringComparison.OrdinalIgnoreCase)||!Directory.Exists(fullOutput))
                throw new InvalidOperationException("Qualification output must be an existing owned child directory.");
            for(var ancestor=fullOutput;ancestor!=null;ancestor=Path.GetDirectoryName(ancestor))
                if(Directory.Exists(ancestor)&&(File.GetAttributes(ancestor)&FileAttributes.ReparsePoint)!=0)
                    throw new InvalidOperationException("Qualification output cannot contain links.");
            var receipt=Path.Combine(fullOutput,"starter-assets.json");
            if(File.Exists(receipt))throw new InvalidOperationException("Use fresh qualification evidence.");
            if(string.IsNullOrEmpty(SceneManager.GetActiveScene().path))
                if(!EditorSceneManager.SaveScene(SceneManager.GetActiveScene(),"Assets/EmoteCap/QualificationInput.unity"))
                    throw new InvalidOperationException("Could not save the owned qualification input scene.");
            var prepared=BuildScene(Destination,false);EditorSceneManager.CloseScene(prepared,true);
            var prefabs=new[]{Destination+"/Standard.prefab",Destination+"/Tall.prefab"};
            var records=new JArray();
            foreach(var path in Directory.GetFiles(Destination,"*",SearchOption.AllDirectories).OrderBy(value=>value,StringComparer.Ordinal)) {
                using(var hash=SHA256.Create())using(var stream=File.OpenRead(path))
                    records.Add(new JObject {["path"]=path.Replace('\\','/'),["bytes"]=stream.Length,
                        ["sha256"]=BitConverter.ToString(hash.ComputeHash(stream)).Replace("-","").ToLowerInvariant()});
            }
            var report=new JObject {["schema"]="emotecap-original-starter-assets-v1",["unityVersion"]=Application.unityVersion,
                ["prefabs"]=new JArray(prefabs),["assets"]=records,["thirdPartyCharacters"]=false,["projectLicenseApproved"]=false};
            using(var stream=new FileStream(receipt,FileMode.CreateNew,FileAccess.Write))
            using(var writer=new StreamWriter(stream,new System.Text.UTF8Encoding(false)))writer.Write(report.ToString());
        }
    }
}
