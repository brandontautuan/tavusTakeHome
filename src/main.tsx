import { lazy, Suspense, useEffect, useRef, useState, type FormEvent } from 'react';
import { createRoot } from 'react-dom/client';
import { Icon, type IconName } from './Icon';
import { emptyStore, newParticipantTag, repository } from './store';
import { tavusClient } from './tavusClient';
import type { Category, DemoStore, Memory, NextStep, Screen, TavusConversation, TavusMemorySnapshot } from './types';
import './styles.css';

// The Daily SDK is most of the bundle; only the call screen needs it.
const LiveCall = lazy(() => import('./LiveCall'));

const SCREENS: Screen[] = ['home', 'setup', 'call', 'recap', 'memories'];
const TITLES: Record<Screen, string> = {
  home: 'Neighborly',
  setup: 'Get comfortable · Neighborly',
  call: 'Your conversation · Neighborly',
  recap: 'Sample recap · Neighborly',
  memories: 'Remembered details · Neighborly',
};
const DEFAULT_STEP: NextStep = { id: 'family-garden', text: 'Call a family member and share a gardening story.', status: 'proposed' };
const DEFAULT_RECAP = 'This sample recap is only available for the original prototype flow.';

const screenFromHash = (): Screen => {
  const name = window.location.hash.slice(1) as Screen;
  return SCREENS.includes(name) ? name : 'home';
};

type MemoryPatch = (id: string, patch: Partial<Memory>) => void;

function App() {
  const [store, setStore] = useState<DemoStore>(() => repository.load());
  const [screen, setScreen] = useState<Screen>(screenFromHash);
  const [liveConversation, setLiveConversation] = useState<TavusConversation | null>(null);
  const [liveError, setLiveError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [topic, setTopic] = useState('');
  const [name, setName] = useState(() => store.profile?.name || '');
  const [rememberName, setRememberName] = useState(() => Boolean(store.profile?.name));
  const [mic, setMic] = useState(() => store.callPreferences?.mic ?? true);
  const [camera, setCamera] = useState(() => store.callPreferences?.camera ?? false);
  const [tavusMemory, setTavusMemory] = useState<TavusMemorySnapshot | null>(null);
  const [memoryError, setMemoryError] = useState<string | null>(null);
  const [memoryVersion, setMemoryVersion] = useState(0);
  const storageOk = useRef(true);
  const resetDialog = useRef<HTMLDialogElement>(null);
  const firstView = useRef(true);

  // A call needs a live session; a stale #call link falls back to setup.
  const view: Screen = screen === 'call' && !liveConversation ? 'setup' : screen;

  const go = (next: Screen, replace = false) => {
    const url = next === 'home' ? window.location.pathname + window.location.search : '#' + next;
    window.history[replace ? 'replaceState' : 'pushState'](null, '', url);
    setScreen(next);
  };

  useEffect(() => {
    const sync = () => setScreen(screenFromHash());
    window.addEventListener('popstate', sync);
    window.addEventListener('hashchange', sync);
    return () => { window.removeEventListener('popstate', sync); window.removeEventListener('hashchange', sync); };
  }, []);

  // Leaving the call screen by any route (Back, a link) releases the session; LiveCall closes it on unmount.
  useEffect(() => {
    if (screen !== 'call' && liveConversation) setLiveConversation(null);
  }, [screen, liveConversation]);

  useEffect(() => { storageOk.current = repository.save(store); }, [store]);

  useEffect(() => {
    const tag = store.profile?.participantTag;
    if (!tag) return;
    let active = true;
    setTavusMemory(null); setMemoryError(null);
    tavusClient.memory(tag).then(snapshot => { if (active) setTavusMemory(snapshot); }).catch(error => { if (active) setMemoryError(error instanceof Error ? error.message : 'Could not read remembered details.'); });
    return () => { active = false; };
  }, [store.profile?.participantTag, memoryVersion]);

  // Screens swap in place, so move focus and the page title the way a navigation would.
  useEffect(() => {
    document.title = TITLES[view];
    if (firstView.current) { firstView.current = false; return; }
    window.scrollTo(0, 0);
    const heading = document.querySelector<HTMLElement>('main h1');
    heading?.setAttribute('tabindex', '-1');
    heading?.focus();
  }, [view]);

  const updateMemory: MemoryPatch = (id, patch) =>
    setStore(previous => ({ ...previous, memories: previous.memories.map(m => (m.id === id ? { ...m, ...patch } : m)) }));
  const patchStore = (patch: Partial<DemoStore>) => setStore(previous => ({ ...previous, ...patch }));

  const approve = (m: Memory) => {
    updateMemory(m.id, { approval: 'approved', saving: 'saving' });
    // Stands in for a network save; reports honestly if this browser refused the write.
    window.setTimeout(() => updateMemory(m.id, storageOk.current ? { saving: 'saved', savedAt: new Date().toISOString() } : { saving: 'failed' }), 700);
  };

  const begin = async () => {
    if (isCreating) return;
    setIsCreating(true);
    setLiveError(null);
    try {
      const profile = { participantTag: store.profile?.participantTag || newParticipantTag(), ...(rememberName && name.trim() ? { name: name.trim() } : {}) };
      setStore(previous => ({ ...previous, profile, callPreferences: { mic, camera } }));
      setLiveConversation(await tavusClient.start(topic.trim(), profile.participantTag, profile.name));
      go('call');
    } catch (error) {
      setLiveError(error instanceof Error ? error.message : 'The conversation could not be started. Please try again.');
    } finally {
      setIsCreating(false);
    }
  };

  const finishLiveCall = () => {
    setStore(previous => ({ ...previous, hasVisited: true }));
    setLiveConversation(null);
    setTopic('');
    setMemoryVersion(version => version + 1);
    go('home', true);
  };

  const reset = () => {
    resetDialog.current?.close();
    setStore(emptyStore());
    setTopic('');
    go('home');
  };

  const inCall = view === 'call';
  const saved = store.memories.filter(m => m.approval === 'approved' && m.saving === 'saved');

  return (
    <>
      <a className="skip-link" href="#content">Skip to content</a>
      <header>
        {inCall ? (
          <span className="brand"><Icon name="spark" size={18} /> Neighborly</span>
        ) : (
          <>
            <button className="brand" onClick={() => go('home')}><Icon name="spark" size={18} /> Neighborly</button>
            <nav aria-label="Main">
              <button className="text-btn" onClick={() => go('memories')} aria-current={view === 'memories' ? 'page' : undefined}>Remembered details</button>
            </nav>
          </>
        )}
      </header>
      <main id="content">
        {view === 'home' && <Home store={store} saved={saved} tavusMemory={tavusMemory} memoryError={memoryError} isCreating={isCreating} onRefreshMemory={() => setMemoryVersion(version => version + 1)} onStart={() => store.profile ? begin() : go('setup')} onSettings={() => go('setup')} onMemories={() => go('memories')} />}
        {view === 'setup' && <Setup name={name} setName={setName} rememberName={rememberName} setRememberName={setRememberName} topic={topic} setTopic={setTopic} mic={mic} setMic={setMic} camera={camera} setCamera={setCamera} onStart={begin} isCreating={isCreating} error={liveError} onBack={() => go('home')} />}
        {view === 'call' && liveConversation && (
          <Suspense fallback={<section className="call wrap"><h1 className="visually-hidden">Your conversation</h1><p role="status">Joining your conversation…</p></section>}>
            <LiveCall conversation={liveConversation} requestedMic={mic} requestedCamera={camera} onEnded={finishLiveCall} onAbandon={() => go('home', true)} />
          </Suspense>
        )}
        {view === 'recap' && <Recap store={store} onApprove={approve} onUpdate={updateMemory} onPatch={patchStore} onHome={() => go('home')} />}
        {view === 'memories' && <Memories saved={saved} name={store.profile?.name} onUpdate={updateMemory} onBack={() => go('home')} />}
      </main>
      {!inCall && (
        <footer>
          <p>Fictional demo data, kept only in this browser.</p>
          <button className="text-btn quiet" onClick={() => resetDialog.current?.showModal()}>Reset demo</button>
        </footer>
      )}
      <dialog ref={resetDialog} aria-labelledby="reset-title">
        <h2 id="reset-title">Reset the demo?</h2>
        <p>This forgets every remembered detail, the sample recap, and your next step in this browser. It cannot be undone.</p>
        <div className="dialog-actions">
          <button className="secondary" onClick={() => resetDialog.current?.close()}>Keep everything</button>
          <button className="primary danger-fill" onClick={reset}>Reset demo</button>
        </div>
      </dialog>
    </>
  );
}

function Home({ store, saved, tavusMemory, memoryError, isCreating, onRefreshMemory, onStart, onSettings, onMemories }: { store: DemoStore; saved: Memory[]; tavusMemory: TavusMemorySnapshot | null; memoryError: string | null; isCreating: boolean; onRefreshMemory: () => void; onStart: () => void; onSettings: () => void; onMemories: () => void }) {
  const step = store.nextStep;
  const learnedFacts = tavusMemory?.facts || [];
  return (
    <section className="home wrap">
      <p className="eyebrow">A familiar face, whenever you feel like talking</p>
      <h1>{store.hasVisited ? `Welcome back${store.profile?.name ? `, ${store.profile.name}` : ''}.` : `Hello${store.profile?.name ? `, ${store.profile.name}` : ''}.`}</h1>
      <p className="lead">A friendly place to talk about your day, swap stories, or simply have a little company.</p>
      <button className="primary big" onClick={onStart} disabled={isCreating}>{isCreating ? 'Starting your conversation…' : <>Start a conversation <Icon name="arrowRight" /></>}</button>
      {store.profile && <button className="text-btn call-settings" onClick={onSettings}>Change how you join</button>}
      <p className="disclosure">Neighborly is an AI companion, not a person or a therapist.</p>
      <div className="home-grid">
        {store.hasVisited ? (
          <article>
            <p className="label">LAST CONVERSATION</p>
            <h2>{tavusMemory?.state === 'ready' ? 'A conversation to continue' : 'Getting ready for next time'}</h2>
            <p>{tavusMemory === null ? 'Checking what your companion learned from the last conversation…' : tavusMemory.lastSummary || (tavusMemory.state === 'processing' ? 'Your companion is processing the last conversation. This can take a moment after a call ends.' : 'Your companion will use the details you choose to share to make the next conversation feel familiar.')}</p>
            {memoryError && <p className="memory-error" role="status">{memoryError}</p>}
            <button className="text-btn refresh-memory" onClick={onRefreshMemory}>Refresh remembered details</button>
            {step?.status === 'accepted' && (
              <div className="next"><Icon name="check" /><p><b>Your next step</b><br />{step.text}</p></div>
            )}
          </article>
        ) : (
          <article>
            <p className="label">Your first visit</p>
            <h2>We can start wherever you are.</h2>
            <p>You decide what to discuss and what, if anything, should be remembered for a later visit.</p>
          </article>
        )}
        <article className="remember">
          <p className="label">Remembered details</p>
          <h2>{learnedFacts.length ? `${learnedFacts.length} detail${learnedFacts.length > 1 ? 's' : ''} remembered` : saved.length ? `${saved.length} detail${saved.length > 1 ? 's' : ''} you chose to save` : 'Nothing saved yet'}</h2>
          <p>{learnedFacts.length ? learnedFacts.join(' · ') : saved.length ? saved.map(m => m.text).join(' ') : 'The details you share are always yours to decide.'}</p>
          <button className="text-btn" onClick={onMemories}>View remembered details <Icon name="arrowRight" size={16} /></button>
        </article>
      </div>
    </section>
  );
}

type SetupProps = {
  name: string; setName: (value: string) => void;
  rememberName: boolean; setRememberName: (value: boolean) => void;
  topic: string; setTopic: (value: string) => void;
  mic: boolean; setMic: (on: boolean) => void;
  camera: boolean; setCamera: (on: boolean) => void;
  onStart: () => void; onBack: () => void;
  isCreating: boolean; error: string | null;
};

function Setup({ name, setName, rememberName, setRememberName, topic, setTopic, mic, setMic, camera, setCamera, onStart, onBack, isCreating, error }: SetupProps) {
  return (
    <section className="wrap setup">
      <button className="text-btn back" onClick={onBack}><Icon name="arrowLeft" size={16} /> Back</button>
      <p className="eyebrow">Before we begin</p>
      <h1>Get comfortable</h1>
      <p className="lead">Choose how you would like to join. Your browser will ask before it uses your microphone or camera.</p>
      <label className="profile-name">What should your companion call you? <span>Optional</span><input value={name} onChange={e => setName(e.target.value)} maxLength={80} autoComplete="given-name" placeholder="Your first name" /></label>
      <label className="remember-choice"><input type="checkbox" checked={rememberName} onChange={e => setRememberName(e.target.checked)} disabled={!name.trim()} /> Remember this name for a future visit</label>
      <p className="hint">This is optional. When selected, your name stays in this browser and is shared with the companion for future conversations.</p>
      <div className="device-row">
        <Device icon={mic ? 'mic' : 'micOff'} title="Microphone" on={mic} set={setMic} />
        <Device icon={camera ? 'camera' : 'cameraOff'} title="Camera" on={camera} set={setCamera} />
      </div>
      <label className="topic">
        Anything on your mind? <span>Optional</span>
        <textarea value={topic} onChange={e => setTopic(e.target.value)} maxLength={500} aria-describedby="topic-hint" placeholder="Perhaps something from your day, a favorite memory, or no topic at all." />
      </label>
      <p className="hint" id="topic-hint">Your companion will see this so the conversation can start there.</p>
      <aside className="notice">
        <Icon name="spark" size={22} />
        <p><b>Your companion can remember your conversations.</b><br />This local demo uses one browser-specific visitor ID so Tavus can build continuity with this companion over time.</p>
      </aside>
      {error && <p className="call-error" role="alert">{error}</p>}
      <button className="primary big" onClick={onStart} disabled={isCreating}>
        {isCreating ? 'Starting your conversation…' : <>Join the conversation <Icon name="arrowRight" /></>}
      </button>
    </section>
  );
}

function Device({ icon, title, on, set }: { icon: IconName; title: string; on: boolean; set: (on: boolean) => void }) {
  return (
    <button className="device" role="switch" aria-checked={on} onClick={() => set(!on)}>
      <span className="device-icon"><Icon name={icon} size={22} /></span>
      <span className="device-text"><b>{title}</b><span aria-hidden="true">{on ? 'On when you join' : 'Off when you join'}</span></span>
      <span className="toggle" aria-hidden="true"><i /></span>
    </button>
  );
}

// Returns focus to the Edit button when an inline editor closes.
function useEditing() {
  const [editing, setEditing] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const wasEditing = useRef(false);
  useEffect(() => {
    if (wasEditing.current && !editing) trigger.current?.focus();
    wasEditing.current = editing;
  }, [editing]);
  return { editing, open: () => setEditing(true), close: () => setEditing(false), trigger };
}

function EditForm({ label, initial, onSave, onCancel }: { label: string; initial: string; onSave: (text: string) => void; onCancel: () => void }) {
  const [text, setText] = useState(initial);
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (text.trim()) onSave(text.trim());
  };
  return (
    <form className="edit-form" onSubmit={submit} onKeyDown={e => { if (e.key === 'Escape') onCancel(); }}>
      <label>
        <span>{label}</span>
        <textarea value={text} onChange={e => setText(e.target.value)} rows={2} maxLength={240} autoFocus />
      </label>
      <div className="actions">
        <button className="primary" type="submit" disabled={!text.trim()}>Save changes</button>
        <button className="secondary" type="button" onClick={onCancel}>Cancel</button>
      </div>
    </form>
  );
}

const SAVING_LABEL: Record<Memory['saving'], string> = { idle: 'Needs your choice', saving: 'Saving…', saved: 'Saved', failed: 'Could not save in this browser' };

function MemoryCard({ m, onApprove, onUpdate }: { m: Memory; onApprove: (m: Memory) => void; onUpdate: MemoryPatch }) {
  const { editing, open, close, trigger } = useEditing();
  if (editing) {
    return (
      <article className="memory-card">
        <EditForm label="Edit this detail" initial={m.text} onCancel={close} onSave={text => { onUpdate(m.id, { text }); close(); }} />
      </article>
    );
  }
  return (
    <article className="memory-card">
      <div>
        <span className={'status ' + m.saving} role="status">{SAVING_LABEL[m.saving]}</span>
        <p>{m.text}</p>
        <small>{m.category} · sample detail</small>
      </div>
      <div className="actions">
        {m.approval === 'pending' && <button className="primary" onClick={() => onApprove(m)}>Remember</button>}
        {m.saving === 'failed' && <button className="primary" onClick={() => onApprove(m)}>Try saving again</button>}
        {m.saving !== 'saving' && <button className="secondary" ref={trigger} onClick={open}>Edit</button>}
        {m.approval === 'pending' && <button className="text-btn" onClick={() => onUpdate(m.id, { approval: 'discarded' })}>Discard</button>}
      </div>
    </article>
  );
}

type RecapProps = { store: DemoStore; onApprove: (m: Memory) => void; onUpdate: MemoryPatch; onPatch: (patch: Partial<DemoStore>) => void; onHome: () => void };

function Recap({ store, onApprove, onUpdate, onPatch, onHome }: RecapProps) {
  const [summary, setSummary] = useState(store.recap || DEFAULT_RECAP);
  const { editing, open, close, trigger } = useEditing();
  const step = store.nextStep || DEFAULT_STEP;
  const remembered = store.memories.filter(m => m.approval === 'approved');
  const pending = store.memories.filter(m => m.approval === 'pending');
  const setStep = (status: NextStep['status'], text = step.text) => onPatch({ nextStep: { ...step, status, text } });
  return (
    <section className="wrap recap">
      <p className="eyebrow">Sample conversation recap</p>
      <h1>A moment to look back</h1>
      <p className="lead">This recap uses fictional details; it was not written from your call. Review what to keep. Nothing is saved without your choice.</p>
      <label className="summary">
        Short summary
        <textarea value={summary} onChange={e => setSummary(e.target.value)} onBlur={() => onPatch({ recap: summary })} />
      </label>
      <section className="recap-section">
        <h2>Suggestions for you to review</h2>
        {pending.length ? pending.map(m => <MemoryCard key={m.id} m={m} onApprove={onApprove} onUpdate={onUpdate} />) : <p className="empty">There are no more suggestions to review.</p>}
      </section>
      <section className="recap-section">
        <h2>Already remembered</h2>
        {remembered.length ? remembered.map(m => <MemoryCard key={m.id} m={m} onApprove={onApprove} onUpdate={onUpdate} />) : <p className="empty">Nothing remembered yet.</p>}
      </section>
      <section className="step-card">
        <p className="label">A gentle next step</p>
        {editing ? (
          <EditForm label="Edit your next step" initial={step.text} onCancel={close} onSave={text => { setStep('accepted', text); close(); }} />
        ) : (
          <>
            <h2>{step.text}</h2>
            <p>Only for you. This does not contact anyone or send reminders.</p>
            <div className="actions">
              {step.status === 'accepted'
                ? <p className="status saved" role="status"><Icon name="check" size={16} /> Accepted</p>
                : <button className="primary" onClick={() => setStep('accepted')}>Accept this step</button>}
              <button className="secondary" ref={trigger} onClick={open}>Edit</button>
              {step.status === 'skipped'
                ? <p className="status" role="status">Skipped for now</p>
                : <button className="text-btn" onClick={() => setStep('skipped')}>Skip for now</button>}
            </div>
          </>
        )}
      </section>
      <button className="primary big" onClick={onHome}>Return home <Icon name="arrowRight" /></button>
      {pending.length > 0 && <p className="hint">Anything you have not chosen stays unsaved.</p>}
    </section>
  );
}

const GROUPS: Category[] = ['Interests', 'Preferences', 'People'];

function Memories({ saved, name, onUpdate, onBack }: { saved: Memory[]; name?: string; onUpdate: MemoryPatch; onBack: () => void }) {
  const [forgotten, setForgotten] = useState<Memory | null>(null);
  const forget = (m: Memory) => { onUpdate(m.id, { approval: 'discarded' }); setForgotten(m); };
  const undo = () => { if (forgotten) onUpdate(forgotten.id, { approval: 'approved' }); setForgotten(null); };
  return (
    <section className="wrap details">
      <button className="text-btn back" onClick={onBack}><Icon name="arrowLeft" size={16} /> Back home</button>
      <p className="eyebrow">Your choices, remembered</p>
      <h1>Remembered details</h1>
      <p className="lead">These details help make future conversations feel more personal. You can change or forget them at any time.</p>
      {name && <section className="detail-group profile-detail"><h2>Your name</h2><p>{name}</p><small>Used to greet you in future local-demo conversations.</small></section>}
      <div role="status">
        {forgotten && <p className="undo">Forgotten: “{forgotten.text}” <button className="text-btn" onClick={undo}>Undo</button></p>}
      </div>
      {GROUPS.map(group => {
        const items = saved.filter(m => m.category === group);
        return (
          <section className="detail-group" key={group}>
            <h2>{group}</h2>
            {items.length ? items.map(m => <Detail key={m.id} m={m} onUpdate={onUpdate} onForget={forget} />) : <p className="empty">No saved {group.toLowerCase()} yet.</p>}
          </section>
        );
      })}
      <aside className="notice">
        <Icon name="spark" size={22} />
        <p><b>Your privacy matters.</b><br />Your chosen name and browser-specific participant ID stay in this browser. Tavus learns conversational continuity for that ID. This app does not make clinical assessments or diagnoses.</p>
      </aside>
    </section>
  );
}

function Detail({ m, onUpdate, onForget }: { m: Memory; onUpdate: MemoryPatch; onForget: (m: Memory) => void }) {
  const { editing, open, close, trigger } = useEditing();
  if (editing) {
    return (
      <article className="detail">
        <EditForm label="Edit this detail" initial={m.text} onCancel={close} onSave={text => { onUpdate(m.id, { text }); close(); }} />
      </article>
    );
  }
  return (
    <article className="detail">
      <Icon name="spark" size={16} />
      <p>{m.text}</p>
      <button className="text-btn" ref={trigger} onClick={open}>Edit</button>
      <button className="text-btn danger" onClick={() => onForget(m)}>Forget</button>
    </article>
  );
}

createRoot(document.getElementById('root')!).render(<App />);
