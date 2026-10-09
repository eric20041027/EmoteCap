"""Recipients must receive truthful source locations for the shipped payload."""
import hashlib
import json
import os
import stat
import zipfile
from pathlib import Path

import pytest

from test_windows_package import ROOT, build_inputs, builder, files, git
import package_notices as notices

SOURCE_NAMES=('__init__.py','__main__.py','core.py','cacert.pem')

def write_index(repo,value):
    (repo/'third_party/inventory.json').write_text(json.dumps(value,sort_keys=True,indent=2,allow_nan=False)+'\n',encoding='utf-8')

def refresh_receipt(repo,prepared,value):
    receipt=json.loads((prepared/'prepared.json').read_bytes())
    receipt['files']=files.file_inventory(prepared/'payload')
    (prepared/'prepared.json').write_text(json.dumps(receipt,sort_keys=True,indent=2,allow_nan=False)+'\n',encoding='utf-8')
    value['context']['preparedReceiptSha256']=files.sha256_file(prepared/'prepared.json')
    value['nativeBinaryFiles']=[item for item in receipt['files'] if item['path'].endswith('.pyd')]
    write_index(repo,value)

def form_bytes(version):
    return {'__init__.py':f'__version__ = "{version}"\n'.encode(),
            '__main__.py':b'print("owned source fixture")\n','core.py':b'owned_source = True\n',
            'cacert.pem':b'Owned public certificate source fixture\n'}

@pytest.fixture
def source_inputs(build_inputs):
    repo,prepared=build_inputs;payload=prepared/'payload'
    value=json.loads((repo/'third_party/inventory.json').read_bytes())
    mpl=repo/'third_party/licenses/owned/MPL.txt'
    mpl.write_bytes((ROOT/'third_party/licenses/runtime-vendor/certifi-2024.08.30/LICENSE').read_bytes())
    ssl=repo/'third_party/licenses/owned/OpenSSL4.txt'
    ssl.write_bytes((ROOT/'third_party/licenses/native-static/openssl-4.0.2/LICENSE.txt').read_bytes())
    for path in (mpl,ssl):
        value['files'].append({'path':path.relative_to(repo/'third_party').as_posix(),'size':path.stat().st_size,
            'sha256':files.sha256_file(path),'origin':{'kind':'owned-fixture','input':path.name}})
    forms=[]
    for location,version in [('deps/certifi','2026.07.22'),('python/Lib/site-packages/pip/_vendor/certifi','2026.06.17')]:
        root=payload/location;root.mkdir(parents=True)
        data=form_bytes(version)
        for name,body in data.items():(root/name).write_bytes(body)
        license_path=payload/('deps/certifi-2026.7.22.dist-info/licenses/LICENSE' if location=='deps/certifi' else location+'/LICENSE')
        license_path.parent.mkdir(parents=True,exist_ok=True);license_path.write_bytes(mpl.read_bytes())
        forms.append({'name':'certifi','version':version,'licenseId':'MPL-2.0','license':'licenses/owned/MPL.txt',
            'location':{'kind':'directory','path':location},
            'files':[{'path':name,'size':len(body),'sha256':hashlib.sha256(body).hexdigest()} for name,body in sorted(data.items())]})
    wheel=payload/'python/Lib/ensurepip/_bundled/pip-owned.whl';wheel.parent.mkdir(parents=True)
    data=form_bytes('2024.08.30')
    with zipfile.ZipFile(wheel,'w',compression=zipfile.ZIP_DEFLATED) as archive:
        for name,body in data.items():archive.writestr('pip/_vendor/certifi/'+name,body)
    forms.append({'name':'certifi','version':'2024.08.30','licenseId':'MPL-2.0','license':'licenses/owned/MPL.txt',
        'location':{'kind':'wheel','path':wheel.relative_to(payload).as_posix(),'prefix':'pip/_vendor/certifi'},
        'files':[{'path':name,'size':len(body),'sha256':hashlib.sha256(body).hexdigest()} for name,body in sorted(data.items())]})
    native=payload/'deps/cryptography/hazmat/bindings/_rust.pyd';native.parent.mkdir(parents=True)
    native.write_bytes(b'Owned nonexecutable native fixture')
    binding={'path':native.relative_to(payload).as_posix(),'size':native.stat().st_size,'sha256':files.sha256_file(native)}
    value['components'] += [
        {'name':'Owned certifi source copies','version':'1','kind':'python-runtime','declaredLicense':'MPL-2.0',
         'status':'native-and-vendor-coverage-pending','suppliedLicenses':['licenses/owned/MPL.txt'],'sourceForms':forms},
        {'name':'cryptography','version':'50.0.1','kind':'python-production','declaredLicense':'Apache-2.0 OR BSD-3-Clause',
         'status':'supplied-material-assessment-pending','suppliedLicenses':[]},
        {'name':'OpenSSL','version':'4.0.2','kind':'native-static','declaredLicense':'Apache-2.0',
         'status':'native-and-vendor-coverage-pending','suppliedLicenses':['licenses/owned/OpenSSL4.txt'],'embeddedIn':[binding]}]
    value['files'].sort(key=lambda item:item['path'])
    refresh_receipt(repo,prepared,value)
    return repo,prepared,value

def validate(repo,prepared):
    return notices.validate_notices(repo,prepared,files.file_inventory(repo/'web/dist'))

def test_all_actual_source_copies_and_native_binding_are_reported(source_inputs):
    repo,prepared,_=source_inputs;summary=validate(repo,prepared)['summary']
    assert summary['sourceForms']==3 and summary['sourceFiles']==12 and summary['embeddedNativeRecords']==1
    assert summary['assessment']=='pending'

def test_nested_preferred_sources_are_retained_in_recipient_notice(source_inputs,tmp_path):
    repo,prepared,value=source_inputs;target=prepared/'payload/deps/certifi/tests/test_owned.py'
    target.parent.mkdir();target.write_bytes(b'owned_nested_source = True\n')
    form=value['components'][1]['sourceForms'][0]
    form['files'].append({'path':'tests/test_owned.py','size':target.stat().st_size,'sha256':files.sha256_file(target)})
    refresh_receipt(repo,prepared,value);validated=validate(repo,prepared)
    assert validated['summary']['sourceFiles']==13
    staged=tmp_path/'staged';files.copy_tree(prepared/'payload',staged)
    notices.copy_notices(repo,staged,validated,git(repo,'rev-parse','HEAD'))
    assert 'tests/test_owned.py' in (staged/'notices/SOURCE-ACCESS.txt').read_text()

@pytest.mark.parametrize('change',['missing-form','missing-file','extra-form','bad-hash','bad-version','wrong-license',
    'foreign-license','traversal','duplicate','unknown-field','many-forms','many-files','source-changed',
    'native-hash','native-missing','native-changed','native-status'])
def test_false_source_or_native_statements_are_rejected(source_inputs,change):
    repo,prepared,value=source_inputs;owner=value['components'][1];form=owner['sourceForms'][0]
    if change=='missing-form':owner['sourceForms'].pop()
    elif change=='missing-file':form['files'].pop()
    elif change=='extra-form':owner['sourceForms'].append({**form,'location':{'kind':'directory','path':'deps/absent'}})
    elif change=='bad-hash':form['files'][0]['sha256']='0'*64
    elif change=='bad-version':form['version']='2020.01.01'
    elif change=='wrong-license':form['licenseId']='MIT'
    elif change=='foreign-license':form['license']='licenses/owned/LICENSE'
    elif change=='traversal':form['location']['path']='deps/../outside'
    elif change=='duplicate':owner['sourceForms'].append(form)
    elif change=='unknown-field':form['unapprovedField']='owned sentinel'
    elif change=='many-forms':owner['sourceForms']=owner['sourceForms']*33
    elif change=='many-files':form['files']=form['files']*17
    elif change=='source-changed':(prepared/'payload/deps/certifi/core.py').write_bytes(b'Changed source')
    elif change=='native-hash':value['components'][-1]['embeddedIn'][0]['sha256']='0'*64
    elif change=='native-missing':value['components'].pop();value['files']=[item for item in value['files'] if item['path']!='licenses/owned/OpenSSL4.txt'];(repo/'third_party/licenses/owned/OpenSSL4.txt').unlink()
    elif change=='native-changed':(prepared/'payload/deps/cryptography/hazmat/bindings/_rust.pyd').write_bytes(b'Changed native')
    else:value['components'][-1]['status']='approved'
    write_index(repo,value)
    with pytest.raises(files.PackageError):validate(repo,prepared)

@pytest.mark.parametrize('change',['case-collision','traversal','symlink','encrypted','too-many-entries','expanded-budget','source-budget'])
def test_unsafe_embedded_source_wheel_is_rejected(source_inputs,change):
    repo,prepared,value=source_inputs;wheel=prepared/'payload/python/Lib/ensurepip/_bundled/pip-owned.whl'
    data=form_bytes('2024.08.30')
    with zipfile.ZipFile(wheel,'w',compression=zipfile.ZIP_DEFLATED) as archive:
        for name,body in data.items():
            if change=='source-budget' and name=='cacert.pem':body=b'x'*(2*1024*1024+1)
            item=zipfile.ZipInfo('pip/_vendor/certifi/'+name);item.compress_type=zipfile.ZIP_DEFLATED
            if change=='symlink' and name=='core.py':item.external_attr=(stat.S_IFLNK|0o777)<<16
            archive.writestr(item,body)
        if change=='case-collision':archive.writestr('pip/_vendor/certifi/CORE.py',data['core.py'])
        elif change=='traversal':archive.writestr('pip/_vendor/certifi/../outside.py',b'Owned invalid member')
        elif change=='too-many-entries':
            for number in range(4097):archive.writestr(f'owned/{number}.txt',b'')
        elif change=='expanded-budget':archive.writestr('owned/large.txt',b'x'*(64*1024*1024+1))
    if change=='encrypted':
        raw=bytearray(wheel.read_bytes());position=raw.index(b'PK\x01\x02');raw[position+8]|=1;wheel.write_bytes(raw)
    refresh_receipt(repo,prepared,value)
    with pytest.raises(files.PackageError):validate(repo,prepared)

def test_generated_notice_names_every_actual_source_copy(source_inputs,tmp_path):
    repo,prepared,_=source_inputs;staged=tmp_path/'staged';files.copy_tree(prepared/'payload',staged)
    validated=validate(repo,prepared)
    notices.copy_notices(repo,staged,validated,git(repo,'rev-parse','HEAD'))
    text=(staged/'notices/SOURCE-ACCESS.txt').read_text(encoding='utf-8')
    assert 'deps/certifi' in text and 'python/Lib/site-packages/pip/_vendor/certifi' in text
    assert 'pip-owned.whl' in text and 'pip/_vendor/certifi' in text and 'MPL-2.0' in text
    assert 'SOURCE-ACCESS.txt' in (staged/'notices/README.txt').read_text()

@pytest.mark.parametrize('changed',['prepared','staged'])
def test_copy_rejects_changed_source_after_admission(source_inputs,tmp_path,changed):
    repo,prepared,_=source_inputs;staged=tmp_path/'staged';files.copy_tree(prepared/'payload',staged)
    validated=validate(repo,prepared)
    target=(prepared/'payload' if changed=='prepared' else staged)/'deps/certifi/core.py'
    target.write_bytes(b'Changed source after admission')
    with pytest.raises(files.PackageError):notices.copy_notices(repo,staged,validated,git(repo,'rev-parse','HEAD'))
    assert not (staged/'notices/SOURCE-ACCESS.txt').exists()


@pytest.mark.parametrize('changed',['prepared','staged'])
@pytest.mark.parametrize('added',['source','wheel'])
def test_copy_rejects_added_source_location_after_admission(source_inputs,tmp_path,changed,added):
    repo,prepared,_=source_inputs;staged=tmp_path/'staged';files.copy_tree(prepared/'payload',staged)
    validated=validate(repo,prepared);payload=prepared/'payload' if changed=='prepared' else staged
    if added=='source':
        (payload/'deps/certifi/added_after_admission.py').write_bytes(b'owned_source = True\n')
    else:
        original=payload/'python/Lib/ensurepip/_bundled/pip-owned.whl'
        (original.parent/'additional.whl').write_bytes(original.read_bytes())
    with pytest.raises(files.PackageError):notices.copy_notices(repo,staged,validated,git(repo,'rev-parse','HEAD'))
    assert not (staged/'notices/SOURCE-ACCESS.txt').exists()


def test_new_source_after_admission_cannot_complete_candidate(source_inputs,tmp_path,monkeypatch):
    repo,prepared,_=source_inputs;git(repo,'add','.');git(repo,'commit','-qm','Owned source fixture')
    original=builder.copy_tree;changed=False
    def copying(source,target):
        nonlocal changed
        if source==prepared/'payload' and not changed:
            changed=True;(source/'deps/certifi/added_after_admission.py').write_bytes(b'owned_source = True\n')
        return original(source,target)
    monkeypatch.setattr(builder,'copy_tree',copying)
    output=tmp_path/'candidate';archive=tmp_path/'candidate.zip'
    with pytest.raises(files.PackageError):builder.build(repo,prepared,output,archive)
    assert not output.exists() and not archive.exists() and not archive.with_suffix('.zip.receipt.json').exists()


@pytest.mark.parametrize('change',['source-reference','native-reference','source-text','native-text','payload-license'])
def test_owned_wrong_license_material_is_rejected(source_inputs,change):
    repo,prepared,value=source_inputs;owner=value['components'][1];native=value['components'][-1]
    if change=='source-reference':
        wrong=repo/'third_party/licenses/owned/bzip2.txt';wrong.write_bytes(b'Owned unrelated bzip2 licensing text\n')
        name=wrong.relative_to(repo/'third_party').as_posix()
        value['files'].append({'path':name,'size':wrong.stat().st_size,'sha256':files.sha256_file(wrong),
            'origin':{'kind':'owned-fixture','input':'bzip2.txt'}})
        value['files'].sort(key=lambda item:item['path']);owner['suppliedLicenses'].append(name)
        owner['sourceForms'][1]['license']=name
    elif change=='native-reference':
        wrong=value['components'][0]['suppliedLicenses'][0];right=native['suppliedLicenses'][0]
        value['components'][0]['suppliedLicenses']=[right];native['suppliedLicenses']=[wrong]
    elif change=='payload-license':
        (prepared/'payload/python/Lib/site-packages/pip/_vendor/certifi/LICENSE').write_bytes(b'Owned unrelated license\n')
        refresh_receipt(repo,prepared,value)
    else:
        name=owner['suppliedLicenses'][0] if change=='source-text' else native['suppliedLicenses'][0]
        target=repo/'third_party'/name;target.write_bytes(b'Owned unrelated replacement licensing text\n')
        record=next(item for item in value['files'] if item['path']==name)
        record.update(size=target.stat().st_size,sha256=files.sha256_file(target))
    write_index(repo,value)
    with pytest.raises(files.PackageError):validate(repo,prepared)


@pytest.mark.parametrize('ancestor_first',[False,True])
@pytest.mark.parametrize('ancestor',['pip/_vendor/certifi','pip/_vendor'])
def test_wheel_file_directory_collision_is_rejected(source_inputs,ancestor_first,ancestor):
    repo,prepared,value=source_inputs;wheel=prepared/'payload/python/Lib/ensurepip/_bundled/pip-owned.whl'
    with zipfile.ZipFile(wheel,'r') as archive:entries=[(item,archive.read(item)) for item in archive.infolist()]
    with zipfile.ZipFile(wheel,'w') as archive:
        if ancestor_first:archive.writestr(ancestor,b'Owned colliding ordinary file')
        for item,body in entries:archive.writestr(item,body)
        if not ancestor_first:archive.writestr(ancestor,b'Owned colliding ordinary file')
    refresh_receipt(repo,prepared,value)
    with pytest.raises(files.PackageError):validate(repo,prepared)


def test_wheel_expanded_budget_is_aggregate_across_copies(source_inputs):
    repo,prepared,value=source_inputs;wheel=prepared/'payload/python/Lib/ensurepip/_bundled/pip-owned.whl'
    with zipfile.ZipFile(wheel,'a',compression=zipfile.ZIP_DEFLATED) as archive:
        with archive.open('owned/bounded-large.txt','w') as output:
            for _ in range(33):output.write(b'x'*(1024*1024))
    second=wheel.parent/'pip-second.whl';second.write_bytes(wheel.read_bytes())
    owner=value['components'][1];form=json.loads(json.dumps(owner['sourceForms'][-1]))
    form['location']['path']=second.relative_to(prepared/'payload').as_posix();owner['sourceForms'].append(form)
    refresh_receipt(repo,prepared,value)
    with pytest.raises(files.PackageError):validate(repo,prepared)
