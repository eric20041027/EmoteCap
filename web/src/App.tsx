import { useEffect, useMemo, useRef, useState } from 'react';
import './App.css';
import { CameraSelect } from './capture/CameraSelect';
import type { CropMode } from './capture/cropFrame';
import { CameraView } from './capture/CameraView';
import { needsStepBack } from './capture/captureChecks';
import { drawPoseOverlay } from './capture/drawPoseOverlay';
import { ImportView } from './import/ImportView';
import { useVideoImport } from './import/useVideoImport';
import { useCalibration } from './capture/useCalibration';
import { useCameraDevices } from './capture/useCameraDevices';
import { SkeletonSelect } from './settings/SkeletonSelect';
import { SmoothingSelect } from './settings/SmoothingSelect';
import { setSmoothing, useSmoothing } from './settings/smoothing';
import { setSkeleton, useSkeleton, type SkeletonMode } from './settings/skeleton';
import { usePose, type CaptureQuality, type PoseResult } from './capture/usePose';
import { ChipToggle, LiveLinkToggle } from './live/LiveLinkToggle';
import { useLiveLink } from './live/useLiveLink';
import { createPoseSolver, tposeFrame, type MotionFrame, type PoseLandmark } from './motion/index';
import { PreviewCanvas } from './preview/PreviewCanvas';
import { CaptureControls } from './record/CaptureControls';
import { ExportedFiles } from './record/ExportedFiles';
import { useExporter } from './record/useExporter';
import { useExportJobs } from './jobs/useExportJobs';
import { JobPanel } from './jobs/JobPanel';
import { takeDuration } from './record/take';
import { useRecorder } from './record/useRecorder';
import { useTakeVideo } from './take/useTakeVideo';
import { ImportProgress } from './import/ImportProgress';
import { addTake, selectTake } from './project/model';
import { MAX_PROJECT_FRAMES, MAX_TAKE_FRAMES, MAX_TAKES } from './project/types';
import { ProjectBar } from './studio/ProjectBar';
import { TakeList } from './studio/TakeList';
import { ProjectReview } from './studio/ProjectReview';
import { SetupDiagnostics } from './studio/SetupDiagnostics';
import { useStudioSession } from './studio/useStudioSession';
import { useCaptureProject } from './studio/useCaptureProject';
import { captureProvenance } from './studio/provenance';
import { importProject } from './studio/archiveActions';
import sampleProjectURL from '../../contracts/fixtures/sample-project.emotecap?url';
import './record/record.css';
import './studio/studio.css';
import { AppHeader } from './ui/AppHeader';
import { CountdownOverlay } from './ui/CountdownOverlay';
import { StatusBar } from './ui/StatusBar';
import { useServerHealth } from './ui/useServerHealth';

export default function App() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const frameRef = useRef<MotionFrame | null>(tposeFrame());
  const latestWorldRef = useRef<PoseLandmark[] | null>(null);
  const studio = useStudioSession();
  const cameras = useCameraDevices();
  const server = useServerHealth();
  const liveLink = useLiveLink();
  const exportJobs=useExportJobs();
  const exporter = useExporter(exportJobs.controller);
  const [mirrorPreview, setMirrorPreview] = useState(true);
  const [quality, setQuality] = useState<CaptureQuality>('fast');
  const [crop, setCrop] = useState<CropMode>('none');
  const [cameraEnabled,setCameraEnabled]=useState(false);
  const [cameraGeneration,setCameraGeneration]=useState(0);
  const [archiveBusy,setArchiveBusy]=useState(false);
  const skeleton = useSkeleton();
  const smoothing = useSmoothing();
  const cameraKey=`${cameras.deviceId}:${quality}:${cameraGeneration}`;
  const solver=useMemo(()=>createPoseSolver(),[cameraKey]);
  const calibration=useCalibration(solver,latestWorldRef,cameraKey);
  const existingFrames=studio.state.project.takes.filter(t=>t.status!=='recording').reduce((sum,t)=>sum+t.frames.length,0);
  const capacity=Math.max(0,Math.min(MAX_TAKE_FRAMES,MAX_PROJECT_FRAMES-existingFrames));
  const recorder=useRecorder(capacity);
  const cameraVideo=useTakeVideo(videoRef,recorder.state.phase);
  useEffect(() => solver.setSmoothing(smoothing), [solver, smoothing]);
  useEffect(()=>{if(skeleton==='body') solver.relaxFingers();},[solver,skeleton]);
  const chooseSkeleton = (mode: SkeletonMode) => {
    setSkeleton(mode);
    if (mode === 'body') solver.relaxFingers();
  };
  const [hasPose, setHasPose] = useState(false);
  const [stepBack, setStepBack] = useState(true);
  const { state } = recorder;
  const importVideoRef = useRef<HTMLVideoElement>(null);
  const importOverlayRef = useRef<HTMLCanvasElement>(null);
  const importer = useVideoImport({
    videoRef: importVideoRef,
    overlayRef: importOverlayRef,
    trackHands: skeleton === 'full',
    smoothing,
    onFrame: (frame) => {
      frameRef.current = frame;
      if (liveLink.enabled) liveLink.send(frame);
    },
    onDone: (frames,file,note)=>{
      try {
        const provenance=captureProvenance({quality:'accurate',skeleton,smoothing,calibrated:note.tone==='ok',note:note.text});
        studio.session.update(p=>addTake(p,{name:file.name.slice(0,120)||'Imported video',source:'video',provenance,frames}));
        studio.session.attachSource(studio.session.getSnapshot().project.activeTakeId!,{name:file.name.slice(0,120)||'source.video',blob:file});
        void studio.session.flush().catch(error=>studio.session.reportError(error));
      } catch(error) {studio.session.reportError(error);}
    },
  });
  const importState = importer.state;
  const isImporting = importState.phase !== 'idle';
  const activeTake=studio.state.project.takes.find(t=>t.id===studio.state.project.activeTakeId);
  const isReviewing=!!activeTake && activeTake.status!=='recording' && state.phase!=='recording' && state.phase!=='countdown' && !isImporting;
  const capture=useCaptureProject(recorder,studio.session,captureProvenance({quality,skeleton,smoothing,calibrated:cameraEnabled&&calibration.isCalibrated}),cameraVideo);
  const capturing=state.phase==='recording'||state.phase==='countdown';
  const locked=capturing||isImporting||capture.sourcePending||archiveBusy||studio.state.busy||studio.state.storage==='loading'||calibration.remaining!==null;
  const atCapacity=capacity===0||studio.state.project.takes.length>=MAX_TAKES;
  useEffect(()=>{
    const warn=(event:BeforeUnloadEvent)=>{
      if(capturing||isImporting||studio.state.save.phase!=='saved') {event.preventDefault();event.returnValue='';}
    };
    window.addEventListener('beforeunload',warn);return ()=>window.removeEventListener('beforeunload',warn);
  },[capturing,isImporting,studio.state.save.phase]);

  // Runs once per camera frame, outside React rendering.
  const handlePose = ({ landmarks, worldLandmarks, hands, frameSize, timestampMs }: PoseResult) => {
    drawPoseOverlay(overlayRef.current, frameSize, landmarks, hands.image);
    latestWorldRef.current = worldLandmarks ?? null;
    setHasPose(worldLandmarks !== undefined);
    setStepBack(needsStepBack(landmarks));
    const frame = solver.solve(worldLandmarks, timestampMs / 1000, hands.world, landmarks);
    if (!frame) return;
    if (liveLink.enabled) liveLink.send(frame);
    if (!isReviewing) frameRef.current = frame;
    recorder.push(frame);
  };

  // Importing pauses camera tracking (its models stay loaded) so the GPU works on the video alone and the two never
  // fight over the preview.
  const pose = usePose(videoRef, handlePose, quality, cameras.deviceId, skeleton === 'full', crop, isImporting||isReviewing, cameraEnabled);
  useEffect(()=>{if(pose.status==='off') {latestWorldRef.current=null;setHasPose(false);}},[pose.status]);
  const { refresh: refreshCameras } = cameras;
  useEffect(() => {
    if (pose.status === 'ready') void refreshCameras(); // device labels appear once permission is granted
  }, [pose.status, refreshCameras]);
  const recordingSeconds = state.phase === 'recording' ? takeDuration(state.frames) : null;
  const startCamera=()=>{if(locked) return;setCameraGeneration(n=>n+1);setCameraEnabled(true);pose.retry();};
  const newTake=()=>{
    if(locked||atCapacity) return;
    try {recorder.discard();studio.session.update(p=>selectTake(p,null));frameRef.current=tposeFrame();}
    catch(error) {studio.session.reportError(error);}
  };
  const openSample=async(signal:AbortSignal,discardSources:boolean)=>{
    const response=await fetch(sampleProjectURL,{signal});if(!response.ok) throw new Error('The sample project could not be opened.');
    await importProject(studio.session,await response.blob(),discardSources,signal);
  };

  return (
    <div className="app">
      <AppHeader>
        <StatusBar cameraStatus={pose.status} fps={pose.fps} hasPose={hasPose} server={server} />
        <fieldset disabled={locked} className="studio-settings" aria-label="Capture settings">
        <SkeletonSelect value={skeleton} onChange={chooseSkeleton} />
        <SmoothingSelect value={smoothing} onChange={setSmoothing} />
        <ChipToggle
          label={quality === 'accurate' ? 'Accurate' : 'Fast'}
          pressed={quality === 'accurate'}
          onToggle={() => setQuality((q) => (q === 'accurate' ? 'fast' : 'accurate'))}
          title="Fast: Pose Full + hands every other frame (smooth Live Link). Accurate: Pose Heavy + hands every frame (best for recording). Switching restarts the camera."
        />
        </fieldset>
      </AppHeader>

      <ProjectBar session={studio.session} state={studio.state} locked={locked} onBusyChange={setArchiveBusy} onSample={openSample} />
      <TakeList session={studio.session} state={studio.state} locked={locked} onNewTake={newTake} />

      <main className="stage">
        <section className="panel" aria-label="Camera">
          <div className="panel__head">
            <h2 className="panel__title">Camera</h2>
            <span className="legend">
              {cameraEnabled && <button type="button" className="btn btn--secondary" disabled={locked} onClick={()=>{setCameraEnabled(false);calibration.cancel();}}>Stop camera</button>}
              <fieldset disabled={locked} className="studio-settings" aria-label="Camera settings">
              <ChipToggle
                label="Portrait crop"
                pressed={crop === 'portrait'}
                onToggle={() => setCrop((c) => (c === 'portrait' ? 'none' : 'portrait'))}
                title="Crop a landscape camera to a centred 3:4 portrait window: you fill more of the frame the tracker sees"
              />
              <CameraSelect devices={cameras.devices} deviceId={cameras.deviceId} onChange={cameras.setDeviceId} />
              </fieldset>
            </span>
          </div>
          {/* Hidden, not unmounted, while importing: the camera stream stays attached to its <video>. */}
          <div hidden={isImporting}>
            <CameraView
              videoRef={videoRef}
              overlayRef={overlayRef}
              status={pose.status}
              message={pose.message}
              onRetry={startCamera}
              startDisabled={locked}
              showStepBackHint={stepBack}
              recordingSeconds={recordingSeconds}
              aspect={pose.frameAspect}
              cropped={pose.cropped}
              calibrated={calibration.isCalibrated}
              calibrationSecondsLeft={calibration.remaining}
              onCalibrate={calibration.start}
            />
          </div>
          {importState.phase !== 'idle' && (
            <ImportView
              videoRef={importVideoRef}
              overlayRef={importOverlayRef}
              aspect={importer.aspect}
              fileName={importState.fileName}
            />
          )}
        </section>

        <section className="panel" aria-label="3D preview">
          <div className="panel__head">
            <h2 className="panel__title">3D preview</h2>
            <span className="legend">
              <span className="legend__item legend__item--left">Left</span>
              <span className="legend__item legend__item--right">Right</span>
              <ChipToggle
                label="Mirror"
                pressed={mirrorPreview}
                onToggle={() => setMirrorPreview((value) => !value)}
                title="Flip the preview like a mirror so it matches the camera view"
              />
              <LiveLinkToggle enabled={liveLink.enabled} status={liveLink.status} onToggle={liveLink.toggle} />
            </span>
          </div>
          <div className="preview-frame">
            <PreviewCanvas frameRef={frameRef} mirrored={mirrorPreview} />
            {isReviewing && <span className="preview-badge">Reviewing take</span>}
          </div>
        </section>
      </main>

      {isReviewing && activeTake?<ProjectReview key={`${studio.state.project.id}:${activeTake.id}`} take={activeTake} session={studio.session}
        frameRef={frameRef} server={server} exporter={exporter} locked={locked} />:<section className="dock" aria-label="Recording">
        {isImporting?<ImportProgress state={importState} onCancel={importer.cancel} />:<fieldset className="studio-capture-controls" disabled={(atCapacity&&!capturing)||archiveBusy||studio.state.busy||studio.state.storage==='loading'}>
          <CaptureControls state={state.phase==='recorded'?{phase:'idle',notice:'Choose New take to capture another performance.'}:state}
            canRecord={cameraEnabled&&pose.status==='ready'&&state.phase==='idle'&&!atCapacity}
            isCalibrating={calibration.remaining!==null} calibrationMessage={calibration.message} onRecord={recorder.start} onStop={recorder.stop}
            onCancel={recorder.discard} onCalibrate={calibration.start} onImport={importer.start} importError={importState.error} />
        </fieldset>}
        {atCapacity && <p className="studio-warning">Project capacity reached. Delete an unused take or create another project.</p>}
      </section>}
      {state.phase==='recorded' && capture.takeId===activeTake?.id && state.note && <p className="studio-warning" role="status">{state.note.text}</p>}
      {capture.sourcePending && <p className="studio-help" role="status">Finishing source video. Captured motion is being saved.</p>}
      <ExportedFiles files={exporter.files} />
      <JobPanel controller={exportJobs.controller} state={exportJobs.state} />
      <SetupDiagnostics server={server} />

      {recorder.countdown !== null && <CountdownOverlay value={recorder.countdown} caption="Get into position" />}
    </div>
  );
}
