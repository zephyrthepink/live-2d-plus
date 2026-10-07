import { getSillyTavernContext, readConnectionProfiles } from './integrations';

const ANALYSIS_TEMPERATURE = 0.8;
const ANALYSIS_MAX_TOKENS = 1800;

export const DEFAULT_ANALYSIS_MODEL = 'gpt-4o-mini';

export const ANALYSIS_SOURCES = Object.freeze({
    OPENAI: 'openai-compatible',
    CONNECTION_PROFILE: 'connection-profile',
    SILLYTAVERN_CLASSIFIER: 'sillytavern-classifier',
});

export const BUILTIN_CLASSIFIER_EMOTION_LABELS = Object.freeze([
    'admiration',
    'amusement',
    'anger',
    'annoyance',
    'approval',
    'caring',
    'confusion',
    'curiosity',
    'desire',
    'disappointment',
    'disapproval',
    'disgust',
    'embarrassment',
    'excitement',
    'fear',
    'gratitude',
    'grief',
    'joy',
    'love',
    'nervousness',
    'optimism',
    'pride',
    'realization',
    'relief',
    'remorse',
    'sadness',
    'surprise',
    'neutral',
]);

export const DEFAULT_EMOTION_LABELS = Object.freeze([
    'Admiration',
    'Amusement',
    'Anger',
    'Annoyance',
    'Approval',
    'Caring',
    'Confusion',
    'Curiosity',
    'Desire',
    'Disappointment',
    'Disapproval',
    'Disgust',
    'Embarrassment',
    'Excitement',
    'Fear',
    'Gratitude',
    'Joy',
    'Love',
    'Nervousness',
    'Neutral',
    'Optimism',
    'Pride',
    'Realization',
    'Relief',
    'Remorse',
    'Sadness',
    'Surprise',
]);

function normalizeText(value) {
    return typeof value === 'string' ? value.trim() : '';
}

function normalizeAnalysisSource(source) {
    const normalized = normalizeText(source).toLowerCase();
    return Object.values(ANALYSIS_SOURCES).includes(normalized)
        ? normalized
        : ANALYSIS_SOURCES.OPENAI;
}

function normalizeUrl(baseUrl) {
    let url = normalizeText(baseUrl).replace(/\/+$/, '');
    if (url.endsWith('/chat/completions')) url = url.slice(0, -'/chat/completions'.length);
    if (url.endsWith('/models')) url = url.slice(0, -'/models'.length);
    return url;
}

function apiUrl(baseUrl, path) {
    const normalized = normalizeUrl(baseUrl);
    if (!normalized) throw new Error('Add an OpenAI-compatible analysis URL first.');
    return `${normalized}${path}`;
}

function authHeaders(apiKey) {
    const key = normalizeText(apiKey);
    return key ? { Authorization: `Bearer ${key}` } : {};
}

function readNeutralEmotion(emotions = []) {
    return emotions.find((emotion) => String(emotion).toLowerCase() === 'neutral') || emotions[0] || 'Neutral';
}

function canonicalEmotionLabel(label, emotions = []) {
    const normalized = normalizeText(label).toLowerCase();
    const matches = new Map(emotions.map((emotion) => [String(emotion).toLowerCase(), emotion]));
    return matches.get(normalized) || readNeutralEmotion(emotions);
}

export function isLlmAnalysisActive(settings = {}) {
    return settings.dynamicMode === true && normalizeAnalysisSource(settings.analysisSource) !== ANALYSIS_SOURCES.SILLYTAVERN_CLASSIFIER;
}

export function getAnalysisEmotionLabels(settings = {}) {
    if (normalizeAnalysisSource(settings.analysisSource) === ANALYSIS_SOURCES.SILLYTAVERN_CLASSIFIER) {
        return BUILTIN_CLASSIFIER_EMOTION_LABELS;
    }
    if (!isLlmAnalysisActive(settings)) return DEFAULT_EMOTION_LABELS;
    const labels = [...DEFAULT_EMOTION_LABELS, ...(Array.isArray(settings.emotionLabels) ? settings.emotionLabels : [])];
    const unique = new Map();
    for (const value of labels) {
        const label = normalizeText(value);
        if (label && !unique.has(label.toLowerCase())) unique.set(label.toLowerCase(), label);
    }
    return [...unique.values()];
}

export function createNeutralDynamicSegments(text, settings = {}) {
    return [{ emotion: readNeutralEmotion(getAnalysisEmotionLabels(settings)), action: null, text: typeof text === 'string' ? text : '' }];
}

function trimToEndSentence(input) {
    if (!input) return '';

    const punctuation = new Set(['.', '!', '?', '*', '"', ')', '}', '`', ']', '$', '。', '！', '？', '”', '）', '】', '’', '」', '_']);
    const characters = Array.from(input);
    let last = -1;

    for (let i = characters.length - 1; i >= 0; i -= 1) {
        const character = characters[i];
        if (!punctuation.has(character)) continue;
        last = i > 0 && /[\s\n]/.test(characters[i - 1]) ? i - 1 : i;
        break;
    }

    return last === -1
        ? input.trimEnd()
        : characters.slice(0, last + 1).join('').trimEnd();
}

function trimToStartSentence(input) {
    if (!input) return '';

    const positions = ['.', '!', '?', '\n']
        .map((punctuation) => ({ punctuation, index: input.indexOf(punctuation) }))
        .filter(({ index }) => index > 0)
        .sort((left, right) => left.index - right.index);
    const first = positions[0];
    if (!first) return input;
    return input.substring(first.index + (first.punctuation === '\n' ? 1 : 2));
}

function sampleClassifierText(text) {
    if (!text) return text;

    let result = String(text).replace(/[*"]/g, '');
    const sampleThreshold = 500;
    const halfSampleThreshold = sampleThreshold / 2;

    if (text.length < sampleThreshold) {
        result = trimToEndSentence(result);
    } else {
        result = `${trimToEndSentence(result.slice(0, halfSampleThreshold))} ${trimToStartSentence(result.slice(-halfSampleThreshold))}`;
    }

    return result.trim();
}

function readSillyTavernContext() {
    return typeof globalThis !== 'undefined' && typeof globalThis.SillyTavern?.getContext === 'function'
        ? globalThis.SillyTavern.getContext()
        : null;
}

function readSillyTavernRequestHeaders(options) {
    const context = readSillyTavernContext();
    if (typeof context?.getRequestHeaders === 'function') return context.getRequestHeaders(options);
    return options?.omitContentType ? {} : { 'Content-Type': 'application/json' };
}

function readClassifierLabel(payload) {
    const source = Array.isArray(payload?.classification)
        ? payload.classification
        : Array.isArray(payload)
            ? payload
            : [];
    const first = source[0];
    return normalizeText(first?.label || first?.Label || first?.className || first);
}

function readDynamicActionDescriptions(settings = {}) {
    const actions = Array.isArray(settings.actionMappings) ? settings.actionMappings : [];
    return actions
        .map((action) => normalizeText(action?.description))
        .filter(Boolean);
}

function buildAnalysisPrompt({ text, emotions, actions }) {
    const actionsText = actions.length > 0
        ? actions.map((action) => `- ${action}`).join('\n')
        : '- null';

    return `You are a strict JSON text segment analyzer for a Live2D character.

Return JSON only. The response must be an array of objects with exactly these keys:
emotion, action, text.

Rules:
- Preserve every character from the input text exactly.
- The concatenation of every returned text field must equal the input text exactly.
- Split only when the emotion meaningfully changes or a configured action occurs.
- Merge adjacent segments when they share the same emotion and action.
- Use one emotion from the configured emotion list.
- Use one action from the configured action list, or null.
- If no action applies, action must be null.

Configured emotions:
${emotions.map((emotion) => `- ${emotion}`).join('\n')}

Configured actions:
${actionsText}

Input text as a JSON string:
${JSON.stringify(text)}`;
}

function parseJsonResponseText(text) {
    const raw = typeof text === 'string' ? text.trim() : '';
    if (!raw) throw new Error('Analysis returned an empty response.');

    const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
    const source = fenced ? fenced[1].trim() : raw;

    try {
        return JSON.parse(source);
    } catch {
        const start = source.indexOf('[');
        const end = source.lastIndexOf(']');
        if (start >= 0 && end > start) return JSON.parse(source.slice(start, end + 1));
        const objectStart = source.indexOf('{');
        const objectEnd = source.lastIndexOf('}');
        if (objectStart >= 0 && objectEnd > objectStart) return JSON.parse(source.slice(objectStart, objectEnd + 1));
        throw new Error('Analysis did not return valid JSON.');
    }
}

function normalizeAnalysisSegments(raw, originalText, emotions = [], actions = []) {
    const rawSegments = Array.isArray(raw) ? raw : Array.isArray(raw?.segments) ? raw.segments : [];
    if (!rawSegments.length) return [{ emotion: readNeutralEmotion(emotions), action: null, text: originalText }];

    const emotionKeys = new Map(emotions.map((emotion) => [String(emotion).toLowerCase(), emotion]));
    const actionKeys = new Map(actions.map((action) => [String(action).toLowerCase(), action]));
    const segments = rawSegments.map((segment) => {
        const rawEmotion = normalizeText(segment?.emotion);
        const emotion = emotionKeys.get(rawEmotion.toLowerCase()) || readNeutralEmotion(emotions);
        const rawAction = normalizeText(segment?.action);
        const action = rawAction && rawAction.toLowerCase() !== 'null'
            ? actionKeys.get(rawAction.toLowerCase()) || null
            : null;
        return {
            emotion,
            action,
            text: typeof segment?.text === 'string' ? segment.text : '',
        };
    });

    const reconstructed = segments.map((segment) => segment.text).join('');
    if (reconstructed !== originalText) {
        console.warn('[Live2D Dynamic] Analysis text did not reconstruct exactly; using neutral fallback.', {
            originalText,
            reconstructed,
            segments,
        });
        return [{ emotion: readNeutralEmotion(emotions), action: null, text: originalText }];
    }

    return segments.reduce((merged, segment) => {
        if (!segment.text) return merged;
        const previous = merged[merged.length - 1];
        if (previous && previous.emotion === segment.emotion && previous.action === segment.action) {
            previous.text += segment.text;
            return merged;
        }
        merged.push({ ...segment });
        return merged;
    }, []);
}

function readCompletionText(payload) {
    const choice = Array.isArray(payload?.choices) ? payload.choices[0] : null;
    const content = choice?.message?.content ?? choice?.text ?? '';
    if (Array.isArray(content)) {
        return content.map((part) => part?.text || part?.content || '').join('');
    }
    return typeof content === 'string' ? content : '';
}

export async function fetchOpenAiModels({ baseUrl, apiKey } = {}) {
    const response = await fetch(apiUrl(baseUrl, '/models'), {
        method: 'GET',
        headers: {
            Accept: 'application/json',
            ...authHeaders(apiKey),
        },
    });
    if (!response.ok) throw new Error(`Failed to fetch models (${response.status}).`);
    const payload = await response.json();
    const source = Array.isArray(payload?.data) ? payload.data : Array.isArray(payload?.models) ? payload.models : [];
    return source
        .map((model) => {
            const id = normalizeText(model?.id || model?.name || model);
            return id ? { id, name: normalizeText(model?.name) || id } : null;
        })
        .filter(Boolean);
}

async function analyzeWithSillyTavernClassifier(sourceText) {
    const emotions = BUILTIN_CLASSIFIER_EMOTION_LABELS;

    if (!sourceText.trim()) {
        return { segments: [{ emotion: readNeutralEmotion(emotions), action: null, text: sourceText }], skipped: true };
    }

    const classifierText = sampleClassifierText(sourceText);

    try {
        const response = await fetch('/api/extra/classify', {
            method: 'POST',
            headers: readSillyTavernRequestHeaders(),
            body: JSON.stringify({ text: classifierText }),
        });
        if (!response.ok) throw new Error(`SillyTavern classifier request failed (${response.status}).`);
        const payload = await response.json();
        const rawLabel = readClassifierLabel(payload);
        const emotion = canonicalEmotionLabel(rawLabel, emotions);
        const segments = [{ emotion, action: null, text: sourceText }];

        return {
            model: 'sillytavern-classifier',
            source: { type: ANALYSIS_SOURCES.SILLYTAVERN_CLASSIFIER, endpoint: '/api/extra/classify' },
            rawResponseText: rawLabel,
            parsed: payload,
            segments,
        };
    } catch (error) {
        console.warn('[Live2D Dynamic] SillyTavern classifier failed; using neutral fallback:', error?.message || error);
        return {
            model: 'sillytavern-classifier',
            source: { type: ANALYSIS_SOURCES.SILLYTAVERN_CLASSIFIER, endpoint: '/api/extra/classify' },
            error: error?.message || 'classifier_failed',
            segments: [{ emotion: readNeutralEmotion(emotions), action: null, text: sourceText }],
        };
    }
}

export async function analyzeDynamicText(text, settings = {}) {
    const sourceText = typeof text === 'string' ? text : '';
    const analysisSource = normalizeAnalysisSource(settings.analysisSource);
    if (settings.dynamicMode !== true) {
        return { segments: createNeutralDynamicSegments(sourceText, settings), skipped: true };
    }

    if (analysisSource === ANALYSIS_SOURCES.SILLYTAVERN_CLASSIFIER) {
        return analyzeWithSillyTavernClassifier(sourceText);
    }

    const emotions = getAnalysisEmotionLabels(settings);
    const actions = readDynamicActionDescriptions(settings);
    const useProfile = analysisSource === ANALYSIS_SOURCES.CONNECTION_PROFILE;
    const profile = useProfile ? readConnectionProfiles().find((item) => item.id === settings.analysisProfileId) : null;
    const model = useProfile ? profile?.model || '' : normalizeText(settings.analysisModel) || DEFAULT_ANALYSIS_MODEL;
    const prompt = buildAnalysisPrompt({ text: sourceText, emotions, actions });

    if (!sourceText.trim()) {
        return { segments: [{ emotion: readNeutralEmotion(emotions), action: null, text: sourceText }], skipped: true };
    }

    if (!useProfile && !normalizeText(settings.analysisBaseUrl)) {
        console.warn('[Live2D Dynamic] No analysis URL configured; using neutral fallback.');
        return { segments: [{ emotion: readNeutralEmotion(emotions), action: null, text: sourceText }], skipped: true };
    }

    try {
        let rawResponseText;
        if (useProfile) {
            if (!profile) throw new Error('Select an available Connection Profile for analysis.');
            const service = getSillyTavernContext()?.ConnectionManagerRequestService;
            const result = await service.sendRequest(profile.id, prompt, ANALYSIS_MAX_TOKENS, {
                stream: false,
                extractData: true,
                includePreset: true,
                includeInstruct: true,
            });
            rawResponseText = typeof result === 'string' ? result : result?.content || '';
        } else {
            const response = await fetch(apiUrl(settings.analysisBaseUrl, '/chat/completions'), {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Accept: 'application/json',
                    ...authHeaders(settings.analysisApiKey),
                },
                body: JSON.stringify({
                    model,
                    messages: [{ role: 'user', content: prompt }],
                    temperature: ANALYSIS_TEMPERATURE,
                    max_tokens: ANALYSIS_MAX_TOKENS,
                    stream: false,
                }),
            });
            if (!response.ok) throw new Error(`Analysis request failed (${response.status}).`);
            const payload = await response.json();
            rawResponseText = readCompletionText(payload);
        }
        const parsed = parseJsonResponseText(rawResponseText);
        const segments = normalizeAnalysisSegments(parsed, sourceText, emotions, actions);

        return {
            model,
            temperature: useProfile ? undefined : ANALYSIS_TEMPERATURE,
            source: useProfile
                ? { type: ANALYSIS_SOURCES.CONNECTION_PROFILE, profileId: settings.analysisProfileId }
                : { type: ANALYSIS_SOURCES.OPENAI, baseUrl: normalizeUrl(settings.analysisBaseUrl) },
            rawResponseText,
            parsed,
            segments,
        };
    } catch (error) {
        console.warn('[Live2D Dynamic] Analysis failed; using neutral fallback:', error?.message || error);
        return {
            model,
            temperature: useProfile ? undefined : ANALYSIS_TEMPERATURE,
            source: useProfile
                ? { type: ANALYSIS_SOURCES.CONNECTION_PROFILE, profileId: settings.analysisProfileId }
                : { type: ANALYSIS_SOURCES.OPENAI, baseUrl: normalizeUrl(settings.analysisBaseUrl) },
            error: error?.message || 'analysis_failed',
            segments: [{ emotion: readNeutralEmotion(emotions), action: null, text: sourceText }],
        };
    }
}