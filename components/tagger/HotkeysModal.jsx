'use client';
import { X } from 'lucide-react';

const HOTKEYS = [
  { key: 'Space',     desc: 'Play / Pause video' },
  { key: '← / →',    desc: '±5 seconds' },
  { key: 'Shift+←/→',desc: '±1 second' },
  { key: '↑ / ↓',    desc: '±30 seconds' },
  { key: 'Enter',     desc: 'Log current event' },
  { key: 'Ctrl+Z',    desc: 'Undo last event' },
  { key: 'N',         desc: 'Focus Notes field' },
  { key: 'Tab',       desc: 'Cycle Outcome options' },
];

export default function HotkeysModal({ onClose }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-80 rounded-xl border border-gray-700 bg-gray-900 p-5 shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-semibold text-white">Keyboard Shortcuts</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-white"><X size={16} /></button>
        </div>
        <table className="w-full text-xs">
          <tbody>
            {HOTKEYS.map(({ key, desc }) => (
              <tr key={key} className="border-b border-gray-800 last:border-0">
                <td className="py-1.5 pr-4">
                  <kbd className="rounded bg-gray-700 px-1.5 py-0.5 font-mono text-gray-200">{key}</kbd>
                </td>
                <td className="py-1.5 text-gray-400">{desc}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
