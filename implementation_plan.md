# Günlük Şantiye Raporu Asistanı - Proje Planı

Bu plan, **Team Lead** (Takım Lideri) ajanı rolüyle, projenin baştan sona nasıl inşa edileceğini ve takım hiyerarşisinin nasıl işleyeceğini belirlemek amacıyla hazırlanmıştır.

## İletişim ve Çalışma Protokolü (Ajan Hiyerarşisi)
Sizin talebiniz doğrultusunda proje boyunca katı bir "Sanal Ekip" işleyişi benimsenecektir:
1. **Tek Muhatap (Team Lead):** Siz (Kullanıcı / Proje Sahibi) geliştirme süreci boyunca sadece benimle (**Team Lead**) muhatap olacaksınız.
2. **Delegasyon:** Sizden gelen her yeni isteği, düzeltmeyi veya onaylanmış planı ben alacak ve ekibimdeki ilgili uzman ajana (Backend, Frontend, Data, QA) "Task" (Görev) olarak atayacağım.
3. **Geri Bildirim:** Atadığım ajan arka planda kendi işini (kodlamasını) bitirdiğinde, ben süreci devralıp size o ajanın raporunu, yazdığı kodun sonucunu ve sistemdeki güncel durumu aktaracağım.

## Teknoloji Yığını (Tech Stack)
- **Backend:** Python (FastAPI)
- **Data / RAG:** PostgreSQL (Rapor verileri için), ChromaDB/Pinecone (Vektör arama için)
- **Frontend:** Next.js (React) ve Vanilla CSS (Modern Tasarım)
- **İletişim Kanalı:** Twilio WhatsApp Sandbox API (Medya API'si dahil)

## Proje Bileşenleri ve Ajan Görevleri (Fazlar)

### Faz 1: Veri ve Altyapı
Sorumlu Ajan: **Data Agent**
- **Görevler:** Raporlar, Hava Durumu, Personel, İmalatlar, Şablonlar ve Fotoğraflar tablolarının (PostgreSQL) tanımlanması. Dinamik LLM JSON çıktılarının veri yapılarının tasarlanması.

### Faz 2: API ve Bot Entegrasyonu
Sorumlu Ajan: **Backend Agent**
- **Görevler:** FastAPI sunucusunun kurulması, Twilio Webhook'un bağlanması, OpenAI Vision/LLM entegrasyonu, PDF üretici motorun kodlanması.

### Faz 3: Arayüz ve Görselleştirme
Sorumlu Ajan: **Frontend Agent**
- **Görevler:** Next.js Web panelinin kodlanması. Şablon yükleme modülü, rapor detay ve takvim arayüzlerinin modern tasarımla (Vanilla CSS) oluşturulması.

### Faz 4: Test ve Validasyon
Sorumlu Ajan: **QA Agent**
- **Görevler:** Veri bütünlüğü testleri, halüsinasyon kontrolleri, WhatsApp üzerinden fotoğraf-metin eşleşme denemeleri.
