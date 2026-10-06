import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import DailyIframe, { type DailyCall } from '@daily-co/daily-js';
import './styles.css';
import './live.css';

type Category = 'Interests' | 'Preferences' | 'People';
type Approval = 'pending' | 'approved' | 'discarded';
type Saving = 'idle' | 'saving' | 'saved' | 'failed';
type Memory = { id: string; text: string; category: Category; conversationId: string; approval: Approval; saving: Saving; createdAt: string; savedAt?: string; replacesId?: string };
type NextStep = { id: string; text: string; status: 'proposed' | 'accepted' | 'completed' };
type DemoStore = { memories: Memory[]; nextStep?: NextStep; hasVisited: boolean; recap?: string };
type Screen = 'home' | 'setup' | 'call' | 'recap' | 'memories';
type Connection = 'connecting' | 'connected' | 'reconnecting' | 'failed';
type SessionRequest = { topic?: string; cameraEnabled: boolean; microphoneEnabled: boolean };
type ConversationEvent = { type: 'transcript' | 'memory_suggestion' | 'next_step'; createdAt: string };
type TavusConversation = { conversationId: string; conversationUrl: string; status: string };

const KEY = 'neighborly-fictional-demo-v1';
const repository = { load: (): DemoStore => { try { return JSON.parse(localStorage.getItem(KEY) || '') } catch { return { memories: [], hasVisited: false } } }, save: (data: DemoStore) => localStorage.setItem(KEY, JSON.stringify(data)), reset: () => localStorage.removeItem(KEY) };
const stamp = () => new Date().toISOString();
const fresh = (): Memory => ({ id: 'garden-' + Date.now(), text: 'Enjoys gardening and growing tomatoes.', category: 'Interests', conversationId: 'demo-garden-01', approval: 'pending', saving: 'idle', createdAt: stamp() });

function App() {
  const [store, setStore] = useState<DemoStore>(() => repository.load());
  const [screen, setScreen] = useState<Screen>('home');
  const [connection, setConnection] = useState<Connection>('connecting');
  const [liveConversation, setLiveConversation] = useState<TavusConversation | null>(null);
  const [liveError, setLiveError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [topic, setTopic] = useState(''); const [mic, setMic] = useState(true); const [camera, setCamera] = useState(false);
  const [eventShown, setEventShown] = useState(false); const [savingFailure, setSavingFailure] = useState(false); const [caption, setCaption] = useState('');
  const save = (next: DemoStore) => { setStore(next); repository.save(next); };
  // Functional update keeps delayed simulated saves from overwriting a newer approval state.
  const updateMemory = (id: string, patch: Partial<Memory>) => setStore(previous => {
    const next = { ...previous, memories: previous.memories.map(m => m.id === id ? { ...m, ...patch } : m) };
    repository.save(next);
    return next;
  });
  const pending = store.memories.filter(m => m.approval === 'pending');
  const saved = store.memories.filter(m => m.approval === 'approved' && m.saving === 'saved');
  const begin = async () => {
    if (isCreating) return;
    setIsCreating(true); setLiveError(null); setConnection('connecting');
    try {
      const response = await fetch('http://127.0.0.1:3001/api/tavus/conversations', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ topic }) });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Could not start the Tavus conversation.');
      setLiveConversation(data); setScreen('call');
    } catch (error) {
      setLiveError(error instanceof Error ? error.message : 'Could not start the Tavus conversation.');
    } finally { setIsCreating(false); }
  };
  const addSuggestion = () => { const existing = store.memories.find(m => m.conversationId === 'demo-garden-01'); const suggestion = existing || fresh(); if (!existing) save({ ...store, memories: [...store.memories, suggestion] }); setEventShown(true); setCaption('You: I have been enjoying the tomatoes in my garden this year.'); return suggestion; };
  const approve = (m: Memory, text = m.text) => { updateMemory(m.id, { text, approval: 'approved', saving: 'saving' }); setTimeout(() => { const failed = savingFailure; setSavingFailure(false); updateMemory(m.id, failed ? { saving: 'failed' } : { saving: 'saved', savedAt: stamp() }); }, 700); };
  const retry = (m: Memory) => approve(m);
  const reset = () => { repository.reset(); setStore({ memories: [], hasVisited: false }); setScreen('home'); };
  return <main>
    <header><button className="brand" onClick={() => setScreen('home')} aria-label="Go home"><span>✦</span> Neighborly</button><nav><button onClick={() => setScreen('memories')}>Remembered details</button><button className="quiet" onClick={reset}>Reset demo</button></nav></header>
    {screen === 'home' && <Home store={store} saved={saved} onStart={() => setScreen('setup')} onMemories={() => setScreen('memories')} />}
    {screen === 'setup' && <Setup topic={topic} setTopic={setTopic} mic={mic} setMic={setMic} camera={camera} setCamera={setCamera} onStart={begin} isCreating={isCreating} error={liveError} onBack={() => setScreen('home')} />}
    {screen === 'call' && liveConversation && <LiveCall conversation={liveConversation} requestedMic={mic} requestedCamera={camera} onEnded={() => { setLiveConversation(null); setScreen('home'); }} />}
    {screen === 'recap' && <Recap store={store} pending={pending} onApprove={approve} onUpdate={updateMemory} onSave={save} onHome={() => setScreen('home')} />}
    {screen === 'memories' && <Memories store={store} onUpdate={updateMemory} onSave={save} onBack={() => setScreen('home')} />}
  </main>;
}

function Home({store,saved,onStart,onMemories}:{store:DemoStore;saved:Memory[];onStart:()=>void;onMemories:()=>void}) { const step=store.nextStep; return <section className="home wrap"><div className="eyebrow">A familiar face, whenever you feel like talking</div><h1>{store.hasVisited ? 'Welcome back, Margaret.' : 'Hello, Margaret.'}</h1><p className="lead">A friendly place to talk about your day, swap stories, or simply have a little company.</p><button className="primary big" onClick={onStart}>Start a conversation <span>→</span></button><p className="disclosure">Neighborly is an AI companion, not a person or a therapist.</p><div className="home-grid">{store.hasVisited ? <article><p className="label">LAST TIME</p><h2>A lovely chat about your garden</h2><p>You shared that you have been enjoying your tomato plants this year.</p>{step?.status === 'accepted' && <div className="next"><span>✓</span><div><b>Your next step</b><br />{step.text}</div></div>}</article> : <article><p className="label">YOUR FIRST VISIT</p><h2>We can start wherever you are.</h2><p>You decide what to discuss and what, if anything, should be remembered for a later visit.</p></article>}<article className="remember"><p className="label">REMEMBERED DETAILS</p><h2>{saved.length ? `${saved.length} detail${saved.length > 1 ? 's' : ''} you chose to save` : 'Nothing saved yet'}</h2><p>{saved.length ? saved.map(m=>m.text).join(' ') : 'The details you share are always yours to decide.'}</p><button className="text-btn" onClick={onMemories}>View remembered details →</button></article></div></section> }

function Setup({topic,setTopic,mic,setMic,camera,setCamera,onStart,onBack,isCreating,error}:any) { return <section className="wrap setup"><button className="back" onClick={onBack}>← Back</button><div className="eyebrow">BEFORE WE BEGIN</div><h1>Get comfortable</h1><p className="lead">Choose how you would like to join. Your browser will request the selected device permissions when the live call opens.</p><div className="device-row"><Device icon="◉" title="Microphone" on={mic} set={setMic}/><Device icon="▣" title="Camera" on={camera} set={setCamera}/></div><label className="topic">Anything on your mind? <span>Optional</span><textarea value={topic} onChange={e=>setTopic(e.target.value)} placeholder="Perhaps something from your day, a favorite memory, or no topic at all." /></label><aside className="notice"><span>✦</span><p><b>You are in control of what is remembered.</b><br/>This milestone does not save memories or generate a recap from a live conversation.</p></aside>{error && <p className="call-error" role="alert">{error}</p>}<button className="primary big" onClick={onStart} disabled={isCreating}>{isCreating ? 'Starting your conversation…' : <>Join the conversation <span>→</span></>}</button></section> }
function Device({icon,title,on,set}:any){return <div className="device"><div className="device-icon">{icon}</div><div><b>{title}</b><p><span className="sim">Simulated</span> {on?'Ready':'Off'}</p></div><button className={'toggle '+(on?'on':'')} onClick={()=>set(!on)} aria-pressed={on}><i/></button></div>}

function LiveCall({ conversation, requestedMic, requestedCamera, onEnded }: { conversation: TavusConversation; requestedMic: boolean; requestedCamera: boolean; onEnded: () => void }) {
  const callRef = useRef<DailyCall | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const remoteAudioRef = useRef<HTMLAudioElement>(null);
  const [connection, setConnection] = useState<Connection>('connecting');
  const [micOn, setMicOn] = useState(requestedMic);
  const [cameraOn, setCameraOn] = useState(requestedCamera);
  const [remoteParticipant, setRemoteParticipant] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [ending, setEnding] = useState(false);

  useEffect(() => {
    const call = DailyIframe.createCallObject();
    callRef.current = call;
    const refreshParticipants = () => {
      const remote = Object.entries(call.participants()).find(([id]) => id !== 'local')?.[1];
      setRemoteParticipant(remote || null);
    };
    const joined = () => { setConnection('connected'); refreshParticipants(); };
    const left = () => setConnection('failed');
    const failed = () => { setConnection('failed'); setError('The video room disconnected. You can end the call and try again.'); };
    call.on('joined-meeting', joined);
    call.on('participant-joined', refreshParticipants);
    call.on('participant-updated', refreshParticipants);
    call.on('participant-left', refreshParticipants);
    call.on('left-meeting', left);
    call.on('error', failed);
    call.join({ url: conversation.conversationUrl, startAudioOff: !requestedMic, startVideoOff: !requestedCamera }).catch(() => failed());
    return () => {
      call.off('joined-meeting', joined); call.off('participant-joined', refreshParticipants); call.off('participant-updated', refreshParticipants); call.off('participant-left', refreshParticipants); call.off('left-meeting', left); call.off('error', failed);
      call.leave().catch(() => undefined).finally(() => call.destroy());
    };
  }, [conversation.conversationUrl, requestedCamera, requestedMic]);

  useEffect(() => {
    const videoTrack = remoteParticipant?.tracks?.video;
    const audioTrack = remoteParticipant?.tracks?.audio;
    if (remoteVideoRef.current && videoTrack?.state === 'playable' && videoTrack.persistentTrack) remoteVideoRef.current.srcObject = new MediaStream([videoTrack.persistentTrack]);
    if (remoteAudioRef.current && audioTrack?.state === 'playable' && audioTrack.persistentTrack) remoteAudioRef.current.srcObject = new MediaStream([audioTrack.persistentTrack]);
  }, [remoteParticipant]);

  const toggleMicrophone = () => { const next = !micOn; callRef.current?.setLocalAudio(next); setMicOn(next); };
  const toggleCamera = () => { const next = !cameraOn; callRef.current?.setLocalVideo(next); setCameraOn(next); };
  const end = async () => {
    if (ending) return;
    setEnding(true); setError(null);
    await callRef.current?.leave().catch(() => undefined);
    try {
      const response = await fetch(`http://127.0.0.1:3001/api/tavus/conversations/${conversation.conversationId}/end`, { method: 'POST' });
      if (!response.ok) { const body = await response.json().catch(() => ({})); throw new Error(body.error || 'Tavus did not confirm the conversation ended.'); }
      onEnded();
    } catch (reason) {
      setError(reason instanceof Error ? `You left the browser room, but ${reason.message} Please retry.` : 'You left the browser room, but Tavus cleanup could not be confirmed. Please retry.');
      setEnding(false);
    }
  };
  const status = connection === 'connected' ? 'Connected' : connection === 'connecting' ? 'Joining your Tavus conversation…' : 'Disconnected';
  return <section className="call wrap"><div className="call-top"><div><span className={'dot ' + connection}/>{status}</div><span className="session">Live Tavus conversation</span></div><div className="video live-video"><video ref={remoteVideoRef} autoPlay playsInline aria-label="AI companion video"/><audio ref={remoteAudioRef} autoPlay playsInline/>{!remoteParticipant && connection !== 'failed' && <div className="joining"><div className="halo"/><div className="face">◡</div><p>Joining your companion…</p></div>}{connection === 'failed' && <div className="failure"><b>The room is no longer connected.</b><br/>Use End call to leave and close the Tavus session.</div>}</div><div className="caption-box" aria-live="polite"><b>Captions</b><p>Live captions are not exposed by this custom Daily UI yet. The Tavus hosted room supports captions; this local milestone keeps the custom controls and video surface.</p></div>{error && <p className="call-error" role="alert">{error}</p>}<div className="call-controls"><button onClick={toggleMicrophone} aria-pressed={micOn} disabled={connection !== 'connected'}>{micOn ? '♩' : '⌁'}<span>{micOn ? 'Microphone on' : 'Microphone off'}</span></button><button onClick={toggleCamera} aria-pressed={cameraOn} disabled={connection !== 'connected'}>{cameraOn ? '▣' : '□'}<span>{cameraOn ? 'Camera on' : 'Camera off'}</span></button><button disabled title="Captions are not available in this custom local UI">CC<span>Captions unavailable</span></button><button className="end" onClick={end} disabled={ending}>☎<span>{ending ? 'Ending…' : 'End call'}</span></button></div><p className="live-note">This is a live Tavus conversation. The gardening, memory, and recap suggestions from the prototype are not generated from this call.</p></section>;
}

function Recap({store,pending,onApprove,onUpdate,onSave,onHome}:any){ const [summary,setSummary]=useState(store.recap || 'Margaret and June talked about the tomatoes growing in Margaret’s garden.'); const step=store.nextStep || {id:'family-garden',text:'Call a family member and share a gardening story.',status:'proposed'}; const remembered=store.memories.filter((m:Memory)=>m.approval==='approved'); const setStep=(status:any,text=step.text)=>onSave({...store,recap:summary,nextStep:{...step,status,text}}); return <section className="wrap recap"><div className="eyebrow">YOUR CONVERSATION RECAP</div><h1>A moment to look back</h1><p className="lead">Review what to keep before returning home. Nothing is saved without your choice.</p><label className="summary"><b>Short summary</b><textarea value={summary} onChange={e=>setSummary(e.target.value)} onBlur={()=>onSave({...store,recap:summary})}/></label><section className="recap-section"><h2>Already remembered</h2>{remembered.length ? remembered.map((m:Memory)=><MemoryCard key={m.id} m={m} onApprove={onApprove} onUpdate={onUpdate}/>) : <p>Nothing remembered yet.</p>}</section><section className="recap-section"><h2>Suggestions for you to review</h2>{pending.length ? pending.map((m:Memory)=><MemoryCard key={m.id} m={m} onApprove={onApprove} onUpdate={onUpdate}/>) : <p>There are no more suggestions to review.</p>}</section><section className="step-card"><p className="label">A GENTLE NEXT STEP</p><h2>{step.text}</h2><p>Only for you—this does not contact anyone or send reminders.</p><div><button className="primary" onClick={()=>setStep('accepted')}>{step.status==='accepted'?'Accepted ✓':'Accept this step'}</button><button className="secondary" onClick={()=>{const x=prompt('Edit your next step:',step.text); if(x) setStep('accepted',x)}}>Edit</button><button className="text-btn" onClick={()=>setStep('completed')}>Skip for now</button></div></section><button className="primary big" onClick={onHome}>Finish and return home</button><button className="text-btn finish" onClick={onHome}>Finish without saving anything else</button></section> }
function MemoryCard({m,onApprove,onUpdate}:any){const edit=()=>{const x=prompt('Edit this detail:',m.text);if(x) onUpdate(m.id,{text:x})};return <article className="memory-card"><div><span className={'status '+m.saving}>{m.saving==='saving'?'Saving…':m.saving==='saved'?'Saved':m.saving==='failed'?'Could not save':'Needs your choice'}</span><p>{m.text}</p><small>{m.category} · from this conversation</small></div>{m.approval==='pending'?<div className="actions"><button className="primary" onClick={()=>onApprove(m)}>Remember</button><button className="secondary" onClick={edit}>Edit</button><button className="text-btn" onClick={()=>onUpdate(m.id,{approval:'discarded'})}>Discard</button></div>:m.saving==='failed'?<button className="primary" onClick={()=>onApprove(m)}>Retry saving</button>:<button className="text-btn" onClick={edit}>Edit</button>}</article>}
function Memories({store,onUpdate,onSave,onBack}:any){const saved=store.memories.filter((m:Memory)=>m.approval==='approved'&&m.saving==='saved'); const groups:Category[]=['Interests','Preferences','People']; return <section className="wrap details"><button className="back" onClick={onBack}>← Back home</button><div className="eyebrow">YOUR CHOICES, REMEMBERED</div><h1>Remembered details</h1><p className="lead">These details help make future conversations feel more personal. You can change or forget them at any time.</p>{groups.map(g=><section className="detail-group" key={g}><h2>{g}</h2>{saved.filter((m:Memory)=>m.category===g).length ? saved.filter((m:Memory)=>m.category===g).map((m:Memory)=><article className="detail" key={m.id}><span>✦</span><p>{m.text}</p><button className="text-btn" onClick={()=>{const x=prompt('Edit detail:',m.text);if(x)onUpdate(m.id,{text:x})}}>Edit</button><button className="text-btn danger" onClick={()=>onUpdate(m.id,{approval:'discarded'})}>Forget</button></article>):<p className="empty">No saved {g.toLowerCase()} yet.</p>}</section>)}<aside className="notice"><span>⌁</span><p><b>Your privacy matters.</b><br/>This demo keeps fictional data only in this browser. It does not make clinical assessments or diagnoses.</p></aside></section>}

createRoot(document.getElementById('root')!).render(<App/>);
