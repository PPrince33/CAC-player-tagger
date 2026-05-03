'use client';
import { useRef, useEffect, useCallback, useState } from 'react';
import { useTaggerStore } from '@/store/taggerStore';
import { Play, Pause, SkipBack, SkipForward, ChevronDown } from 'lucide-react';

const SPEEDS = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2];

export default function VideoPlayer({ videoUrl, videoType }) {
  const setCurrentTime = useTaggerStore(s => s.setCurrentTime);
  const setPlayerRef   = useTaggerStore(s => s.setPlayerRef);

  const ytContainerRef = useRef(null);
  const ytPlayerRef    = useRef(null);   // YT.Player instance
  const htmlVideoRef   = useRef(null);   // <video> element
  const tickRef        = useRef(null);

  const [playing, setPlaying] = useState(false);
  const [speed,   setSpeed]   = useState(1);
  const [duration, setDuration] = useState(0);
  const [current,  setCurrent]  = useState(0);

  const isYT = videoType === 'YouTube';

  // ── Helpers ───────────────────────────────────────────────
  const getTime = useCallback(() => {
    if (isYT) return ytPlayerRef.current?.getCurrentTime() ?? 0;
    return htmlVideoRef.current?.currentTime ?? 0;
  }, [isYT]);

  const seekTo = useCallback((t) => {
    if (isYT) ytPlayerRef.current?.seekTo(t, true);
    else if (htmlVideoRef.current) htmlVideoRef.current.currentTime = t;
  }, [isYT]);

  const playPause = useCallback(() => {
    if (isYT) {
      const state = ytPlayerRef.current?.getPlayerState();
      if (state === 1) ytPlayerRef.current.pauseVideo();
      else ytPlayerRef.current?.playVideo();
    } else {
      const v = htmlVideoRef.current;
      if (!v) return;
      if (v.paused) v.play(); else v.pause();
    }
  }, [isYT]);

  const changeSpeed = useCallback((s) => {
    setSpeed(s);
    if (isYT) ytPlayerRef.current?.setPlaybackRate(s);
    else if (htmlVideoRef.current) htmlVideoRef.current.playbackRate = s;
  }, [isYT]);

  // ── Expose player ref to store ────────────────────────────
  useEffect(() => {
    setPlayerRef({ getTime, seekTo, playPause });
  }, [getTime, seekTo, playPause, setPlayerRef]);

  // ── YouTube IFrame API ────────────────────────────────────
  useEffect(() => {
    if (!isYT || !videoUrl) return;

    const videoId = extractYtId(videoUrl);
    if (!videoId) return;

    function createPlayer() {
      ytPlayerRef.current = new window.YT.Player(ytContainerRef.current, {
        videoId,
        playerVars: { autoplay: 0, controls: 1, rel: 0 },
        events: {
          onStateChange(e) {
            setPlaying(e.data === 1);
            if (e.data === 1) {
              setDuration(ytPlayerRef.current.getDuration());
              tickRef.current = setInterval(() => {
                const t = ytPlayerRef.current?.getCurrentTime() ?? 0;
                setCurrent(t);
                setCurrentTime(Math.floor(t));
              }, 250);
            } else {
              clearInterval(tickRef.current);
            }
          },
        },
      });
    }

    if (window.YT?.Player) {
      createPlayer();
    } else {
      const tag = document.createElement('script');
      tag.src   = 'https://www.youtube.com/iframe_api';
      document.head.appendChild(tag);
      window.onYouTubeIframeAPIReady = createPlayer;
    }

    return () => {
      clearInterval(tickRef.current);
      ytPlayerRef.current?.destroy?.();
    };
  }, [videoUrl, isYT, setCurrentTime]);

  // ── HTML5 video events ────────────────────────────────────
  useEffect(() => {
    if (isYT) return;
    const v = htmlVideoRef.current;
    if (!v) return;

    const onTime = () => {
      setCurrent(v.currentTime);
      setCurrentTime(Math.floor(v.currentTime));
    };
    const onMeta  = () => setDuration(v.duration);
    const onPlay  = () => setPlaying(true);
    const onPause = () => setPlaying(false);

    v.addEventListener('timeupdate', onTime);
    v.addEventListener('loadedmetadata', onMeta);
    v.addEventListener('play', onPlay);
    v.addEventListener('pause', onPause);
    return () => {
      v.removeEventListener('timeupdate', onTime);
      v.removeEventListener('loadedmetadata', onMeta);
      v.removeEventListener('play', onPlay);
      v.removeEventListener('pause', onPause);
    };
  }, [isYT, setCurrentTime]);

  // ── Keyboard shortcuts ────────────────────────────────────
  useEffect(() => {
    function onKey(e) {
      const tag = document.activeElement?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

      if (e.code === 'Space') { e.preventDefault(); playPause(); }
      if (e.code === 'ArrowLeft')  { e.preventDefault(); seekTo(Math.max(0, getTime() - (e.shiftKey ? 1 : 5))); }
      if (e.code === 'ArrowRight') { e.preventDefault(); seekTo(getTime() + (e.shiftKey ? 1 : 5)); }
      if (e.code === 'ArrowUp')    { e.preventDefault(); seekTo(getTime() + 30); }
      if (e.code === 'ArrowDown')  { e.preventDefault(); seekTo(Math.max(0, getTime() - 30)); }
      if (e.code === 'BracketLeft')  { e.preventDefault(); seekTo(Math.max(0, getTime() - 1)); }
      if (e.code === 'BracketRight') { e.preventDefault(); seekTo(getTime() + 1); }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [playPause, seekTo, getTime]);

  // ── Seek bar ──────────────────────────────────────────────
  function handleSeekBar(e) {
    const pct = e.target.value / 1000;
    seekTo(pct * duration);
  }

  return (
    <div className="flex flex-col gap-2">
      {/* Video area */}
      {isYT ? (
        <div
          ref={ytContainerRef}
          className="w-full rounded-lg bg-black"
          style={{ aspectRatio: '16/9' }}
        />
      ) : (
        <video
          ref={htmlVideoRef}
          src={videoUrl}
          className="w-full rounded-lg bg-black"
          style={{ aspectRatio: '16/9' }}
          controls={false}
        />
      )}

      {/* Controls */}
      <div className="flex items-center gap-2 rounded-md border border-gray-700 bg-gray-900 px-3 py-2">
        {/* Seek back 5s */}
        <button onClick={() => seekTo(Math.max(0, getTime() - 5))}
          className="text-gray-400 hover:text-white" title="−5s [←]">
          <SkipBack size={16} />
        </button>
        {/* Play/Pause */}
        <button onClick={playPause}
          className="rounded bg-green-600 p-1.5 text-white hover:bg-green-500" title="Play/Pause [Space]">
          {playing ? <Pause size={14} /> : <Play size={14} />}
        </button>
        {/* Seek forward 5s */}
        <button onClick={() => seekTo(getTime() + 5)}
          className="text-gray-400 hover:text-white" title="+5s [→]">
          <SkipForward size={16} />
        </button>

        {/* Time */}
        <span className="min-w-[80px] text-xs text-gray-400 font-mono">
          {fmtTime(current)} / {fmtTime(duration)}
        </span>

        {/* Seek bar */}
        <input
          type="range" min={0} max={1000}
          value={duration ? Math.round((current / duration) * 1000) : 0}
          onChange={handleSeekBar}
          className="flex-1 h-1.5 accent-green-500"
        />

        {/* Speed */}
        <select
          value={speed}
          onChange={e => changeSpeed(parseFloat(e.target.value))}
          className="rounded bg-gray-800 border border-gray-700 text-xs text-white px-1 py-0.5"
        >
          {SPEEDS.map(s => <option key={s} value={s}>{s}×</option>)}
        </select>
      </div>

      {/* Hotkey hint */}
      <p className="text-xs text-gray-600">
        Space: play/pause · ←/→: ±5s · Shift+←/→: ±1s · ↑/↓: ±30s
      </p>
    </div>
  );
}

function extractYtId(url) {
  const m = url.match(/(?:v=|youtu\.be\/)([A-Za-z0-9_-]{11})/);
  return m ? m[1] : null;
}

function fmtTime(secs) {
  if (!secs || isNaN(secs)) return '00:00';
  const m = Math.floor(secs / 60).toString().padStart(2, '0');
  const s = Math.floor(secs % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}
