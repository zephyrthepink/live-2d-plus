/* global SillyTavern */
// ---------------------------------------------------------------------------
// Speech-to-Text pipeline
//
// Intercepts the audio produced by SillyTavern's TTS, feeds it through
// Vosk Browser, and logs word-level timestamps to the console. These
// timestamps are the raw material for Live2D lip-sync.
//
// The Vosk model must be loaded MANUALLY by the user (via the settings UI)
// before any transcription happens — loading a model is expensive and we never
// want to trigger it implicitly from an incoming TTS event.
// ---------------------------------------------------------------------------
import { EXTENSION_WEB_PATH } from './paths';
import { createTextAlignment } from './textAlignment';
import { analyzeDynamicText, createNeutralDynamicSegments } from './dynamicAnalysis';

const MODULE = 'Live2D+ STT';

// Served path of the bundled default model (see models/ folder + README).
export const DEFAULT_VOSK_MODEL_URL =
    `${EXTENSION_WEB_PATH}/models/vosk-model-small-en-us-0.15.tar.gz`;

// Vosk internal log verbosity (-1 silences its own console spam).
const VOSK_LOG_LEVEL = -1;
const CHUNK_SECONDS = 0.25;
const FINAL_RESULT_TIMEOUT_MS = 15000;
const FINAL_RESULT_SETTLE_MS = 250;
const URL_REVOKE_FALLBACK_MS = 120000;

// ---------------------------------------------------------------------------
// Model state (manual load required)
// ---------------------------------------------------------------------------

// state: 'idle' | 'loading' | 'ready' | 'error'
let modelState = { state: 'idle', message: '', modelUrl: '' };
let loadedModel = null;
let loadPromise = null;
const stateListeners = new Set();

function setModelState(next) {
    modelState = { ...modelState, ...next };
    for (const listener of stateListeners) {
        try { listener(modelState); } catch { /* noop */ }
    }
}

export function getSttModelState() {
    return modelState;
}

export function subscribeSttModelState(listener) {
    if (typeof listener !== 'function') return () => {};
    stateListeners.add(listener);
    listener(modelState);
    return () => stateListeners.delete(listener);
}

export function isSttModelReady() {
    return modelState.state === 'ready' && !!loadedModel;
}

/**
 * Convert user-provided model locations into a fetchable SillyTavern URL.
 * Handles empty input, Android document/content URIs, double-encoded paths,
 * and local filesystem paths under SillyTavern's extensions folder.
 * @param {string} modelUrl
 */
function normalizeModelUrl(modelUrl) {
    let url = typeof modelUrl === 'string' ? modelUrl.trim() : '';
    if (!url) return DEFAULT_VOSK_MODEL_URL;

    // Decode over-encoded URI components, e.g. %252F -> %2F -> /
    while (url.includes('%25')) {
        const decoded = decodeURIComponent(url);
        if (decoded === url) break;
        url = decoded;
    }

    // Strip Android Storage Access Framework wrappers.
    if (url.startsWith('document://')) {
        url = url.slice('document://'.length);
    }
    if (url.startsWith('content://')) {
        // content://com.termux.documents/tree/<encoded-root>?<relative-path>
        const match = url.match(/tree\/(.+?)(?:\?|$)(.*)/);
        if (match) {
            url = `/${match[1].replace(/^\/+/, '')}${match[2] || ''}`;
        }
    }

    // If the user pasted a local filesystem path inside SillyTavern's
    // extensions folder, convert it to the web-served path.
    const localMatch = url.match(/\/extensions\/([^/]+)\/models\/([^/]+\.tar\.gz)$/i);
    if (localMatch) {
        return `/scripts/extensions/third-party/${localMatch[1]}/models/${localMatch[2]}`;
    }

    // Non-HTTP relative paths should be absolute so fetch() resolves them
    // against the site origin instead of the current page.
    if (!url.match(/^https?:\/\//i) && !url.startsWith('/')) {
        url = `/${url}`;
    }

    return url;
}

/**
 * Manually load (or reload) a Vosk model before transcribing TTS audio.
 * @param {string} modelUrl
 */
export async function loadSttModel(modelUrl) {
    const url = normalizeModelUrl(modelUrl);

    // Deduplicate concurrent load requests.
    if (loadPromise) return loadPromise;

    loadPromise = (async () => {
        setModelState({ state: 'loading', message: `Loading model from ${url}…`, modelUrl: url });

        // Free any previously loaded model before swapping.
        if (loadedModel) {
            try { loadedModel.terminate?.(); } catch { /* noop */ }
            loadedModel = null;
        }

        try {
            const Vosk = await import(/* webpackChunkName: "vosk" */ 'vosk-browser');
            const model = await Vosk.createModel(url, VOSK_LOG_LEVEL);
            loadedModel = model;
            setModelState({ state: 'ready', message: `Model ready — ${url}`, modelUrl: url });
        } catch (error) {
            loadedModel = null;
            let message = error?.message || 'Failed to load Vosk model.';
            if (message.toLowerCase().includes('fetch') || /^(document|content):/i.test(modelUrl)) {
                message = `${message}. Make sure the URL is a path SillyTavern can serve, e.g. ${DEFAULT_VOSK_MODEL_URL}`;
            }
            setModelState({ state: 'error', message, modelUrl: url });
            console.error(`[${MODULE}] Failed to load Vosk model from ${url}:`, error);
        } finally {
            loadPromise = null;
        }
    })();

    return loadPromise;
}

// ---------------------------------------------------------------------------
// Audio decoding helpers
// ---------------------------------------------------------------------------

async function decodeAudioBlob(blob) {
    if (typeof window === 'undefined') {
        throw new Error('Vosk STT is only available in the browser.');
    }
    if (!blob || typeof blob.arrayBuffer !== 'function') {
        throw new Error('A browser audio Blob is required for Vosk transcription.');
    }

    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) throw new Error('Web Audio API is not available.');

    const audioContext = new AudioCtx();
    try {
        const arrayBuffer = await blob.arrayBuffer();
        const decoded = await audioContext.decodeAudioData(arrayBuffer.slice(0));

        return decoded;
    } finally {
        try { audioContext.close(); } catch { /* noop */ }
    }
}

function mixAudioBufferToMono(audioBuffer) {
    if (!audioBuffer || audioBuffer.numberOfChannels < 1) {
        throw new Error('Decoded audio does not contain any channels.');
    }
    if (audioBuffer.numberOfChannels === 1) {
        return Float32Array.from(audioBuffer.getChannelData(0));
    }

    const mono = new Float32Array(audioBuffer.length);
    for (let channel = 0; channel < audioBuffer.numberOfChannels; channel += 1) {
        const data = audioBuffer.getChannelData(channel);
        for (let i = 0; i < audioBuffer.length; i += 1) {
            mono[i] += data[i] / audioBuffer.numberOfChannels;
        }
    }
    return mono;
}

function readChunkFrames(sampleRate) {
    return Math.max(1024, Math.round(sampleRate * CHUNK_SECONDS));
}

function yieldToBrowser() {
    return new Promise((resolve) => window.setTimeout(resolve, 0));
}

function normalizeWord(entry) {
    const start = Number(entry?.start);
    const end = Number(entry?.end);
    const conf = Number(entry?.conf);
    const word = typeof entry?.word === 'string' ? entry.word.trim() : '';
    return {
        word,
        start: Number.isFinite(start) ? start : NaN,
        end: Number.isFinite(end) ? end : NaN,
        conf: Number.isFinite(conf) ? conf : null,
    };
}

function normalizeResultMessage(message) {
    const result = message?.result || {};
    let rawWords = [];
    if (Array.isArray(result.result)) {
        rawWords = result.result;
    } else if (Array.isArray(result.words)) {
        rawWords = result.words;
    } else if (Array.isArray(message?.result)) {
        rawWords = message.result;
    }
    const words = rawWords.map(normalizeWord).filter((entry) => entry.word);
    const text = typeof result.text === 'string'
        ? result.text.trim()
        : (typeof message?.text === 'string' ? message.text.trim() : '');
    return { text, words };
}

// ---------------------------------------------------------------------------
// Recognizer result collection
//
// Vosk emits 'result' messages as it flushes segments. After we've pushed all
// audio we call retrieveFinalResult() and wait for Vosk's final 'result' event;
// resolving earlier can remove the recognizer before timestamps are emitted.
// ---------------------------------------------------------------------------

function collectRecognizerResult(recognizer) {
    const resultMessages = [];
    const partialResults = [];
    let resolveFn;
    let rejectFn;
    let timeoutId = 0;
    let settleId = 0;
    let finalRequested = false;

    const promise = new Promise((resolve, reject) => {
        resolveFn = resolve;
        rejectFn = reject;
    });

    const cleanup = () => {
        if (timeoutId) window.clearTimeout(timeoutId);
        if (settleId) window.clearTimeout(settleId);
    };
    const finish = () => {
        cleanup();
        resolveFn({ resultMessages, partialResults });
    };
    const fail = (error) => {
        cleanup();
        rejectFn(error instanceof Error ? error : new Error(String(error)));
    };
    const scheduleSettle = () => {
        if (settleId) window.clearTimeout(settleId);
        settleId = window.setTimeout(finish, FINAL_RESULT_SETTLE_MS);
    };

    recognizer.on('result', (message) => {
        resultMessages.push(message);
        if (finalRequested) scheduleSettle();
    });
    recognizer.on('partialresult', (message) => {
        // Keep a partial transcript as guidance if no final text is emitted.
        partialResults.push(message);
    });
    recognizer.on('error', (message) => {
        console.error(`[${MODULE}] Vosk 'error' event:`, message);
        fail(new Error(message?.error || 'Vosk recognizer returned an error.'));
    });

    timeoutId = window.setTimeout(() => {
        fail(new Error('Timed out waiting for Vosk final result.'));
    }, FINAL_RESULT_TIMEOUT_MS);

    return {
        promise,
        requestFinal() {
            finalRequested = true;

            recognizer.retrieveFinalResult();
        },
    };
}

// ---------------------------------------------------------------------------
// Transcription
// ---------------------------------------------------------------------------

async function transcribeBlob(blob) {
    if (!loadedModel) {
        throw new Error('Vosk model is not loaded. Load a model in the Live2D+ settings first.');
    }

    const audioBuffer = await decodeAudioBlob(blob);
    if (!audioBuffer?.sampleRate || !audioBuffer?.length) {
        throw new Error('Decoded audio is empty.');
    }

    // Pass the decoded audio to Vosk at its native sample rate. Vosk resamples
    // internally and timestamps are more reliable when we let it handle the
    // original buffer instead of pre-resampling with OfflineAudioContext.
    const recognizerSampleRate = audioBuffer.sampleRate;
    const duration = audioBuffer.duration;
    const mono = mixAudioBufferToMono(audioBuffer);

    const recognizer = new loadedModel.KaldiRecognizer(recognizerSampleRate);
    if (typeof recognizer.setWords === 'function') {
        recognizer.setWords(true);
    } else {
        console.warn(`[${MODULE}] Recognizer has no setWords() method; word timestamps will not be available.`);
    }

    const collector = collectRecognizerResult(recognizer);
    const chunkFrames = readChunkFrames(recognizerSampleRate);

    try {
        for (let offset = 0, chunk = 0; offset < mono.length; offset += chunkFrames, chunk += 1) {
            recognizer.acceptWaveformFloat(mono.slice(offset, offset + chunkFrames), recognizerSampleRate);
            // Yield periodically so we don't freeze the UI on long clips.
            if (chunk % 8 === 7) await yieldToBrowser();
        }

        collector.requestFinal();
        const { resultMessages, partialResults } = await collector.promise;

        const normalizedResults = resultMessages.map(normalizeResultMessage);
        const words = normalizedResults.flatMap((result) => result.words);
        let text = normalizedResults
            .map((result) => result.text)
            .filter(Boolean)
            .join(' ')
            .replace(/\s+/g, ' ')
            .trim() || words.map((entry) => entry.word).join(' ');

        // Fallback: if the final result is empty but partial results exist,
        // Vosk recognized something but never flushed a final segment. Use the
        // last partial transcript so the lip-sync pipeline still gets text.
        if (!text && partialResults.length) {
            const lastPartial = partialResults[partialResults.length - 1];
            const partialText = typeof lastPartial?.result?.partial === 'string'
                ? lastPartial.result.partial.trim()
                : '';
            if (partialText) {
                console.warn(`[${MODULE}] Vosk produced no final result; falling back to last partial transcript.`);
                text = partialText;
            }
        }

        if (!words.length && resultMessages.length) {
            console.warn(`[${MODULE}] Vosk returned ${resultMessages.length} result segment(s) but no word timestamps. ` +
                'The audio may contain no recognizable speech, or the model may not support word timestamps.');
        } else if (!words.length && partialResults.length) {
            console.warn(`[${MODULE}] Vosk returned partial results but no word timestamps. ` +
                'The model may not support word timestamps, or the audio format prevented extraction.');
        }

        return {
            text,
            words,
            recognitionSegments: normalizedResults,
            sampleRate: audioBuffer.sampleRate,
            duration,
        };
    } finally {
        try { recognizer.remove(); } catch { /* noop */ }
    }
}

// ---------------------------------------------------------------------------
// TTS audio interception
//
// SillyTavern emits TTS_AUDIO_READY with the raw audio (a Blob, or sometimes a
// plain URL string) BEFORE it plays. We grab it there, transcribe it, and log
// the word timestamps. When Live2D routing and native-playback blocking are
// enabled, the original SillyTavern audio element is muted and completed while
// Live2D's speak() path plays the audible lip-sync audio.
// ---------------------------------------------------------------------------

let pipelineInstalled = false;
let playbackInterceptorInstalled = false;
let shouldBlockNativePlayback = () => false;
let originalAudioPlay = null;
let originalMediaSrcDescriptor = null;
const mutedNativeTtsElements = new WeakSet();
const endedNativeTtsSources = new WeakMap();

function isNativeTtsAudioElement(element) {
    return typeof HTMLAudioElement !== 'undefined'
        && element instanceof HTMLAudioElement
        && element.id === 'tts_audio';
}

function dispatchNativeTtsEnded(element) {
    const source = element.currentSrc || element.src || '';
    if (endedNativeTtsSources.get(element) === source) return;
    endedNativeTtsSources.set(element, source);
    Promise.resolve().then(() => element.dispatchEvent(new Event('ended')));
}

function silenceNativeTtsElement(element, { dispatchEnded = true, pause = true } = {}) {
    if (!isNativeTtsAudioElement(element)) return;

    mutedNativeTtsElements.add(element);
    try { element.muted = true; } catch { /* noop */ }
    try { element.volume = 0; } catch { /* noop */ }
    if (pause && !element.paused) {
        try { element.pause(); } catch { /* noop */ }
    }
    if (dispatchEnded) dispatchNativeTtsEnded(element);
}

function restoreNativeTtsElement(element) {
    if (!isNativeTtsAudioElement(element) || !mutedNativeTtsElements.has(element)) return;
    mutedNativeTtsElements.delete(element);
    endedNativeTtsSources.delete(element);
    try { element.muted = false; } catch { /* noop */ }
    try {
        if (element.volume === 0) element.volume = 1;
    } catch { /* noop */ }
}

function silenceNativeTtsElementIfBlocked(options) {
    if (typeof document === 'undefined' || !shouldBlockNativePlayback()) return;
    silenceNativeTtsElement(document.getElementById('tts_audio'), options);
}

function handleNativeTtsMediaEvent(event) {
    const element = event?.target;
    if (!isNativeTtsAudioElement(element)) return;

    if (shouldBlockNativePlayback()) {
        silenceNativeTtsElement(element, { dispatchEnded: event?.type !== 'volumechange' });
    } else {
        restoreNativeTtsElement(element);
    }
}

function installNativeTtsPlaybackBlocker() {
    if (playbackInterceptorInstalled || typeof HTMLAudioElement === 'undefined') return;
    playbackInterceptorInstalled = true;

    const mediaPrototype = typeof HTMLMediaElement !== 'undefined'
        ? HTMLMediaElement.prototype
        : HTMLAudioElement.prototype;

    originalAudioPlay = mediaPrototype.play;
    mediaPrototype.play = function patchedLive2DPlusPlay() {
        if (isNativeTtsAudioElement(this)) {
            if (!shouldBlockNativePlayback()) {
                restoreNativeTtsElement(this);
                return originalAudioPlay.apply(this, arguments);
            }

            silenceNativeTtsElement(this);
            return Promise.resolve();
        }
        return originalAudioPlay.apply(this, arguments);
    };

    originalMediaSrcDescriptor = Object.getOwnPropertyDescriptor(mediaPrototype, 'src');
    if (originalMediaSrcDescriptor?.get && originalMediaSrcDescriptor?.set && originalMediaSrcDescriptor.configurable) {
        Object.defineProperty(mediaPrototype, 'src', {
            configurable: true,
            enumerable: originalMediaSrcDescriptor.enumerable,
            get() {
                return originalMediaSrcDescriptor.get.call(this);
            },
            set(value) {
                if (isNativeTtsAudioElement(this)) {
                    endedNativeTtsSources.delete(this);
                    if (shouldBlockNativePlayback()) {
                        silenceNativeTtsElement(this, { dispatchEnded: false, pause: false });
                    } else {
                        restoreNativeTtsElement(this);
                    }
                }
                return originalMediaSrcDescriptor.set.call(this, value);
            },
        });
    }

    if (typeof document !== 'undefined') {
        for (const eventName of ['canplay', 'play', 'playing', 'volumechange']) {
            document.addEventListener(eventName, handleNativeTtsMediaEvent, true);
        }
    }
}

async function resolveAudioBlob(audio) {
    if (audio instanceof Blob) return audio;
    if (typeof audio === 'string') {
        const response = await fetch(audio);
        if (!response.ok) {
            throw new Error(`Failed to fetch TTS audio (${response.status}).`);
        }
        return response.blob();
    }
    return null;
}

async function readBlobDuration(blob) {
    try {
        const audioBuffer = await decodeAudioBlob(blob);
        const duration = Number(audioBuffer?.duration);
        return Number.isFinite(duration) && duration > 0 ? duration : 0;
    } catch (error) {
        console.warn(`[${MODULE}] Could not read audio duration for approximate alignment:`, error);
        return 0;
    }
}

function logTimestamps(characterName, text, words, alignment, duration, transcription) {
    const label = characterName ? `"${characterName}"` : 'TTS';
    console.groupCollapsed(`[${MODULE}] ${label} — ${words.length} words (${duration.toFixed(2)}s)`);
    console.log('TTS text:', text);
    console.log('Vosk transcript:', transcription || '');
    if (words.length) {
        console.table(words.map((w) => ({
            word: w.word,
            start: w.start,
            end: w.end,
            conf: w.conf,
        })));
    } else {
        console.warn('No word-level timestamps were produced; using approximate alignment.');
    }
    console.log('Alignment:', alignment);
    console.groupEnd();
}

// Public event for timestamp consumers and Live2D playback.
const TTS_DYNAMIC_TIMESTAMPS_READY_EVENT = 'TTSDynamicTimestampsReady';

function dispatchTimestamps({ characterName, text, transcription, words, wordTimings, captionSegments, alignment, duration, blobUrl, analysis, segments }) {
    if (typeof window === 'undefined') return Promise.resolve(false);
    return new Promise((resolve) => {
        let settled = false;
        let fallbackTimer = 0;
        const settle = (accepted) => {
            if (settled) return;
            settled = true;
            if (fallbackTimer) window.clearTimeout(fallbackTimer);
            resolve(accepted === true);
        };
        const detail = {
            accepted: false,
            provider: MODULE,
            characterName,
            text,
            transcription,
            words,
            wordTimings,
            captionSegments,
            blobUrl,
            timestamps: alignment,
            alignment,
            normalizedAlignment: alignment,
            approximate: alignment?.approximate === true,
            duration,
            segments,
            analysisModel: analysis?.model || null,
            analysisSource: analysis?.source || null,
            analysisTemperature: analysis?.temperature ?? null,
            rawAnalysisText: analysis?.rawResponseText || '',
            parsedAnalysis: analysis?.parsed || null,
            analysisError: analysis?.error || null,
            analysisSkipped: analysis?.skipped === true,
            resolve: () => settle(true),
            reject: (error) => {
                if (error) console.error(`[${MODULE}] Live2D dynamic playback rejected:`, error);
                settle(true);
            },
        };

        try {
            window.dispatchEvent(new CustomEvent(TTS_DYNAMIC_TIMESTAMPS_READY_EVENT, { detail }));
            if (!detail.accepted) settle(false);
            else if (!settled) fallbackTimer = window.setTimeout(() => settle(true), URL_REVOKE_FALLBACK_MS);
        } catch (err) {
            console.error(`[${MODULE}] Failed to dispatch timestamp event:`, err);
            settle(false);
        }
    });
}

/**
 * Install the TTS interception + transcription pipeline. Safe to call once.
 * @param {object} opts
 * @param {() => boolean} opts.isEnabled  Live read of the STT enabled toggle.
 * @param {() => object}  opts.getSettings Live read of all Live2D+ settings.
 */
export function setupSttPipeline({ isEnabled, getSettings } = {}) {
    if (pipelineInstalled) return;
    pipelineInstalled = true;

    installNativeTtsPlaybackBlocker();
    shouldBlockNativePlayback = () => {
        const settings = typeof getSettings === 'function' ? getSettings() : {};
        return settings.enabled === true
            && settings.routeTtsToLive2D === true
            && settings.blockOriginalTtsPlayback === true
            && !!window.live2dPlusModel?.speak;
    };

    const ctx = typeof SillyTavern !== 'undefined' ? SillyTavern.getContext() : null;
    if (!ctx) {
        console.error(`[${MODULE}] SillyTavern context not available; STT disabled.`);
        return;
    }

    const eventSource = ctx.eventSource;
    const eventTypes = ctx.eventTypes || ctx.event_types;
    const readyEvent = eventTypes?.TTS_AUDIO_READY;

    if (!eventSource || !readyEvent) {
        console.error(`[${MODULE}] TTS_AUDIO_READY event is unavailable; STT disabled.`);
        return;
    }

    eventSource.on(readyEvent, async ({ audio, text, characterName } = {}) => {
        const settings = typeof getSettings === 'function' ? getSettings() : {};
        const sttEnabled = typeof isEnabled === 'function' ? isEnabled() : settings.sttEnabled === true;
        const routeToLive2D = settings.enabled === true && settings.routeTtsToLive2D === true;

        if (!sttEnabled && !routeToLive2D) {
            return;
        }

        if (routeToLive2D) {
            silenceNativeTtsElementIfBlocked({ dispatchEnded: false, pause: false });
        }

        let blobUrl = '';
        try {
            const blob = await resolveAudioBlob(audio);
            if (!blob) {
                console.warn(`[${MODULE}] Unrecognized TTS audio type:`, typeof audio);
                return;
            }

            blobUrl = URL.createObjectURL(blob);
            let result = null;
            if (sttEnabled && isSttModelReady()) {
                try {
                    result = await transcribeBlob(blob);
                } catch (error) {
                    console.warn(`[${MODULE}] Vosk transcription failed; using the original TTS text with estimated timing:`, error);
                }
            } else if (sttEnabled) {
                console.warn(`[${MODULE}] No Vosk model is loaded; using estimated caption timing.`);
            }
            if (!result) {
                result = { text: '', words: [], recognitionSegments: [], duration: await readBlobDuration(blob) };
            }

            // SillyTavern's event carries the exact text passed to generateTts().
            // A missing original must never expose guessed recognition as captions.
            const finalText = typeof text === 'string' ? text : '';
            const { alignment, captionSegments, wordTimings } = createTextAlignment(
                finalText, result.words, result.duration, result.recognitionSegments,
            );
            const analysis = settings.dynamicMode === true
                ? await analyzeDynamicText(finalText, settings)
                : { segments: createNeutralDynamicSegments(finalText, settings), skipped: true };
            const segments = Array.isArray(analysis?.segments) && analysis.segments.length
                ? analysis.segments
                : createNeutralDynamicSegments(finalText, settings);

            logTimestamps(characterName, finalText, result.words, alignment, result.duration, result.text);
            const accepted = await dispatchTimestamps({
                characterName,
                text: finalText,
                transcription: result.text,
                words: result.words,
                wordTimings,
                captionSegments,
                alignment,
                duration: result.duration,
                blobUrl,
                analysis,
                segments,
            });
            if (!accepted && blobUrl) {
                URL.revokeObjectURL(blobUrl);
                blobUrl = '';
            }
        } catch (error) {
            console.error(`[${MODULE}] Failed to transcribe TTS audio:`, error);
            if (blobUrl) URL.revokeObjectURL(blobUrl);
        }
    });
}
