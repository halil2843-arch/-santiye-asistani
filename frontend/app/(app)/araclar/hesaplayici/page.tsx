'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';

interface GecmisItem {
  ifade: string;
  sonuc: string;
}

const TUSLAR = [
  ['C', '←', '%', '÷'],
  ['7', '8', '9', '×'],
  ['4', '5', '6', '-'],
  ['1', '2', '3', '+'],
  ['±', '0', '.', '='],
];

// Bilimsel tuşlar: [label, işlev_kodu]
const BILIMSEL_TUSLAR: [string, string][] = [
  ['sin', 'sin'],
  ['cos', 'cos'],
  ['tan', 'tan'],
  ['√', 'sqrt'],
  ['x²', 'sq'],
  ['xʸ', 'pow'],
  ['π', 'pi'],
  ['e', 'euler'],
  ['log', 'log'],
  ['ln', 'ln'],
  ['1/x', 'inv'],
  ['|x|', 'abs'],
];

export default function Hesaplayici() {
  const [ekran, setEkran] = useState('0');
  const [oncekiDeger, setOncekiDeger] = useState<string | null>(null);
  const [islem, setIslem] = useState<string | null>(null);
  const [yeniGiris, setYeniGiris] = useState(true);
  const [gecmis, setGecmis] = useState<GecmisItem[]>([]);

  // Geçmiş localStorage'dan yükle
  useEffect(() => {
    try {
      const saved = localStorage.getItem('hesap_gecmis');
      if (saved) setGecmis(JSON.parse(saved) as GecmisItem[]);
    } catch {
      // Bozuk veri — yoksay
    }
  }, []);

  // Geçmiş güncelleme yardımcısı
  const gecmisGuncelle = useCallback((yeni: GecmisItem[]) => {
    setGecmis(yeni);
    try {
      localStorage.setItem('hesap_gecmis', JSON.stringify(yeni.slice(0, 20)));
    } catch {
      // sessiz
    }
  }, []);
  const [ifade, setIfade] = useState('');
  const [bilimsel, setBilimsel] = useState(false);
  const [powBekliyor, setPowBekliyor] = useState(false);

  const hesapla = useCallback((a: string, op: string, b: string): string => {
    const x = parseFloat(a);
    const y = parseFloat(b);
    switch (op) {
      case '+': return String(x + y);
      case '-': return String(x - y);
      case '×': return String(x * y);
      case '÷': return y === 0 ? 'Hata' : String(x / y);
      case 'pow': return String(Math.pow(x, y));
      default: return b;
    }
  }, []);

  const formatEkran = (val: string): string => {
    if (val === 'Hata') return 'Hata';
    const n = parseFloat(val);
    if (isNaN(n)) return '0';
    if (Math.abs(n) >= 1e12 || (Math.abs(n) < 1e-7 && n !== 0)) {
      return n.toExponential(4);
    }
    const str = n.toString();
    if (str.length > 12) return parseFloat(n.toPrecision(10)).toString();
    return str;
  };

  const bilimselTusBasildi = useCallback((kod: string) => {
    const n = parseFloat(ekran);
    if (isNaN(n)) return;
    let sonuc: number | null = null;
    let ifadeStr = '';

    switch (kod) {
      case 'sin':
        sonuc = Math.sin((n * Math.PI) / 180);
        ifadeStr = `sin(${n}°)`;
        break;
      case 'cos':
        sonuc = Math.cos((n * Math.PI) / 180);
        ifadeStr = `cos(${n}°)`;
        break;
      case 'tan':
        sonuc = Math.tan((n * Math.PI) / 180);
        ifadeStr = `tan(${n}°)`;
        break;
      case 'sqrt':
        sonuc = n >= 0 ? Math.sqrt(n) : NaN;
        ifadeStr = `√(${n})`;
        break;
      case 'sq':
        sonuc = n * n;
        ifadeStr = `(${n})²`;
        break;
      case 'pow':
        // xʸ: bekle — bir sonraki sayıyı üs olarak kullan
        setOncekiDeger(ekran);
        setIslem('pow');
        setYeniGiris(true);
        setIfade(`${ekran} ^`);
        setPowBekliyor(true);
        return;
      case 'pi':
        setEkran(String(Math.PI));
        setYeniGiris(false);
        return;
      case 'euler':
        setEkran(String(Math.E));
        setYeniGiris(false);
        return;
      case 'log':
        sonuc = n > 0 ? Math.log10(n) : NaN;
        ifadeStr = `log(${n})`;
        break;
      case 'ln':
        sonuc = n > 0 ? Math.log(n) : NaN;
        ifadeStr = `ln(${n})`;
        break;
      case 'inv':
        sonuc = n !== 0 ? 1 / n : NaN;
        ifadeStr = `1/(${n})`;
        break;
      case 'abs':
        sonuc = Math.abs(n);
        ifadeStr = `|${n}|`;
        break;
      default:
        return;
    }

    if (sonuc === null) return;
    const sonucStr = isNaN(sonuc) ? 'Hata' : String(sonuc);
    gecmisGuncelle([
      { ifade: ifadeStr, sonuc: isNaN(sonuc!) ? 'Hata' : String(parseFloat(sonuc!.toPrecision(10))) },
      ...gecmis.slice(0, 19),
    ]);
    setEkran(sonucStr);
    setOncekiDeger(null);
    setIslem(null);
    setYeniGiris(true);
    setIfade('');
    setPowBekliyor(false);
  }, [ekran, gecmis, gecmisGuncelle]);

  const tusBasildi = useCallback((tus: string) => {
    if (ekran === 'Hata' && tus !== 'C') {
      if (/[0-9.]/.test(tus)) {
        setEkran(tus);
        setYeniGiris(false);
      }
      return;
    }

    if (tus === 'C') {
      setEkran('0');
      setOncekiDeger(null);
      setIslem(null);
      setYeniGiris(true);
      setIfade('');
      return;
    }

    if (tus === '←') {
      if (yeniGiris) return;
      if (ekran.length <= 1) {
        setEkran('0');
        setYeniGiris(true);
      } else {
        setEkran(ekran.slice(0, -1));
      }
      return;
    }

    if (tus === '±') {
      const n = parseFloat(ekran);
      if (!isNaN(n)) setEkran(String(-n));
      return;
    }

    if (tus === '%') {
      const n = parseFloat(ekran);
      if (!isNaN(n)) setEkran(String(n / 100));
      return;
    }

    if (['+', '-', '×', '÷'].includes(tus)) {
      const current = ekran;
      if (oncekiDeger !== null && !yeniGiris) {
        const sonuc = hesapla(oncekiDeger, islem!, current);
        setEkran(sonuc);
        setOncekiDeger(sonuc);
        setIfade(formatEkran(sonuc) + ' ' + tus);
      } else {
        setOncekiDeger(current);
        setIfade(formatEkran(current) + ' ' + tus);
      }
      setIslem(tus);
      setYeniGiris(true);
      return;
    }

    if (tus === '=') {
      if (oncekiDeger !== null && islem !== null) {
        const b = yeniGiris ? oncekiDeger : ekran;
        const sonuc = hesapla(oncekiDeger, islem, b);
        const ifadeStr = `${formatEkran(oncekiDeger)} ${islem} ${formatEkran(b)}`;
        gecmisGuncelle([
          { ifade: ifadeStr, sonuc: formatEkran(sonuc) },
          ...gecmis.slice(0, 19),
        ]);
        setEkran(sonuc);
        setOncekiDeger(null);
        setIslem(null);
        setYeniGiris(true);
        setIfade('');
      }
      return;
    }

    // Rakam veya nokta
    if (tus === '.' && ekran.includes('.') && !yeniGiris) return;
    if (yeniGiris) {
      setEkran(tus === '.' ? '0.' : tus);
      setYeniGiris(false);
    } else {
      if (ekran === '0' && tus !== '.') {
        setEkran(tus);
      } else {
        if (ekran.replace('-', '').replace('.', '').length >= 12) return;
        setEkran(ekran + tus);
      }
    }
  }, [ekran, oncekiDeger, islem, yeniGiris, hesapla, gecmis, gecmisGuncelle]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const k = e.key;
      if (k >= '0' && k <= '9') { tusBasildi(k); return; }
      if (k === '.') { tusBasildi('.'); return; }
      if (k === '+') { tusBasildi('+'); return; }
      if (k === '-') { tusBasildi('-'); return; }
      if (k === '*') { tusBasildi('×'); return; }
      if (k === '/') { e.preventDefault(); tusBasildi('÷'); return; }
      if (k === 'Enter' || k === '=') { tusBasildi('='); return; }
      if (k === 'Escape') { tusBasildi('C'); return; }
      if (k === 'Backspace') { tusBasildi('←'); return; }
      if (k === '%') { tusBasildi('%'); return; }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [tusBasildi]);

  const getTusStyle = (tus: string): string => {
    const base = 'flex items-center justify-center rounded-2xl text-lg font-bold h-14 active:scale-95 transition-all select-none cursor-pointer';
    if (tus === '=') return `${base} bg-amber-500 text-black`;
    if (['+', '-', '×', '÷'].includes(tus)) return `${base} bg-amber-500/20 text-amber-500`;
    if (['C', '←', '%', '±'].includes(tus)) return `${base} bg-[#252F42] text-[#94A3B8]`;
    return `${base} bg-[#1E2636] text-white border border-white/[0.05]`;
  };

  return (
    <div className="min-h-screen bg-[#0E1117] px-4 py-5">
      <Link
        href="/araclar"
        className="inline-flex items-center gap-1.5 text-[#94A3B8] text-sm mb-5 hover:text-white transition-colors"
      >
        ← Araçlar
      </Link>

      <div className="flex items-center justify-between mb-4">
        <h1 className="font-[var(--font-syne)] text-2xl font-black text-white">
          Hesaplayıcı
        </h1>
        <button
          onClick={() => setBilimsel((v) => !v)}
          className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
            bilimsel
              ? 'bg-amber-500 text-black border-amber-500'
              : 'bg-transparent text-[#94A3B8] border-white/10 hover:border-amber-500/40 hover:text-amber-400'
          }`}
        >
          {bilimsel ? '⚗️ Bilimsel' : '⚗️ Bilimsel'}
        </button>
      </div>

      {/* Ekran */}
      <div className="bg-[#1E2636] rounded-2xl border border-white/[0.07] p-4 mb-3">
        <p className="text-[#64748B] text-sm text-right h-5 mb-1 truncate">{ifade || ' '}</p>
        <p
          className="text-white font-bold text-right leading-none"
          style={{ fontSize: formatEkran(ekran).length > 10 ? '1.5rem' : '2.5rem' }}
        >
          {formatEkran(ekran)}
        </p>
      </div>

      {/* Bilimsel Tuşlar (animasyonlu) */}
      <div
        className="overflow-hidden transition-all duration-300"
        style={{ maxHeight: bilimsel ? '200px' : '0px', opacity: bilimsel ? 1 : 0 }}
      >
        <div className="grid grid-cols-4 gap-2 mb-2">
          {BILIMSEL_TUSLAR.map(([label, kod]) => (
            <button
              key={kod}
              onClick={() => bilimselTusBasildi(kod)}
              className={`flex items-center justify-center rounded-xl text-sm font-semibold h-10 active:scale-95 transition-all select-none cursor-pointer ${
                powBekliyor && kod === 'pow'
                  ? 'bg-amber-500 text-black'
                  : 'bg-[#252F42] text-[#94A3B8] hover:text-white border border-white/[0.05]'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Tuşlar */}
      <div className="grid grid-cols-4 gap-2 mb-4">
        {TUSLAR.flat().map((tus, i) => (
          <button
            key={i}
            onClick={() => tusBasildi(tus)}
            className={getTusStyle(tus)}
          >
            {tus}
          </button>
        ))}
      </div>

      {/* Geçmiş */}
      {gecmis.length > 0 && (
        <div className="bg-[#1E2636] rounded-2xl border border-white/[0.07] p-4">
          <p className="text-[#94A3B8] text-xs font-semibold mb-3">Son İşlemler</p>
          <div className="space-y-2">
            {gecmis.map((g, i) => (
              <div key={i} className="flex justify-between items-center gap-2">
                <span className="text-[#64748B] text-sm truncate">{g.ifade}</span>
                <span className="text-white text-sm font-semibold shrink-0">= {g.sonuc}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
