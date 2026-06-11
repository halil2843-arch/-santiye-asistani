'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import type { ProjeResponse, PuantajKaydi } from '@/types';

// ───────────────────────────────────────────────
// Tipler
// ───────────────────────────────────────────────

interface PersonelOzet {
  ad: string;
  meslek: string | null;
  toplamSaat: number;
  son7Gun: { tarih: string; saat: number }[];
}

// ───────────────────────────────────────────────
// Yardımcı
// ───────────────────────────────────────────────

function avatarHarf(ad: string): string {
  const parcalar = ad.trim().split(/\s+/);
  if (parcalar.length >= 2)
    return (parcalar[0][0] + parcalar[parcalar.length - 1][0]).toUpperCase();
  return (parcalar[0]?.[0] ?? '?').toUpperCase();
}

function son7GunTarihleri(): string[] {
  const tarihler: string[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    tarihler.push(d.toISOString().split('T')[0]);
  }
  return tarihler;
}

function puantajdanPersonelOzeti(kayitlar: PuantajKaydi[]): PersonelOzet[] {
  const gunler = son7GunTarihleri();
  const map = new Map<string, PersonelOzet>();

  for (const k of kayitlar) {
    const anahtar = k.personel_adi.trim();
    if (!map.has(anahtar)) {
      map.set(anahtar, {
        ad: k.personel_adi,
        meslek: k.meslek ?? null,
        toplamSaat: 0,
        son7Gun: gunler.map((t) => ({ tarih: t, saat: 0 })),
      });
    }
    const p = map.get(anahtar)!;
    p.toplamSaat += k.calisma_saati;
    const gunIdx = gunler.indexOf(k.tarih);
    if (gunIdx !== -1) {
      p.son7Gun[gunIdx].saat += k.calisma_saati;
    }
  }

  return Array.from(map.values()).sort((a, b) =>
    a.ad.localeCompare(b.ad, 'tr')
  );
}

// ───────────────────────────────────────────────
// Bar Grafik
// ───────────────────────────────────────────────

function BarGrafik({ veriler }: { veriler: { tarih: string; saat: number }[] }) {
  const maxSaat = Math.max(...veriler.map((v) => v.saat), 1);
  const gunKisaltma = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'];

  return (
    <div style={{ display: 'flex', gap: '3px', alignItems: 'flex-end', height: '32px' }}>
      {veriler.map((gun, i) => {
        const yuzde = (gun.saat / maxSaat) * 100;
        const tarihObj = new Date(gun.tarih + 'T00:00:00');
        const gunAdi = gunKisaltma[tarihObj.getDay() === 0 ? 6 : tarihObj.getDay() - 1];
        return (
          <div
            key={i}
            title={`${gunAdi}: ${gun.saat} saat`}
            style={{
              flex: 1,
              background: gun.saat > 0 ? '#F59E0B' : 'rgba(255,255,255,0.07)',
              height: `${Math.max(yuzde, gun.saat > 0 ? 15 : 8)}%`,
              minHeight: '2px',
              borderRadius: '2px 2px 0 0',
              transition: 'height 0.3s ease',
            }}
          />
        );
      })}
    </div>
  );
}

// ───────────────────────────────────────────────
// Skeleton
// ───────────────────────────────────────────────

function Skeleton() {
  return (
    <div className="flex flex-col gap-3">
      {Array.from({ length: 4 }).map((_, i) => (
        <div
          key={i}
          className="bg-[#1E2636] rounded-2xl h-28 animate-pulse border border-white/[0.07]"
        />
      ))}
    </div>
  );
}

// ───────────────────────────────────────────────
// Ana Sayfa
// ───────────────────────────────────────────────

export default function EkipPage() {
  const router = useRouter();

  const [projeler, setProjeler] = useState<ProjeResponse[]>([]);
  const [secilenProje, setSecilenProje] = useState<string>('');
  const [personeller, setPersoneller] = useState<PersonelOzet[]>([]);
  const [loading, setLoading] = useState(false);
  const [projelerLoading, setProjelerLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Projeleri yükle
  useEffect(() => {
    api
      .getProjeler()
      .then(setProjeler)
      .catch((e: unknown) =>
        setError(e instanceof Error ? e.message : 'Projeler yüklenemedi')
      )
      .finally(() => setProjelerLoading(false));
  }, []);

  // Proje seçilince puantaj verisi yükle
  useEffect(() => {
    if (!secilenProje) {
      setPersoneller([]);
      return;
    }
    setLoading(true);
    setError(null);
    api
      .getPuantaj(undefined, secilenProje)
      .then((kayitlar) => {
        setPersoneller(puantajdanPersonelOzeti(kayitlar));
      })
      .catch((e: unknown) =>
        setError(e instanceof Error ? e.message : 'Puantaj verisi yüklenemedi')
      )
      .finally(() => setLoading(false));
  }, [secilenProje]);

  // ── Özet istatistikler ────────────────────────
  const toplamPersonel = personeller.length;
  const toplamSaat = personeller.reduce((s, p) => s + p.toplamSaat, 0);
  const bugunTarihi = new Date().toISOString().split('T')[0];
  const bugunPersonel = new Set(
    personeller.filter((p) =>
      p.son7Gun.some((g) => g.tarih === bugunTarihi && g.saat > 0)
    ).map((p) => p.ad)
  ).size;

  return (
    <div className="min-h-screen bg-[#0E1117] px-4 py-5 pb-28">
      {/* Geri + Başlık */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.back()}
            className="w-9 h-9 flex items-center justify-center bg-[#1E2636] rounded-xl border border-white/[0.07] text-[#94A3B8] hover:text-[#F1F5F9] transition-colors"
            aria-label="Geri"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div>
            <h1 className="text-[#F1F5F9] text-xl font-bold">Ekip Yönetimi</h1>
            <p className="text-[#94A3B8] text-xs mt-0.5">Puantaj kaynaklı personel</p>
          </div>
        </div>
        <Link
          href="/yonetim/puantaj"
          className="flex items-center gap-1.5 bg-[#1E2636] border border-white/[0.07] text-[#F59E0B] text-xs font-semibold px-3 py-2 rounded-xl hover:bg-[#252F42] transition-colors"
        >
          Puantaja Git
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </Link>
      </div>

      {/* Hata banner */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3 mb-4 flex items-center justify-between">
          <p className="text-red-400 text-sm">{error}</p>
          <button onClick={() => setError(null)} className="text-red-400 hover:text-red-300 ml-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {/* Proje seçici */}
      <div className="mb-5">
        <label className="block text-[#94A3B8] text-xs mb-1.5 font-medium">
          Proje Seç
        </label>
        <select
          className="w-full bg-[#252F42] border border-white/[0.07] rounded-xl px-4 py-3 text-[#F1F5F9] text-sm focus:outline-none focus:border-[#F59E0B]/60"
          value={secilenProje}
          onChange={(e) => setSecilenProje(e.target.value)}
          disabled={projelerLoading}
        >
          <option value="">— Proje Seçin —</option>
          {projeler.map((p) => (
            <option key={p.id} value={p.id}>
              {p.isim}
            </option>
          ))}
        </select>
      </div>

      {/* İçerik */}
      {!secilenProje ? (
        <div className="bg-[#1E2636] rounded-2xl p-12 text-center border border-white/[0.07]">
          <div className="text-4xl mb-3">👷</div>
          <p className="text-[#94A3B8] text-sm">
            Personel verisi görmek için proje seçin
          </p>
        </div>
      ) : loading ? (
        <Skeleton />
      ) : personeller.length === 0 ? (
        <div className="bg-[#1E2636] rounded-2xl p-12 text-center border border-white/[0.07]">
          <div className="text-4xl mb-3">📋</div>
          <p className="text-[#94A3B8] text-sm mb-4">
            Bu projede henüz puantaj kaydı yok
          </p>
          <Link
            href="/yonetim/puantaj"
            className="inline-flex items-center gap-2 bg-[#F59E0B] text-black text-sm font-semibold px-5 py-2.5 rounded-xl hover:bg-[#D97706] transition-colors"
          >
            Puantaj Ekle
          </Link>
        </div>
      ) : (
        <>
          {/* Özet kartlar */}
          <div className="grid grid-cols-3 gap-3 mb-5">
            {[
              { label: 'Toplam Personel', value: toplamPersonel },
              { label: 'Toplam Saat', value: toplamSaat },
              { label: 'Bugün Sahada', value: bugunPersonel },
            ].map(({ label, value }) => (
              <div
                key={label}
                className="bg-[#1E2636] rounded-2xl p-3 border border-white/[0.07] text-center"
              >
                <p className="text-[#F59E0B] text-xl font-bold">{value}</p>
                <p className="text-[#94A3B8] text-[10px] mt-0.5 leading-tight">{label}</p>
              </div>
            ))}
          </div>

          {/* Son 7 gün etiketi */}
          <div className="flex items-center justify-between mb-3">
            <p className="text-[#94A3B8] text-xs font-medium uppercase tracking-wide">
              Personel Listesi
            </p>
            <p className="text-[#94A3B8] text-xs">{toplamPersonel} kişi</p>
          </div>

          {/* Personel kartları */}
          <div className="flex flex-col gap-3">
            {personeller.map((p) => (
              <div
                key={p.ad}
                className="bg-[#1E2636] rounded-2xl border border-white/[0.07] px-4 py-3"
              >
                <div className="flex items-center gap-3">
                  {/* Avatar */}
                  <div className="w-10 h-10 rounded-full bg-[#F59E0B] flex items-center justify-center text-black font-bold text-sm flex-shrink-0">
                    {avatarHarf(p.ad)}
                  </div>

                  {/* Bilgi */}
                  <div className="flex-1 min-w-0">
                    <p className="text-[#F1F5F9] text-sm font-semibold truncate">{p.ad}</p>
                    <p className="text-[#94A3B8] text-xs truncate">
                      {p.meslek ?? 'Meslek belirtilmemiş'}
                    </p>
                  </div>

                  {/* Toplam saat */}
                  <div className="text-right flex-shrink-0">
                    <p className="text-[#F59E0B] text-sm font-bold">{p.toplamSaat}</p>
                    <p className="text-[#94A3B8] text-[10px]">saat</p>
                  </div>
                </div>

                {/* Bar grafik */}
                <div className="mt-3 pt-3 border-t border-white/[0.07]">
                  <p className="text-[#94A3B8] text-[10px] mb-1.5">Son 7 gün</p>
                  <BarGrafik veriler={p.son7Gun} />
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
