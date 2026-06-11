'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { api } from '@/lib/api';
import { tokenStore } from '@/lib/auth';
import type { SantiyeResponse, ProjeResponse } from '@/types';

// ─── Tipler ────────────────────────────────────────────────────────────────

interface Message {
  id: number;
  role: 'user' | 'ai';
  content: string;
  loading: boolean;
  error?: boolean;
}

interface QuickCommand {
  key: string;
  label: string;
}

// ─── Varsayılan hızlı komutlar ─────────────────────────────────────────────

const DEFAULT_COMMANDS: QuickCommand[] = [
  { key: 'rapor', label: 'Rapor Oluştur' },
  { key: 'stok', label: 'Stok Sorgula' },
  { key: 'ekip', label: 'Ekip Ara' },
  { key: 'isg', label: 'ISG Kontrol' },
  { key: 'plan', label: 'İş Planı' },
];

// ─── Typing Indicator ──────────────────────────────────────────────────────

function TypingDots() {
  return (
    <span className="inline-flex items-center gap-1 h-5">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="w-1.5 h-1.5 bg-[#94A3B8] rounded-full animate-bounce"
          style={{ animationDelay: `${i * 0.15}s`, animationDuration: '0.8s' }}
        />
      ))}
    </span>
  );
}

// ─── SA Avatar ─────────────────────────────────────────────────────────────

function SaAvatar({ size = 'sm' }: { size?: 'sm' | 'lg' }) {
  const dim = size === 'lg' ? 'w-14 h-14 text-base' : 'w-8 h-8 text-xs';
  return (
    <div
      className={`${dim} rounded-full flex items-center justify-center flex-shrink-0 font-bold font-[var(--font-syne)]`}
      style={{ background: 'linear-gradient(135deg, #F59E0B 0%, #D97706 100%)' }}
    >
      <span className="text-white">SA</span>
    </div>
  );
}

// ─── Kullanıcı Avatar ───────────────────────────────────────────────────────

function UserAvatar() {
  return (
    <div className="w-8 h-8 rounded-full bg-[#252F42] flex items-center justify-center flex-shrink-0">
      <svg className="w-4 h-4 text-[#94A3B8]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
      </svg>
    </div>
  );
}

// ─── Mesaj Balonu ───────────────────────────────────────────────────────────

function MessageBubble({ msg }: { msg: Message }) {
  const isUser = msg.role === 'user';

  if (isUser) {
    return (
      <div className="flex items-end gap-2 justify-end">
        <div
          className="max-w-[78%] px-4 py-2.5 rounded-2xl rounded-br-sm text-sm leading-relaxed font-medium"
          style={{ background: '#F59E0B', color: '#0E1117' }}
        >
          {msg.content}
        </div>
        <UserAvatar />
      </div>
    );
  }

  return (
    <div className="flex items-end gap-2">
      <SaAvatar />
      <div
        className={`max-w-[78%] px-4 py-2.5 rounded-2xl rounded-bl-sm text-sm leading-relaxed ${
          msg.error
            ? 'bg-red-900/40 border border-red-700/40 text-red-300'
            : 'bg-[#1E2636] border border-[rgba(255,255,255,0.07)] text-[#F1F5F9]'
        }`}
      >
        {msg.loading ? (
          <TypingDots />
        ) : msg.error ? (
          <span>{msg.content || 'Bir hata oluştu. Tekrar deneyin.'}</span>
        ) : (
          <span className="whitespace-pre-wrap">{msg.content}</span>
        )}
      </div>
    </div>
  );
}

// ─── Boş Durum ──────────────────────────────────────────────────────────────

function EmptyState({
  commands,
  onCommand,
  santiyeAdi,
}: {
  commands: QuickCommand[];
  onCommand: (label: string) => void;
  santiyeAdi: string;
}) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center px-6 py-8 gap-5">
      {/* Büyük SA ikonu */}
      <div className="flex flex-col items-center gap-3">
        <SaAvatar size="lg" />
        <div className="text-center">
          <h2 className="text-[#F1F5F9] text-base font-bold font-[var(--font-syne)]">
            Merhaba! Size nasıl yardımcı olabilirim?
          </h2>
          {santiyeAdi && (
            <p className="text-[#94A3B8] text-xs mt-1">
              Aktif şantiye: <span className="text-[#F59E0B] font-medium">{santiyeAdi}</span>
            </p>
          )}
        </div>
      </div>

      {/* Yetenekler */}
      <div className="flex flex-wrap justify-center gap-2 max-w-xs">
        {['Rapor yardımı', 'Stok analizi', 'ISG danışmanlık', 'Ekip yönetimi'].map((tag) => (
          <span
            key={tag}
            className="text-xs text-[#94A3B8] bg-[#1E2636] px-3 py-1 rounded-full border border-[rgba(255,255,255,0.07)]"
          >
            {tag}
          </span>
        ))}
      </div>

      {/* Hızlı komutlar */}
      <div className="w-full">
        <p className="text-[#64748B] text-xs text-center mb-3">Hızlı başlangıç</p>
        <div className="flex flex-wrap justify-center gap-2">
          {commands.map((cmd) => (
            <button
              key={cmd.key}
              onClick={() => onCommand(cmd.label)}
              className="flex-shrink-0 bg-[#1E2636] border border-[rgba(255,255,255,0.07)] text-[#94A3B8] text-xs font-medium px-4 py-2 rounded-full hover:border-[#F59E0B]/50 hover:text-[#F1F5F9] hover:bg-[#252F42] transition-all"
            >
              {cmd.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Ana Sayfa ──────────────────────────────────────────────────────────────

export default function AsistanPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [santiyeAdi, setSantiyeAdi] = useState('');
  const [projeAdi, setProjeAdi] = useState('');
  const [santiyeler, setSantiyeler] = useState<SantiyeResponse[]>([]);
  const [projeler, setProjeler] = useState<ProjeResponse[]>([]);
  const [secilenSantiye, setSecilenSantiye] = useState('');
  const [secilenProje, setSecilenProje] = useState('');
  const [commands, setCommands] = useState<QuickCommand[]>(DEFAULT_COMMANDS);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // ─── Context: şantiye ve proje listelerini yükle ─────────────────────────
  useEffect(() => {
    api.getSantiyeler()
      .then((sites) => {
        setSantiyeler(sites);
        const aktif = sites.find((s) => s.aktif) ?? sites[0];
        if (aktif) {
          setSecilenSantiye(aktif.isim);
          setSantiyeAdi(aktif.isim);
        }
      })
      .catch(() => {/* sessizce geç */});

    api.getProjeler()
      .then((prjs) => {
        setProjeler(prjs);
      })
      .catch(() => {/* sessizce geç */});
  }, []);

  // Seçim değişince state'i güncelle
  useEffect(() => {
    setSantiyeAdi(secilenSantiye);
  }, [secilenSantiye]);

  useEffect(() => {
    setProjeAdi(secilenProje);
  }, [secilenProje]);

  // ─── Hızlı komutlar API'den ───────────────────────────────────────────────
  useEffect(() => {
    api.getChatCommands()
      .then((res) => {
        if (res.komutlar?.length) setCommands(res.komutlar);
      })
      .catch(() => {/* varsayılanlar kalır */});
  }, []);

  // ─── Otomatik scroll ──────────────────────────────────────────────────────
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // ─── Textarea auto-resize ─────────────────────────────────────────────────
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    const ta = e.target;
    ta.style.height = 'auto';
    ta.style.height = Math.min(ta.scrollHeight, 120) + 'px';
  };

  // ─── Mesaj gönder + SSE stream ────────────────────────────────────────────
  const sendMessage = useCallback(async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || isLoading) return;

    setInput('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
    setIsLoading(true);

    const userMsgId = Date.now();
    const aiMsgId = Date.now() + 1;

    // Kullanıcı mesajı
    setMessages((prev) => [
      ...prev,
      { id: userMsgId, role: 'user', content: trimmed, loading: false },
    ]);

    // AI placeholder
    setMessages((prev) => [
      ...prev,
      { id: aiMsgId, role: 'ai', content: '', loading: true },
    ]);

    try {
      const token = tokenStore.getAccess();
      const BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000';

      const res = await fetch(`${BASE}/api/v1/chat/message`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          icerik: trimmed,
          santiye_adi: santiyeAdi || undefined,
          proje_adi: projeAdi || undefined,
        }),
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      }

      if (!res.body) {
        throw new Error('Response body boş');
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let fullText = '';
      let buffer = '';
      let streamDone = false;

      while (!streamDone) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        // Son satır henüz tamamlanmamış olabilir
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          const trimmedLine = line.trim();
          if (!trimmedLine.startsWith('data: ')) continue;

          try {
            const jsonStr = trimmedLine.slice(6);
            const data = JSON.parse(jsonStr) as { token?: string; done?: boolean; error?: string };

            if (data.error) {
              throw new Error(data.error);
            }

            if (data.token) {
              fullText += data.token;
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === aiMsgId
                    ? { ...m, content: fullText, loading: false }
                    : m,
                ),
              );
            }

            if (data.done) {
              streamDone = true;
              break;
            }
          } catch (parseErr) {
            // Geçersiz JSON satırı — devam et
            console.warn('[SSE parse]', parseErr);
          }
        }
      }

      // Stream bitti ama hâlâ loading=true ise temizle
      setMessages((prev) =>
        prev.map((m) =>
          m.id === aiMsgId
            ? { ...m, content: fullText || '(Yanıt alınamadı)', loading: false }
            : m,
        ),
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Bağlantı hatası';
      setMessages((prev) =>
        prev.map((m) =>
          m.id === aiMsgId
            ? { ...m, content: msg, loading: false, error: true }
            : m,
        ),
      );
    } finally {
      setIsLoading(false);
    }
  }, [isLoading, santiyeAdi, projeAdi]);

  // ─── Klavye: Enter gönder, Shift+Enter yeni satır ─────────────────────────
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(input);
  };

  const isEmpty = messages.length === 0;

  return (
    <div className="flex flex-col h-[calc(100vh-68px)] bg-[#0E1117] lg:h-screen">

      {/* ── Üst Banner ──────────────────────────────────────────────────────── */}
      <div className="bg-[#161B26] border-b border-[rgba(255,255,255,0.07)] px-4 py-3 flex-shrink-0">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-[#F1F5F9] text-base font-bold font-[var(--font-syne)]">
              Yapay Zeka Asistanı
            </h1>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse" />
              <span className="text-[#94A3B8] text-xs">Groq · çevrimiçi</span>
            </div>
          </div>

          {/* Aktif şantiye */}
          {santiyeAdi && (
            <div className="flex items-center gap-1.5 bg-[#1E2636] border border-[rgba(255,255,255,0.07)] rounded-full px-3 py-1">
              <svg className="w-3 h-3 text-[#F59E0B]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <span className="text-[#F59E0B] text-xs font-medium truncate max-w-[100px]">{santiyeAdi}</span>
            </div>
          )}
        </div>
      </div>

      {/* ── Bağlam Seçici ────────────────────────────────────────────────────── */}
      <div style={{ background: '#1E2636', borderBottom: '1px solid rgba(255,255,255,0.07)', padding: '8px 16px', display: 'flex', gap: '8px', flexShrink: 0 }}>
        <select
          value={secilenSantiye}
          onChange={(e) => setSecilenSantiye(e.target.value)}
          style={{ background: '#252F42', color: '#94A3B8', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '8px', padding: '4px 8px', fontSize: '12px', flex: 1, outline: 'none' }}
        >
          <option value="">Şantiye seç...</option>
          {santiyeler.map((s) => (
            <option key={s.id} value={s.isim}>{s.isim}</option>
          ))}
        </select>
        <select
          value={secilenProje}
          onChange={(e) => setSecilenProje(e.target.value)}
          style={{ background: '#252F42', color: '#94A3B8', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '8px', padding: '4px 8px', fontSize: '12px', flex: 1, outline: 'none' }}
        >
          <option value="">Proje seç...</option>
          {projeler.map((p) => (
            <option key={p.id} value={p.isim}>{p.isim}</option>
          ))}
        </select>
      </div>

      {/* ── Hızlı Komut Chipleri (mesaj varken üstte küçük) ─────────────────── */}
      {!isEmpty && (
        <div className="px-4 pt-2 pb-1 flex-shrink-0">
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
            {commands.map((cmd) => (
              <button
                key={cmd.key}
                onClick={() => sendMessage(cmd.label)}
                disabled={isLoading}
                className="flex-shrink-0 bg-[#1E2636] border border-[rgba(255,255,255,0.07)] text-[#94A3B8] text-xs font-medium px-3 py-1.5 rounded-full hover:border-[#F59E0B]/40 hover:text-[#F1F5F9] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                {cmd.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Chat Alanı ───────────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto">
        {isEmpty ? (
          <EmptyState
            commands={commands}
            onCommand={sendMessage}
            santiyeAdi={santiyeAdi}
          />
        ) : (
          <div className="px-4 py-4 space-y-4">
            {messages.map((msg) => (
              <MessageBubble key={msg.id} msg={msg} />
            ))}
            <div ref={bottomRef} />
          </div>
        )}
      </div>

      {/* ── Input Alanı (sabit alt) ──────────────────────────────────────────── */}
      <form
        onSubmit={handleSubmit}
        className="bg-[#161B26] border-t border-[rgba(255,255,255,0.07)] px-4 py-3 flex-shrink-0"
      >
        <div className="flex items-end gap-2 bg-[#1E2636] border border-[rgba(255,255,255,0.1)] rounded-2xl px-3 py-2">

          {/* Mikrofon (gelecekte ses için — şimdilik disabled) */}
          <button
            type="button"
            disabled
            className="text-[#4A5568] p-1 flex-shrink-0 cursor-not-allowed mb-0.5"
            aria-label="Sesli giriş (yakında)"
            title="Sesli giriş yakında"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
            </svg>
          </button>

          {/* Textarea */}
          <textarea
            ref={textareaRef}
            value={input}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder="Bir şey sorun… (Enter gönder, Shift+Enter yeni satır)"
            rows={1}
            disabled={isLoading}
            className="flex-1 bg-transparent text-[#F1F5F9] text-sm placeholder-[#4A5568] focus:outline-none resize-none min-h-[24px] max-h-[120px] leading-6 disabled:opacity-60"
            style={{ overflowY: 'auto' }}
          />

          {/* Gönder butonu */}
          <button
            type="submit"
            disabled={!input.trim() || isLoading}
            className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 transition-colors mb-0.5 ${
              input.trim() && !isLoading
                ? 'bg-[#F59E0B] text-white hover:bg-[#D97706] active:bg-[#B45309]'
                : 'bg-[#2A3447] text-[#4A5568] cursor-not-allowed'
            }`}
            aria-label="Gönder"
          >
            {isLoading ? (
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
              </svg>
            ) : (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
            )}
          </button>
        </div>

        {/* Bağlam ipucu */}
        <p className="text-[#374151] text-[10px] text-center mt-1.5">
          Groq · Llama 3 · Mesajlar bu oturuma özeldir
        </p>
      </form>
    </div>
  );
}
