using System.Collections.Generic;
using System.Linq;
using UnityEngine;

namespace EmoteCap.Tests
{
    internal sealed class ReceiverTestRig
    {
        internal GameObject Root;
        internal Avatar Avatar;
        internal Animator Animator;
        internal EmoteCapLiveLink Receiver;
    }
    internal static class ReceiverRigFactory
    {
        internal static ReceiverTestRig Create()
        {
            var root=new GameObject("Owned original receiver test rig");
            var nodes=new Dictionary<HumanBodyBones,Transform>();
            void Bone(HumanBodyBones bone,HumanBodyBones? parent,Vector3 local)
            {
                var transform=new GameObject(bone.ToString()).transform;
                transform.SetParent(parent.HasValue?nodes[parent.Value]:root.transform,false);
                transform.localPosition=local;nodes.Add(bone,transform);
            }
            Bone(HumanBodyBones.Hips,null,new Vector3(0,.95f,0));
            Bone(HumanBodyBones.Spine,HumanBodyBones.Hips,new Vector3(0,.10f,0));
            Bone(HumanBodyBones.Chest,HumanBodyBones.Spine,new Vector3(0,.12f,0));
            Bone(HumanBodyBones.UpperChest,HumanBodyBones.Chest,new Vector3(0,.12f,0));
            Bone(HumanBodyBones.Neck,HumanBodyBones.UpperChest,new Vector3(0,.15f,0));
            Bone(HumanBodyBones.Head,HumanBodyBones.Neck,new Vector3(0,.10f,0));
            Bone(HumanBodyBones.LeftShoulder,HumanBodyBones.UpperChest,new Vector3(.10f,.02f,0));
            Bone(HumanBodyBones.LeftUpperArm,HumanBodyBones.LeftShoulder,new Vector3(.08f,0,0));
            Bone(HumanBodyBones.LeftLowerArm,HumanBodyBones.LeftUpperArm,new Vector3(.30f,0,0));
            Bone(HumanBodyBones.LeftHand,HumanBodyBones.LeftLowerArm,new Vector3(.27f,0,0));
            Bone(HumanBodyBones.RightShoulder,HumanBodyBones.UpperChest,new Vector3(-.10f,.02f,0));
            Bone(HumanBodyBones.RightUpperArm,HumanBodyBones.RightShoulder,new Vector3(-.08f,0,0));
            Bone(HumanBodyBones.RightLowerArm,HumanBodyBones.RightUpperArm,new Vector3(-.30f,0,0));
            Bone(HumanBodyBones.RightHand,HumanBodyBones.RightLowerArm,new Vector3(-.27f,0,0));
            Bone(HumanBodyBones.LeftUpperLeg,HumanBodyBones.Hips,new Vector3(.09f,-.02f,0));
            Bone(HumanBodyBones.LeftLowerLeg,HumanBodyBones.LeftUpperLeg,new Vector3(0,-.43f,0));
            Bone(HumanBodyBones.LeftFoot,HumanBodyBones.LeftLowerLeg,new Vector3(0,-.42f,0));
            Bone(HumanBodyBones.LeftToes,HumanBodyBones.LeftFoot,new Vector3(0,-.04f,.14f));
            Bone(HumanBodyBones.RightUpperLeg,HumanBodyBones.Hips,new Vector3(-.09f,-.02f,0));
            Bone(HumanBodyBones.RightLowerLeg,HumanBodyBones.RightUpperLeg,new Vector3(0,-.43f,0));
            Bone(HumanBodyBones.RightFoot,HumanBodyBones.RightLowerLeg,new Vector3(0,-.42f,0));
            Bone(HumanBodyBones.RightToes,HumanBodyBones.RightFoot,new Vector3(0,-.04f,.14f));
            var description=new HumanDescription {
                human=nodes.Select(pair=>new HumanBone {boneName=pair.Value.name,
                    humanName=HumanTrait.BoneName[(int)pair.Key],limit=new HumanLimit {useDefaultValues=true}}).ToArray(),
                skeleton=root.GetComponentsInChildren<Transform>().Select(t=>new SkeletonBone {
                    name=t.name,position=t.localPosition,rotation=t.localRotation,scale=t.localScale}).ToArray(),
                upperArmTwist=.5f,lowerArmTwist=.5f,upperLegTwist=.5f,lowerLegTwist=.5f,
                armStretch=.05f,legStretch=.05f,feetSpacing=0,hasTranslationDoF=false
            };
            var avatar=AvatarBuilder.BuildHumanAvatar(root,description);
            var animator=root.AddComponent<Animator>();animator.avatar=avatar;
            var receiver=root.AddComponent<EmoteCapLiveLink>();
            return new ReceiverTestRig {Root=root,Avatar=avatar,Animator=animator,Receiver=receiver};
        }
    }
}
