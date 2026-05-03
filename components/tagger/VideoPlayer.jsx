'use client';
import { useRef, useEffect, useCallback, useState } from 'react';
import { useTaggerStore } from '@/store/taggerStore';
import { Play, Pause, SkipBack, SkipForward } from 'lucide-react';

const SPEEDS = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2];

export default function VideoPlayer({ videoUrl, videoType }) {
  const setCurrentTime = useTaggerStore(s => s.setCurrentTime);
  const setPlayerRef   = useTaggerStore(s => s.setPlayerRef);

  const ytContainerRef = useRef(null);
  const ytPlayerRef    = useRef(null);
  const htmlVideoRef   = useRef(null);
  const tickRef        = useRef(null);

  const [playing, setPlaying] = useState(false);
  const [speed,   setSpeed]   = useState(1);
  const [duration, setDuration] = useState(0);
  const [current,  setCurrent]  = useState(0);

  const isYT = videoType === 'YouTube';

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

  useEffect(() => {
    setPlayerRef({ getTime, seekTo, playPause });
  }, [getTime, seekTo, playPause, setPlayerRef]);

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

  useEffect(() => {
    if (isYT) return;
    const v = htmlVideoRef.current;
    if (!v) return;

    const onTime  = () => { setCurrent(v.currentTime); setCurrentTime(Math.floor(v.currentTime)); };
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

  useEffect(() => {
    function onKey(e) {
      const tag = document.activeElement?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

      if (e.code === 'Space')       { e.preventDefault(); playPause(); }
      if (e.code === 'ArrowLeft')   { e.preventDefault(); seekTo(Math.max(0, getTime() - (e.shiftKey ? 1 : 5))); }
      if (e.code === 'ArrowRight')  { e.preventDefault(); seekTo(getTime() + (e.shiftKey ? 1 : 5)); }
      if (e.code === 'ArrowUp')     { e.preventDefault(); seekTo(getTime() + 30); }
      if (e.code === 'ArrowDown')   { e.preventDefault(); seekTo(Math.max(0, getTime() - 30)); }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [playPause, seekTo, getTime]);

  function handleSeekBar(e) {
    const pct = e.target.value / 1000;
    seekTo(pct * duration);
  }

  return (
    <div className="flex flex-col gap-2">
      {/* Video area */}
      {isYT ? (
        <div ref={ytContainerRef} className="w-full bg-black border-2 border-black" style={{ aspectRatio: '16/9' }} />
      ) : (
        <video
          ref={htmlVideoRef}
          src={videoUrl}
          className="w-full bg-black border-2 border-black"
          style={{ aspectRatio: '16/9' }}
          controls={false}
        />
      )}

      {/* Controls */}
      <div className="flex items-center gap-2 border-2 border-black bg-white px-3 py-2 shadow-brutal-sm">
        <button onClick={() => seekTo(Math.max(0, getTime() - 5))}
          className="border-2 border-black p-1 hover:bg-black hover:text-white transition-none" title="−5s [←]">
          <SkipBack size={14} />
        </button>
        <button onClick={playPause}
          className="border-2 border-black bg-[#34D399] p-1.5 font-bold hover:bg-black hover:text-[#34D399] transition-none" title="Play/Pause [Space]">
          {playing ? <Pause size={13} /> : <Play size={13} />}
        </button>
        <button onClick={() => seekTo(getTime() + 5)}
          className="border-2 border-black p-1 hover:bg-black hover:text-white transition-none" title="+5s [→]">
          <SkipForward size={14} />
        </button>

        <span className="min-w-[80px] text-xs font-bold font-mono text-black">
          {fmtTime(current)} / {fmtTime(duration)}
        </span>

        <input
          type="range" min={0} max={1000}
          value={duration ? Math.round((current / duration) * 1000) : 0}
          onChange={handleSeekBar}
          className="flex-1 h-1.5 accent-black"
        />

        <select
          value={speed}
          onChange={e => changeSpeed(parseFloat(e.target.value))}
          className="border-2 border-black bg-white text-xs font-bold px-1 py-0.5 focus:outline-none"
        >
          {SPEEDS.map(s => <option key={s} value={s}>{s}×</option>)}
        </select>
      </div>

      <p className="text-xs font-bold text-gray-500">
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
