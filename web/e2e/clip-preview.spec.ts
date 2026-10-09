import { expect, test, type Page } from '@playwright/test';
import type { Clip, MotionFrame } from '../src/motion/contract';
import type { ProjectDocument as Project } from '../src/project/types';
import type { Playback } from '../src/record/usePlayback';
import { download, projectId, sample, saved, storedProject } from './helpers';

// Actual React/ProjectReview, with owned synthetic data and controlled RAF.
// This is a component/action proof, not hardware or real-time qualification.
async function mountReview(page:Page) {
  await page.route('**/api/health',route=>route.fulfill({json:{ok:true,blender:false}}));
  await page.route('**/api/export-jobs',route=>route.fulfill({json:[]}));
  await page.goto('/');
  await page.evaluate(async()=>{
    const reviewUrl='/src/studio/ProjectReview.tsx',dataUrl='/src/project/testData.ts',motionUrl='/src/motion/contract.ts';
    const appSource=await (await fetch('/src/App.tsx')).text(),mainSource=await (await fetch('/src/main.tsx')).text();
    const reactUrl=appSource.match(/["'](\/node_modules\/\.vite\/deps\/react\.js\?[^"']+)["']/)![1];
    const domUrl=mainSource.match(/["'](\/node_modules\/\.vite\/deps\/react-dom_client\.js\?[^"']+)["']/)![1];
    const React=(await import(reactUrl)).default,DOM=(await import(domUrl)).default;
    const {ProjectReview}=await import(reviewUrl),data=await import(dataUrl),motion=await import(motionUrl);
    const playbackUrl='/src/record/usePlayback.ts',playbackModule=await import(playbackUrl);
    let project:Project=data.readyProject();
    const frames:MotionFrame[]=[motion.tposeFrame(0),motion.tposeFrame(0.45),motion.tposeFrame(1)];
    frames[0].h=[0,0.95,0];frames[1].h=[0,2.5,0];frames[2].h=[0,0.55,0];
    frames[1].r.splice(0,4,0,Math.SQRT1_2,0,Math.SQRT1_2);
    const take={...project.takes[0],frames,clips:[{...project.takes[0].clips[0],start:0.2,end:0.8}]};
    project={...project,takes:[take]};
    const initial=structuredClone(project),frameRef:{current:MotionFrame|null}={current:null};
    const panel=document.createElement('div');panel.id='review-fixture';document.body.append(panel);
    const root=DOM.createRoot(panel);
    let clock=0,serial=0,exports:Clip[]=[];
    const callbacks=new Map<number,FrameRequestCallback>();
    Object.defineProperty(performance,'now',{configurable:true,value:()=>clock});
    window.requestAnimationFrame=callback=>{const id=++serial;callbacks.set(id,callback);return id;};
    window.cancelAnimationFrame=id=>{callbacks.delete(id);};
    const render=()=>root.render(React.createElement(ProjectReview,{take:project.takes[0],session,frameRef,
      server:'online',exporter,locked:false}));
    const session={getSnapshot:()=>({project}),update:(operation:(p:Project)=>Project)=>{project=operation(project);render();},
      reportError:(error:unknown)=>{throw error;}};
    const exporter={busy:false,error:null,exportClips:async(factory:()=>Clip[])=>{exports=factory();}};
    const fixture={frame:()=>structuredClone(frameRef.current),initial,project:()=>project,exported:()=>exports,
      advance:(milliseconds:number)=>{clock+=milliseconds;const pending=[...callbacks.values()];callbacks.clear();pending.forEach(callback=>callback(clock));},
      switchTake:()=>{const first=motion.tposeFrame(0);first.h=[0,0.7,0];
        project={...project,takes:[{...project.takes[0],id:crypto.randomUUID(),frames:[first,motion.tposeFrame(1)]}]};render();},
      empty:()=>{project={...project,takes:[{...project.takes[0],frames:[],clips:[],status:'interrupted'}]};render();},
      unmount:()=>root.unmount()};
    Object.assign(fixture,{mountDirectHook:()=>{
      root.unmount();const element=document.createElement('div');element.id='direct-hook';document.body.append(element);
      const directRoot=DOM.createRoot(element);let directFrames:MotionFrame[]=[motion.tposeFrame(0),motion.tposeFrame(1)];
      let direct:Playback|null=null;
      function Harness() {
        direct=playbackModule.usePlayback(directFrames,frameRef);
        return React.createElement('div',null,React.createElement('button',{onClick:()=>direct!.play(0,1,true)},'Play direct dataset'),
          React.createElement('span',{id:'direct-state'},direct!.playhead===null?'idle':'playing'));
      }
      Reflect.set(fixture,'switchDirectFrames',()=>{
        const first=motion.tposeFrame(0);first.h=[0,0.7,0];directFrames=[first,motion.tposeFrame(1)];
        frameRef.current=first;directRoot.render(React.createElement(Harness));
      });
      Reflect.set(fixture,'unmountDirect',()=>directRoot.unmount());directRoot.render(React.createElement(Harness));
    }});
    Reflect.set(window,'reviewFixture',fixture);render();
  });
  await expect(page.locator('#review-fixture').getByRole('button',{name:'Play clip 1'})).toBeVisible();
}
const panel=(page:Page)=>page.locator('#review-fixture');
const frame=(page:Page)=>page.evaluate(()=>Reflect.get(window,'reviewFixture').frame() as MotionFrame|null);
const advance=(page:Page,ms:number)=>page.evaluate(ms=>Reflect.get(window,'reviewFixture').advance(ms),ms);
const exported=(page:Page)=>page.evaluate(()=>Reflect.get(window,'reviewFixture').exported() as Clip[]);
async function exportPacket(page:Page) {
  await panel(page).getByRole('button',{name:'Export FBX',exact:true}).click();
  return (await exported(page))[0];
}

test('Play clip shows actual processed export frames rather than raw trim samples',async({page})=>{
  await mountReview(page);const packet=await exportPacket(page);
  await panel(page).getByRole('button',{name:'Play clip 1'}).focus();await page.keyboard.press('Enter');
  await advance(page,0);
  await expect.poll(()=>frame(page)).toEqual(packet.frames[0]);
  await expect(panel(page).getByRole('status')).toContainText('Export clip preview: Clip_01');
  await advance(page,300);await expect.poll(()=>frame(page)).toEqual(packet.frames[9]);
  await advance(page,1000);await expect.poll(()=>frame(page)).toEqual(packet.frames.at(-1));
  const current=await page.evaluate(()=>Reflect.get(window,'reviewFixture').project());
  const initial=await page.evaluate(()=>Reflect.get(window,'reviewFixture').initial);
  expect(current).toEqual(initial);expect(packet.frames[0].h).not.toEqual(initial.takes[0].frames[0].h);
});

test('repeated Play restarts and Stop cancels further poses',async({page})=>{
  await mountReview(page);const packet=await exportPacket(page),play=panel(page).getByRole('button',{name:'Play clip 1'});
  await play.click();await advance(page,250);expect(await frame(page)).not.toEqual(packet.frames[0]);
  await play.click();await advance(page,0);await expect.poll(()=>frame(page)).toEqual(packet.frames[0]);
  await panel(page).getByRole('button',{name:'Stop playback'}).click();const stopped=await frame(page);
  await advance(page,500);expect(await frame(page)).toEqual(stopped);
});

test('loop uses relative processed duration and original review stays available',async({page})=>{
  await mountReview(page);await panel(page).getByLabel('Clip 1 loop').check();
  const packet=await exportPacket(page);expect(packet.loop).toBe(true);
  await panel(page).getByRole('button',{name:'Play clip 1'}).click();await advance(page,700);
  await expect.poll(()=>frame(page)).toEqual(packet.frames[3]);
  await panel(page).getByRole('button',{name:'Play original take'}).focus();await page.keyboard.press('Enter');
  await advance(page,0);const first=await page.evaluate(()=>Reflect.get(window,'reviewFixture').initial.takes[0].frames[0]);
  await expect.poll(()=>frame(page)).toEqual(first);await expect(panel(page).getByRole('status')).toContainText('Original take preview');
});

test('editing, deleting and switching stop stale derived callbacks',async({page})=>{
  await mountReview(page);const play=panel(page).getByRole('button',{name:'Play clip 1'});
  await play.click();await advance(page,150);
  await panel(page).getByLabel('Clip 1 name').fill('Changed');
  await expect(panel(page).getByRole('status')).toContainText('Original take preview');const raw=await frame(page);
  await advance(page,500);expect(await frame(page)).toEqual(raw);
  await play.click();await advance(page,0);await page.evaluate(()=>Reflect.get(window,'reviewFixture').switchTake());
  await expect.poll(async()=>((await frame(page))?.h[1])).toBe(0.7);
  await advance(page,500);expect((await frame(page))?.h[1]).toBe(0.7);
  await play.click();await advance(page,0);await panel(page).getByRole('button',{name:'Delete clip 1'}).click();
  await expect(panel(page).getByRole('status')).toContainText('Original take preview');const deleted=await frame(page);
  await advance(page,500);expect(await frame(page)).toEqual(deleted);
});

test('invalid drafts cannot masquerade as export previews; valid selected drafts can still play',async({page})=>{
  await mountReview(page);await panel(page).getByLabel('Clip 1 name').fill('');
  await expect(panel(page).getByRole('button',{name:'Play clip 1'})).toBeDisabled();
  await expect(panel(page).getByRole('button',{name:'Export FBX',exact:true})).toBeDisabled();
  await panel(page).getByRole('button',{name:'Play original take'}).click();await advance(page,0);
  expect((await frame(page))?.h[1]).toBe(0.95);
  await panel(page).getByLabel('Clip 1 name').fill('Valid');await panel(page).getByRole('button',{name:'Add clip',exact:true}).click();
  await panel(page).getByLabel('Clip 2 name').fill('');
  await expect(panel(page).getByRole('button',{name:'Play clip 1'})).toBeEnabled();
  await expect(panel(page).getByRole('button',{name:'Export FBX',exact:true})).toBeDisabled();
  await panel(page).getByRole('button',{name:'Play clip 1'}).click();
  await expect(panel(page).getByRole('status')).toContainText('Export clip preview: Valid');
});

test('empty checkpoint and unmount leave no owned preview callback',async({page})=>{
  await mountReview(page);await panel(page).getByRole('button',{name:'Play clip 1'}).click();await advance(page,0);
  await page.evaluate(()=>Reflect.get(window,'reviewFixture').empty());
  await expect(panel(page).getByRole('button',{name:'Play original take'})).toBeDisabled();
  await expect(panel(page).getByRole('button',{name:'Export FBX',exact:true})).toBeDisabled();
  const pose=await frame(page);await advance(page,500);expect(await frame(page)).toEqual(pose);
  await page.evaluate(()=>Reflect.get(window,'reviewFixture').unmount());await advance(page,500);expect(await frame(page)).toEqual(pose);
});

test('base playback stops obsolete frame-array callbacks independently of its caller',async({page})=>{
  await mountReview(page);await page.evaluate(()=>Reflect.get(window,'reviewFixture').mountDirectHook());
  await page.getByRole('button',{name:'Play direct dataset'}).click();await advance(page,0);
  await expect(page.locator('#direct-state')).toHaveText('playing');
  await page.evaluate(()=>Reflect.get(window,'reviewFixture').switchDirectFrames());
  await expect(page.locator('#direct-state')).toHaveText('idle');
  await advance(page,250);expect((await frame(page))?.h[1]).toBe(0.7);
  await page.evaluate(()=>Reflect.get(window,'reviewFixture').unmountDirect());
  await advance(page,250);expect((await frame(page))?.h[1]).toBe(0.7);
});

test('integrated Studio keeps originals and backups through processed playback and reload',async({page},info)=>{
  await page.route('**/api/health',route=>route.fulfill({json:{ok:true,blender:false}}));
  await page.route('**/api/export-jobs',route=>route.fulfill({json:[]}));
  const original=await sample(page);
  await page.getByLabel('Clip 1 start (seconds)').fill('0.25');await page.getByLabel('Clip 1 end (seconds)').fill('1.5');
  await page.keyboard.press('Tab');await saved(page);
  await page.getByRole('button',{name:'Play clip 1'}).click();
  await expect(page.getByRole('status').filter({hasText:'Export clip preview:'})).toContainText('Export clip preview:');
  await page.getByRole('button',{name:'Stop playback'}).click();
  await page.screenshot({path:info.outputPath('processed-clip-preview.png')});
  expect((await storedProject(page)).takes[0].frames).toEqual(original.takes[0].frames);
  await page.reload();await expect(page.getByLabel('Clip 1 start (seconds)')).toHaveValue('0.25');
  const backup=await download(page,info,'processed-preview-project.emotecap');
  const beforeImport=await projectId(page);
  await page.getByLabel('Import project file').setInputFiles(backup);
  await expect.poll(()=>projectId(page)).not.toBe(beforeImport);await saved(page);
  expect((await storedProject(page)).takes[0].frames).toEqual(original.takes[0].frames);
  await page.getByRole('button',{name:'Play original take'}).click();
  await expect(page.getByRole('status').filter({hasText:'Original take preview'})).toBeVisible();
});
