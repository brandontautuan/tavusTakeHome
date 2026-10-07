import { useEffect, useRef, useState, type RefObject } from 'react';
import DailyIframe, { type DailyCall, type DailyTrackState } from '@daily-co/daily-js';
import { Icon } from './Icon';
import { tavusClient } from './tavusClient';
import type { Connection, TavusConversation } from './types';

type Props = {
  conversation: TavusConversation;
  requestedMic: boolean;
  requestedCamera: boolean;
  onEnded: () => void;
  onAbandon: () => void;
};

const playable = (track?: DailyTrackState) => (track?.state === 'playable' && track.persistentTrack) || null;

// Re-attaches only when the underlying track changes, not on every participant update.
function useTrack(ref: RefObject<HTMLMediaElement | null>, track: MediaStreamTrack | null) {
  useEffect(() => {
    if (ref.current) ref.current.srcObject = track ? new MediaStream([track]) : null;
  }, [ref, track]);
}

export default function LiveCall({ conversation, requestedMic, requestedCamera, onEnded, onAbandon }: Props) {
  const callRef = useRef<DailyCall | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const remoteAudioRef = useRef<HTMLAudioElement>(null);
  const selfVideoRef = useRef<HTMLVideoElement>(null);
  const leavingRef = useRef(false);
  const closedRef = useRef(false);
  const [connection, setConnection] = useState<Connection>('connecting');
  const [micOn, setMicOn] = useState(requestedMic);
  const [cameraOn, setCameraOn] = useState(requestedCamera);
  const [hasRemote, setHasRemote] = useState(false);
  const [remoteVideo, setRemoteVideo] = useState<MediaStreamTrack | null>(null);
  const [remoteAudio, setRemoteAudio] = useState<MediaStreamTrack | null>(null);
  const [selfVideo, setSelfVideo] = useState<MediaStreamTrack | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ending, setEnding] = useState(false);
  const [leftRoom, setLeftRoom] = useState(false);

  useEffect(() => {
    const call = DailyIframe.createCallObject();
    callRef.current = call;
    const refresh = () => {
      const participants = call.participants();
      const remote = Object.values(participants).find(p => !p.local);
      setHasRemote(Boolean(remote));
      setRemoteVideo(playable(remote?.tracks.video));
      setRemoteAudio(playable(remote?.tracks.audio));
      setSelfVideo(playable(participants.local?.tracks.video));
    };
    const joined = () => { setConnection('connected'); refresh(); };
    const left = () => { if (!leavingRef.current) setConnection('failed'); };
    const failed = () => {
      if (leavingRef.current) return;
      setConnection('failed');
      setError('The call disconnected. Choose End call to close it, then start again whenever you like.');
    };
    // Any exit that skips End call (tab close, Back, navigation) still closes the Tavus session.
    const closeOnExit = () => {
      if (closedRef.current) return;
      closedRef.current = true;
      tavusClient.endOnExit(conversation.conversationId);
    };
    call.on('joined-meeting', joined);
    call.on('participant-joined', refresh);
    call.on('participant-updated', refresh);
    call.on('participant-left', refresh);
    call.on('left-meeting', left);
    call.on('error', failed);
    window.addEventListener('pagehide', closeOnExit);
    call.join({ url: conversation.conversationUrl, startAudioOff: !requestedMic, startVideoOff: !requestedCamera }).catch(failed);
    return () => {
      call.off('joined-meeting', joined);
      call.off('participant-joined', refresh);
      call.off('participant-updated', refresh);
      call.off('participant-left', refresh);
      call.off('left-meeting', left);
      call.off('error', failed);
      window.removeEventListener('pagehide', closeOnExit);
      closeOnExit();
      call.leave().catch(() => undefined).finally(() => call.destroy());
    };
  }, [conversation.conversationId, conversation.conversationUrl, requestedCamera, requestedMic]);

  useTrack(remoteVideoRef, remoteVideo);
  useTrack(remoteAudioRef, remoteAudio);
  useTrack(selfVideoRef, selfVideo);

  const toggleMicrophone = () => { const next = !micOn; callRef.current?.setLocalAudio(next); setMicOn(next); };
  const toggleCamera = () => { const next = !cameraOn; callRef.current?.setLocalVideo(next); setCameraOn(next); };
  const end = async () => {
    if (ending) return;
    setEnding(true);
    setError(null);
    leavingRef.current = true;
    await callRef.current?.leave().catch(() => undefined);
    setLeftRoom(true);
    try {
      await tavusClient.end(conversation.conversationId);
      closedRef.current = true;
      onEnded();
    } catch (reason) {
      const detail = reason instanceof Error ? reason.message : 'The conversation could not be confirmed as ended.';
      setError(`You have left the call, but it may still be open on our side. ${detail}`);
      setEnding(false);
    }
  };

  const live = connection === 'connected' && !leftRoom;
  const status = leftRoom ? 'You have left the call' : connection === 'connected' ? 'Connected' : connection === 'connecting' ? 'Joining your conversation…' : 'Disconnected';

  return (
    <section className="call wrap">
      <h1 className="visually-hidden">Your conversation</h1>
      <div className="call-top">
        <p role="status"><span className={'dot ' + (leftRoom ? 'failed' : connection)} />{status}</p>
        <p className="session">Live conversation with an AI companion</p>
      </div>
      <div className="video">
        <video ref={remoteVideoRef} autoPlay playsInline aria-label="Your AI companion" />
        <audio ref={remoteAudioRef} autoPlay />
        {!hasRemote && connection !== 'failed' && !leftRoom && (
          <div className="joining">
            <div className="halo" />
            <div className="face"><Icon name="smile" size={84} /></div>
            <p>Your companion is on the way…</p>
          </div>
        )}
        {(connection === 'failed' || leftRoom) && (
          <p className="failure">{leftRoom ? 'You have left the call.' : 'The call is no longer connected.'}</p>
        )}
        {selfVideo && !leftRoom && <video className="self-view" ref={selfVideoRef} autoPlay playsInline muted aria-label="Your camera, as your companion sees it" />}
      </div>
      {error && <p className="call-error" role="alert">{error}</p>}
      <div className="call-controls">
        <button role="switch" aria-checked={micOn} onClick={toggleMicrophone} disabled={!live}>
          <Icon name={micOn ? 'mic' : 'micOff'} size={24} /><b>Microphone</b><span aria-hidden="true">{micOn ? 'On' : 'Off'}</span>
        </button>
        <button role="switch" aria-checked={cameraOn} onClick={toggleCamera} disabled={!live}>
          <Icon name={cameraOn ? 'camera' : 'cameraOff'} size={24} /><b>Camera</b><span aria-hidden="true">{cameraOn ? 'On' : 'Off'}</span>
        </button>
        <button className="end" onClick={end} disabled={ending}>
          <Icon name="hangUp" size={24} /><b>{ending ? 'Ending…' : leftRoom ? 'Try again' : 'End call'}</b>
        </button>
      </div>
      {leftRoom && error && !ending && <button className="text-btn leave-anyway" onClick={onAbandon}>Return home anyway</button>}
      <p className="live-note">You are talking with an AI companion, not a person or a therapist. Captions are not available in this call yet.</p>
    </section>
  );
}
