"""Owned real Blender/Unity sample qualification, never physical-capture acceptance."""
import argparse
import copy
from datetime import datetime,timezone
import hashlib
import importlib.util
import json
import math
import os
from pathlib import Path,PurePosixPath
import shutil
import subprocess
import sys
import xml.etree.ElementTree as ET

ROOT=Path(__file__).resolve().parents[1]
WORK=ROOT/'.superpowers/sdd/2026-10-08-unity-quality'

def clips():
    original=json.loads((ROOT/'contracts/fixtures/raise-right-arm.clip.json').read_text())
    raised=copy.deepcopy(original);raised['name']='Sample_Raise_Right_Arm'
    result=[raised]
    tpose=copy.deepcopy(raised);tpose['name']='Quality_Tpose';tpose['loop']=True
    tpose['frames']=[copy.deepcopy(raised['frames'][0]) for _ in range(2)];tpose['frames'][1]['t']=1
    result.append(tpose)
    posed=copy.deepcopy(raised);posed['name']='Quality_PosedStart'
    posed['frames']=[copy.deepcopy(raised['frames'][30]),copy.deepcopy(raised['frames'][-1])]
    posed['frames'][0]['t']=0;posed['frames'][1]['t']=.45;result.append(posed)
    irregular=copy.deepcopy(raised);irregular['name']='Quality_Irregular'
    irregular['frames']=[copy.deepcopy(raised['frames'][i]) for i in (0,12,30,48,59)]
    for frame,time in zip(irregular['frames'],(0,.013,.077,.217,1.7)):frame['t']=time
    result.append(irregular)
    body=copy.deepcopy(raised);body['name']='Quality_Body';body['skeleton']='body';result.append(body)
    single=copy.deepcopy(raised);single['name']='Quality_Single'
    single['frames']=[copy.deepcopy(raised['frames'][30])];single['frames'][0]['t']=0;result.append(single)
    fingers=copy.deepcopy(tpose);fingers['name']='Quality_Fingers';fingers['loop']=False
    for index in range(18,48):fingers['frames'][1]['r'][index*4:index*4+4]=[0,0,math.sin(.2),math.cos(.2)]
    result.append(fingers)
    mirrored=copy.deepcopy(raised);mirrored['name']='Negative_Mirrored'
    for frame in mirrored['frames']:
        for left,right in ((6,9),(7,10),(8,11)):
            x,y,z,w=frame['r'][right*4:right*4+4]
            frame['r'][left*4:left*4+4]=[x,-y,-z,w]
            frame['r'][right*4:right*4+4]=[0,0,0,1]
    result.append(mirrored)
    frozen=copy.deepcopy(raised);frozen['name']='Negative_Frozen'
    for frame in frozen['frames']:frame['r']=[0,0,0,1]*48
    result.append(frozen)
    return result

def owned_output(value):
    raw=Path(value).absolute()
    for path in (raw,*raw.parents):
        if path.is_symlink() or path.is_junction():raise ValueError('Owned quality paths cannot contain links')
    path=Path(os.path.abspath(value));work=WORK.absolute()
    if path==work or not path.is_relative_to(work) or path.exists():
        raise ValueError('Use a fresh child of the Unity quality workspace')
    return path

def record(path):
    if not path.is_file() or path.is_symlink():raise ValueError('Required qualification file is missing or linked')
    return {'path':path.name,'bytes':path.stat().st_size,'sha256':hashlib.sha256(path.read_bytes()).hexdigest()}

def verify_material(folder):
    proof=json.loads((folder/'provenance.json').read_text())
    if proof.get('schema')!='emotecap-original-sample-animation-v1':raise ValueError('Unknown sample material')
    files=proof.get('files')
    required={'Sample_Raise_Right_Arm.fbx','Sample_Raise_Right_Arm.emotecap.json','Sample_Raise_Right_Arm.fixture.json'}
    if not isinstance(files,list) or len(files)!=3 or {item.get('path') for item in files}!=required:
        raise ValueError('Sample material must supply all three original files')
    for item in files:
        name=PurePosixPath(item['path'])
        if name.is_absolute() or len(name.parts)!=1 or ':' in item['path'] or '\\' in item['path']:
            raise ValueError('Invalid sample material path')
        if record(folder/item['path'])!=item:raise ValueError('Sample material bytes differ from provenance')
    return proof

def write_json(path,value):
    with path.open('x',encoding='utf-8',newline='\n') as stream:json.dump(value,stream,indent=2,allow_nan=False)

def run_owned(command,output,name,timeout,environment):
    flags=subprocess.CREATE_NO_WINDOW if os.name=='nt' else 0
    with (output/(name+'.log')).open('xb') as log:
        process=subprocess.Popen(command,cwd=ROOT,env=environment,stdin=subprocess.DEVNULL,stdout=log,stderr=log,creationflags=flags)
        write_json(output/(name+'-ownership.json'),{'pid':process.pid,'command':command,'startedUtc':datetime.now(timezone.utc).isoformat()})
        try:
            try:code=process.wait(timeout=timeout)
            except subprocess.TimeoutExpired:
                process.kill();process.wait();raise RuntimeError('Owned '+name+' timed out; evidence retained')
        finally:
            write_json(output/(name+'-completion.json'),{'pid':process.pid,'exitCode':process.returncode,'completedUtc':datetime.now(timezone.utc).isoformat()})
    if code:raise RuntimeError('Actual '+name+' failed; retained log is authoritative')

def assert_xml(path,required_classes):
    if path.stat().st_size>16*1024*1024:raise ValueError('Unexpected oversized test XML')
    root=ET.parse(path).getroot()
    if root.tag!='test-run' or root.get('result')!='Passed' or int(root.get('failed','-1'))!=0 or int(root.get('skipped','-1'))!=0:
        raise ValueError('Actual zero-failure/zero-skip Unity XML is required')
    cases=list(root.iter('test-case'))
    minimum={'EmoteCap.Tests.LiveProtocolTests':55,'EmoteCap.Tests.LiveReceiverTests':22,'EmoteCap.Tests.LiveRelayInteropTests':7}
    for classname in required_classes:
        matches=[case for case in cases if case.get('classname')==classname]
        if len(matches)<minimum.get(classname,1) or any(case.get('result')!='Passed' for case in matches):raise ValueError('Required Unity class did not pass: '+classname)
    return {'total':len(cases),'passed':int(root.get('passed')),'classes':required_classes}

def run(args):
    output=owned_output(args.output)
    for binary in (args.unity,args.blender,args.powershell):
        if not Path(binary).is_file():raise ValueError('Required installed qualification runtime is unavailable')
    sample=ROOT/'unity/com.emotecap.mocap/Samples~/Starter Rigs'
    material=verify_material(sample/'Animations')
    output.mkdir(parents=True,exist_ok=False)
    source_commit=subprocess.check_output(['git','rev-parse','HEAD'],cwd=ROOT,text=True).strip()
    source_dirty=bool(subprocess.check_output(['git','status','--porcelain'],cwd=ROOT,text=True).strip())
    package_files=[{**record(path),'path':path.relative_to(ROOT).as_posix()} for path in sorted((ROOT/'unity/com.emotecap.mocap').rglob('*')) if path.is_file()]
    project=output/'project'
    for child in ('Assets','Packages','ProjectSettings'):(project/child).mkdir(parents=True)
    dependencies={'com.emotecap.mocap':'file:'+str(ROOT/'unity/com.emotecap.mocap').replace('\\','/'),
        'com.unity.test-framework':'1.7.0','com.unity.nuget.newtonsoft-json':'3.2.2',
        **{'com.unity.modules.'+name:'1.0.0' for name in ('animation','physics','imgui','jsonserialize','imageconversion')}}
    write_json(project/'Packages/manifest.json',{'dependencies':dependencies,'testables':['com.emotecap.mocap']})
    (project/'ProjectSettings/ProjectVersion.txt').write_text('m_EditorVersion: 6000.5.9f1\nm_EditorVersionWithRevision: 6000.5.9f1 (b57deb96f08d)\n',encoding='utf-8')
    copied=[];destination=project/'Assets/Samples/EmoteCap/Starter Rigs'
    for path in sorted(sample.rglob('*')):
        if path.is_symlink() or path.is_junction():raise ValueError('Sample source cannot contain links')
        if path.is_file():
            target=destination/path.relative_to(sample);target.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(path,target)
            if path.read_bytes()!=target.read_bytes():raise ValueError('Imported sample differs from source')
            copied.append({**record(path),'path':path.relative_to(sample).as_posix()})
    write_json(output/'sample-copy.json',copied)
    fixture_clips=clips()
    write_json(output/'job.json',{'clips':fixture_clips})
    environment=dict(os.environ);environment['ALLUSERSPROFILE']=os.environ.get('ProgramData','C:/ProgramData')
    environment['EMOTECAP_UNITY_QUALITY_ROOT']=str(output)
    command=[args.blender,'-b','--factory-startup','--python-exit-code','1','-P',str(ROOT/'server/blender/export_fbx.py'),
        '--','--in',str(output/'job.json'),'--out',str(output/'exports'),'--bones',str(ROOT/'contracts/bones.json')]
    run_owned(command,output,'blender',120,environment)
    export_destination=project/'Assets/EmoteCap/QualityExports';export_destination.mkdir(parents=True)
    exports=[]
    for fixture in fixture_clips:
        for suffix in ('.emotecap.json','.fbx'):
            path=output/'exports'/(fixture['name']+suffix);exports.append(record(path));shutil.copyfile(path,export_destination/path.name)
        write_json(export_destination/(fixture['name']+'.fixture.json'),fixture)
    write_json(output/'qualification-inputs.json',{'schema':'emotecap-unity-fbx-inputs-v1','sourceCommit':source_commit,
        'sourceDirty':source_dirty,'packageSources':package_files,
        'job':record(output/'job.json'),'contract':record(ROOT/'contracts/bones.json'),'exporter':record(ROOT/'server/blender/export_fbx.py'),
        'sampleMaterial':material,'exports':exports})
    command=[args.unity,'-batchmode','-nographics','-projectPath',str(project),'-executeMethod',
        'EmoteCap.Samples.Editor.StarterRigBuilder.PrepareQualification','-quit','-logFile',str(output/'prepare-editor.log')]
    run_owned(command,output,'prepare',180,environment)
    if not (output/'starter-assets.json').is_file():raise ValueError('Actual sample preparation did not create asset evidence')
    spec=importlib.util.spec_from_file_location('emotecap_owned_relay',ROOT/'scripts/unity-relay-test.py')
    relay=importlib.util.module_from_spec(spec);spec.loader.exec_module(relay)
    os.environ['EMOTECAP_UNITY_QUALITY_ROOT']=str(output)
    relay.run(argparse.Namespace(output=str(output/'relay-tests'),project=str(project),mode='both',filter=None,
        unity=args.unity,powershell=args.powershell,workspace_name='2026-10-08-unity-quality',graphics=True))
    edit=assert_xml(output/'relay-tests/EditMode.xml',['EmoteCap.Tests.LiveProtocolTests','EmoteCap.Samples.Tests.StarterRigTests',
        'EmoteCap.Samples.Tests.StarterSceneTests','EmoteCap.Samples.Tests.FbxImportTests','EmoteCap.Samples.Tests.CanonicalFbxTests'])
    play=assert_xml(output/'relay-tests/PlayMode.xml',['EmoteCap.Tests.LiveReceiverTests','EmoteCap.Tests.LiveRelayInteropTests',
        'EmoteCap.Samples.Tests.FbxPlaybackTests','EmoteCap.Samples.Tests.ClipPlayerTests','EmoteCap.Samples.Tests.SampleRenderTests'])
    for frozen in package_files:
        if {**record(ROOT/frozen['path']),'path':frozen['path']}!=frozen:raise ValueError('Package source changed during qualification')
    write_json(output/'complete.json',{'sourceCommit':source_commit,'sourceDirty':source_dirty,'Editor':edit,'Play':play,'physicalAcceptance':False,
        'projectLicenseApproved':False,'completedUtc':datetime.now(timezone.utc).isoformat()})
    print(json.dumps({'status':'actual-two-rig-unity-qualified','sourceCommit':source_commit,'Editor':edit['passed'],'Play':play['passed']}))

if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    for name in ('output','unity','blender','powershell'):parser.add_argument('--'+name,required=True)
    run(parser.parse_args())
