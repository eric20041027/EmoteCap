"""Strict live envelopes; export duration bounds never apply to stream uptime."""
import json
import math
import re
from dataclasses import dataclass
from uuid import UUID,RFC_4122
from ..contract import BONES,BONE_COUNT

MAX_MESSAGE_BYTES=16*1024
TOKEN_PATTERN=re.compile(r'[A-Za-z0-9_-]{43}')

class PolicyViolation(ValueError):
    """A safe constant reason for closing an untrusted connection."""

@dataclass(frozen=True)
class Hello:
    session_id:str
    token:str

def canonical_id(value):
    if not isinstance(value,str):return False
    try:
        identifier=UUID(value)
        return identifier.version==4 and identifier.variant==RFC_4122 and str(identifier)==value
    except (ValueError,AttributeError):return False

def _pairs(pairs):
    result={}
    for key,value in pairs:
        if key in result:raise ValueError('Duplicate field')
        result[key]=value
    return result

def _constant(_):raise ValueError('Nonfinite JSON')

def message(text):
    if not isinstance(text,str):raise PolicyViolation('Text messages are required')
    try:
        if len(text)>MAX_MESSAGE_BYTES or len(text.encode('utf-8'))>MAX_MESSAGE_BYTES:
            raise PolicyViolation('Live message exceeds16KiB')
        value=json.loads(text,object_pairs_hook=_pairs,parse_constant=_constant)
    except (ValueError,RecursionError,UnicodeError) as exc:
        if isinstance(exc,PolicyViolation):raise
        raise PolicyViolation('Malformed live message') from exc
    if not isinstance(value,dict):raise PolicyViolation('Live message must be an object')
    return value

def parse_hello(text,role):
    value=message(text)
    if role not in ('source','sink') or set(value)!={'type','version','bones','sessionId','token'}:
        raise PolicyViolation('A compatible hello is required')
    if value['type']!='hello' or type(value['version']) is not int or value['version']!=2 or value['bones']!=BONES:
        raise PolicyViolation('Live protocol version or bones do not match')
    if not canonical_id(value['sessionId']) or not isinstance(value['token'],str) or not TOKEN_PATTERN.fullmatch(value['token']):
        raise PolicyViolation('Pairing identity or secret is invalid')
    return Hello(value['sessionId'],value['token'])

def _number(value):
    if type(value) not in (int,float):return False
    try:return math.isfinite(value)
    except OverflowError:return False

def validate_frame(text,last_t):
    value=message(text)
    if set(value)!={'type','t','h','r'} or value['type']!='frame':raise PolicyViolation('A live frame is required')
    t,h,r=value['t'],value['h'],value['r']
    if not _number(t) or t<0 or (last_t is not None and t<=last_t):raise PolicyViolation('Live timestamps must increase')
    if not isinstance(h,list) or len(h)!=3 or not all(map(_number,h)) or abs(h[0])>1e-6 or abs(h[2])>1e-6:
        raise PolicyViolation('Live hips must be finite and in-place')
    if not isinstance(r,list) or len(r)!=BONE_COUNT*4 or not all(map(_number,r)):
        raise PolicyViolation('Live rotations must match canonical bones')
    if any(not .98<=math.hypot(*r[index:index+4])<=1.02 for index in range(0,len(r),4)):
        raise PolicyViolation('Live quaternions must have unit length')
    return t
