import re
import pytest

from emotecap_server.media.consent import ConsentGrants,ConsentRequired,ConsentCapacity,CloudBusy

TAKE_ID='604e37e2-814a-40f8-9c0a-6dc702c73dbb'
def payload(**changes):
    return {'provider':'gemini','policyVersion':1,'allowUpload':True,'takeId':TAKE_ID,'size':5,'duration':2.0,'mimeType':'video/webm',**changes}


def test_grant_is_opaque_one_use_and_source_bound():
    grants=ConsentGrants();issued=grants.issue(payload())
    assert re.fullmatch(r'[A-Za-z0-9_-]{43}',issued.token)
    accepted=grants.consume(issued.token);assert str(accepted.takeId)==TAKE_ID and accepted.size==5
    with pytest.raises(ConsentRequired):grants.consume(issued.token)


def test_expired_grant_is_rejected_and_capacity_reclaimed():
    now=[0.0];grants=ConsentGrants(clock=lambda:now[0]);token=grants.issue(payload()).token;now[0]=61
    with pytest.raises(ConsentRequired):grants.consume(token)
    for _ in range(32):grants.issue(payload())
    with pytest.raises(ConsentCapacity):grants.issue(payload())


@pytest.mark.parametrize('changes',[{'allowUpload':False},{'policyVersion':2},{'provider':'other'},
    {'takeId':'bad'},{'size':0},{'size':100*1024*1024+1},{'duration':float('inf')},{'duration':181},{'mimeType':'image/png'},{'extra':True}])
def test_invalid_permission_is_never_issued(changes):
    with pytest.raises(ValueError):ConsentGrants().issue(payload(**changes))


def test_only_one_cloud_operation_can_enter():
    grants=ConsentGrants()
    with grants.enter():
        with pytest.raises(CloudBusy):
            with grants.enter():pass
    with grants.enter():pass
