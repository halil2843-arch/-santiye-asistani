'use client';

import { useState, useRef, useCallback } from 'react';
import Link from 'next/link';

type AracTip = 'kalem' | 'metin' | 'ok' | 'sil';

const RENKLER = ['#F59E0B', '#EF4444', '#22C55E', '#3B82F6', '#FFFFFF', '#000000'];
const BOYUTLAR = [2, 4, 8];

export default function FotografNot() {
  const [arac, setArac] = useState<AracTip>('kalem');
  const [renk, setRenk] = useState('#F59E0B');
  const [boyut, setBoyut] = useState(4);
  const [resimYuklendi, setResimYuklendi] = useState(false);
  const [metinInput, setMetinInput] = useState('');
  const [metinPos, setMetinPos] = useState<{ x: number; y: number } | null>(null);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const resimRef = useRef<HTMLImageElement | null>(null);
  const ciziyorRef = useRef(false);
  const sonPozRef = useRef<{ x: number; y: number } | null>(null);
  const okBaslangicRef = useRef<{ x: number; y: number } | null>(null);
  const anlikCanvasRef = useRef<ImageData | null>(null);

  const getPos = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    if ('touches' in e) {
      const t = e.touches.item(0);
      if (!t) return { x: 0, y: 0 };
      return { x: (t.clientX - rect.left) * scaleX, y: (t.clientY - rect.top) * scaleY };
    }
    return { x: (e.clientX - rect.left) * scaleX, y: (e.clientY - rect.top) * scaleY };
  };

  const resimYukle = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      resimRef.current = img;
      const canvas = canvasRef.current;
      if (!canvas) return;
      const maxW = canvas.parentElement?.clientWidth ?? 400;
      const ratio = img.height / img.width;
      canvas.width = Math.min(img.width, maxW * 2);
      canvas.height = canvas.width * ratio;
      const ctx = canvas.getContext('2d');
      if (ctx) ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      setResimYuklendi(true);
      URL.revokeObjectURL(url);
    };
    img.src = url;
  };

  const cizimBasla = useCallback((e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    if (!resimYuklendi) return;
    const pos = getPos(e);
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!ctx || !canvas) return;

    if (arac === 'metin') {
      setMetinPos(pos);
      return;
    }

    ciziyorRef.current = true;
    sonPozRef.current = pos;

    if (arac === 'ok') {
      okBaslangicRef.current = pos;
      anlikCanvasRef.current = ctx.getImageData(0, 0, canvas.width, canvas.height);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [arac, resimYuklendi, renk, boyut]);

  const cizimDevam = useCallback((e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    if (!ciziyorRef.current || !resimYuklendi) return;
    const pos = getPos(e);
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!ctx || !canvas) return;

    if (arac === 'kalem') {
      ctx.beginPath();
      ctx.strokeStyle = renk;
      ctx.lineWidth = boyut;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.moveTo(sonPozRef.current!.x, sonPozRef.current!.y);
      ctx.lineTo(pos.x, pos.y);
      ctx.stroke();
      sonPozRef.current = pos;
    } else if (arac === 'sil') {
      ctx.beginPath();
      ctx.strokeStyle = 'rgba(0,0,0,0)';
      ctx.lineWidth = boyut * 6;
      ctx.lineCap = 'round';
      if (resimRef.current) {
        ctx.save();
        ctx.globalCompositeOperation = 'destination-out';
        ctx.lineWidth = boyut * 6;
        ctx.moveTo(sonPozRef.current!.x, sonPozRef.current!.y);
        ctx.lineTo(pos.x, pos.y);
        ctx.stroke();
        ctx.restore();
        // Silinen bölgeyi resimle doldur
        const img = resimRef.current;
        ctx.save();
        ctx.globalCompositeOperation = 'destination-over';
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        ctx.restore();
      }
      sonPozRef.current = pos;
    } else if (arac === 'ok' && okBaslangicRef.current && anlikCanvasRef.current) {
      // Önce snapshot'a geri dön
      ctx.putImageData(anlikCanvasRef.current, 0, 0);
      const from = okBaslangicRef.current;
      const headlen = 15;
      const angle = Math.atan2(pos.y - from.y, pos.x - from.x);
      ctx.beginPath();
      ctx.strokeStyle = renk;
      ctx.lineWidth = boyut;
      ctx.lineCap = 'round';
      ctx.moveTo(from.x, from.y);
      ctx.lineTo(pos.x, pos.y);
      ctx.lineTo(pos.x - headlen * Math.cos(angle - Math.PI / 6), pos.y - headlen * Math.sin(angle - Math.PI / 6));
      ctx.moveTo(pos.x, pos.y);
      ctx.lineTo(pos.x - headlen * Math.cos(angle + Math.PI / 6), pos.y - headlen * Math.sin(angle + Math.PI / 6));
      ctx.stroke();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [arac, renk, boyut, resimYuklendi]);

  const cizimBit = useCallback(() => {
    ciziyorRef.current = false;
    sonPozRef.current = null;
    okBaslangicRef.current = null;
    anlikCanvasRef.current = null;
  }, []);

  // Metin ekle
  const metinEkle = () => {
    if (!metinInput.trim() || !metinPos) return;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!ctx) return;
    ctx.font = `bold ${boyut * 6 + 12}px Arial`;
    ctx.fillStyle = renk;
    ctx.strokeStyle = '#000';
    ctx.lineWidth = boyut * 0.5;
    ctx.strokeText(metinInput, metinPos.x, metinPos.y);
    ctx.fillText(metinInput, metinPos.x, metinPos.y);
    setMetinInput('');
    setMetinPos(null);
  };

  const kaydet = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `santiye-not-${Date.now()}.png`;
      a.click();
      URL.revokeObjectURL(url);
    }, 'image/png');
  };

  const araclар: { id: AracTip; label: string; icon: string }[] = [
    { id: 'kalem', label: 'Kalem', icon: '✏️' },
    { id: 'metin', label: 'Metin', icon: 'T' },
    { id: 'ok', label: 'Ok', icon: '→' },
    { id: 'sil', label: 'Sil', icon: '⌫' },
  ];

  return (
    <div className="min-h-screen bg-[#0E1117] px-4 py-5">
      <Link
        href="/araclar"
        className="inline-flex items-center gap-1.5 text-[#94A3B8] text-sm mb-5 hover:text-white transition-colors"
      >
        ← Araçlar
      </Link>

      <h1 className="font-[var(--font-syne)] text-2xl font-black text-white mb-4">
        Fotoğraf Notları
      </h1>

      {!resimYuklendi ? (
        <label className="block bg-[#1E2636] rounded-2xl border border-dashed border-white/20 p-10 text-center cursor-pointer hover:border-amber-500/50 transition-colors">
          <p className="text-4xl mb-3">📷</p>
          <p className="text-white text-sm font-semibold mb-1">Fotoğraf Seçin veya Çekin</p>
          <p className="text-[#64748B] text-xs">Üzerine not ekleyebileceksiniz</p>
          <input
            type="file"
            accept="image/*"
            capture="environment"
            onChange={resimYukle}
            className="hidden"
          />
        </label>
      ) : (
        <>
          {/* Araç çubuğu */}
          <div className="bg-[#1E2636] rounded-2xl border border-white/[0.07] p-3 mb-3 space-y-3">
            {/* Araçlar */}
            <div className="flex gap-2">
              {araclар.map(({ id, label, icon }) => (
                <button
                  key={id}
                  onClick={() => setArac(id)}
                  className={`flex-1 py-2 rounded-xl text-sm font-semibold transition-all flex flex-col items-center gap-0.5 ${
                    arac === id ? 'bg-amber-500 text-black' : 'bg-[#252F42] text-[#94A3B8]'
                  }`}
                >
                  <span>{icon}</span>
                  <span className="text-[0.65rem]">{label}</span>
                </button>
              ))}
            </div>

            {/* Renkler */}
            <div className="flex items-center gap-2">
              <span className="text-[#64748B] text-xs">Renk:</span>
              {RENKLER.map((r) => (
                <button
                  key={r}
                  onClick={() => setRenk(r)}
                  className="w-7 h-7 rounded-full border-2 transition-all"
                  style={{
                    backgroundColor: r,
                    borderColor: renk === r ? '#F59E0B' : 'transparent',
                    transform: renk === r ? 'scale(1.25)' : 'scale(1)',
                  }}
                />
              ))}
            </div>

            {/* Boyut */}
            <div className="flex items-center gap-2">
              <span className="text-[#64748B] text-xs">Boyut:</span>
              {BOYUTLAR.map((b) => (
                <button
                  key={b}
                  onClick={() => setBoyut(b)}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                    boyut === b ? 'bg-amber-500 text-black' : 'bg-[#252F42] text-[#94A3B8]'
                  }`}
                >
                  {b === 2 ? 'İnce' : b === 4 ? 'Normal' : 'Kalın'}
                </button>
              ))}
            </div>
          </div>

          {/* Canvas */}
          <div className="bg-[#1E2636] rounded-2xl border border-white/[0.07] overflow-hidden mb-3">
            <canvas
              ref={canvasRef}
              className="w-full touch-none"
              style={{ cursor: arac === 'sil' ? 'cell' : arac === 'metin' ? 'text' : 'crosshair' }}
              onMouseDown={cizimBasla}
              onMouseMove={cizimDevam}
              onMouseUp={cizimBit}
              onMouseLeave={cizimBit}
              onTouchStart={cizimBasla}
              onTouchMove={cizimDevam}
              onTouchEnd={cizimBit}
            />
          </div>

          {/* Metin girişi */}
          {arac === 'metin' && metinPos && (
            <div className="bg-[#1E2636] rounded-xl border border-amber-500/40 p-3 mb-3 flex gap-2">
              <input
                autoFocus
                value={metinInput}
                onChange={(e) => setMetinInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && metinEkle()}
                placeholder="Metin yazın..."
                className="flex-1 bg-[#252F42] rounded-lg px-3 py-2 text-white text-sm border border-white/[0.07] focus:outline-none"
              />
              <button
                onClick={metinEkle}
                className="bg-amber-500 text-black px-3 py-2 rounded-lg text-sm font-semibold"
              >
                Ekle
              </button>
              <button
                onClick={() => setMetinPos(null)}
                className="bg-[#252F42] text-[#94A3B8] px-3 py-2 rounded-lg text-sm"
              >
                İptal
              </button>
            </div>
          )}

          {/* Kaydet / Yeni */}
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={kaydet}
              className="bg-amber-500 text-black rounded-xl px-6 py-3 font-semibold text-sm transition-all active:scale-[0.98]"
            >
              Kaydet & İndir
            </button>
            <label className="bg-[#252F42] text-[#94A3B8] border border-white/[0.07] rounded-xl px-6 py-3 font-semibold text-sm text-center cursor-pointer">
              Yeni Fotoğraf
              <input
                type="file"
                accept="image/*"
                capture="environment"
                onChange={resimYukle}
                className="hidden"
              />
            </label>
          </div>
        </>
      )}
    </div>
  );
}
