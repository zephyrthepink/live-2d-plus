// Align the text sent to TTS with recognition timings. Recognition supplies
// evidence about timing and boundaries; it never supplies caption wording.

function normalizeWord(word) {
    return word.normalize('NFKD').toLowerCase().replace(/\p{M}/gu, '').replace(/[^\p{L}\p{N}]/gu, '');
}

function tokenize(text) {
    const characters = Array.from(text);
    const tokens = [];
    const isLetter = (character) => /[\p{L}\p{N}\p{M}]/u.test(character || '');
    for (let index = 0; index < characters.length;) {
        if (!isLetter(characters[index])) { index += 1; continue; }
        const start = index++;
        while (index < characters.length && (isLetter(characters[index])
            || (/['’]/u.test(characters[index]) && isLetter(characters[index + 1])))) index += 1;
        tokens.push({ start, end: index, value: normalizeWord(characters.slice(start, index).join('')) });
    }
    return { characters, tokens };
}

function similarity(left, right) {
    if (left === right) return 1;
    if (Math.min(left.length, right.length) < 3) return 0;
    if (Math.abs(left.length - right.length) / Math.max(left.length, right.length) > 0.34) return 0;
    const a = Array.from(left);
    const b = Array.from(right);
    let previous = Array.from({ length: b.length + 1 }, (_, index) => index);
    for (let row = 1; row <= a.length; row += 1) {
        const next = [row];
        for (let column = 1; column <= b.length; column += 1) {
            next[column] = Math.min(next[column - 1] + 1, previous[column] + 1,
                previous[column - 1] + (a[row - 1] === b[column - 1] ? 0 : 1));
        }
        previous = next;
    }
    const score = 1 - previous[b.length] / Math.max(a.length, b.length);
    return score >= 0.66 ? score : 0;
}

function findAnchors(tokens, words) {
    const n = tokens.length;
    const m = words.length;
    if (!n || !m) return [];
    if (n === m && tokens.every((token, index) => token.value === words[index].value)) {
        return tokens.map((_, index) => ({ i: index, j: index, a: 1, b: 1, exact: true }));
    }

    // Keep unusually long provider jobs bounded. Look ahead for exact anchors
    // first, then nearby fuzzy matches, while preserving recognition order.
    if ((n + 1) * (m + 1) > 1000000) {
        const anchors = [];
        let cursor = 0;
        for (let i = 0; i < n && cursor < m; i += 1) {
            let best = -1;
            let score = 0;
            for (let j = cursor; j < Math.min(m, cursor + 32); j += 1) {
                const candidate = similarity(tokens[i].value, words[j].value);
                if (candidate > score) { best = j; score = candidate; }
                if (score === 1) break;
            }
            if (best >= 0) {
                anchors.push({ i, j: best, a: 1, b: 1, exact: score === 1 });
                cursor = best + 1;
            }
        }
        return anchors;
    }

    // Sequence alignment handles omissions, extra recognized words, repeated
    // words, and up to three words merged or split by the recognizer.
    const width = m + 1;
    const costs = new Float64Array((n + 1) * width).fill(Infinity);
    const trace = new Uint8Array(costs.length);
    costs[0] = 0;
    const originalGroups = tokens.map((_, index) => [1, 2, 3].map((size) =>
        index + size <= n ? tokens.slice(index, index + size).map((token) => token.value).join('') : ''));
    const recognizedGroups = words.map((_, index) => [1, 2, 3].map((size) =>
        index + size <= m ? words.slice(index, index + size).map((word) => word.value).join('') : ''));
    const cache = new Map();
    const matchScore = (left, right) => {
        const key = `${left}\0${right}`;
        if (cache.has(key)) return cache.get(key);
        const score = similarity(left, right);
        if (cache.size < 30000) cache.set(key, score);
        return score;
    };
    const update = (i, j, cost, step) => {
        const index = i * width + j;
        if (cost < costs[index]) { costs[index] = cost; trace[index] = step; }
    };
    for (let i = 0; i <= n; i += 1) {
        for (let j = 0; j <= m; j += 1) {
            const cost = costs[i * width + j];
            if (i < n) update(i + 1, j, cost + 1, 1);
            if (j < m) update(i, j + 1, cost + 1, 2);
            if (i === n || j === m) continue;
            for (const [a, b] of [[1, 1], [1, 2], [2, 1], [1, 3], [3, 1]]) {
                const left = originalGroups[i][a - 1];
                const right = recognizedGroups[j][b - 1];
                if (!left || !right) continue;
                // Multiword matches require the concatenated spelling to agree;
                // loose fuzzy groups can consume neighboring correct words.
                const score = a + b > 2 ? (left === right ? 1 : 0) : matchScore(left, right);
                if (!score) continue;
                const penalty = (score === 1 ? 0 : 0.15 + 1.2 * (1 - score)) + 0.12 * (a + b - 2);
                update(i + a, j + b, cost + penalty, 3 + (a - 1) * 3 + b - 1);
            }
        }
    }
    const anchors = [];
    for (let i = n, j = m; i || j;) {
        const step = trace[i * width + j];
        if (step === 1) { i -= 1; continue; }
        if (step === 2) { j -= 1; continue; }
        const a = Math.floor((step - 3) / 3) + 1;
        const b = (step - 3) % 3 + 1;
        i -= a; j -= b;
        anchors.push({ i, j, a, b, exact: originalGroups[i][a - 1] === recognizedGroups[j][b - 1] });
    }
    return anchors.reverse();
}

export function createTextAlignment(text, recognizedWords = [], durationSeconds = 0, recognitionSegments = []) {
    const originalText = typeof text === 'string' ? text : '';
    const { characters, tokens } = tokenize(originalText);
    const durationValue = Number(durationSeconds);
    let duration = Number.isFinite(durationValue) && durationValue > 0 ? durationValue : 0;
    const words = [];
    let previousEnd = 0;
    for (const [rawIndex, entry] of (Array.isArray(recognizedWords) ? recognizedWords : []).entries()) {
        if (entry?.start == null || entry?.end == null) continue;
        const value = normalizeWord(typeof entry?.word === 'string' ? entry.word : '');
        const start = Number(entry?.start);
        const end = Number(entry?.end);
        if (!value || !Number.isFinite(start) || !Number.isFinite(end) || end < start || end < 0) continue;
        const safeStart = Math.max(previousEnd, 0, duration ? Math.min(start, duration) : start);
        const safeEnd = Math.max(safeStart, duration ? Math.min(end, duration) : end);
        words.push({ value, start: safeStart, end: safeEnd, rawIndex });
        previousEnd = safeEnd;
    }
    duration = duration || previousEnd;
    const anchors = findAnchors(tokens, words);
    const timings = new Array(tokens.length);
    const assign = (from, to, start, end, recognizedStart, recognizedEnd, estimated) => {
        const weight = tokens.slice(from, to).reduce((sum, token) => sum + token.end - token.start, 0);
        let elapsed = 0;
        for (let index = from; index < to; index += 1) {
            const token = tokens[index];
            const fraction = elapsed / weight;
            elapsed += token.end - token.start;
            timings[index] = {
                charStart: token.start, charEnd: token.end,
                start: start + (end - start) * fraction,
                end: start + (end - start) * elapsed / weight,
                recognizedEnd: recognizedStart + (recognizedEnd - recognizedStart) * elapsed / weight,
                estimated,
            };
        }
    };
    let originalCursor = 0;
    let recognitionCursor = 0;
    let timeCursor = 0;
    for (const anchor of anchors) {
        if (originalCursor < anchor.i) {
            const hasRecognition = recognitionCursor < anchor.j;
            assign(originalCursor, anchor.i,
                hasRecognition ? words[recognitionCursor].start : timeCursor,
                hasRecognition ? words[anchor.j - 1].end : words[anchor.j].start,
                recognitionCursor, anchor.j, true);
        }
        assign(anchor.i, anchor.i + anchor.a, words[anchor.j].start, words[anchor.j + anchor.b - 1].end,
            anchor.j, anchor.j + anchor.b, !anchor.exact);
        originalCursor = anchor.i + anchor.a;
        recognitionCursor = anchor.j + anchor.b;
        timeCursor = words[recognitionCursor - 1].end;
    }
    if (originalCursor < tokens.length) {
        assign(originalCursor, tokens.length,
            recognitionCursor < words.length ? words[recognitionCursor].start : timeCursor,
            recognitionCursor < words.length ? words[words.length - 1].end : duration,
            recognitionCursor, words.length, true);
    }

    const startTimes = new Array(characters.length);
    const endTimes = new Array(characters.length);
    let charCursor = 0;
    let lastEnd = 0;
    for (const timing of timings) {
        // Punctuation and spaces keep their spelling and complete alongside the
        // preceding word. They must not delay a segment into trailing silence.
        for (; charCursor < timing.charStart; charCursor += 1) {
            startTimes[charCursor] = endTimes[charCursor] = lastEnd || timing.start;
        }
        const length = timing.charEnd - timing.charStart;
        for (; charCursor < timing.charEnd; charCursor += 1) {
            const offset = charCursor - timing.charStart;
            startTimes[charCursor] = timing.start + (timing.end - timing.start) * offset / length;
            endTimes[charCursor] = timing.start + (timing.end - timing.start) * (offset + 1) / length;
        }
        lastEnd = timing.end;
    }
    for (; charCursor < characters.length; charCursor += 1) {
        startTimes[charCursor] = endTimes[charCursor] = tokens.length ? lastEnd : duration * charCursor / characters.length;
    }
    const alignment = {
        characters, character_start_times_seconds: startTimes, character_end_times_seconds: endTimes,
        approximate: !anchors.length || timings.some((word) => word.estimated),
        source: 'Live2D+ STT',
    };

    // Project Vosk's flush boundaries onto original words, never through the
    // middle of a word. Omitted words are retained between neighboring anchors.
    const captionSegments = [];
    let rawWordEnd = 0;
    let originalWordEnd = 0;
    let charStart = 0;
    const groups = Array.isArray(recognitionSegments) ? recognitionSegments : [];
    for (let index = 0; index < groups.length - 1; index += 1) {
        rawWordEnd += Array.isArray(groups[index]?.words) ? groups[index].words.length : 0;
        const recognizedEnd = words.filter((word) => word.rawIndex < rawWordEnd).length;
        while (originalWordEnd < timings.length && timings[originalWordEnd].recognizedEnd <= recognizedEnd) originalWordEnd += 1;
        const charEnd = tokens[originalWordEnd]?.start ?? characters.length;
        if (charEnd > charStart && charEnd < characters.length) {
            captionSegments.push({ text: characters.slice(charStart, charEnd).join(''), charStart, charEnd,
                startTime: startTimes[charStart] || 0, endTime: endTimes[charEnd - 1] || 0 });
            charStart = charEnd;
        }
    }
    if (charStart < characters.length) {
        captionSegments.push({ text: characters.slice(charStart).join(''), charStart, charEnd: characters.length,
            startTime: startTimes[charStart] || 0, endTime: endTimes[endTimes.length - 1] || duration });
    }
    return { alignment, captionSegments, wordTimings: timings };
}
