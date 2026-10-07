import { EXTENSION_WEB_PATH } from './paths';

const CAPTION_FONT_FAMILY = 'Live2DPlusCaption';
const CAPTION_FONT_STYLE_ID = 'live2dplus-caption-font';
const CAPTION_FONT_URL = `${EXTENSION_WEB_PATH}/assets/fonts/ngaco/Ngaco.ttf`;

let captionFontInjected = false;

function ensureCaptionFont() {
    if (captionFontInjected || typeof document === 'undefined') return;
    const existing = document.getElementById(CAPTION_FONT_STYLE_ID);
    if (existing) {
        captionFontInjected = true;
        return;
    }

    const style = document.createElement('style');
    style.id = CAPTION_FONT_STYLE_ID;
    style.textContent = `@font-face {
        font-family: "${CAPTION_FONT_FAMILY}";
        src: url("${CAPTION_FONT_URL}") format("truetype");
        font-display: swap;
    }`;
    document.head.appendChild(style);
    captionFontInjected = true;
}

function normalizeCaptionText(text) {
    // Keep original spelling, punctuation, and whitespace so character offsets
    // continue to agree with the timing alignment.
    return typeof text === 'string' && text.trim() ? text : '';
}

function estimateCaptionDurationMs(text) {
    const count = Array.from(normalizeCaptionText(text)).length;
    return Math.min(Math.max(900, count * 58 + 480), 45000);
}

function resolveCaptionPreset(captions = {}) {
    const shadow = captions.shadowColor || '#1c0f1f';
    const fill = captions.fillColor || '#ff9b71';

    switch (captions.style) {
        case 'arcade':
            return {
                textTransform: 'uppercase',
                fontStyle: 'normal',
                baseOpacity: 0.36,
                wrapperFilter: `drop-shadow(0 10px 18px ${shadow}99)`,
                pendingTextShadow: `0 1px 0 ${shadow}, 1px 0 0 ${shadow}, 0 -1px 0 ${shadow}, -1px 0 0 ${shadow}, 2px 2px 0 ${shadow}`,
                activeTextShadow: `0 1px 0 ${shadow}, 1px 0 0 ${shadow}, 0 -1px 0 ${shadow}, -1px 0 0 ${shadow}, 0 0 12px ${fill}88`,
            };
        case 'soft':
            return {
                textTransform: 'none',
                fontStyle: 'italic',
                baseOpacity: 0.28,
                wrapperFilter: `drop-shadow(0 6px 18px ${shadow}66)`,
                pendingTextShadow: `0 0 10px ${shadow}bb`,
                activeTextShadow: `0 0 18px ${fill}55, 0 0 8px ${shadow}bb`,
            };
        case 'cinematic':
        default:
            return {
                textTransform: 'none',
                fontStyle: 'normal',
                baseOpacity: 0.32,
                wrapperFilter: `drop-shadow(0 10px 24px ${shadow}aa)`,
                pendingTextShadow: `0 3px 14px ${shadow}cc`,
                activeTextShadow: `0 0 22px ${fill}66, 0 3px 14px ${shadow}cc`,
            };
    }
}

function applyStyles(node, styles) {
    Object.assign(node.style, styles);
}

function buildCaptionDom(root) {
    const wrapper = document.createElement('div');
    const custom = document.createElement('div');
    const bubble = document.createElement('div');
    const text = document.createElement('span');

    wrapper.dataset.live2dplusCaption = 'true';
    wrapper.className = 'live2d-plus-caption';
    bubble.className = 'live2d-plus-caption-bubble';
    text.className = 'live2d-plus-caption-text';
    applyStyles(wrapper, {
        position: 'absolute',
        left: '0',
        right: '0',
        display: 'none',
        justifyContent: 'center',
        padding: '0 16px',
        pointerEvents: 'none',
        boxSizing: 'border-box',
    });
    applyStyles(custom, {
        maxWidth: '100%',
    });
    applyStyles(bubble, {
        borderRadius: '28px',
        padding: '12px 20px',
        textAlign: 'center',
        backdropFilter: 'blur(3px)',
        background: 'linear-gradient(180deg, rgba(8, 8, 12, 0.22), rgba(8, 8, 12, 0.06))',
    });
    applyStyles(text, {
        whiteSpace: 'pre-wrap',
        overflowWrap: 'break-word',
        wordBreak: 'break-word',
    });

    bubble.appendChild(text);
    custom.appendChild(bubble);
    wrapper.appendChild(custom);
    root.appendChild(wrapper);

    return { wrapper, custom, bubble, text };
}

export function createLive2DCaptionController(root) {
    if (!root || typeof document === 'undefined') return null;

    ensureCaptionFont();

    const dom = buildCaptionDom(root);
    let settings = null;
    let currentText = '';
    let characters = [];
    let spans = [];
    let activeCount = -1;
    let frameId = 0;
    let hideTimerId = 0;
    let token = 0;
    let finishPlayback = null;

    const clearTimers = () => {
        if (frameId && typeof window !== 'undefined') window.cancelAnimationFrame(frameId);
        if (hideTimerId && typeof window !== 'undefined') window.clearTimeout(hideTimerId);
        frameId = 0;
        hideTimerId = 0;
    };

    const readCaptions = () => settings?.captions || {};
    const captionsAreEnabled = () => settings?.routeTtsToLive2D === true && readCaptions().enabled === true;

    const applyCaptionSettings = () => {
        const captions = readCaptions();
        const preset = resolveCaptionPreset(captions);

        dom.wrapper.style.bottom = `${captions.bottomOffset || 0}px`;
        dom.wrapper.style.maxWidth = `${captions.maxWidth || 100}%`;
        dom.wrapper.style.margin = '0 auto';
        dom.bubble.style.filter = preset.wrapperFilter;
        applyStyles(dom.text, {
            fontFamily: `"${CAPTION_FONT_FAMILY}", sans-serif`,
            fontSize: `${captions.fontSize || 38}px`,
            fontWeight: String(captions.fontWeight || 700),
            lineHeight: String(captions.lineHeight || 1.08),
            letterSpacing: `${captions.letterSpacing || 0}em`,
            textTransform: preset.textTransform,
            fontStyle: preset.fontStyle,
        });
    };

    const paintProgress = (progress) => {
        const captions = readCaptions();
        const preset = resolveCaptionPreset(captions);
        const count = Math.round(Math.min(Math.max(Number(progress) || 0, 0), 1) * characters.length);
        if (count === activeCount) return;
        activeCount = count;

        spans.forEach((span, index) => {
            const spoken = index < activeCount;
            span.style.color = spoken ? captions.fillColor : captions.textColor;
            span.style.opacity = spoken ? '1' : String(preset.baseOpacity);
            span.style.textShadow = spoken ? preset.activeTextShadow : preset.pendingTextShadow;
        });
    };

    const renderText = (text) => {
        dom.text.textContent = '';
        characters = Array.from(text);
        spans = characters.map((character, index) => {
            const span = document.createElement('span');
            span.textContent = character;
            span.style.transition = 'color 120ms linear, opacity 120ms linear, text-shadow 120ms linear';
            span.dataset.index = String(index);
            dom.text.appendChild(span);
            return span;
        });
        activeCount = -1;
        paintProgress(0);
    };

    const clear = () => {
        clearTimers();
        token += 1;
        currentText = '';
        finishPlayback = null;
        characters = [];
        spans = [];
        activeCount = -1;
        dom.text.textContent = '';
        dom.wrapper.style.display = 'none';
    };

    const finish = () => {
        clearTimers();
        if (!currentText) return;
        finishPlayback?.();
        paintProgress(1);
        dom.wrapper.style.display = 'flex';
        if (typeof window !== 'undefined') {
            hideTimerId = window.setTimeout(clear, 420);
        }
    };

    const start = ({ text, durationMs, alignment, segments, getPlaybackTime } = {}) => {
        const normalizedText = normalizeCaptionText(text);
        if (!captionsAreEnabled() || !normalizedText) {
            clear();
            return;
        }

        clearTimers();
        token += 1;
        const currentToken = token;
        currentText = normalizedText;
        const safeDuration = Number.isFinite(Number(durationMs)) && Number(durationMs) > 0
            ? Number(durationMs)
            : estimateCaptionDurationMs(normalizedText);

        const sourceCharacters = Array.from(normalizedText);
        const endTimes = alignment?.character_end_times_seconds;
        const timed = alignment?.characters?.join('') === normalizedText
            && Array.isArray(endTimes) && endTimes.length === sourceCharacters.length
            && endTimes.every((time, index) => Number.isFinite(time) && time >= 0 && (!index || time >= endTimes[index - 1]));
        const chunks = Array.isArray(segments) && segments.length
            && segments[0].charStart === 0 && segments[segments.length - 1].charEnd === sourceCharacters.length
            && segments.every((chunk, index) => chunk.charEnd > chunk.charStart
                && (!index || chunk.charStart === segments[index - 1].charEnd))
            ? segments : [{ charStart: 0, charEnd: sourceCharacters.length, startTime: 0 }];
        let chunkIndex = -1;
        const paintTime = (elapsed) => {
            let next = 0;
            while (next + 1 < chunks.length && chunks[next + 1].startTime <= elapsed) next += 1;
            const chunk = chunks[next];
            if (next !== chunkIndex) {
                chunkIndex = next;
                currentText = sourceCharacters.slice(chunk.charStart, chunk.charEnd).join('');
                renderText(currentText);
            }
            if (timed) {
                let count = 0;
                for (let index = chunk.charStart; index < chunk.charEnd && endTimes[index] <= elapsed; index += 1) count += 1;
                paintProgress(count / Math.max(characters.length, 1));
            } else {
                paintProgress(Math.min(elapsed * 1000 / safeDuration, 1));
            }
        };
        finishPlayback = () => paintTime(safeDuration / 1000);

        applyCaptionSettings();
        paintTime(0);
        dom.wrapper.style.display = 'flex';

        if (typeof window === 'undefined' || !window.requestAnimationFrame) {
            paintProgress(1);
            return;
        }

        const startedAt = performance.now();
        const tick = (time) => {
            if (token !== currentToken) return;
            const playbackTime = typeof getPlaybackTime === 'function' ? Number(getPlaybackTime()) : NaN;
            const elapsed = Number.isFinite(playbackTime) && playbackTime >= 0 ? playbackTime : (time - startedAt) / 1000;
            paintTime(elapsed);
            if (elapsed * 1000 >= safeDuration) {
                frameId = 0;
                return;
            }
            frameId = window.requestAnimationFrame(tick);
        };
        frameId = window.requestAnimationFrame(tick);
    };

    const updateSettings = (nextSettings) => {
        settings = nextSettings || {};
        applyCaptionSettings();
        if (!captionsAreEnabled()) clear();
        else if (currentText) {
            const progress = Math.max(0, activeCount) / Math.max(characters.length, 1);
            renderText(currentText);
            paintProgress(progress);
            dom.wrapper.style.display = 'flex';
        }
    };

    const destroy = () => {
        clearTimers();
        dom.wrapper.remove();
    };

    return { updateSettings, start, finish, clear, destroy };
}
