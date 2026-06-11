export interface TokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  kullanici_id: string;
  musteri_id: string;
  rol: string;
}

export interface SantiyeResponse {
  id: string;
  musteri_id: string;
  isim: string;
  adres: string | null;
  whatsapp_numara: string | null;
  aktif: boolean;
}

export interface RaporResponse {
  id: string;
  santiye_id: string;
  sablon_id: string | null;
  olusturan_id: string | null;
  tarih: string;
  durum: 'taslak' | 'onaylandi' | 'iptal' | 'hata';
  cikti_dosya_yolu: string | null;
}

export interface SablonResponse {
  id: string;
  musteri_id: string;
  santiye_id: string | null;
  isim: string;
  format: 'xlsx' | 'docx';
  dosya_yolu: string;
  alan_esleme: Record<string, string>;
  tip: 'gunluk_rapor' | 'hakedis' | 'isg' | 'puantaj' | 'aylik_ozet' | 'diger' | null;
  aktif: boolean;
}

export interface WhatsappMesaji {
  id: string;
  santiye_id: string;
  rapor_id: string | null;
  gonderen_no: string;
  icerik: string | null;
  medya_url: string | null;
  islendi: boolean;
  created_at: string;
}

export interface PendingPhoneResponse {
  id: string;
  whatsapp_numara: string;
  ilk_mesaj_metni: string | null;
  islendi: boolean;
}

export interface RaporOlusturRequest {
  santiye_id: string;
  sablon_id: string;
  tarih: string;
  mesaj_ids: string[];
}

export interface RaporOlusturResponse {
  rapor_id: string;
  durum: string;
  mesaj: string;
}

export interface KullaniciResponse {
  id: string;
  musteri_id: string;
  ad_soyad: string;
  email: string;
  telefon_no: string | null;
  rol: 'admin' | 'editor' | 'viewer';
  aktif: boolean;
}

export interface NumaraResponse {
  id: string;
  santiye_id: string;
  numara: string;
  aktif: boolean;
}

export interface HucreDegeri {
  deger: string | null;
  kalin: boolean;
  hizalama: string;
}

export interface SayfaVeri {
  isim: string;
  satirlar: HucreDegeri[][];
  sutun_genislikleri: number[];
}

export interface PreviewResponse {
  rapor_id: string;
  sayfalar: SayfaVeri[];
}

export interface WeatherResponse {
  sicaklik: number;
  durum: string;
  ikon: string;
  nem: number;
  ruzgar: number;
  il: string;
  ilce: string;
}

export interface DashboardSummary {
  aktif_santiye_sayisi: number;
  aktif_proje_sayisi: number;
  bugunun_rapor_sayisi: number;
  bekleyen_rapor_sayisi: number;
  toplam_personel: number;
  okunmamis_mesaj_sayisi: number;
}

export interface ProjeResponse {
  id: string;
  musteri_id: string;
  santiye_id: string | null;
  isim: string;
  tanim: string | null;
  durum: string;
  baslangic_tarihi: string | null;
  bitis_tarihi: string | null;
  il: string | null;
  ilce: string | null;
  enlem: number | null;
  boylam: number | null;
  proje_muduru: string | null;
  butce: number | null;
  ilerleme_yuzdesi: number;
  created_at: string | null;
  updated_at: string | null;
}

export interface ProjeCreate {
  santiye_id?: string | null;
  isim: string;
  tanim?: string;
  durum?: string;
  baslangic_tarihi?: string;
  bitis_tarihi?: string;
  il?: string;
  ilce?: string;
  enlem?: number;
  boylam?: number;
  proje_muduru?: string;
  butce?: number;
  ilerleme_yuzdesi?: number;
}

export interface StokKalemi {
  id: string; musteri_id: string; proje_id: string | null;
  malzeme_adi: string; birim: string | null;
  miktar: number; min_miktar: number; kritik: boolean;
  created_at: string | null;
}

export interface StokHareketi {
  id: string; kalem_id: string; tip: 'giris' | 'cikis' | 'sayim';
  miktar: number; aciklama: string | null;
  tarih: string | null;
  created_at: string | null;
}

export interface MedyaDosyasi {
  id: string; musteri_id: string; proje_id: string | null;
  dosya_adi: string | null; mime_type: string | null;
  boyut_byte: number | null; tip: 'fotograf' | 'belge' | 'video';
  dosya_yolu: string; created_at: string | null;
  klasor: string | null;
}

export interface IsgKaydi {
  id: string; musteri_id: string; proje_id: string | null;
  tip: 'olay' | 'denetim' | 'egitim' | 'ramak_kala';
  tarih: string; aciklama: string | null; sonuc: string | null;
  onem_seviyesi: 'dusuk' | 'orta' | 'yuksek' | 'kritik';
  durum: 'acik' | 'kapandi' | 'ertelendi'; sorumlu: string | null;
}

export interface Toplanti {
  id: string; musteri_id: string; proje_id: string | null;
  baslik: string; tarih: string; yer: string | null;
  notlar: string | null; katilanlar: string | null;
}

export interface Aktivite {
  id: string; proje_id: string; tip: string | null;
  baslik: string | null; aciklama: string | null;
  renk: string; created_at: string | null;
}

export interface PuantajKaydi {
  id: string; musteri_id: string; proje_id: string | null;
  santiye_id: string | null; tarih: string;
  personel_adi: string; meslek: string | null;
  giris_saati: string | null; cikis_saati: string | null;
  calisma_saati: number; fazla_mesai: number;
  devamsizlik: boolean;
  devamsizlik_nedeni: string | null;
  notlar: string | null; created_at: string | null;
}

export interface ProjeIstatistik {
  toplam_personel_bugun: number;
  kritik_stok_sayisi: number;
  medya_sayisi: number;
  isg_acik_madde: number;
  ilerleme_yuzdesi: number;
  proje_muduru: string | null;
  baslangic_tarihi: string | null;
  bitis_tarihi: string | null;
}

export interface ProjeNot {
  id: string;
  proje_id: string;
  musteri_id: string;
  baslik: string;
  icerik: string;
  renk: string;
  sabitlendi: string; // "true" | "false"
  created_at: string;
  updated_at: string | null;
}

export interface ProjeMilestone {
  id: string;
  tip: string; // "milestone"
  baslik: string;
  aciklama: string | null; // JSON: {hedef_tarih, tamamlandi}
  renk: string;
  created_at: string;
}
