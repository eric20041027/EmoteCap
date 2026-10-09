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
sys.path.insert(0,str(ROOT/'scripts'))
from emotecap_owned_process import OwnedProcess

SOURCE_PATHS=('unity/com.emotecap.mocap','contracts','server/blender','server/emotecap_server',
    'server/pyproject.toml','server/uv.lock','scripts/unity-quality.py','scripts/unity-relay-test.py',
    'scripts/test-unity.ps1','scripts/emotecap_owned_process.py','scripts/unity-required-cases.json')

def freeze_sources(paths):
    files={}
    for relative in paths:
        base=ROOT/relative
        if not base.exists():raise ValueError('Consumed source is missing: '+relative)
        if base.is_symlink() or base.is_junction():raise ValueError('Consumed source root cannot use links')
        for path in ([base] if base.is_file() else sorted(base.rglob('*'))):
            if '__pycache__' in path.parts:continue
            if path.is_symlink() or path.is_junction():raise ValueError('Consumed source cannot use links')
            if path.is_file():
                key=path.relative_to(ROOT).as_posix()
                files[key]={**record(path),'path':key,'mtimeNs':path.stat().st_mtime_ns}
    return {'roots':list(paths),'files':files}

def verify_sources(frozen):
    if freeze_sources(frozen['roots'])!=frozen:raise ValueError('Consumed source inventory changed during qualification')

def git_identity():
    return {'commit':subprocess.check_output(['git','rev-parse','HEAD'],cwd=ROOT,text=True).strip(),
        'status':subprocess.check_output(['git','status','--porcelain','--untracked-files=all'],cwd=ROOT,text=True)}

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
    with (output/(name+'.log')).open('xb') as log:
        owned=OwnedProcess(command,cwd=ROOT,env=environment,stdin=subprocess.DEVNULL,stdout=log,stderr=log)
        process=owned.process
        try:
            write_json(output/(name+'-ownership.json'),{'pid':process.pid,'command':command,'startedUtc':datetime.now(timezone.utc).isoformat()})
            try:code=process.wait(timeout=timeout)
            except subprocess.TimeoutExpired:
                raise RuntimeError('Owned '+name+' timed out; evidence retained')
        finally:
            owned.close()
            write_json(output/(name+'-completion.json'),{'pid':process.pid,'exitCode':process.returncode,
                'ownedProcessTreeTerminal':owned.closed,'completedUtc':datetime.now(timezone.utc).isoformat()})
    if code:raise RuntimeError('Actual '+name+' failed; retained log is authoritative')

def assert_xml(path,required_classes):
    if path.stat().st_size>16*1024*1024:raise ValueError('Unexpected oversized test XML')
    root=ET.parse(path).getroot()
    if root.tag!='test-run' or root.get('result')!='Passed' or int(root.get('failed','-1'))!=0 or int(root.get('skipped','-1'))!=0:
        raise ValueError('Actual zero-failure/zero-skip Unity XML is required')
    cases=list(root.iter('test-case'))
    manifest=json.loads((ROOT/'scripts/unity-required-cases.json').read_text())
    mode=path.stem
    if manifest.get('schema')!='emotecap-unity-required-cases-v1' or mode not in manifest['modes']:
        raise ValueError('Unknown mandatory Unity test mode')
    identities=[(case.get('fullname'),case.get('classname')) for case in cases]
    mandatory={(case['fullname'],case['classname']) for case in manifest['modes'][mode]}
    if len(identities)!=len(set(identities)) or any(not name or not classname for name,classname in identities):
        raise ValueError('Unity test identities must be present and unique')
    if not mandatory.issubset(set(identities)) or not set(required_classes).issubset({classname for _,classname in identities}):
        raise ValueError('Mandatory Unity test cases are missing')
    if any(case.get('result')!='Passed' for case in cases) or int(root.get('passed','-1'))!=len(cases) or int(root.get('total','-1'))!=len(cases):
        raise ValueError('Unity results and individual case counts disagree')
    return {'total':len(cases),'passed':int(root.get('passed')),'classes':required_classes}

def run(args):
    output=owned_output(args.output)
    for binary in (args.unity,args.blender,args.powershell):
        if not Path(binary).is_file():raise ValueError('Required installed qualification runtime is unavailable')
    frozen=freeze_sources(SOURCE_PATHS);identity=git_identity()
    def check_sources():
        verify_sources(frozen)
        if git_identity()!=identity:raise ValueError('Git source identity changed during qualification')
    sample=ROOT/'unity/com.emotecap.mocap/Samples~/Starter Rigs'
    material=verify_material(sample/'Animations')
    output.mkdir(parents=True,exist_ok=False)
    source_commit=identity['commit'];source_dirty=bool(identity['status'].strip())
    write_json(output/'source-snapshot.json',{'schema':'emotecap-unity-source-snapshot-v1','git':identity,**frozen})
    snapshot=output/'frozen-sources'
    for relative,item in frozen['files'].items():
        target=snapshot/relative;target.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(ROOT/relative,target)
        if record(target)['sha256']!=item['sha256']:raise ValueError('Frozen copy differs from pre-execution source')
    original_check=check_sources
    def check_sources():
        original_check()
        actual={path.relative_to(snapshot).as_posix():record(path)['sha256'] for path in snapshot.rglob('*')
            if path.is_file() and '__pycache__' not in path.parts}
        expected={relative:item['sha256'] for relative,item in frozen['files'].items()}
        if actual!=expected:raise ValueError('Executed source snapshot changed during qualification')
    check_sources()
    sample=snapshot/'unity/com.emotecap.mocap/Samples~/Starter Rigs'
    package_files=[{**record(path),'path':path.relative_to(ROOT).as_posix()} for path in sorted((ROOT/'unity/com.emotecap.mocap').rglob('*')) if path.is_file()]
    project=output/'project'
    for child in ('Assets','Packages','ProjectSettings'):(project/child).mkdir(parents=True)
    dependencies={'com.emotecap.mocap':'file:'+str(snapshot/'unity/com.emotecap.mocap').replace('\\','/'),
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
        '--','--in',str(output/'job.json'),'--out',str(output/'exports'),'--bones',str(snapshot/'contracts/bones.json')]
    command[command.index('-P')+1]=str(snapshot/'server/blender/export_fbx.py')
    check_sources()
    run_owned(command,output,'blender',120,environment)
    check_sources()
    export_destination=project/'Assets/EmoteCap/QualityExports';export_destination.mkdir(parents=True)
    exports=[]
    for fixture in fixture_clips:
        for suffix in ('.emotecap.json','.fbx'):
            path=output/'exports'/(fixture['name']+suffix);exports.append(record(path));shutil.copyfile(path,export_destination/path.name)
        write_json(export_destination/(fixture['name']+'.fixture.json'),fixture)
    write_json(output/'qualification-inputs.json',{'schema':'emotecap-unity-fbx-inputs-v1','sourceCommit':source_commit,
        'sourceDirty':source_dirty,'packageSources':package_files,
        'job':record(output/'job.json'),'contract':record(snapshot/'contracts/bones.json'),'exporter':record(snapshot/'server/blender/export_fbx.py'),
        'sampleMaterial':material,'exports':exports})
    command=[args.unity,'-batchmode','-nographics','-projectPath',str(project),'-executeMethod',
        'EmoteCap.Samples.Editor.StarterRigBuilder.PrepareQualification','-quit','-logFile',str(output/'prepare-editor.log')]
    check_sources();run_owned(command,output,'prepare',180,environment);check_sources()
    if not (output/'starter-assets.json').is_file():raise ValueError('Actual sample preparation did not create asset evidence')
    spec=importlib.util.spec_from_file_location('emotecap_owned_relay',ROOT/'scripts/unity-relay-test.py')
    relay=importlib.util.module_from_spec(spec);spec.loader.exec_module(relay)
    os.environ['EMOTECAP_UNITY_QUALITY_ROOT']=str(output)
    check_sources()
    relay.run(argparse.Namespace(output=str(output/'relay-tests'),project=str(project),mode='both',filter=None,
        unity=args.unity,powershell=args.powershell,workspace_name='2026-10-08-unity-quality',graphics=True))
    check_sources()
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
