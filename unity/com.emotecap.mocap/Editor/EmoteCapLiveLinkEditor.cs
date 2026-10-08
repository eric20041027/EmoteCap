using System;
using UnityEditor;
using UnityEngine;

namespace EmoteCap.Editor
{
    [CustomEditor(typeof(EmoteCapLiveLink))]
    public sealed class EmoteCapLiveLinkEditor : UnityEditor.Editor
    {
        [NonSerialized] string pairingCode="";
        void OnDisable() {pairingCode="";}
        public override void OnInspectorGUI()
        {
            DrawDefaultInspector();var receiver=(EmoteCapLiveLink)target;
            EditorGUILayout.HelpBox("Enter Play mode, paste the Studio pairing code, then Connect. Codes stay in memory.",MessageType.Info);
            using(new EditorGUI.DisabledScope(!Application.isPlaying||!receiver.isActiveAndEnabled)) {
                pairingCode=EditorGUILayout.PasswordField("Pairing code",pairingCode);
                if(GUILayout.Button("Connect")){var code=pairingCode;pairingCode="";receiver.ConnectPairing(code);}
                if(GUILayout.Button("Stop")){pairingCode="";receiver.StopPairing();}
            }
            if(!Application.isPlaying)pairingCode="";
            EditorGUILayout.LabelField("Status",receiver.Status);
            EditorGUILayout.LabelField("Accepted frames",receiver.AcceptedFrameCount.ToString());
            if(Application.isPlaying)Repaint();
        }
    }
}
