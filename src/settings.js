// ---------------------------------------------------------------------------
// Extension settings: defaults, normalization, helpers
// ---------------------------------------------------------------------------

import { ANALYSIS_SOURCES, DEFAULT_ANALYSIS_MODEL, DEFAULT_EMOTION_LABELS } from './dynamicAnalysis';

export { ANALYSIS_SOURCES, BUILTIN_CLASSIFIER_EMOTION_LABELS } from './dynamicAnalysis';

export const SETTINGS_KEY = 'live2dplus';

export const DEFAULT_MODEL_URL =
    'https://cdn.jsdelivr.net/gh/guansss/pixi-live2d-display/test/assets/shizuku/shizuku.model.json';

export const MODEL_SOURCES = Object.freeze({
    DEFAULT: 'default',
    URL: 'url',
    LOCAL: 'local',
});

export const DEFAULT_FILTERS = Object.freeze({
    outline: false,
    pixelate: false,
    crt: false,
    noise: false,
    alpha: false,
});

export const DEFAULT_FILTER_PARAMS = Object.freeze({
    outline: { thickness: 2, color: '#805ad5' },
    pixelate: { size: 5 },
    crt: { curvature: 3, lineWidth: 3, lineContrast: 0.2, vignetting: 0.3, vignettingAlpha: 0.8, noise: 0.1 },
    noise: { noise: 0.2 },
    alpha: { alpha: 0.8 },
});

export const DEFAULT_PRIORITY_LIST = Object.freeze([
    { priority: 4, type: 'action', target: 'motion', label: 'Action Motions' },
    { priority: 3, type: 'emotion', target: 'expression', label: 'Emotion Expressions' },
    { priority: 2, type: 'emotion', target: 'motion', label: 'Emotion Motions' },
    { priority: 1, type: 'action', target: 'expression', label: 'Action Expressions' },
]);

export const DEFAULT_DISABLE_SETTINGS = Object.freeze({
    emotionMotions: false,
    emotionExpressions: false,
    actionMotions: false,
    actionExpressions: false,
});

export const DEFAULT_TAP_INTERACTION_MAPPING = Object.freeze({
    motion: '',
    expression: '',
    message: '',
});

export const DEFAULT_TAP_INTERACTIONS = Object.freeze({
    enabled: true,
    allowSpamClick: false,
    autoSend: false,
    defaultMapping: DEFAULT_TAP_INTERACTION_MAPPING,
    hitAreaMappings: {},
});

export const CAPTION_STYLE_OPTIONS = Object.freeze([
    { value: 'cinematic', label: 'Cinematic Glow' },
    { value: 'arcade', label: 'Arcade Outline' },
    { value: 'soft', label: 'Soft Whisper' },
]);

export const DEFAULT_CAPTION_SETTINGS = Object.freeze({
    enabled: false,
    textColor: '#fff2dc',
    fillColor: '#ff9b71',
    shadowColor: '#1c0f1f',
    fontSize: 38,
    fontWeight: 700,
    letterSpacing: 0.01,
    lineHeight: 1.08,
    bottomOffset: 26,
    maxWidth: 78,
    style: 'cinematic',
});

const VALID_CAPTION_STYLES = new Set(CAPTION_STYLE_OPTIONS.map((option) => option.value));

export const DEFAULT_SETTINGS = Object.freeze({
    enabled: false,
    followCursor: true,
    draggable: true,
    enableHitTesting: true,
    sttEnabled: false,
    routeTtsToLive2D: true,
    blockOriginalTtsPlayback: true,
    dynamicMode: false,
    reloadModelAfterPlayback: true,
    tapInteractions: DEFAULT_TAP_INTERACTIONS,
    voskModelUrl: '',
    analysisSource: ANALYSIS_SOURCES.OPENAI,
    analysisBaseUrl: '',
    analysisApiKey: '',
    analysisModel: DEFAULT_ANALYSIS_MODEL,
    analysisProfileId: '',
    emotionLabels: DEFAULT_EMOTION_LABELS,
    emotionMappings: {},
    actionMappings: [],
    priorityList: DEFAULT_PRIORITY_LIST,
    disableSettings: DEFAULT_DISABLE_SETTINGS,
    captions: DEFAULT_CAPTION_SETTINGS,
    modelSource: MODEL_SOURCES.DEFAULT,
    customModelUrl: '',
    localModelPath: '',
    canvasWidth: 900,
    canvasHeight: 900,
    scale: 0.75,
    positionX: 75,
    positionY: 65,
    modelPositionX: 50,
    modelPositionY: 100,
    zIndex: 35,
    reloadKey: 0,
    filters: DEFAULT_FILTERS,
    filterParams: DEFAULT_FILTER_PARAMS,
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function clamp(value, min, max, fallback) {
    const n = Number(value);
    if (!Number.isFinite(n)) return fallback;
    return Math.min(Math.max(n, min), max);
}

function bool(value, fallback = false) {
    return typeof value === 'boolean' ? value : fallback;
}

function text(value) {
    return typeof value === 'string' ? value.trim() : '';
}

function normalizeColor(value, fallback) {
    const color = text(value);
    return /^#[0-9a-f]{6}$/i.test(color) ? color : fallback;
}

function normalizeLabelList(values, fallback = []) {
    const list = Array.isArray(values) ? values : fallback;
    const seen = new Set();
    const labels = [];
    for (const value of list) {
        const label = text(value);
        const key = label.toLowerCase();
        if (!label || seen.has(key)) continue;
        seen.add(key);
        labels.push(label);
    }
    return labels.length ? labels : [...fallback];
}

const VALID_ANALYSIS_SOURCES = new Set(Object.values(ANALYSIS_SOURCES));

function normalizeAnalysisSource(value) {
    const source = text(value).toLowerCase();
    return VALID_ANALYSIS_SOURCES.has(source) ? source : ANALYSIS_SOURCES.OPENAI;
}

function normalizeMappingEntry(value) {
    if (typeof value === 'string') return { motion: text(value), expression: '' };
    const source = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
    return {
        motion: text(source.motion),
        expression: text(source.expression),
    };
}

function normalizeEmotionMappings(source = {}) {
    const mappings = source && typeof source === 'object' && !Array.isArray(source) ? source : {};
    const normalized = {};
    for (const [rawKey, rawEntry] of Object.entries(mappings)) {
        const key = text(rawKey);
        if (!key) continue;
        const entry = normalizeMappingEntry(rawEntry);
        if (entry.motion || entry.expression) normalized[key] = entry;
    }
    return normalized;
}

function normalizeActionMappings(source = []) {
    const actions = Array.isArray(source) ? source : [];
    return actions.map((action, index) => {
        const entry = action && typeof action === 'object' && !Array.isArray(action) ? action : {};
        return {
            id: text(entry.id) || `action-${index + 1}`,
            description: text(entry.description),
            motion: text(entry.motion),
            expression: text(entry.expression),
        };
    });
}

function normalizePriorityList(source = []) {
    const defaultsByKey = new Map(DEFAULT_PRIORITY_LIST.map((item) => [`${item.type}:${item.target}`, item]));
    const input = Array.isArray(source) ? source : [];
    const ordered = [];
    const seen = new Set();

    input
        .filter((item) => item && typeof item === 'object' && !Array.isArray(item))
        .slice()
        .sort((left, right) => Number(right.priority || 0) - Number(left.priority || 0))
        .forEach((item) => {
            const type = item.type === 'action' ? 'action' : item.type === 'emotion' ? 'emotion' : '';
            const target = item.target === 'motion' ? 'motion' : item.target === 'expression' ? 'expression' : '';
            const key = `${type}:${target}`;
            const defaults = defaultsByKey.get(key);
            if (!defaults || seen.has(key)) return;
            seen.add(key);
            ordered.push({ ...defaults, label: text(item.label) || defaults.label });
        });

    for (const item of DEFAULT_PRIORITY_LIST) {
        const key = `${item.type}:${item.target}`;
        if (!seen.has(key)) ordered.push({ ...item });
    }

    const count = ordered.length;
    return ordered.map((item, index) => ({ ...item, priority: count - index }));
}

function normalizeDisableSettings(source = {}) {
    const settings = source && typeof source === 'object' && !Array.isArray(source) ? source : {};
    return {
        emotionMotions: bool(settings.emotionMotions, DEFAULT_DISABLE_SETTINGS.emotionMotions),
        emotionExpressions: bool(settings.emotionExpressions, DEFAULT_DISABLE_SETTINGS.emotionExpressions),
        actionMotions: bool(settings.actionMotions, DEFAULT_DISABLE_SETTINGS.actionMotions),
        actionExpressions: bool(settings.actionExpressions, DEFAULT_DISABLE_SETTINGS.actionExpressions),
    };
}

function normalizeTapInteractionMapping(source = {}) {
    const mapping = source && typeof source === 'object' && !Array.isArray(source) ? source : {};
    return {
        motion: text(mapping.motion),
        expression: text(mapping.expression),
        message: text(mapping.message),
    };
}

function tapInteractionMappingHasValue(mapping) {
    return !!(mapping?.motion || mapping?.expression || mapping?.message);
}

function normalizeTapHitAreaMappings(source = {}) {
    const mappings = source && typeof source === 'object' && !Array.isArray(source) ? source : {};
    const normalized = {};

    for (const [rawKey, rawMapping] of Object.entries(mappings)) {
        const key = text(rawKey);
        if (!key) continue;
        const mapping = normalizeTapInteractionMapping(rawMapping);
        if (tapInteractionMappingHasValue(mapping)) normalized[key] = mapping;
    }

    return normalized;
}

function normalizeTapInteractions(source = {}) {
    const interactions = source && typeof source === 'object' && !Array.isArray(source) ? source : {};
    return {
        enabled: bool(interactions.enabled, DEFAULT_TAP_INTERACTIONS.enabled),
        allowSpamClick: bool(interactions.allowSpamClick, DEFAULT_TAP_INTERACTIONS.allowSpamClick),
        autoSend: bool(interactions.autoSend, DEFAULT_TAP_INTERACTIONS.autoSend),
        defaultMapping: normalizeTapInteractionMapping(interactions.defaultMapping),
        hitAreaMappings: normalizeTapHitAreaMappings(interactions.hitAreaMappings),
    };
}

function normalizeCaptionSettings(source = {}) {
    const captions = source && typeof source === 'object' && !Array.isArray(source) ? source : {};
    return {
        enabled: bool(captions.enabled, DEFAULT_CAPTION_SETTINGS.enabled),
        textColor: normalizeColor(captions.textColor, DEFAULT_CAPTION_SETTINGS.textColor),
        fillColor: normalizeColor(captions.fillColor, DEFAULT_CAPTION_SETTINGS.fillColor),
        shadowColor: normalizeColor(captions.shadowColor, DEFAULT_CAPTION_SETTINGS.shadowColor),
        fontSize: Math.round(clamp(captions.fontSize, 18, 96, DEFAULT_CAPTION_SETTINGS.fontSize)),
        fontWeight: Math.round(clamp(captions.fontWeight, 400, 900, DEFAULT_CAPTION_SETTINGS.fontWeight)),
        letterSpacing: clamp(captions.letterSpacing, -0.04, 0.24, DEFAULT_CAPTION_SETTINGS.letterSpacing),
        lineHeight: clamp(captions.lineHeight, 0.8, 1.8, DEFAULT_CAPTION_SETTINGS.lineHeight),
        bottomOffset: Math.round(clamp(captions.bottomOffset, 0, 120, DEFAULT_CAPTION_SETTINGS.bottomOffset)),
        maxWidth: Math.round(clamp(captions.maxWidth, 30, 100, DEFAULT_CAPTION_SETTINGS.maxWidth)),
        style: VALID_CAPTION_STYLES.has(captions.style) ? captions.style : DEFAULT_CAPTION_SETTINGS.style,
    };
}

function normalizeFlatSettings(input = {}) {
    const src = input && typeof input === 'object' ? input : {};
    const analysisSource = normalizeAnalysisSource(src.analysisSource);
    const disableSettings = normalizeDisableSettings(src.disableSettings);
    const filters = src.filters && typeof src.filters === 'object' ? src.filters : {};
    const fp = src.filterParams && typeof src.filterParams === 'object' ? src.filterParams : {};
    const outline = fp.outline || {};
    const pixelate = fp.pixelate || {};
    const crt = fp.crt || {};
    const noise = fp.noise || {};
    const alpha = fp.alpha || {};

    if (analysisSource === ANALYSIS_SOURCES.SILLYTAVERN_CLASSIFIER) {
        disableSettings.actionMotions = true;
        disableSettings.actionExpressions = true;
    }

    return {
        enabled: bool(src.enabled, DEFAULT_SETTINGS.enabled),
        followCursor: bool(src.followCursor, DEFAULT_SETTINGS.followCursor),
        draggable: bool(src.draggable, DEFAULT_SETTINGS.draggable),
        enableHitTesting: bool(src.enableHitTesting, DEFAULT_SETTINGS.enableHitTesting),
        sttEnabled: bool(src.sttEnabled, DEFAULT_SETTINGS.sttEnabled),
        routeTtsToLive2D: true,
        blockOriginalTtsPlayback: true,
        dynamicMode: bool(src.dynamicMode, DEFAULT_SETTINGS.dynamicMode),
        reloadModelAfterPlayback: bool(src.reloadModelAfterPlayback,
            bool(src.resetExpressionAfterPlayback, DEFAULT_SETTINGS.reloadModelAfterPlayback)),
        tapInteractions: normalizeTapInteractions(src.tapInteractions),
        voskModelUrl: typeof src.voskModelUrl === 'string' ? src.voskModelUrl : '',
        analysisSource,
        analysisBaseUrl: text(src.analysisBaseUrl),
        analysisApiKey: typeof src.analysisApiKey === 'string' ? src.analysisApiKey : '',
        analysisModel: text(src.analysisModel) || DEFAULT_ANALYSIS_MODEL,
        analysisProfileId: text(src.analysisProfileId),
        emotionLabels: normalizeLabelList([...DEFAULT_EMOTION_LABELS, ...(Array.isArray(src.emotionLabels) ? src.emotionLabels : [])], DEFAULT_EMOTION_LABELS),
        emotionMappings: normalizeEmotionMappings(src.emotionMappings),
        actionMappings: normalizeActionMappings(src.actionMappings),
        priorityList: normalizePriorityList(src.priorityList),
        disableSettings,
        captions: normalizeCaptionSettings(src.captions),
        modelSource: Object.values(MODEL_SOURCES).includes(src.modelSource)
            ? src.modelSource
            : DEFAULT_SETTINGS.modelSource,
        customModelUrl: typeof src.customModelUrl === 'string' ? src.customModelUrl : '',
        localModelPath: typeof src.localModelPath === 'string' ? src.localModelPath : '',
        canvasWidth: clamp(src.canvasWidth, 100, 3000, DEFAULT_SETTINGS.canvasWidth),
        canvasHeight: clamp(src.canvasHeight, 100, 3000, DEFAULT_SETTINGS.canvasHeight),
        scale: clamp(src.scale, 0.01, 10, DEFAULT_SETTINGS.scale),
        positionX: clamp(src.positionX, 0, 100, DEFAULT_SETTINGS.positionX),
        positionY: clamp(src.positionY, 0, 100, DEFAULT_SETTINGS.positionY),
        modelPositionX: clamp(src.modelPositionX, 0, 100, DEFAULT_SETTINGS.modelPositionX),
        modelPositionY: clamp(src.modelPositionY, 0, 100, DEFAULT_SETTINGS.modelPositionY),
        zIndex: Math.round(clamp(src.zIndex, -9999, 9999, DEFAULT_SETTINGS.zIndex)),
        reloadKey: Number.isInteger(src.reloadKey) ? src.reloadKey : 0,
        filters: {
            outline: bool(filters.outline, false),
            pixelate: bool(filters.pixelate, false),
            crt: bool(filters.crt, false),
            noise: bool(filters.noise, false),
            alpha: bool(filters.alpha, false),
        },
        filterParams: {
            outline: {
                thickness: clamp(outline.thickness, 0, 20, 2),
                color: typeof outline.color === 'string' ? outline.color : '#805ad5',
            },
            pixelate: {
                size: clamp(pixelate.size, 1, 50, 5),
            },
            crt: {
                curvature: clamp(crt.curvature, 0, 10, 3),
                lineWidth: clamp(crt.lineWidth, 0, 10, 3),
                lineContrast: clamp(crt.lineContrast, 0, 1, 0.2),
                vignetting: clamp(crt.vignetting, 0, 1, 0.3),
                vignettingAlpha: clamp(crt.vignettingAlpha, 0, 1, 0.8),
                noise: clamp(crt.noise, 0, 1, 0.1),
            },
            noise: {
                noise: clamp(noise.noise, 0, 1, 0.2),
            },
            alpha: {
                alpha: clamp(alpha.alpha, 0, 1, 0.8),
            },
        },
    };
}

// Everything configurable follows the selected model, except the extension's
// master switch, source selectors, transient reload counter, and profile store.
export const MODEL_SETTING_KEYS = Object.freeze(Object.keys(DEFAULT_SETTINGS).filter((key) =>
    !['enabled', 'modelSource', 'customModelUrl', 'localModelPath', 'reloadKey'].includes(key)));

function modelConfiguration(input) {
    const settings = normalizeFlatSettings(input);
    return Object.fromEntries(MODEL_SETTING_KEYS.map((key) => [key, settings[key]]));
}

function normalizeModelSettings(input) {
    const profiles = input && typeof input === 'object' && !Array.isArray(input) ? input : {};
    return Object.fromEntries(Object.entries(profiles)
        .filter(([key, value]) => /^(default|url|local):/.test(key) && value && typeof value === 'object' && !Array.isArray(value))
        .map(([key, value]) => [key, modelConfiguration(value)]));
}

export function normalizeSettings(input = {}) {
    return { ...normalizeFlatSettings(input), modelSettings: normalizeModelSettings(input?.modelSettings) };
}

export function getModelSettingsKey(settings = {}) {
    if (settings.modelSource === MODEL_SOURCES.DEFAULT || !settings.modelSource) return `default:${DEFAULT_MODEL_URL}`;
    const source = settings.modelSource;
    const value = text(source === MODEL_SOURCES.LOCAL ? settings.localModelPath : settings.customModelUrl);
    if (!value) return null;
    try {
        const url = new URL(value.replace(/\\/g, '/'), 'https://live2d.invalid/');
        url.hash = '';
        // Local paths are served by SillyTavern; the origin is not their identity.
        const address = source === MODEL_SOURCES.LOCAL || !/^https?:\/\//i.test(value)
            ? `${url.pathname}${url.search}` : url.href;
        return `${source}:${address}`;
    } catch {
        return `${source}:${value}`;
    }
}

export function restoreModelSettings(input = {}) {
    const settings = normalizeSettings(input);
    const key = getModelSettingsKey(settings);
    if (!key) return settings;
    const profile = settings.modelSettings[key];
    // Legacy flat settings belong only to the model that was selected before
    // migration. New models get defaults, rather than another model's mappings.
    const configuration = profile || modelConfiguration(settings);
    const restored = normalizeSettings({ ...settings, ...configuration });
    restored.modelSettings[key] = modelConfiguration(restored);
    return restored;
}

export function updateModelSettings(input, patch = {}) {
    const current = normalizeSettings(input);
    const profiles = current.modelSettings;
    const oldKey = getModelSettingsKey(current);
    if (oldKey) profiles[oldKey] = modelConfiguration(current);
    const selection = normalizeFlatSettings({ ...current, ...patch });
    const newKey = getModelSettingsKey(selection);
    const configuration = oldKey === newKey ? modelConfiguration(current)
        : profiles[newKey] || modelConfiguration(DEFAULT_SETTINGS);
    const next = normalizeSettings({ ...current, ...configuration, ...patch, modelSettings: profiles });
    if (newKey) next.modelSettings[newKey] = modelConfiguration(next);
    return next;
}

export function resolveModelUrl(settings) {
    switch (settings.modelSource) {
        case MODEL_SOURCES.URL:
            return settings.customModelUrl.trim() || null;
        case MODEL_SOURCES.LOCAL:
            return settings.localModelPath.trim() || null;
        case MODEL_SOURCES.DEFAULT:
        default:
            return DEFAULT_MODEL_URL;
    }
}
