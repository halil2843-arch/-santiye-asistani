'use client';

import { useState, type ReactNode } from 'react';
import Link from 'next/link';

interface BolumItem {
  baslik: string;
  etiket: string;
  icerik: ReactNode;
}

const bolumler: BolumItem[] = [
  {
    baslik: 'ISG Mevzuatı',
    etiket: 'Hukuki',
    icerik: (
      <div className="space-y-4">
        <div>
          <p className="text-amber-500 text-xs font-bold uppercase tracking-wider mb-2">
            İş Sağlığı ve Güvenliği Kanunu (6331)
          </p>
          <ul className="space-y-1.5">
            {[
              'İşveren, işyerinde iş sağlığı ve güvenliğini sağlamakla yükümlüdür.',
              '10 ve üzeri çalışanı olan işyerlerinde İSG uzmanı ve işyeri hekimi görevlendirilmesi zorunludur.',
              'Çok tehlikeli işyerlerinde İSG uzmanı: en az tam zamanlı 1 kişi/50 çalışan.',
              'Yıllık iş kazası/meslek hastalığı istatistikleri Bakanlık\'a bildirilir.',
            ].map((m, i) => (
              <li key={i} className="flex gap-2 items-start">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 mt-1.5 shrink-0" />
                <p className="text-[#94A3B8] text-sm">{m}</p>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <p className="text-amber-500 text-xs font-bold uppercase tracking-wider mb-2">
            Risk Değerlendirmesi
          </p>
          <ul className="space-y-1.5">
            {[
              'Tüm işyerlerinde risk değerlendirmesi yapmak zorunludur (md. 10).',
              'Şantiyelerde her iş değişikliğinde ve periyodik olarak (en az 2 yılda bir) güncellenir.',
              'Çok tehlikeli sınıfta: her yıl güncelleme zorunludur.',
            ].map((m, i) => (
              <li key={i} className="flex gap-2 items-start">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 mt-1.5 shrink-0" />
                <p className="text-[#94A3B8] text-sm">{m}</p>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <p className="text-amber-500 text-xs font-bold uppercase tracking-wider mb-2">
            KKD — Kişisel Koruyucu Donanım
          </p>
          <div className="grid grid-cols-2 gap-2">
            {[
              { ppe: 'Baret (EN 397)', renk: '#F59E0B' },
              { ppe: 'Emniyet kemeri (EN 361)', renk: '#EF4444' },
              { ppe: 'Reflektif yelek (EN 20471)', renk: '#F97316' },
              { ppe: 'Güvenlik ayakkabısı (EN ISO 20345)', renk: '#8B5CF6' },
              { ppe: 'Kulaklık/tıkaç (SNR ≥ 20 dB)', renk: '#3B82F6' },
              { ppe: 'Gözlük/yüz siperi (EN 166)', renk: '#22C55E' },
            ].map(({ ppe, renk }) => (
              <div key={ppe} className="bg-[#252F42] rounded-xl p-2.5 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: renk }} />
                <p className="text-[#94A3B8] text-xs">{ppe}</p>
              </div>
            ))}
          </div>
        </div>
        <div>
          <p className="text-amber-500 text-xs font-bold uppercase tracking-wider mb-2">
            Olay Bildirimi
          </p>
          <ul className="space-y-1.5">
            {[
              'İş kazasını işveren, SGK\'ya kazadan itibaren en geç 3 iş günü içinde e-bildirge ile bildirir.',
              'Ölümlü veya ağır iş kazasında aynı zamanda yetkili merciye (Bakanlık) ivediyle bildirim yapılır.',
              'Meslek hastalığı: sağlık hizmeti sunucusu 3 iş günü içinde SGK\'ya bildirir.',
            ].map((m, i) => (
              <li key={i} className="flex gap-2 items-start">
                <span className="w-1.5 h-1.5 rounded-full bg-red-500 mt-1.5 shrink-0" />
                <p className="text-[#94A3B8] text-sm">{m}</p>
              </li>
            ))}
          </ul>
        </div>
      </div>
    ),
  },
  {
    baslik: 'Beton Standartları (TS EN 206)',
    etiket: 'Teknik',
    icerik: (
      <div className="space-y-4">
        <div>
          <p className="text-amber-500 text-xs font-bold uppercase tracking-wider mb-2">
            Beton Dayanım Sınıfları
          </p>
          <div className="space-y-2">
            {[
              { sinif: 'C16/20', kullanum: 'Gözaltı betonu, temel altı dolgu', renk: '#6B7280' },
              { sinif: 'C20/25', kullanum: 'Basit konut temelleri, perde duvarlar', renk: '#64748B' },
              { sinif: 'C25/30', kullanum: 'Standart konut kolon/kiriş/döşeme', renk: '#3B82F6' },
              { sinif: 'C30/37', kullanum: 'Yüksek katlı yapılar, köprü ayakları', renk: '#8B5CF6' },
              { sinif: 'C35/45', kullanum: 'Ön gerilmeli elemanlar, köprü kirişleri', renk: '#EC4899' },
              { sinif: 'C40/50', kullanum: 'Özel taşıyıcı sistemler, ağır yükler', renk: '#EF4444' },
              { sinif: 'C50/60', kullanum: 'Çok yüksek mukavemet gerektiren yapılar', renk: '#DC2626' },
            ].map(({ sinif, kullanum, renk }) => (
              <div key={sinif} className="flex gap-3 items-center bg-[#252F42] rounded-xl px-3 py-2">
                <span
                  className="text-xs font-bold px-2 py-0.5 rounded-lg shrink-0"
                  style={{ backgroundColor: `${renk}22`, color: renk }}
                >
                  {sinif}
                </span>
                <p className="text-[#94A3B8] text-xs">{kullanum}</p>
              </div>
            ))}
          </div>
        </div>
        <div>
          <p className="text-amber-500 text-xs font-bold uppercase tracking-wider mb-2">
            Su/Çimento Oranı
          </p>
          <ul className="space-y-1.5">
            {[
              'Normal ortam: w/c oranı maksimum 0.60',
              'Agresif ortam (sülfatlı zemin, deniz): w/c maksimum 0.50',
              'Donma-çözülme etkisi varsa: hava sürükleyici katkı kullanılır (%3–5 hava)',
            ].map((m, i) => (
              <li key={i} className="flex gap-2 items-start">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-400 mt-1.5 shrink-0" />
                <p className="text-[#94A3B8] text-sm">{m}</p>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <p className="text-amber-500 text-xs font-bold uppercase tracking-wider mb-2">
            Kürleme Süreleri
          </p>
          <div className="grid grid-cols-2 gap-2">
            {[
              { durum: 'Normal çimento (CEM I)', sure: 'Min 7 gün' },
              { durum: 'Hızlandırılmış kürleme', sure: 'Min 3 gün' },
              { durum: 'Agresif ortam', sure: 'Min 28 gün' },
              { durum: 'Yavaş sertleşen çimento', sure: 'Min 14 gün' },
            ].map(({ durum, sure }) => (
              <div key={durum} className="bg-[#252F42] rounded-xl p-2.5">
                <p className="text-[#94A3B8] text-xs">{durum}</p>
                <p className="text-amber-500 text-sm font-bold mt-0.5">{sure}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    ),
  },
  {
    baslik: 'Çelik / Donatı (TS 708)',
    etiket: 'Teknik',
    icerik: (
      <div className="space-y-4">
        <div>
          <p className="text-amber-500 text-xs font-bold uppercase tracking-wider mb-2">
            Donatı Çeliği Sınıfları
          </p>
          <div className="space-y-2">
            {[
              { sinif: 'B420C', akma: '420 MPa', aciklama: 'Nervürlü, deprem bölgelerinde kullanım için uygun (C sınıfı)' },
              { sinif: 'B500C', akma: '500 MPa', aciklama: 'Yüksek mukavemetli nervürlü, yaygın tercih' },
            ].map(({ sinif, akma, aciklama }) => (
              <div key={sinif} className="bg-[#252F42] rounded-xl p-3">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-bold px-2 py-0.5 rounded bg-amber-500/20 text-amber-500">{sinif}</span>
                  <span className="text-white text-sm font-semibold">{akma}</span>
                </div>
                <p className="text-[#64748B] text-xs">{aciklama}</p>
              </div>
            ))}
          </div>
        </div>
        <div>
          <p className="text-amber-500 text-xs font-bold uppercase tracking-wider mb-2">
            Bindirme ve Kenetlenme Boyu
          </p>
          <ul className="space-y-1.5">
            {[
              'Genel bindirme boyu: 40 × çap (örn. Ø16 için 640 mm)',
              'Deprem bölgelerinde: 50 × çap kullanılması önerilir',
              'Kenetlenme boyu (çekme): 40–50 × çap',
            ].map((m, i) => (
              <li key={i} className="flex gap-2 items-start">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 mt-1.5 shrink-0" />
                <p className="text-[#94A3B8] text-sm">{m}</p>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <p className="text-amber-500 text-xs font-bold uppercase tracking-wider mb-2">
            Pas Payı (Minimum Beton Örtüsü)
          </p>
          <div className="grid grid-cols-2 gap-2">
            {[
              { eleman: 'Zemine değen yüzey', paspay: '50 mm' },
              { eleman: 'Kolon', paspay: '40 mm' },
              { eleman: 'Kiriş', paspay: '25 mm' },
              { eleman: 'Döşeme', paspay: '20 mm' },
              { eleman: 'Perde / Duvar', paspay: '25 mm' },
              { eleman: 'Deniz yapısı', paspay: '50–65 mm' },
            ].map(({ eleman, paspay }) => (
              <div key={eleman} className="bg-[#252F42] rounded-xl p-2.5 flex justify-between items-center">
                <p className="text-[#94A3B8] text-xs">{eleman}</p>
                <span className="text-white text-xs font-bold ml-2">{paspay}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    ),
  },
  {
    baslik: 'Zemin Etüdü',
    etiket: 'Temel',
    icerik: (
      <div className="space-y-4">
        <div>
          <p className="text-amber-500 text-xs font-bold uppercase tracking-wider mb-2">
            Zemin Sınıfları (TBDY 2018)
          </p>
          <div className="space-y-1.5">
            {[
              { kat: 'ZA', tanim: 'Sağlam kaya / çok sık zemin', vs: 'Vs > 1500 m/s' },
              { kat: 'ZB', tanim: 'Az ayrışmış sağlam kaya', vs: '760–1500 m/s' },
              { kat: 'ZC', tanim: 'Çok sık kum, çakıl veya sert kil', vs: '360–760 m/s' },
              { kat: 'ZD', tanim: 'Orta sıkı kum, çakıl veya katı kil', vs: '180–360 m/s' },
              { kat: 'ZE', tanim: 'Gevşek kum / yumuşak kil', vs: '< 180 m/s' },
            ].map(({ kat, tanim, vs }) => (
              <div key={kat} className="flex gap-3 items-center">
                <span className="text-amber-500 font-bold text-sm w-6 shrink-0">{kat}</span>
                <p className="text-[#94A3B8] text-xs flex-1">{tanim}</p>
                <span className="text-[#64748B] text-xs font-mono">{vs}</span>
              </div>
            ))}
          </div>
        </div>
        <div>
          <p className="text-amber-500 text-xs font-bold uppercase tracking-wider mb-2">
            Temel Derinliği
          </p>
          <ul className="space-y-1.5">
            {[
              'Don sınırı altında en az 0.5 m derin olmalıdır',
              'Türkiye\'nin çoğu bölgesinde: 1.0–1.5 m minimum temel derinliği',
              'Zemin taşıma kapasitesine göre yayılı/kazıklı temel seçilir',
            ].map((m, i) => (
              <li key={i} className="flex gap-2 items-start">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 mt-1.5 shrink-0" />
                <p className="text-[#94A3B8] text-sm">{m}</p>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <p className="text-amber-500 text-xs font-bold uppercase tracking-wider mb-2">
            Tipik Zemin Taşıma Kapasiteleri
          </p>
          <div className="grid grid-cols-2 gap-2">
            {[
              { zemin: 'Gevşek kum', kapasite: '~100 kPa' },
              { zemin: 'Sıkı kum/çakıl', kapasite: '~250 kPa' },
              { zemin: 'Sert kil', kapasite: '~200 kPa' },
              { zemin: 'Yumuşak kil', kapasite: '~50 kPa' },
              { zemin: 'Kaya (ayrışmış)', kapasite: '~500 kPa' },
              { zemin: 'Kaya (sağlam)', kapasite: '~1000 kPa' },
            ].map(({ zemin, kapasite }) => (
              <div key={zemin} className="bg-[#252F42] rounded-xl p-2.5 flex justify-between items-center">
                <p className="text-[#94A3B8] text-xs">{zemin}</p>
                <span className="text-white text-xs font-bold ml-2">{kapasite}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    ),
  },
  {
    baslik: 'Elektrik Tesisatı (IEC 60364)',
    etiket: 'Tesisat',
    icerik: (
      <div className="space-y-4">
        <div>
          <p className="text-amber-500 text-xs font-bold uppercase tracking-wider mb-2">
            Şantiye Geçici Tesisatı
          </p>
          <ul className="space-y-1.5">
            {[
              'Geçici dağıtım panoları ve prize armatürleri minimum IP44 koruma sınıfına sahip olmalıdır.',
              'Pano ve malzemeler zemin üzerinde çalışmayı engellemeyecek şekilde konumlandırılır.',
              'Tüm şantiye panoları kilitlenebilir kapı ile korunmalıdır.',
            ].map((m, i) => (
              <li key={i} className="flex gap-2 items-start">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 mt-1.5 shrink-0" />
                <p className="text-[#94A3B8] text-sm">{m}</p>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <p className="text-amber-500 text-xs font-bold uppercase tracking-wider mb-2">
            GFCI / RCD Gereksinimleri
          </p>
          <ul className="space-y-1.5">
            {[
              'Tüm şantiye besleme devrelerine 30 mA hassasiyetli kaçak akım rölesi (RCD) takılmalıdır.',
              'Taşınabilir el aletleri için 10 mA RCD önerilir.',
              'RCD\'ler aylık olarak test butonu ile kontrol edilmelidir.',
            ].map((m, i) => (
              <li key={i} className="flex gap-2 items-start">
                <span className="w-1.5 h-1.5 rounded-full bg-red-400 mt-1.5 shrink-0" />
                <p className="text-[#94A3B8] text-sm">{m}</p>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <p className="text-amber-500 text-xs font-bold uppercase tracking-wider mb-2">
            Topraklama ve Kablo Kesitleri
          </p>
          <ul className="space-y-1.5 mb-3">
            {[
              'Topraklama zorunludur; şantiye ana panosundan itibaren tüm metal aksam topraklanır.',
              'Topraklama direnci: 4 Ω altında olmalıdır (IEC 60364-4-41).',
            ].map((m, i) => (
              <li key={i} className="flex gap-2 items-start">
                <span className="w-1.5 h-1.5 rounded-full bg-green-400 mt-1.5 shrink-0" />
                <p className="text-[#94A3B8] text-sm">{m}</p>
              </li>
            ))}
          </ul>
          <div className="grid grid-cols-2 gap-2">
            {[
              { kullanum: 'Aydınlatma devresi', kesit: '1.5 mm²' },
              { kullanum: 'Priz devresi', kesit: '2.5 mm²' },
              { kullanum: 'Küçük motor', kesit: '4 mm²' },
              { kullanum: 'Büyük motor/vinç', kesit: '6 mm² +' },
            ].map(({ kullanum, kesit }) => (
              <div key={kullanum} className="bg-[#252F42] rounded-xl p-2.5 flex justify-between items-center">
                <p className="text-[#94A3B8] text-xs">{kullanum}</p>
                <span className="text-white text-xs font-bold ml-2">{kesit}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    ),
  },
  {
    baslik: 'İskele ve Kalıp',
    etiket: 'İnşaat',
    icerik: (
      <div className="space-y-4">
        <div>
          <p className="text-amber-500 text-xs font-bold uppercase tracking-wider mb-2">
            Boru İskele Limitleri
          </p>
          <ul className="space-y-1.5">
            {[
              'Boru iskelede desteksiz maksimum yükseklik: 20 m',
              '20 m üzeri yükseklikte ilave yatay rijitleştirme (bağlantı) gerekir.',
              'Cephe iskelesi: yapı cephesine her 4 m\'de bir bağlanmalıdır.',
              'İskele kurma/sökmede yetkin kişi gözetimi zorunludur.',
            ].map((m, i) => (
              <li key={i} className="flex gap-2 items-start">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 mt-1.5 shrink-0" />
                <p className="text-[#94A3B8] text-sm">{m}</p>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <p className="text-amber-500 text-xs font-bold uppercase tracking-wider mb-2">
            Kalıp Söküm Süreleri (TS 500)
          </p>
          <div className="grid grid-cols-2 gap-2">
            {[
              { eleman: 'Kolon yanı', sure: '7 gün' },
              { eleman: 'Kiriş yanı', sure: '7 gün' },
              { eleman: 'Kiriş altı (≤4 m)', sure: '14 gün' },
              { eleman: 'Kiriş altı (>4 m)', sure: '28 gün' },
              { eleman: 'Döşeme altı (≤3 m)', sure: '14 gün' },
              { eleman: 'Döşeme altı (>3 m)', sure: '28 gün' },
            ].map(({ eleman, sure }) => (
              <div key={eleman} className="bg-[#252F42] rounded-xl p-2.5 flex justify-between items-center">
                <p className="text-[#94A3B8] text-xs">{eleman}</p>
                <span className="text-amber-500 text-xs font-bold ml-2">{sure}</span>
              </div>
            ))}
          </div>
          <p className="text-[#64748B] text-xs mt-2">* Ortam sıcaklığı 15°C üzeri ve standart çimento varsayımıyla</p>
        </div>
        <div>
          <p className="text-amber-500 text-xs font-bold uppercase tracking-wider mb-2">
            Yük Kapasitesi
          </p>
          <ul className="space-y-1.5">
            {[
              'Tipik çalışma iskelesi yüzey yükü: 2.0 kN/m² (yaklaşık 200 kg/m²)',
              'Ağır yük iskelesi (malzeme depolama): 3.0–7.5 kN/m²',
              'Hesaplanan maksimum yük aşılmamalı; yük tablosu iskelenin görünür yerine asılır.',
            ].map((m, i) => (
              <li key={i} className="flex gap-2 items-start">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-400 mt-1.5 shrink-0" />
                <p className="text-[#94A3B8] text-sm">{m}</p>
              </li>
            ))}
          </ul>
        </div>
      </div>
    ),
  },
  {
    baslik: 'Ölçü ve Toleranslar',
    etiket: 'Kalite',
    icerik: (
      <div className="space-y-4">
        <div>
          <p className="text-amber-500 text-xs font-bold uppercase tracking-wider mb-2">
            Betonarme Yapı Toleransları (TS EN 13670)
          </p>
          <div className="space-y-2">
            {[
              { parametre: 'Kolon düşeylik toleransı', deger: 'H/400 veya maks. ±25 mm' },
              { parametre: 'Döşeme seviye toleransı', deger: '±10 mm / 3 m mesafede' },
              { parametre: 'Beton dış yüzey düzlüğü', deger: '±5 mm / 2 m' },
              { parametre: 'Yapı toplam yükseklik sapması', deger: 'maks. ±H/500' },
              { parametre: 'Eleman boyutsal toleransı', deger: '–5 mm / +10 mm' },
            ].map(({ parametre, deger }) => (
              <div key={parametre} className="flex justify-between items-start gap-4 py-2 border-b border-white/[0.04] last:border-0">
                <p className="text-[#94A3B8] text-sm flex-1">{parametre}</p>
                <span className="text-white text-xs font-bold shrink-0">{deger}</span>
              </div>
            ))}
          </div>
        </div>
        <div>
          <p className="text-amber-500 text-xs font-bold uppercase tracking-wider mb-2">
            Duvar ve Yüzey Toleransları
          </p>
          <div className="grid grid-cols-2 gap-2">
            {[
              { ad: 'Duvar düzlük', deger: '±5 mm / 2 m' },
              { ad: 'Duvar düşeylik', deger: '±5 mm / 3 m' },
              { ad: 'Kapı-pencere boşluğu', deger: '±5 mm' },
              { ad: 'Sıva yüzey düzlüğü', deger: '±3 mm / 2 m' },
            ].map(({ ad, deger }) => (
              <div key={ad} className="bg-[#252F42] rounded-xl p-2.5">
                <p className="text-[#64748B] text-xs">{ad}</p>
                <p className="text-white text-sm font-bold mt-0.5">{deger}</p>
              </div>
            ))}
          </div>
        </div>
        <div>
          <p className="text-amber-500 text-xs font-bold uppercase tracking-wider mb-2">
            Önemli Uyarı
          </p>
          <p className="text-[#94A3B8] text-sm">
            Tolerans değerleri sadece yapı elemanlarının üretim/montaj sapmasını kapsar.
            Zemin oturması, yük altında deformasyon veya deprem davranışı bu toleransların dışındadır.
            Proje statik hesaplarını her zaman esas alın.
          </p>
        </div>
      </div>
    ),
  },
  {
    baslik: 'Önemli İletişim Numaraları',
    etiket: 'Acil',
    icerik: (
      <div className="space-y-2">
        {[
          { ad: 'Yangın / İtfaiye', no: '110', renk: '#EF4444' },
          { ad: 'Sağlık / Ambulans', no: '112', renk: '#22C55E' },
          { ad: 'Polis İmdat', no: '155', renk: '#3B82F6' },
          { ad: 'Jandarma İmdat', no: '156', renk: '#8B5CF6' },
          { ad: 'ALO SGK (Şikâyet)', no: '170', renk: '#F97316' },
          { ad: 'ALO İş Güvenliği', no: '171', renk: '#F59E0B' },
          { ad: 'ÇSGB İşçi Şikâyet', no: 'ALO 170', renk: '#EC4899' },
          { ad: 'AFAD Afet Hattı', no: '122', renk: '#0EA5E9' },
        ].map(({ ad, no, renk }) => (
          <div
            key={ad}
            className="flex justify-between items-center py-2.5 border-b border-white/[0.05] last:border-0"
          >
            <span className="text-[#94A3B8] text-sm">{ad}</span>
            <a
              href={`tel:${no.replace(/\D/g, '')}`}
              className="text-sm font-bold"
              style={{ color: renk }}
            >
              {no}
            </a>
          </div>
        ))}
      </div>
    ),
  },
];

const ETIKET_RENK: Record<string, string> = {
  Hukuki: 'bg-red-500/20 text-red-400',
  Teknik: 'bg-blue-500/20 text-blue-400',
  Temel: 'bg-amber-500/20 text-amber-400',
  Tesisat: 'bg-yellow-500/20 text-yellow-400',
  İnşaat: 'bg-purple-500/20 text-purple-400',
  Kalite: 'bg-emerald-500/20 text-emerald-400',
  Acil: 'bg-rose-500/20 text-rose-400',
};

export default function SantiyeRehberi() {
  const [arama, setArama] = useState('');
  const [acikBolumler, setAcikBolumler] = useState<Set<number>>(new Set([0]));

  const toggle = (i: number) => {
    setAcikBolumler((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  };

  const aramaKucuk = arama.toLowerCase();
  const filtrelenmis = bolumler
    .map((b, i) => ({ b, i }))
    .filter(({ b }) =>
      b.baslik.toLowerCase().includes(aramaKucuk) ||
      b.etiket.toLowerCase().includes(aramaKucuk)
    );

  return (
    <div className="min-h-screen bg-[#0E1117] px-4 py-5 pb-10">
      <Link
        href="/araclar"
        className="inline-flex items-center gap-1.5 text-[#94A3B8] text-sm mb-5 hover:text-white transition-colors"
      >
        ← Araçlar
      </Link>

      <h1 className="text-2xl font-black text-white mb-1">Şantiye Rehberi</h1>
      <p className="text-[#64748B] text-sm mb-5">
        ISG mevzuatı, teknik standartlar ve toleranslar
      </p>

      {/* Arama */}
      <div className="mb-4">
        <input
          type="text"
          value={arama}
          onChange={(e) => setArama(e.target.value)}
          placeholder="Kategori veya konu ara..."
          className="w-full bg-[#252F42] rounded-xl px-4 py-3 text-white border border-white/[0.07] text-sm focus:outline-none focus:border-amber-500/50 placeholder-[#4A5568]"
        />
      </div>

      {/* Accordion */}
      <div className="space-y-2">
        {filtrelenmis.length === 0 ? (
          <div className="bg-[#1E2636] rounded-2xl border border-white/[0.07] p-8 text-center">
            <p className="text-[#94A3B8] text-sm">&quot;{arama}&quot; için sonuç bulunamadı.</p>
          </div>
        ) : (
          filtrelenmis.map(({ b, i }) => {
            const acik = acikBolumler.has(i);
            return (
              <div
                key={i}
                className="bg-[#1E2636] rounded-2xl border border-white/[0.07] overflow-hidden"
              >
                <button
                  onClick={() => toggle(i)}
                  className="w-full flex justify-between items-center px-4 py-4 text-left gap-3"
                >
                  <div className="flex items-center gap-2.5 flex-1 min-w-0">
                    <span className="text-white text-sm font-semibold truncate">{b.baslik}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ${ETIKET_RENK[b.etiket] ?? 'bg-slate-500/20 text-slate-400'}`}>
                      {b.etiket}
                    </span>
                  </div>
                  <span
                    className="text-amber-500 text-lg transition-transform shrink-0"
                    style={{ transform: acik ? 'rotate(180deg)' : 'rotate(0deg)' }}
                  >
                    ↓
                  </span>
                </button>
                {acik && (
                  <div className="px-4 pb-5 border-t border-white/[0.07] pt-4">
                    {b.icerik}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
