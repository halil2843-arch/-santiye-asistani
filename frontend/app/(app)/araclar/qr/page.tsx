'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import Link from 'next/link';

declare global {
  interface Window {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    jsQR?: (data: Uint8ClampedArray, width: number, height: number) => { data: string } | null;
  }
}

interface TarananKayit {
  icerik: string;
  tarih: string;
}

const MAX_KAYIT = 10;
const STORAGE_KEY = 'qr_tarananlar';

function kayitlariYukle(): TarananKayit[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]') as TarananKayit[];
  } catch {
    return [];
  }
}

function kayitlariKaydet(kayitlar: TarananKayit[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(kayitlar.slice(0, MAX_KAYIT)));
}

type Mod = 'kamera' | 'dosya';

export default function QROkuyucu() {
  const [mod, setMod] = useState<Mod>('kamera');
  const [sonuc, setSonuc] = useState<string | null>(null);
  const [hata, setHata] = useState<string | null>(null);
  const [kameraAktif, setKameraAktif] = useState(false);
  const [jsqrYuklendi, setJsqrYuklendi] = useState(false);
  const [kopyalandi, setKopyalandi] = useState(false);
  const [gecmis, setGecmis] = useState<TarananKayit[]>([]);
  const [gecmisAcik, setGecmisAcik] = useState(false);
  const [httpsUyari, setHttpsUyari] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animRef = useRef<number | null>(null);

  // HTTPS kontrolü
  useEffect(() => {
    if (typeof window !== 'undefined' && !window.isSecureContext) {
      setHttpsUyari(true);
    }
  }, []);

  // Geçmiş kayıtları yükle
  useEffect(() => {
    setGecmis(kayitlariYukle());
  }, []);

  // jsQR CDN yükle
  useEffect(() => {
    if (typeof window !== 'undefined' && window.jsQR) {
      setJsqrYuklendi(true);
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.min.js';
    script.onload = () => setJsqrYuklendi(true);
    script.onerror = () => setHata('QR kütüphanesi yüklenemedi. İnternet bağlantınızı kontrol edin.');
    document.head.appendChild(script);
    return () => {
      if (document.head.contains(script)) {
        document.head.removeChild(script);
      }
    };
  }, []);

  const sonucKaydet = useCallback((icerik: string) => {
    const yeniKayit: TarananKayit = {
      icerik,
      tarih: new Date().toISOString(),
    };
    const guncellenmis = [yeniKayit, ...kayitlariYukle().filter((k) => k.icerik !== icerik)];
    kayitlariKaydet(guncellenmis);
    setGecmis(guncellenmis.slice(0, MAX_KAYIT));
  }, []);

  const taramaKapat = useCallback(() => {
    if (animRef.current) cancelAnimationFrame(animRef.current);
    animRef.current = null;
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setKameraAktif(false);
  }, []);

  const tarama = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || !window.jsQR) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const loop = () => {
      if (video.readyState === video.HAVE_ENOUGH_DATA) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const code = window.jsQR!(imageData.data, imageData.width, imageData.height);
        if (code) {
          setSonuc(code.data);
          sonucKaydet(code.data);
          taramaKapat();
          return;
        }
      }
      animRef.current = requestAnimationFrame(loop);
    };
    animRef.current = requestAnimationFrame(loop);
  }, [taramaKapat, sonucKaydet]);

  const kameraBaslat = async () => {
    setHata(null);
    setSonuc(null);
    if (httpsUyari) {
      setHata('Kamera erişimi için HTTPS gereklidir. Güvenli bir bağlantı kullanın.');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
      setKameraAktif(true);
      setTimeout(tarama, 500);
    } catch {
      setHata('Kameraya erişilemedi. Tarayıcı izinlerini kontrol edin.');
    }
  };

  useEffect(() => {
    return () => taramaKapat();
  }, [taramaKapat]);

  const dosyaOku = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setHata(null);
    setSonuc(null);

    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.drawImage(img, 0, 0);
      const imageData = ctx.getImageData(0, 0, img.width, img.height);
      if (window.jsQR) {
        const code = window.jsQR(imageData.data, imageData.width, imageData.height);
        if (code) {
          setSonuc(code.data);
          sonucKaydet(code.data);
        } else {
          setHata('QR kod bulunamadı. Farklı bir görsel deneyin.');
        }
      } else {
        setHata('QR kütüphanesi henüz yüklenmedi, bekleyin.');
      }
      URL.revokeObjectURL(url);
    };
    img.onerror = () => {
      setHata('Görsel okunamadı.');
      URL.revokeObjectURL(url);
    };
    img.src = url;
  };

  const kopyala = async () => {
    if (!sonuc) return;
    try {
      await navigator.clipboard.writeText(sonuc);
      setKopyalandi(true);
      setTimeout(() => setKopyalandi(false), 1500);
    } catch {
      // ignore
    }
  };

  const gecmisSec = (icerik: string) => {
    setSonuc(icerik);
    setGecmisAcik(false);
  };

  const gecmisSil = () => {
    localStorage.removeItem(STORAGE_KEY);
    setGecmis([]);
  };

  return (
    <div className="min-h-screen bg-[#0E1117] px-4 py-5 pb-24">
      <Link
        href="/araclar"
        className="inline-flex items-center gap-1.5 text-[#94A3B8] text-sm mb-5 hover:text-white transition-colors"
      >
        ← Araçlar
      </Link>

      <h1 className="font-[var(--font-syne)] text-2xl font-black text-white mb-6">
        QR Okuyucu
      </h1>

      {/* HTTPS Uyarısı */}
      {httpsUyari && (
        <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-3 mb-4">
          <p className="text-yellow-400 text-sm">
            ⚠️ Kamera erişimi HTTPS bağlantısı gerektirir. Dosya yükleme modu kullanılabilir.
          </p>
        </div>
      )}

      {/* Mod seçici */}
      <div className="bg-[#1E2636] rounded-2xl border border-white/[0.07] p-1 flex gap-1 mb-4">
        <button
          onClick={() => { setMod('kamera'); taramaKapat(); setSonuc(null); setHata(null); }}
          className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all ${
            mod === 'kamera' ? 'bg-amber-500 text-black' : 'text-[#94A3B8] hover:text-white'
          }`}
        >
          📷 Kamera ile Tara
        </button>
        <button
          onClick={() => { setMod('dosya'); taramaKapat(); setSonuc(null); setHata(null); }}
          className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all ${
            mod === 'dosya' ? 'bg-amber-500 text-black' : 'text-[#94A3B8] hover:text-white'
          }`}
        >
          🖼️ Görsel Yükle
        </button>
      </div>

      {/* jsQR Yükleniyor */}
      {!jsqrYuklendi && !hata && (
        <div className="bg-[#1E2636] rounded-xl p-3 border border-white/[0.07] mb-4">
          <p className="text-[#94A3B8] text-sm text-center animate-pulse">QR kütüphanesi yükleniyor...</p>
        </div>
      )}

      {/* Kamera Modu */}
      {mod === 'kamera' && (
        <div className="space-y-4">
          <div
            className="relative bg-[#1E2636] rounded-2xl border border-white/[0.07] overflow-hidden"
            style={{ aspectRatio: '4/3' }}
          >
            <video
              ref={videoRef}
              className="w-full h-full object-cover"
              playsInline
              muted
            />
            {!kameraAktif && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
                <span className="text-4xl">📷</span>
                <p className="text-[#4A5568] text-sm">Kamera kapalı</p>
              </div>
            )}
            {kameraAktif && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                {/* QR çerçeve */}
                <div className="w-52 h-52 relative">
                  <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-amber-500 rounded-tl-lg" />
                  <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-amber-500 rounded-tr-lg" />
                  <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-amber-500 rounded-bl-lg" />
                  <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-amber-500 rounded-br-lg" />
                  {/* Tarama çizgisi animasyonu */}
                  <div className="absolute left-2 right-2 h-0.5 bg-amber-500/60 animate-bounce top-1/2" />
                </div>
              </div>
            )}
          </div>
          <canvas ref={canvasRef} className="hidden" />

          {!kameraAktif ? (
            <button
              onClick={kameraBaslat}
              disabled={!jsqrYuklendi}
              className="w-full bg-amber-500 text-black rounded-xl px-6 py-3.5 font-semibold text-sm disabled:opacity-60 disabled:cursor-not-allowed transition-all active:scale-[0.98] hover:bg-amber-400"
            >
              Kamerayı Başlat
            </button>
          ) : (
            <button
              onClick={taramaKapat}
              className="w-full bg-[#252F42] text-[#94A3B8] border border-white/[0.07] rounded-xl px-6 py-3.5 font-semibold text-sm transition-all hover:bg-[#2A3447]"
            >
              Kamerayı Kapat
            </button>
          )}
        </div>
      )}

      {/* Dosya Modu */}
      {mod === 'dosya' && (
        <div className="space-y-4">
          <canvas ref={canvasRef} className="hidden" />
          <label className="block bg-[#1E2636] rounded-2xl border border-dashed border-white/20 p-10 text-center cursor-pointer hover:border-amber-500/50 transition-colors">
            <p className="text-4xl mb-3">📷</p>
            <p className="text-white text-sm font-semibold mb-1">QR Görselini Seçin</p>
            <p className="text-[#64748B] text-xs">Galeriden seçin veya kamera ile çekin</p>
            <input
              type="file"
              accept="image/*"
              capture="environment"
              onChange={dosyaOku}
              className="hidden"
            />
          </label>
        </div>
      )}

      {/* Hata banner */}
      {hata && (
        <div className="mt-4 bg-red-500/10 border border-red-500/30 rounded-xl p-3">
          <p className="text-red-400 text-sm">{hata}</p>
        </div>
      )}

      {/* Sonuç */}
      {sonuc && (
        <div className="mt-4 bg-[#1E2636] rounded-xl p-4 border border-amber-500/40">
          <div className="flex justify-between items-center mb-2">
            <p className="text-[#94A3B8] text-xs font-semibold uppercase tracking-wide">QR İçeriği</p>
            <button
              onClick={kopyala}
              className={`text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors ${
                kopyalandi
                  ? 'bg-green-500/20 text-green-400'
                  : 'bg-amber-500/20 text-amber-400 hover:bg-amber-500/30'
              }`}
            >
              {kopyalandi ? '✓ Kopyalandı' : 'Kopyala'}
            </button>
          </div>
          <p className="text-white text-sm break-all leading-relaxed">{sonuc}</p>
          {(sonuc.startsWith('http://') || sonuc.startsWith('https://')) && (
            <a
              href={sonuc}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 inline-flex items-center gap-1 text-amber-400 text-xs hover:underline"
            >
              Bağlantıyı Aç →
            </a>
          )}
          <button
            onClick={() => { setSonuc(null); }}
            className="mt-2 ml-2 text-xs text-[#94A3B8] hover:text-white transition-colors"
          >
            Temizle
          </button>
        </div>
      )}

      {/* Son Taranan Kayıtlar */}
      {gecmis.length > 0 && (
        <div className="mt-5">
          <button
            onClick={() => setGecmisAcik(!gecmisAcik)}
            className="w-full flex items-center justify-between bg-[#1E2636] rounded-xl p-4 border border-white/[0.07]"
          >
            <span className="text-[#F1F5F9] text-sm font-semibold">
              Son Tarananlar ({gecmis.length})
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={(e) => { e.stopPropagation(); gecmisSil(); }}
                className="text-[10px] text-red-400/70 hover:text-red-400 transition-colors px-2 py-0.5 rounded"
              >
                Temizle
              </button>
              <svg
                className={`w-4 h-4 text-[#94A3B8] transition-transform ${gecmisAcik ? 'rotate-180' : ''}`}
                fill="none" stroke="currentColor" viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </button>

          {gecmisAcik && (
            <div className="mt-2 space-y-2">
              {gecmis.map((kayit, i) => (
                <button
                  key={i}
                  onClick={() => gecmisSec(kayit.icerik)}
                  className="w-full bg-[#161B26] rounded-xl px-4 py-3 border border-white/[0.05] text-left hover:border-amber-500/30 transition-colors"
                >
                  <p className="text-[#F1F5F9] text-xs font-mono truncate">{kayit.icerik}</p>
                  <p className="text-[#4A5568] text-[10px] mt-0.5">
                    {new Date(kayit.tarih).toLocaleString('tr-TR')}
                  </p>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
