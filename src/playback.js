function readAlignment(detail) {
    return detail?.alignment || detail?.timestamps || detail?.normalizedAlignment || {};
}

export function buildPlaybackTimeline(detail, neutralEmotion = 'Neutral') {
    const text = typeof detail?.text === 'string' ? detail.text : '';
    let source = Array.isArray(detail?.segments) && detail.segments.length ? detail.segments : [];
    if (!source.length || source.map((segment) => segment?.text || '').join('') !== text) {
        source = [{ emotion: neutralEmotion, action: null, text }];
    }
    const alignment = readAlignment(detail);
    const starts = alignment.character_start_times_seconds || [];
    const ends = alignment.character_end_times_seconds || [];
    const characters = Array.from(text);
    const aligned = Array.isArray(alignment.characters) && alignment.characters.join('') === text
        && Array.isArray(starts) && Array.isArray(ends) && starts.length === characters.length && ends.length === characters.length
        && starts.every((time, index) => Number.isFinite(time) && Number.isFinite(ends[index])
            && time >= 0 && ends[index] >= time && (!index || time >= ends[index - 1]));
    const duration = Math.max(0, Number(detail?.duration) || Number(ends[ends.length - 1]) || 0);
    let charCursor = 0;
    let timeCursor = 0;
    return source.map((segment, index) => {
        const charStart = charCursor;
        const charEnd = charCursor += Array.from(segment.text || '').length;
        const last = index === source.length - 1;
        // Audio slices cover the whole recording. A pause belongs to its two
        // neighboring slices; no leading, intervening, or trailing audio drops.
        const boundary = aligned && charEnd && charEnd < characters.length
            ? (Number(ends[charEnd - 1]) + Number(starts[charEnd])) / 2
            : duration * charEnd / Math.max(characters.length, 1);
        const endTime = last ? duration : Math.max(timeCursor, Math.min(duration, boundary));
        const startTime = timeCursor;
        timeCursor = endTime;
        return { ...segment, emotion: segment.emotion || neutralEmotion, action: segment.action || null,
            charStart, charEnd, startTime, endTime, duration: endTime - startTime };
    });
}

export function getCaptionPlayback(detail, segment, start, end) {
    const source = readAlignment(detail);
    const charStart = segment.charStart;
    const charEnd = segment.charEnd;
    const relative = (time) => Math.max(0, Math.min(end - start, Number(time) - start));
    const alignment = Array.isArray(source.characters) && source.characters.join('') === detail.text
        && Array.isArray(source.character_start_times_seconds) && Array.isArray(source.character_end_times_seconds) ? {
        characters: source.characters.slice(charStart, charEnd),
        character_start_times_seconds: source.character_start_times_seconds.slice(charStart, charEnd).map(relative),
        character_end_times_seconds: source.character_end_times_seconds.slice(charStart, charEnd).map(relative),
    } : null;
    const segments = (Array.isArray(detail.captionSegments) ? detail.captionSegments : []).flatMap((caption) => {
        const from = Math.max(charStart, caption.charStart);
        const to = Math.min(charEnd, caption.charEnd);
        if (from >= to) return [];
        return [{ charStart: from - charStart, charEnd: to - charStart,
            startTime: relative(source.character_start_times_seconds?.[from] ?? caption.startTime) }];
    });
    return { text: segment.text, durationMs: (end - start) * 1000, alignment, segments };
}
