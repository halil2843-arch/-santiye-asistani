export interface TokenResponse {
  access_token: string;
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
