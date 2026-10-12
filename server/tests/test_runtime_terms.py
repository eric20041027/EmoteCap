"""Actual isolated package entry must require local affirmative runtime consent."""
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import subprocess
import sys

import pytest

from test_windows_package import build_inputs, git
import build_windows as builder


@pytest.fixture
def terms_candidate(build_inputs, tmp_path):
    repo, prepared = build_inputs
    marker = tmp_path/'app-imported.txt'
    (repo/'server/emotecap_server/__init__.py').write_text(
        f'from pathlib import Path\nPath({str(marker)!r}).write_text("imported")\n', encoding='utf-8')
    (repo/'server/emotecap_server/launcher.py').write_text('def main(argv):\n print("APP_STARTED");return 0\n')
    git(repo,'add','.');git(repo,'commit','-qm','owned app import marker')
    root = tmp_path/'candidate with 空白'
    builder.build(repo, prepared, root, tmp_path/'candidate.zip')
    return root, tmp_path/'private data', marker


def run_entry(root, data, input_bytes=b'', *options):
    return subprocess.run([sys.executable,'-I','-S','-B',str(root/'bootstrap.py'),
        '--data-dir',str(data),'--no-browser',*options],input=input_bytes,
        capture_output=True,timeout=15)


def receipt(data):
    return data/'runtime-terms-acceptance.json'


def update_payload(root, name, content):
    (root/name).write_bytes(content)
    path=root/'manifest.json';manifest=json.loads(path.read_bytes())
    entry=next(x for x in manifest['files'] if x['path']==name)
    entry.update(size=len(content),sha256=hashlib.sha256(content).hexdigest())
    path.write_text(json.dumps(manifest),encoding='utf-8')


def test_first_launch_eof_never_imports_app_or_creates_private_data(terms_candidate):
    root, data, marker = terms_candidate
    result = run_entry(root, data)
    assert result.returncode == 2, result.stderr
    assert not marker.exists() and not data.exists()


@pytest.mark.parametrize('choice',[b'EXIT\n',b'\n',b'yes\n',b'true\n'])
def test_unconfirmed_choice_is_not_consent(terms_candidate,choice):
    root,data,marker=terms_candidate
    result=run_entry(root,data,choice)
    assert result.returncode==2 and not marker.exists() and not data.exists()


def test_explicit_accept_writes_only_bounded_private_receipt_before_app(terms_candidate):
    root,data,marker=terms_candidate
    result=run_entry(root,data,b'ACCEPT\n')
    assert result.returncode==0 and marker.exists(),result.stderr
    body=receipt(data).read_bytes();saved=json.loads(body)
    assert len(body)<8192 and set(saved)=={'schema','termsSHA256','accepted','acceptedAtUTC'}
    assert saved['accepted'] is True and len(saved['termsSHA256'])==64
    assert saved['acceptedAtUTC'].endswith('Z')
    assert list(data.iterdir())==[receipt(data)]
    assert not list(root.glob('**/*acceptance*'))


def test_cached_matching_acceptance_does_not_need_input(terms_candidate):
    root,data,marker=terms_candidate
    assert run_entry(root,data,b'ACCEPT\n').returncode==0
    before=receipt(data).read_bytes();marker.unlink()
    result=run_entry(root,data)
    assert result.returncode==0 and marker.exists()
    assert receipt(data).read_bytes()==before


def test_read_then_exit_displays_original_without_state_or_app(terms_candidate):
    root,data,marker=terms_candidate
    result=run_entry(root,data,b'READ\nEXIT\n')
    assert result.returncode==2 and not marker.exists() and not data.exists()
    assert (root/'python/LICENSE.txt').read_bytes().strip() in result.stdout


def test_read_only_entry_displays_original_and_never_starts(terms_candidate):
    root,data,marker=terms_candidate
    result=run_entry(root,data,b'', '--read-runtime-terms')
    assert result.returncode==0 and not marker.exists() and not data.exists()
    assert (root/'python/LICENSE.txt').read_bytes().strip() in result.stdout


@pytest.mark.parametrize('corrupt',['malformed','negative','duplicate','nonfinite','wrong-schema','wrong-time','wrong-type'])
def test_invalid_receipt_never_silently_accepts_or_is_overwritten_on_decline(terms_candidate,corrupt):
    root,data,marker=terms_candidate
    assert run_entry(root,data,b'ACCEPT\n').returncode==0
    marker.unlink();saved=json.loads(receipt(data).read_bytes())
    if corrupt=='malformed':body=b'not json'
    elif corrupt=='duplicate':body=json.dumps(saved).replace('"accepted": true','"accepted": false, "accepted": true').encode()
    elif corrupt=='nonfinite':body=b'{"accepted":NaN}'
    else:
        if corrupt=='negative':saved['accepted']=False
        elif corrupt=='wrong-schema':saved['schema']='other'
        elif corrupt=='wrong-time':saved['acceptedAtUTC']='not a UTC timestamp'
        else:saved['accepted']=1
        body=json.dumps(saved).encode()
    receipt(data).write_bytes(body)
    result=run_entry(root,data,b'EXIT\n')
    assert result.returncode==2 and not marker.exists()
    assert receipt(data).read_bytes()==body


@pytest.mark.parametrize('container', ['array', 'object'])
@pytest.mark.parametrize('choice', [b'', b'EXIT\n', b'READ\nEXIT\n', b'READ\nACCEPT\n'])
def test_deep_receipt_requires_explicit_choice_and_preserves_declined_bytes(terms_candidate, container, choice):
    root, data, marker = terms_candidate
    data.mkdir()
    body = (b'[' * 4000 + b'0' + b']' * 4000 if container == 'array'
        else b'{"x":' * 1300 + b'0' + b'}' * 1300)
    assert len(body) < 8192
    receipt(data).write_bytes(body)
    result = run_entry(root, data, choice)
    assert b'Traceback' not in result.stderr, result.stderr
    assert b'READ = original text' in result.stdout
    if choice.startswith(b'READ'):
        assert (root/'python/LICENSE.txt').read_bytes().strip() in result.stdout
    if choice.endswith(b'ACCEPT\n'):
        assert result.returncode == 0 and marker.exists(), result.stderr
        accepted = receipt(data).read_bytes()
        assert len(accepted) < 8192 and json.loads(accepted)['accepted'] is True
        assert accepted != body
        marker.unlink()
        cached = run_entry(root, data)
        assert cached.returncode == 0 and marker.exists(), cached.stderr
        assert receipt(data).read_bytes() == accepted
        assert b'READ = original text' not in cached.stdout
    else:
        assert result.returncode == 2 and not marker.exists(), result.stderr
        assert receipt(data).read_bytes() == body
    assert list(data.iterdir()) == [receipt(data)]


@pytest.mark.parametrize('name',['python/python.exe','python/LICENSE.txt','RUNTIME-TERMS.en.txt','runtime_terms.py'])
def test_changed_relevant_content_requires_fresh_choice(terms_candidate,name):
    root,data,marker=terms_candidate
    assert run_entry(root,data,b'ACCEPT\n').returncode==0
    marker.unlink();before=receipt(data).read_bytes()
    update_payload(root,name,(root/name).read_bytes()+b'\n# owned changed bytes\n')
    result=run_entry(root,data,b'EXIT\n')
    assert result.returncode==2 and not marker.exists(),result.stderr
    assert receipt(data).read_bytes()==before


def test_unrelated_web_change_does_not_invalidate_runtime_choice(terms_candidate):
    root,data,marker=terms_candidate
    assert run_entry(root,data,b'ACCEPT\n').returncode==0
    marker.unlink();before=receipt(data).read_bytes()
    update_payload(root,'app/web/dist/index.html',b'owned unrelated Web update')
    result=run_entry(root,data)
    assert result.returncode==0 and marker.exists()
    assert receipt(data).read_bytes()==before


def test_write_failure_never_imports_app_or_changes_existing_file(terms_candidate):
    root,data,marker=terms_candidate
    data.write_bytes(b'owned existing file')
    result=run_entry(root,data,b'ACCEPT\n')
    assert result.returncode==1 and not marker.exists()
    assert data.read_bytes()==b'owned existing file'


def test_receipt_hardlink_is_rejected_without_changing_other_file(terms_candidate,tmp_path):
    root,data,marker=terms_candidate
    assert run_entry(root,data,b'ACCEPT\n').returncode==0
    marker.unlink();before=receipt(data).read_bytes()
    alias=tmp_path/'other-owned-file.json';os.link(receipt(data),alias)
    result=run_entry(root,data,b'ACCEPT\n')
    assert result.returncode==1 and not marker.exists()
    assert alias.read_bytes()==receipt(data).read_bytes()==before


def test_oversized_receipt_is_rejected_before_input_or_app(terms_candidate):
    root,data,marker=terms_candidate;data.mkdir();receipt(data).write_bytes(b'x'*8193)
    result=run_entry(root,data,b'ACCEPT\n')
    assert result.returncode==1 and not marker.exists()
    assert receipt(data).stat().st_size==8193


def test_no_cli_acceptance_bypass(terms_candidate):
    root,data,marker=terms_candidate
    result=run_entry(root,data,b'', '--accept-runtime-terms')
    assert result.returncode==2 and not marker.exists() and not data.exists()


def test_tampered_summary_rejected_before_any_private_state(terms_candidate):
    root,data,marker=terms_candidate
    (root/'RUNTIME-TERMS.en.txt').write_bytes(b'changed without manifest')
    result=run_entry(root,data,b'ACCEPT\n')
    assert result.returncode==1 and not marker.exists() and not data.exists()


def load_terms(root):
    spec=importlib.util.spec_from_file_location('test_owned_runtime_terms',root/'runtime_terms.py')
    module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
    return module


def test_interrupted_choice_does_not_create_acceptance(terms_candidate,monkeypatch):
    root,data,marker=terms_candidate;terms=load_terms(root)
    def interrupt(prompt):raise KeyboardInterrupt
    monkeypatch.setattr('builtins.input',interrupt)
    assert terms.ensure_accepted(root,json.loads((root/'manifest.json').read_bytes()),data) is False
    assert not data.exists() and not marker.exists()


def test_atomic_replace_failure_preserves_previous_receipt(terms_candidate,monkeypatch):
    root,data,marker=terms_candidate;data.mkdir();receipt(data).write_bytes(b'{}')
    terms=load_terms(root)
    monkeypatch.setattr('builtins.input',lambda prompt:'ACCEPT')
    def fail_replace(*args):raise PermissionError('owned injected IO failure')
    monkeypatch.setattr(terms.os,'replace',fail_replace)
    with pytest.raises(terms.TermsError):
        terms.ensure_accepted(root,json.loads((root/'manifest.json').read_bytes()),data)
    assert receipt(data).read_bytes()==b'{}' and list(data.iterdir())==[receipt(data)]
    assert not marker.exists()


def test_linked_private_directory_cannot_store_or_reuse_choice(terms_candidate,tmp_path):
    root,data,marker=terms_candidate;target=tmp_path/'other owned folder';target.mkdir()
    if os.name=='nt':
        subprocess.run(['cmd','/d','/c','mklink','/J',str(data),str(target)],check=True,capture_output=True)
    else:data.symlink_to(target,target_is_directory=True)
    result=run_entry(root,data,b'ACCEPT\n')
    assert result.returncode==1 and not marker.exists() and not list(target.iterdir())
