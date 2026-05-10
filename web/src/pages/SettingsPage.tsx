import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { loadSettings, saveSettings } from '../lib/storage';
import type { StoredSettings } from '../types';
import { modelsListUrl } from '../lib/endpoints';

function formatSyncedAt(ts: number): string {
  try {
    return new Date(ts).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  } catch {
    return '';
  }
}

function settingsEqual(a: StoredSettings, b: StoredSettings): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

export function SettingsPage() {
  const [settings, setSettings] = useState<StoredSettings>(() => loadSettings());
  const [lastSavedSettings, setLastSavedSettings] = useState<StoredSettings>(() => loadSettings());
  const [hintCheck, setHintCheck] = useState<'idle' | 'checking' | 'ok' | 'fail'>('idle');
  const [saveBanner, setSaveBanner] = useState<'idle' | 'ok' | 'err'>('idle');
  const [saveAck, setSaveAck] = useState(false);
  const [lastSyncedAt, setLastSyncedAt] = useState<number | null>(null);
  const saveUiTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    return () => {
      if (saveUiTimerRef.current !== undefined) window.clearTimeout(saveUiTimerRef.current);
    };
  }, []);

  const settingsDirty = useMemo(() => !settingsEqual(settings, lastSavedSettings), [settings, lastSavedSettings]);

  const flushToDisk = useCallback((next: StoredSettings) => {
    try {
      saveSettings(next);
      setLastSavedSettings(next);
      setLastSyncedAt(Date.now());
      return true;
    } catch {
      setSaveBanner('err');
      return false;
    }
  }, []);

  const updateField = useCallback(
    (partial: Partial<StoredSettings>) => {
      setSettings((prev) => {
        const next = { ...prev, ...partial };
        return next;
      });
    },
    [],
  );

  const handleSaveClick = () => {
    const ok = flushToDisk(settings);
    if (!ok) return;
    if (saveUiTimerRef.current !== undefined) window.clearTimeout(saveUiTimerRef.current);
    setSaveAck(true);
    setSaveBanner('ok');
    saveUiTimerRef.current = window.setTimeout(() => {
      setSaveAck(false);
      setSaveBanner('idle');
      saveUiTimerRef.current = undefined;
    }, 4000);
  };

  const testHint = async () => {
    if (!settings.hintBaseUrl || !settings.hintModel) {
      setHintCheck('fail');
      return;
    }
    setHintCheck('checking');
    try {
      const url = modelsListUrl(settings.hintBaseUrl);
      const headers: HeadersInit = {};
      if (settings.hintApiKey) headers.Authorization = `Bearer ${settings.hintApiKey}`;
      const res = await fetch(url, { headers });
      setHintCheck(res.ok ? 'ok' : 'fail');
    } catch {
      setHintCheck('fail');
    }
  };

  return (
    <div className="settings-page">
      <header className="settings-page-header">
        <div className="settings-page-title-block">
          <p className="eyebrow">Settings</p>
          <h2 className="settings-page-title">Models &amp; keys</h2>
          <p className="settings-page-lead">
            Everything stays in this browser (<code>localStorage</code>). Personal device only — do not sync this profile to a shared computer.
          </p>
        </div>
        <div className="settings-page-actions">
          <p className="settings-sync-line" aria-live="polite">
            {settingsDirty ? (
              <>Unsaved changes — click Save to store them in this browser.</>
            ) : lastSyncedAt != null ? (
              <>
                Browser storage updated · <time dateTime={new Date(lastSyncedAt).toISOString()}>{formatSyncedAt(lastSyncedAt)}</time>
              </>
            ) : (
              <>Settings loaded from browser storage.</>
            )}
          </p>
          {saveBanner === 'ok' ? (
            <span className="settings-save-hint settings-save-hint--ok" role="status">
              Save confirmed — keys are in localStorage on this device.
            </span>
          ) : null}
          {saveBanner === 'err' ? (
            <span className="settings-save-hint settings-save-hint--err" role="alert">
              Could not write storage (quota or private mode).
            </span>
          ) : null}
          <button
            type="button"
            className={`primary${saveAck ? ' settings-save-btn--ack' : ''}`}
            disabled={!settingsDirty && !saveAck}
            onClick={handleSaveClick}
          >
            {saveAck ? 'Saved ✓' : 'Save settings'}
          </button>
        </div>
      </header>

      <div className="settings-page-grid">
        <article className="settings-box">
          <p className="eyebrow">Realtime voice</p>
          <h3>OpenAI WebRTC</h3>
          <p className="settings-help">
            Used for <strong>Live voice</strong>. Run <code>npm run dev</code> (Vite proxies <code>/openai</code>) or <code>npm run build &amp;&amp; npm run start</code> to avoid CORS.
          </p>
          <label className="settings-field">
            <span className="settings-label">API key</span>
            <input
              type="password"
              autoComplete="off"
              placeholder="sk-…"
              value={settings.realtimeApiKey}
              onChange={(e) => updateField({ realtimeApiKey: e.target.value })}
            />
          </label>
          <label className="settings-field">
            <span className="settings-label">Model</span>
            <input value={settings.realtimeModel} onChange={(e) => updateField({ realtimeModel: e.target.value })} />
          </label>
          <label className="settings-field">
            <span className="settings-label">Voice</span>
            <input value={settings.realtimeVoice} onChange={(e) => updateField({ realtimeVoice: e.target.value })} />
          </label>
          <label className="settings-field">
            <span className="settings-label">Cooldown after AI (seconds)</span>
            <input
              type="number"
              min={5}
              max={120}
              value={settings.realtimeCooldownSeconds}
              onChange={(e) => updateField({ realtimeCooldownSeconds: Number(e.target.value) || 5 })}
            />
          </label>
        </article>

        <article className="settings-box">
          <p className="eyebrow">Hint model</p>
          <h3>Chat &amp; hints</h3>
          <p className="settings-help">OpenAI-compatible Chat Completions. For OpenAI URLs, requests go through the same <code>/openai</code> proxy.</p>
          <label className="settings-field">
            <span className="settings-label">Base URL</span>
            <input value={settings.hintBaseUrl} onChange={(e) => updateField({ hintBaseUrl: e.target.value })} placeholder="https://api.openai.com/v1" />
          </label>
          <label className="settings-field">
            <span className="settings-label">Model</span>
            <input value={settings.hintModel} onChange={(e) => updateField({ hintModel: e.target.value })} />
          </label>
          <label className="settings-field">
            <span className="settings-label">API key</span>
            <input type="password" autoComplete="off" value={settings.hintApiKey} onChange={(e) => updateField({ hintApiKey: e.target.value })} />
          </label>
          <button
            type="button"
            className="soft settings-inline-btn settings-inline-btn--with-spinner"
            disabled={hintCheck === 'checking'}
            aria-busy={hintCheck === 'checking'}
            onClick={() => void testHint()}
          >
            {hintCheck === 'checking' ? (
              <>
                <span className="settings-spinner" aria-hidden />
                Checking…
              </>
            ) : (
              'Check connection'
            )}
          </button>
          {hintCheck === 'checking' ? (
            <p className="settings-status-msg settings-status-msg--pending">Contacting models endpoint…</p>
          ) : hintCheck === 'ok' ? (
            <p className="settings-status-msg settings-status-msg--ok">Reachable (HTTP OK).</p>
          ) : hintCheck === 'fail' ? (
            <p className="settings-status-msg settings-status-msg--err">Cannot reach API (check URL, key, proxy, or network).</p>
          ) : null}
        </article>

        <article className="settings-box settings-box--prefs">
          <p className="eyebrow">Practice</p>
          <h3>Preferences</h3>
          <p className="settings-help">
            Fine-tune the practice UI and live voice. Changes apply on the next screen load where relevant.
          </p>
          <ul className="settings-pref-list">
            <li>
              <label className="settings-pref-row">
                <input
                  type="checkbox"
                  className="settings-pref-input"
                  checked={settings.showLiveVoiceConversationText}
                  onChange={(e) => updateField({ showLiveVoiceConversationText: e.target.checked })}
                />
                <span className="settings-pref-body">
                  <span className="settings-pref-title">Show live conversation text</span>
                  <span className="settings-pref-desc">
                    Realtime AI subtitle lines beside the orb (not the scenario “AI script” panel above).
                  </span>
                </span>
              </label>
            </li>
            <li>
              <label className="settings-pref-row">
                <input
                  type="checkbox"
                  className="settings-pref-input"
                  checked={settings.showLiveVoiceAiCaptionVi}
                  onChange={(e) => updateField({ showLiveVoiceAiCaptionVi: e.target.checked })}
                />
                <span className="settings-pref-body">
                  <span className="settings-pref-title">Show Vietnamese AI captions</span>
                  <span className="settings-pref-desc">Translation under realtime AI subtitle lines.</span>
                </span>
              </label>
            </li>
            <li>
              <label className="settings-pref-row">
                <input
                  type="checkbox"
                  className="settings-pref-input"
                  checked={settings.showLiveVoiceHintVi}
                  onChange={(e) => updateField({ showLiveVoiceHintVi: e.target.checked })}
                />
                <span className="settings-pref-body">
                  <span className="settings-pref-title">Show Vietnamese hints</span>
                  <span className="settings-pref-desc">Translation below sidebar hint cards.</span>
                </span>
              </label>
            </li>
            <li>
              <label className="settings-pref-row">
                <input
                  type="checkbox"
                  className="settings-pref-input"
                  checked={settings.liveVoiceMicHandsFree}
                  onChange={(e) => updateField({ liveVoiceMicHandsFree: e.target.checked })}
                />
                <span className="settings-pref-body">
                  <span className="settings-pref-title">Live voice hands-free mic</span>
                  <span className="settings-pref-desc">
                    Open the mic automatically after each cooldown; tap mic only if you prefer push-to-talk.
                  </span>
                </span>
              </label>
            </li>
            <li>
              <label className="settings-pref-row">
                <input
                  type="checkbox"
                  className="settings-pref-input"
                  checked={settings.showPracticeTimer}
                  onChange={(e) => updateField({ showPracticeTimer: e.target.checked })}
                />
                <span className="settings-pref-body">
                  <span className="settings-pref-title">Session timer</span>
                  <span className="settings-pref-desc">Show an MM:SS clock in chat and live voice headers.</span>
                </span>
              </label>
            </li>
            <li>
              <label className="settings-pref-row">
                <input
                  type="checkbox"
                  className="settings-pref-input"
                  checked={settings.saveTranscripts}
                  onChange={(e) => updateField({ saveTranscripts: e.target.checked })}
                />
                <span className="settings-pref-body">
                  <span className="settings-pref-title">Save transcripts</span>
                  <span className="settings-pref-desc">Keep message history in session history for review.</span>
                </span>
              </label>
            </li>
            <li>
              <label className="settings-pref-row settings-pref-row--disabled">
                <input type="checkbox" className="settings-pref-input" checked={settings.saveAudio} disabled />
                <span className="settings-pref-body">
                  <span className="settings-pref-title">Save audio</span>
                  <span className="settings-pref-desc">Coming later — recording replay is not wired up yet.</span>
                </span>
              </label>
            </li>
          </ul>
        </article>

        <article className="settings-box">
          <p className="eyebrow">Debug</p>
          <h3>Technical log</h3>
          <p className="settings-help">Live voice and LLM chat pages include a collapsible log (events, SDP, rate limits).</p>
        </article>
      </div>
    </div>
  );
}
