"""Versioned job envelopes; motion data keeps the shared v2 validation."""
from typing import Annotated,Literal,Self
from pydantic import BaseModel,ConfigDict,Field,UUID4,model_validator
from ..contract import Clip

MAX_JOB_FRAMES=43202
MAX_INPUT_BYTES=128*1024*1024
TERMINAL=frozenset({'succeeded','failed','cancelled','interrupted'})

class Snapshot(BaseModel):
    model_config=ConfigDict(extra='forbid',frozen=True)
    projectId:UUID4
    takeId:UUID4
    clipRevision:Annotated[int,Field(strict=True,ge=0,le=9007199254740991)]

class JobSubmission(BaseModel):
    model_config=ConfigDict(extra='forbid')
    clips:Annotated[list[Clip],Field(min_length=1,max_length=50)]
    snapshot:Snapshot|None=None

    @model_validator(mode='before')
    @classmethod
    def raw_frame_budget(cls,value):
        if isinstance(value,dict) and isinstance(value.get('clips'),list):
            total=sum(len(clip['frames']) for clip in value['clips'] if isinstance(clip,dict) and isinstance(clip.get('frames'),list))
            if total>MAX_JOB_FRAMES:raise ValueError(f'Export aggregate frame limit is {MAX_JOB_FRAMES}; export fewer clips at once')
        return value

    @model_validator(mode='after')
    def frame_budget(self)->Self:
        if sum(len(clip.frames) for clip in self.clips)>MAX_JOB_FRAMES:
            raise ValueError(f'Export aggregate frame limit is {MAX_JOB_FRAMES}; export fewer clips at once')
        return self

class JobFile(BaseModel):
    model_config=ConfigDict(extra='forbid',frozen=True)
    name:str
    url:str
    sidecar:str

class JobError(BaseModel):
    model_config=ConfigDict(extra='forbid',frozen=True)
    message:Annotated[str,Field(max_length=512)]
    details:Annotated[str,Field(max_length=65536)]=''

JobIdentity=Annotated[str,Field(pattern=r'^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$')]

class JobStatus(BaseModel):
    model_config=ConfigDict(extra='forbid',frozen=True)
    id:JobIdentity
    schemaVersion:Literal[1]=1
    state:Literal['queued','running','succeeded','failed','cancelled','interrupted']='queued'
    phase:Annotated[str,Field(max_length=120)]='Waiting for Blender'
    progress:Annotated[int,Field(ge=0,le=100)]=0
    snapshot:Snapshot|None=None
    inputSha256:Annotated[str,Field(pattern=r'^[0-9a-f]{64}$')]
    createdAt:int
    updatedAt:int
    retryOf:JobIdentity|None=None
    cancelRequested:bool=False
    files:Annotated[list[JobFile],Field(max_length=50)]=Field(default_factory=list)
    error:JobError|None=None
    warning:Annotated[str|None,Field(max_length=512)]=None
