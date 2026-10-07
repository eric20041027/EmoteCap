"""Owned synthetic repositories/fake tokens; no private environment or network."""
import json
import subprocess
import sys
from pathlib import Path

import pytest

sys.path.insert(0,str(Path(__file__).resolve().parents[2]/'scripts'))
import release_audit as audit

GOOGLE='AI'+'za'+'A'*35

def git(repo,*args):
    result=subprocess.run(['git','-C',str(repo),*args],capture_output=True,timeout=15,check=True)
    return result.stdout

def repository(tmp_path):
    repo=tmp_path/'repo';repo.mkdir();git(repo,'init','-b','main')
    git(repo,'config','user.name','Synthetic Test');git(repo,'config','user.email','test@example.invalid')
    git(repo,'config','commit.gpgsign','false')
    (repo/'README.md').write_text('Test repository\n');commit(repo)
    return repo

def commit(repo):
    git(repo,'add','--all');git(repo,'commit','-m','synthetic fixture')

@pytest.mark.parametrize('rule,value',[
    ('google-api-key',GOOGLE),
    ('github-token','gh'+'p_'+'a'*36),
    ('github-fine-token','github_'+'pat_'+'1'*82),
    ('aws-access-key','AK'+'IA'+'B'*16),
    ('aws-access-key','AS'+'IA'+'C'*16),
    ('slack-token','xox'+'b-'+'123456789012-Abcdef1234567890'),
    ('openai-key','s'+'k-'+'proj-'+'aB91_'*10),
    ('private-key','-----BEGIN '+'PRIVATE KEY-----\n'+'a'*80+'\n-----END '+'PRIVATE KEY-----'),
    ('credential-assignment','API_KEY='+'aB9zC4wE1vF7xH2pT8rY5qN'),
])
def test_recognizable_credentials_are_redacted(rule,value):
    findings=audit.scan_bytes(value.encode(),{'kind':'current','path':'source.txt'})
    assert any(f['rule']==rule for f in findings)
    assert value not in json.dumps(findings)
    assert all(len(f['fingerprint'])==64 for f in findings)

def test_placeholders_and_environment_references_are_not_credentials():
    data=b'GEMINI_API_KEY=your-key\nAPI_KEY=replace_with_your_key\nkey = os.getenv("GEMINI_API_KEY")'
    assert audit.scan_bytes(data,{'kind':'current'})==[]

def test_runtime_settings_expressions_are_not_hardcoded_credentials():
    data=b'api_key=self.settings.gemini_api_key\napi_key=settings.gemini_api_key\n'
    assert audit.scan_bytes(data,{'kind':'current'})==[]

def test_quoted_and_dotenv_literals_remain_detectable():
    value='aB9zC4wE1vF7xH2pT8rY5qN'
    for data in [f'api_key="{value}"',f'export API_KEY={value}',f'API_KEY={value}']:
        assert audit.scan_bytes(data.encode(),{'kind':'current'})

def test_annotated_tag_message_credentials_are_scanned(tmp_path):
    repo=repository(tmp_path);git(repo,'config','tag.gpgsign','false')
    git(repo,'tag','-a','synthetic','-m',GOOGLE)
    report=audit.audit_repository(repo)
    assert any(f['kind']=='tag' for f in report['findings'])
    assert GOOGLE not in json.dumps(report)

def test_binary_bytes_cannot_hide_recognizable_credentials():
    findings=audit.scan_bytes(b'\x00\xff\n'+GOOGLE.encode()+b'\x00',{'kind':'current'})
    assert findings[0]['rule']=='google-api-key' and findings[0]['line']==2

def test_secret_removed_from_current_tree_still_exists_in_history(tmp_path):
    repo=repository(tmp_path);path=repo/'old.txt';path.write_text(GOOGLE);commit(repo)
    git(repo,'rm','old.txt');commit(repo)
    report=audit.audit_repository(repo)
    assert len(report['commits'])==3
    assert any(f['kind']=='history' and 'old.txt' in f['paths'] for f in report['findings'])
    assert not any(f['kind']=='current' for f in report['findings'])
    assert GOOGLE not in json.dumps(report)

def test_commit_message_credentials_are_scanned_without_disclosure(tmp_path):
    repo=repository(tmp_path);git(repo,'commit','--allow-empty','-m',GOOGLE)
    report=audit.audit_repository(repo)
    assert any(f['kind']=='commit' for f in report['findings'])
    assert GOOGLE not in json.dumps(report)

def test_shallow_history_cannot_be_reported_as_clean(tmp_path):
    repo=repository(tmp_path);(repo/'.git/shallow').write_bytes(git(repo,'rev-parse','HEAD'))
    with pytest.raises(audit.AuditIncomplete,match='Shallow'):audit.audit_repository(repo)

def test_untracked_nonignored_candidate_and_unicode_path_are_scanned(tmp_path):
    repo=repository(tmp_path);name='新文件 space.txt';(repo/name).write_text(GOOGLE)
    report=audit.audit_repository(repo)
    assert any(f['kind']=='current' and f['path']==name for f in report['findings'])
    assert report['currentFiles']==2

def test_credential_shaped_filename_is_redacted_too(tmp_path):
    repo=repository(tmp_path);(repo/(GOOGLE+'.txt')).write_text(GOOGLE)
    report=audit.audit_repository(repo)
    assert report['findings'] and GOOGLE not in json.dumps(report)

def test_ignored_environment_is_never_read(tmp_path,monkeypatch):
    repo=repository(tmp_path);(repo/'.gitignore').write_text('.env\n');commit(repo)
    (repo/'.env').write_text(GOOGLE)
    original=Path.read_bytes
    def read(path):
        if path.name=='.env':raise AssertionError('Private ignored environment was read')
        return original(path)
    monkeypatch.setattr(Path,'read_bytes',read)
    assert audit.audit_repository(repo)['findings']==[]

def test_oversized_blob_is_incomplete_instead_of_clean(tmp_path):
    repo=repository(tmp_path);(repo/'large.txt').write_bytes(b'a'*100);commit(repo)
    with pytest.raises(audit.AuditIncomplete):audit.audit_repository(repo,max_blob_bytes=32)

def test_total_budget_is_not_silently_truncated(tmp_path):
    repo=repository(tmp_path)
    with pytest.raises(audit.AuditIncomplete):audit.audit_repository(repo,max_total_bytes=8)

def test_overbudget_current_candidate_is_rejected_before_open(tmp_path,monkeypatch):
    repo=repository(tmp_path);baseline=audit.audit_repository(repo)['bytesScanned']
    candidate=repo/'zz-over-budget.dat';candidate.write_bytes(b'a'*100)
    original=Path.open
    def open_file(path,*args,**kwargs):
        if path==candidate:raise AssertionError('Overbudget candidate was opened')
        return original(path,*args,**kwargs)
    monkeypatch.setattr(Path,'open',open_file)
    with pytest.raises(audit.AuditIncomplete):audit.audit_repository(repo,max_total_bytes=baseline+50)

def test_known_overbudget_history_is_rejected_before_body_batch(tmp_path,monkeypatch):
    repo=repository(tmp_path);(repo/'a.txt').write_bytes(b'a'*100);(repo/'b.txt').write_bytes(b'b'*100);commit(repo)
    commits=git(repo,'rev-list','--all').decode().splitlines()
    commit_bytes=sum(len(git(repo,'cat-file','commit',oid)) for oid in commits)
    original=audit.checked_git
    def checked(repo,arguments,**kwargs):
        if arguments==['cat-file','--batch']:raise AssertionError('Known overbudget bodies were requested')
        return original(repo,arguments,**kwargs)
    monkeypatch.setattr(audit,'checked_git',checked)
    with pytest.raises(audit.AuditIncomplete):audit.audit_repository(repo,max_total_bytes=commit_bytes+150)

def test_git_failure_is_incomplete_without_raw_stderr(tmp_path,monkeypatch):
    repo=repository(tmp_path)
    monkeypatch.setattr(audit.subprocess,'run',lambda *a,**k:type('Result',(),{
        'returncode':1,'stdout':b'','stderr':GOOGLE.encode()})())
    with pytest.raises(audit.AuditIncomplete) as error:audit.audit_repository(repo)
    assert GOOGLE not in str(error.value)

def test_current_link_is_rejected_before_file_read(tmp_path,monkeypatch):
    repo=repository(tmp_path);(repo/'link.txt').write_text('outside placeholder')
    original=Path.is_symlink
    monkeypatch.setattr(Path,'is_symlink',lambda p:p.name=='link.txt' or original(p))
    with pytest.raises(audit.AuditIncomplete):audit.audit_repository(repo)

def test_existing_report_is_preserved(tmp_path,capsys):
    repo=repository(tmp_path);output=tmp_path/'receipt.json';output.write_text('original receipt')
    assert audit.main(['--repo',str(repo),'--output',str(output)])==2
    assert output.read_text()=='original receipt'
    assert 'Traceback' not in capsys.readouterr().err

def test_cli_writes_redacted_findings_and_returns_one(tmp_path,capsys):
    repo=repository(tmp_path);(repo/'candidate.txt').write_text(GOOGLE);output=tmp_path/'receipt.json'
    assert audit.main(['--repo',str(repo),'--output',str(output)])==1
    assert GOOGLE not in output.read_text()
    captured=capsys.readouterr();assert GOOGLE not in captured.out+captured.err

def test_clean_cli_returns_zero_and_records_scope(tmp_path):
    repo=repository(tmp_path);output=tmp_path/'receipt.json'
    assert audit.main(['--repo',str(repo),'--output',str(output)])==0
    report=json.loads(output.read_text())
    assert report['schema']=='emotecap-release-scan-v1' and not report['findings']
    assert len(report['head'])==40 and 'ignored' in report['scope']
