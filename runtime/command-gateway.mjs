import { createServer } from 'node:http';
import { randomUUID } from 'node:crypto';

const MAX_COMMAND_BYTES = 1024;
const EXPOSED_CAPABILITIES = new Set(['memory.search']);

export function loadCommandGatewayConfig(env = process.env) {
  const port = Number(env.VERIDAN_COMMAND_GATEWAY_PORT ?? 4700);
  if (!Number.isInteger(port) || port < 0 || port > 65535) throw new Error('VERIDAN_COMMAND_GATEWAY_PORT must be an integer between 0 and 65535.');
  return Object.freeze({ host: '127.0.0.1', port });
}

export function createCommandGatewayServer({ config, orchestrator, idFactory = randomUUID }) {
  if (!orchestrator?.execute || !orchestrator?.route) throw new Error('Command Gateway requires a Veridan Core orchestrator.');
  let boundPort = config.port;
  const server = createServer(async (request, response) => {
    securityHeaders(response);
    const pathname = new URL(request.url ?? '/', `http://${config.host}`).pathname;
    try {
      if (!isExpectedHost(request, config.host, boundPort)) return json(response, 421, { error: 'misdirected_request' });
      if (request.method === 'GET' && pathname === '/health') return json(response, 200, { status: 'ok', component: 'veridan-command-gateway', version: '0.1.0', mode: 'READ_ONLY' });
      if (request.method === 'GET' && pathname === '/') return html(response, 200, commandDesk());
      if (pathname !== '/v1/commands') return json(response, 404, { error: 'not_found' });
      if (request.method !== 'POST') return json(response, 405, { error: 'method_not_allowed' });
      if (!isSameOrigin(request, config.host, boundPort)) return json(response, 403, { error: 'browser_origin_rejected' });

      const payload = await readJson(request);
      const command = validatePayload(payload);
      const proposed = orchestrator.route(command, { source: 'veridan-command-desk', userDirected: true });
      if (proposed.status !== 'routed') return json(response, 403, safeFailure(proposed));
      if (!EXPOSED_CAPABILITIES.has(proposed.capability.id)) {
        return json(response, 403, { status: 'denied', reason: 'capability_not_exposed', intent: proposed.intent, capabilityId: proposed.capability.id });
      }

      const result = await orchestrator.execute(command, { source: 'veridan-command-desk', userDirected: true });
      if (result.status !== 'completed') return json(response, 502, safeFailure(result));
      return json(response, 200, safeSuccess(result, idFactory));
    } catch (error) {
      const status = error.code === 'invalid_command' || error.code === 'invalid_json' || error.code === 'body_too_large' ? 400 : 500;
      return json(response, status, { error: error.code ?? 'command_gateway_error' });
    }
  });

  return {
    raw: server,
    listen: () => new Promise((resolve, reject) => {
      server.once('error', reject);
      server.listen(config.port, config.host, () => {
        server.off('error', reject);
        const address = server.address();
        boundPort = address.port;
        resolve(address);
      });
    }),
    close: () => new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve())),
  };
}

function safeSuccess(result, idFactory) {
  const sources = result.result.sources.map(({ sourceId, path, title, excerpt, updatedAt }) => ({ sourceId, path, title, excerpt, updatedAt }));
  const topSource = sources[0];
  return {
    status: 'completed',
    commandId: result.commandId,
    correlationId: result.correlationId,
    requestId: idFactory(),
    intent: result.intent,
    capabilityId: result.capability.id,
    verification: result.verified,
    answer: {
      type: 'source_excerpt',
      text: topSource.excerpt,
      source: { sourceId: topSource.sourceId, path: topSource.path, title: topSource.title },
    },
    sources,
  };
}

function safeFailure(result) {
  return {
    status: result.status === 'approval_required' ? 'approval_required' : 'denied',
    reason: result.reason ?? result.policy?.reason ?? 'command_denied',
    ...(result.intent ? { intent: result.intent } : {}),
    ...(result.capability?.id ? { capabilityId: result.capability.id } : {}),
  };
}

async function readJson(request) {
  const chunks = [];
  let total = 0;
  for await (const chunk of request) {
    total += chunk.length;
    if (total > MAX_COMMAND_BYTES) throw coded('body_too_large');
    chunks.push(chunk);
  }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { throw coded('invalid_json'); }
}

function validatePayload(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload) || Object.keys(payload).length !== 1 || typeof payload.command !== 'string') throw coded('invalid_command');
  const command = payload.command.trim().replace(/\s+/g, ' ');
  if (command.length < 2 || command.length > 512) throw coded('invalid_command');
  return command;
}

function isExpectedHost(request, host, port) {
  return request.headers.host === `${host}:${port}`;
}

function isSameOrigin(request, host, port) {
  const origin = request.headers.origin;
  const fetchSite = request.headers['sec-fetch-site'];
  return origin === `http://${host}:${port}` && (fetchSite === undefined || fetchSite === 'same-origin');
}

function securityHeaders(response) {
  response.setHeader('Cache-Control', 'no-store');
  response.setHeader('Content-Security-Policy', "default-src 'self'; connect-src 'self'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'");
  response.setHeader('Referrer-Policy', 'no-referrer');
  response.setHeader('X-Content-Type-Options', 'nosniff');
  response.setHeader('X-Frame-Options', 'DENY');
}

function json(response, status, body) {
  const encoded = JSON.stringify(body);
  response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Content-Length': Buffer.byteLength(encoded) });
  response.end(encoded);
}

function html(response, status, body) {
  response.writeHead(status, { 'Content-Type': 'text/html; charset=utf-8', 'Content-Length': Buffer.byteLength(body) });
  response.end(body);
}

function coded(code) { const error = new Error(code); error.code = code; return error; }

function commandDesk() {
  return `<!doctype html>
<html lang="en">
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Veridan Command Desk</title>
<style>
  body{margin:0;background:#08110d;color:#eff9f1;font:16px system-ui,sans-serif}
  .shell{max-width:800px;margin:6vh auto;padding:32px;background:#102219;border:1px solid #2b6547;border-radius:16px}
  h1{margin:0 0 8px}h2{margin:0 0 8px;font-size:1.1rem}p{color:#b5cabb;line-height:1.5}
  .badge{display:inline-block;padding:4px 8px;border:1px solid #83d698;border-radius:999px;color:#a9eab7;font-size:.78rem;font-weight:700;letter-spacing:.04em}
  textarea{box-sizing:border-box;width:100%;min-height:110px;padding:12px;background:#07100b;color:#fff;border:1px solid #4d8b63;border-radius:8px;font:inherit}
  button{margin-top:12px;padding:10px 16px;border:0;border-radius:8px;background:#83d698;color:#082010;font-weight:700;cursor:pointer}
  button:disabled{cursor:not-allowed;opacity:.55}.voice-row{display:flex;align-items:center;gap:12px;flex-wrap:wrap}.voice-row button{margin-top:12px}.voice-status{color:#b5cabb;font-size:.9em}.voice-status[data-state="error"]{color:#ffb4a8}
  .auto-submit,.auto-read{display:flex;align-items:center;gap:6px;color:#b5cabb;font-size:.9em}.speech-settings{display:grid;gap:8px;margin-top:12px;padding:12px;background:#0b1710;border-radius:8px}.speech-settings label{display:flex;align-items:center;gap:10px;color:#b5cabb;font-size:.9em}.speech-settings select{min-width:220px;padding:6px;background:#07100b;color:#fff;border:1px solid #4d8b63;border-radius:6px}.speech-settings input[type="range"]{flex:1}.speech-row{display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin-top:12px}.speech-row button{margin-top:0}.speech-status,.speech-settings-status{color:#b5cabb;font-size:.9em}.result{margin-top:20px;padding:16px;background:#07100b;border-radius:8px;min-height:4em}
  .source{margin-top:12px;padding:14px;border-left:3px solid #83d698;background:#0b1710}.path,.muted{font-size:.9em;color:#9eb2a4}.excerpt{white-space:pre-wrap;color:#eff9f1}
</style>
<main class="shell">
  <span class="badge">READ ONLY — Mind Vault Search</span>
  <h1>Veridan Command Desk</h1>
  <p>Read-only, source-backed Mind Vault search. Screen access, automation, trading, and write actions are not exposed here.</p>
  <p class="muted">Voice input uses browser transcription. Audio is not sent to Veridan Core; any browser speech provider behavior is controlled by the browser.</p>
  <p class="muted">Voice output uses browser speech synthesis. Audio is generated by the browser and is not stored by Veridan.</p>
  <textarea id="command" aria-label="Veridan command" placeholder="What did we decide about zero cross?"></textarea>
  <div class="voice-row">
    <button id="voice" type="button" aria-pressed="false">🎙 Start voice input</button>
    <label class="auto-submit"><input id="auto-submit" type="checkbox"> Submit automatically after final transcription</label>
    <span id="voice-status" class="voice-status" data-state="stopped" role="status">Voice input stopped.</span>
  </div>
  <label class="auto-read"><input id="auto-read" type="checkbox"> Read answers aloud automatically</label>
  <label class="response-style">Response style <select id="response-style" aria-label="Response style"><option value="direct" selected>Direct</option><option value="assistant">Assistant</option></select></label>
  <p class="muted">Assistant style changes presentation only; source citations and read-only safeguards remain unchanged.</p>
  <div class="speech-settings">
    <label>Voice <select id="voice-select" aria-label="Speech voice"></select></label>
    <label>Rate <input id="voice-rate" type="range" min="0.5" max="2" step="0.1" value="0.9"><output id="voice-rate-value">0.9</output></label>
    <label>Pitch <input id="voice-pitch" type="range" min="0.5" max="2" step="0.1" value="0.9"><output id="voice-pitch-value">0.9</output></label>
    <label>Volume <input id="voice-volume" type="range" min="0" max="1" step="0.1" value="1"><output id="voice-volume-value">1.0</output></label>
    <span class="muted">For a smoother assistant voice, choose an English UK system voice and lower the rate slightly.</span>
    <span id="speech-settings-status" class="speech-settings-status" role="status"></span>
  </div>
  <button id="send" type="button">Search Mind Vault</button>
  <section id="result" class="result" aria-live="polite">Ready.</section>
  <p class="muted">This desk is available only on this Windows computer at 127.0.0.1.</p>
</main>
<script>
  const q = (selector) => document.querySelector(selector);
  const command = q('#command');
  const out = q('#result');
  const voiceButton = q('#voice');
  const voiceStatus = q('#voice-status');
  const autoSubmit = q('#auto-submit');
  const autoRead = q('#auto-read');
  const responseStyle = q('#response-style');
  const voiceSelect = q('#voice-select');
  const voiceRate = q('#voice-rate');
  const voicePitch = q('#voice-pitch');
  const voiceVolume = q('#voice-volume');
  const voiceRateValue = q('#voice-rate-value');
  const voicePitchValue = q('#voice-pitch-value');
  const voiceVolumeValue = q('#voice-volume-value');
  const speechSettingsStatus = q('#speech-settings-status');
  const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  const speechSupported = 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window;
  const speechSettingsKey = 'veridan-command-desk-speech-settings-v1';
  const responseStyleKey = 'veridan-command-desk-response-style-v1';
  const defaultSpeechSettings = { voiceKey: '', rate: 0.9, pitch: 0.9, volume: 1.0 };
  let speechSettings = loadSpeechSettings();
  let selectedResponseStyle = loadResponseStyle();
  let selectedVoice = null;
  let recognition = null;

  function el(tag, text, cls) {
    const node = document.createElement(tag);
    node.textContent = text || '';
    if (cls) node.className = cls;
    return node;
  }

  function setVoiceState(state, message) {
    voiceStatus.dataset.state = state;
    voiceStatus.textContent = message;
    voiceButton.setAttribute('aria-pressed', state === 'listening' ? 'true' : 'false');
    voiceButton.textContent = state === 'listening' ? '⏹ Stop voice input' : '🎙 Start voice input';
  }

  function loadSpeechSettings() {
    try {
      const saved = JSON.parse(window.localStorage.getItem(speechSettingsKey) || '{}');
      return {
        voiceKey: typeof saved.voiceKey === 'string' ? saved.voiceKey : defaultSpeechSettings.voiceKey,
        rate: Number.isFinite(saved.rate) ? Math.min(2, Math.max(0.5, saved.rate)) : defaultSpeechSettings.rate,
        pitch: Number.isFinite(saved.pitch) ? Math.min(2, Math.max(0.5, saved.pitch)) : defaultSpeechSettings.pitch,
        volume: Number.isFinite(saved.volume) ? Math.min(1, Math.max(0, saved.volume)) : defaultSpeechSettings.volume,
      };
    } catch {
      return { ...defaultSpeechSettings };
    }
  }

  function saveSpeechSettings() {
    try {
      window.localStorage.setItem(speechSettingsKey, JSON.stringify(speechSettings));
    } catch {
      speechSettingsStatus.textContent = 'Voice settings could not be saved in this browser.';
    }
  }

  function loadResponseStyle() {
    try {
      return window.localStorage.getItem(responseStyleKey) === 'assistant' ? 'assistant' : 'direct';
    } catch {
      return 'direct';
    }
  }

  function saveResponseStyle() {
    try {
      window.localStorage.setItem(responseStyleKey, selectedResponseStyle);
    } catch {
      speechSettingsStatus.textContent = 'Response style could not be saved in this browser.';
    }
  }

  function voiceKey(voice) {
    return voice.name + '|' + voice.lang;
  }

  function updateSpeechSettingControls() {
    voiceRate.value = String(speechSettings.rate);
    voicePitch.value = String(speechSettings.pitch);
    voiceVolume.value = String(speechSettings.volume);
    voiceRateValue.value = speechSettings.rate.toFixed(1);
    voicePitchValue.value = speechSettings.pitch.toFixed(1);
    voiceVolumeValue.value = speechSettings.volume.toFixed(1);
  }

  function populateVoices() {
    if (!speechSupported) return;
    const voices = window.speechSynthesis.getVoices().filter((voice) => voice && voice.lang);
    voiceSelect.replaceChildren();
    if (voices.length === 0) {
      voiceSelect.disabled = true;
      speechSettingsStatus.textContent = 'Waiting for browser speech voices…';
      return;
    }
    const savedVoice = voices.find((voice) => voiceKey(voice) === speechSettings.voiceKey);
    const englishUk = voices.find((voice) => voice.lang.toLowerCase() === 'en-gb') || voices.find((voice) => voice.lang.toLowerCase().startsWith('en-gb'));
    const english = voices.find((voice) => voice.lang.toLowerCase().startsWith('en'));
    selectedVoice = savedVoice || englishUk || english || voices[0];
    speechSettings.voiceKey = voiceKey(selectedVoice);
    voices.forEach((voice) => {
      const option = document.createElement('option');
      option.value = voiceKey(voice);
      option.textContent = voice.name + ' (' + voice.lang + ')';
      voiceSelect.append(option);
    });
    voiceSelect.value = speechSettings.voiceKey;
    voiceSelect.disabled = false;
    speechSettingsStatus.textContent = 'Browser voice ready.';
    saveSpeechSettings();
  }

  function speakText(text, status) {
    if (!speechSupported) return;
    cancelSpeech();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.voice = selectedVoice;
    utterance.rate = speechSettings.rate;
    utterance.pitch = speechSettings.pitch;
    utterance.volume = speechSettings.volume;
    if (status) {
      utterance.onstart = () => { status.textContent = 'Speaking answer…'; };
      utterance.onend = () => { status.textContent = 'Answer finished.'; };
      utterance.onerror = () => { status.textContent = 'Voice output could not start.'; };
    }
    window.speechSynthesis.speak(utterance);
  }

  function sourceCard(source, label) {
    const card = el('article', '', 'source');
    card.append(el('h2', label ? label + ': ' + source.title : source.title), el('div', source.path, 'path'), el('p', source.excerpt, 'excerpt'));
    return card;
  }

  function cancelSpeech() {
    if (speechSupported) window.speechSynthesis.cancel();
  }

  function speechControls(answerText) {
    const row = el('div', '', 'speech-row');
    const speak = el('button', '🔊 Speak answer');
    const stop = el('button', '⏹ Stop speaking');
    const status = el('span', speechSupported ? 'Ready to read the visible answer.' : 'Voice output is not supported in this browser.', 'speech-status');
    speak.type = 'button';
    stop.type = 'button';
    if (!speechSupported) {
      speak.disabled = true;
      stop.disabled = true;
    } else {
      speak.addEventListener('click', () => {
        speakText(answerText, status);
      });
      stop.addEventListener('click', () => {
        cancelSpeech();
        status.textContent = 'Voice output stopped.';
      });
    }
    row.append(speak, stop, status);
    return row;
  }

  function render(data) {
    out.replaceChildren();
    if (data.status !== 'completed') {
      const message = selectedResponseStyle === 'assistant'
        ? (data.reason === 'memory_verification_failed' ? 'No verified source found.' : 'That request is outside read-only mode.')
        : 'Request denied';
      out.append(el('strong', message), el('p', data.reason || 'The local gateway could not complete this request.'));
      return;
    }
    const heading = selectedResponseStyle === 'assistant' ? 'I found this in your Mind Vault.' : 'Source-backed answer';
    const lead = selectedResponseStyle === 'assistant' ? el('p', 'Source-backed answer below.', 'muted') : null;
    out.append(el('h2', heading), ...(lead ? [lead] : []), sourceCard({ title: data.answer.source.title, path: data.answer.source.path, excerpt: data.answer.text }, 'Top source'), el('p', 'Verified: sources cited, source paths scoped, read-only retrieval.', 'muted'), speechControls(data.answer.text));
    if (speechSupported && autoRead.checked) {
      speakText(data.answer.text, null);
    }
    if (data.sources.length > 1) {
      out.append(el('h2', 'Related sources'));
      data.sources.slice(1).forEach((source) => out.append(sourceCard(source, '')));
    }
  }

  async function submitCommand() {
    cancelSpeech();
    const text = command.value.trim();
    if (!text) {
      out.textContent = 'Enter a question first.';
      return;
    }
    out.textContent = 'Searching Mind Vault…';
    try {
      const response = await fetch('/v1/commands', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ command: text }) });
      render(await response.json());
    } catch {
      out.textContent = 'The local Command Gateway is unavailable.';
    }
  }

  q('#send').addEventListener('click', submitCommand);

  updateSpeechSettingControls();
  responseStyle.value = selectedResponseStyle;
  responseStyle.addEventListener('change', () => {
    selectedResponseStyle = responseStyle.value === 'assistant' ? 'assistant' : 'direct';
    responseStyle.value = selectedResponseStyle;
    saveResponseStyle();
  });
  if (!speechSupported) {
    autoRead.disabled = true;
    voiceSelect.disabled = true;
    voiceRate.disabled = true;
    voicePitch.disabled = true;
    voiceVolume.disabled = true;
    speechSettingsStatus.textContent = 'Voice output is not supported in this browser.';
  } else {
    populateVoices();
    window.speechSynthesis.addEventListener('voiceschanged', populateVoices);
    voiceSelect.addEventListener('change', () => {
      speechSettings.voiceKey = voiceSelect.value;
      selectedVoice = window.speechSynthesis.getVoices().find((voice) => voiceKey(voice) === speechSettings.voiceKey) || selectedVoice;
      saveSpeechSettings();
    });
    [[voiceRate, 'rate', voiceRateValue], [voicePitch, 'pitch', voicePitchValue], [voiceVolume, 'volume', voiceVolumeValue]].forEach(([input, key, output]) => {
      input.addEventListener('input', () => {
        speechSettings[key] = Number(input.value);
        output.value = Number(input.value).toFixed(1);
        saveSpeechSettings();
      });
    });
  }

  if (!Recognition) {
    voiceButton.disabled = true;
    setVoiceState('error', 'Voice input is not supported in this browser.');
  } else {
    recognition = new Recognition();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = navigator.language || 'en-US';
    recognition.onstart = () => setVoiceState('listening', 'Listening…');
    recognition.onresult = (event) => {
      let transcript = '';
      let finalResult = false;
      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        transcript += event.results[index][0].transcript;
        finalResult = finalResult || event.results[index].isFinal;
      }
      if (transcript.trim()) command.value = transcript.trim();
      if (finalResult && autoSubmit.checked) submitCommand();
    };
    recognition.onerror = (event) => setVoiceState('error', 'Voice input error: ' + event.error + '.');
    recognition.onend = () => setVoiceState('stopped', 'Voice input stopped. Review the text before searching.');
    voiceButton.addEventListener('click', () => {
      if (voiceStatus.dataset.state === 'listening') {
        recognition.stop();
        return;
      }
      try {
        recognition.start();
      } catch {
        setVoiceState('error', 'Voice input could not start.');
      }
    });
  }
</script>
</html>`;
}
