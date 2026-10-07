"""Isolated inputs/runners for job behavior tests, never real Blender or Unity."""
import dataclasses
import json
import threading
import uuid

from emotecap_server.config import load_settings
from emotecap_server.jobs.models import JobSubmission
from emotecap_server.jobs.runner import JobCancelled


def settings_at(tmp_path):
    return dataclasses.replace(load_settings(),data_dir=tmp_path/'data',unity_export_dir=None)


def submission():
    return JobSubmission.model_validate({'clips':[{'name':'Wave','fps':30,'loop':False,
        'frames':[{'t':0,'h':[0,1,0],'r':[0,0,0,1]*48}]}],
        'snapshot':{'projectId':str(uuid.uuid4()),'takeId':str(uuid.uuid4()),'clipRevision':7}})


def write_outputs(settings,json_path,out,cancel,progress):
    if cancel.is_set():raise JobCancelled('Cancelled')
    out.mkdir(parents=True)
    clips=json.loads(json_path.read_text())['clips']
    for n,clip in enumerate(clips,1):
        (out/f"{clip['name']}.fbx").write_bytes(b'FBX fixture')
        (out/f"{clip['name']}.emotecap.json").write_text('{}')
        progress(n*100//len(clips))


class BlockingRunner:
    def __init__(self):
        self.started=threading.Event();self.release=threading.Event();self.active=0;self.maximum=0;self.calls=0
    def __call__(self,settings,json_path,out,cancel,progress):
        self.active+=1;self.maximum=max(self.maximum,self.active);self.calls+=1;self.started.set()
        try:
            while not self.release.wait(.02):
                if cancel.is_set():raise JobCancelled('Cancelled')
            write_outputs(settings,json_path,out,cancel,progress)
        finally:self.active-=1
