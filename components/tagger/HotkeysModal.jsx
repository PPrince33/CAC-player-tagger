'use client';
import { X } from 'lucide-react';

const HOTKEYS = [
  { key: 'Space',      desc: 'Play / Pause video' },
  { key: '← / →',     desc: '±5 seconds' },
  { key: 'Shift+←/→', desc: '±1 second' },
  { key: '↑ / ↓',     desc: '±30 seconds' },
  { key: 'Enter',      desc: 'Log current event' },
  { key: 'Ctrl+Z',     desc: 'Undo last event' },
  { key: 'N',          desc: 'Focus Notes field' },
  { key: 'Tab',        desc: 'Cycle Outcome options' },
];

export default function HotkeysModal({ onClose }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="w-80 border-2 border-black bg-[#F9FAFB] p-5 shadow-brutal">
        <div className="mb-4 flex items-center justify-between border-b-2 border-black pb-2">
          <h2 className="text-sm font-bold uppercase tracking-wide text-black">Keyboard Shortcuts</h2>
          <button onClick={onClose} className="border-2 border-black p-1 hover:bg-black hover:text-white transition-none">
            <X size={14} />
          </button>
        </div>
        <table className="w-full text-xs">
          <tbody>
            {HOTKEYS.map(({ key, desc }) => (
              <tr key={key} className="border-b border-black last:border-0">
                <td className="py-1.5 pr-4">
                  <kbd className="border-2 border-black bg-[#FACC15] px-1.5 py-0.5 font-bold text-black">{key}</kbd>
                </td>
                <td className="py-1.5 font-mono text-black">{desc}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
