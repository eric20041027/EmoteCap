import pytest
from emotecap_server.live.protocol import parse_hello,validate_frame,PolicyViolation
from emotecap_server.contract import BONES
from live_support import frame_text,hello
SESSION={'id':'10000000-0000-4000-8000-000000000001','sourceToken':'x'*43}
def test_exact_v2_hello_preserves_identity_without_coercion():
    p=parse_hello(hello(SESSION),'source');assert p.session_id==SESSION['id'] and p.token==SESSION['sourceToken']
@pytest.mark.parametrize('changes',[{'version':1},{'version':'2'},{'version':True},{'bones':BONES[::-1]},
    {'sessionId':'00000000-0000-0000-0000-000000000000'},{'token':'bad'},{'extra':None},{'type':'frame'}])
def test_hello_rejects_incompatible_or_ambiguous_metadata(changes):
    with pytest.raises(PolicyViolation):parse_hello(hello(SESSION,**changes),'source')
@pytest.mark.parametrize('changes',[{'t':True},{'t':'0'},{'t':float('nan')},{'t':float('inf')},{'t':-1},{'t':10**1000},
    {'h':[0,1]},{'h':[True,1,0]},{'h':[.001,1,0]},{'h':[0,10**1000,0]},{'r':[0,0,0,1]},
    {'r':[0,0,0,2]*48},{'r':[0,0,0,float('nan')]*48},{'type':'clip_ready'},{'extra':0}])
def test_invalid_pose_is_rejected_before_delivery(changes):
    with pytest.raises(PolicyViolation):validate_frame(frame_text(**changes),None)
def test_live_timestamp_is_unbounded_by_export_duration_but_increases():
    assert validate_frame(frame_text(181),180)==181
    for t in [0,180,181]:
        with pytest.raises(PolicyViolation):validate_frame(frame_text(t),181)
def test_utf8_message_budget_precedes_json_parsing():
    with pytest.raises(PolicyViolation,match='16KiB'):validate_frame(' '*16385,None)
    with pytest.raises(PolicyViolation,match='16KiB'):parse_hello('漢'*5462,'source')
@pytest.mark.parametrize('text',['{}','[]','null','{broken'])
def test_malformed_message_has_a_safe_constant_error(text):
    for parse in [lambda:parse_hello(text,'source'),lambda:validate_frame(text,None)]:
        with pytest.raises(PolicyViolation):parse()
