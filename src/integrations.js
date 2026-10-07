// Use SillyTavern's public context rather than changing the active connection.
export function getSillyTavernContext() {
    return globalThis.SillyTavern?.getContext?.() || null;
}

export function getSillyTavernHeaders() {
    return getSillyTavernContext()?.getRequestHeaders?.() || { 'Content-Type': 'application/json' };
}

export function readConnectionProfiles() {
    const context = getSillyTavernContext();
    if (context?.extensionSettings?.disabledExtensions?.includes('connection-manager')) return [];
    const profiles = context?.extensionSettings?.connectionManager?.profiles;
    const service = context?.ConnectionManagerRequestService;
    if (!Array.isArray(profiles) || !service?.sendRequest) return [];
    return profiles.filter((profile) => {
        if (!profile?.id || !profile.api) return false;
        try { return service.isProfileSupported?.(profile) ?? true; } catch { return false; }
    }).slice().sort((a, b) => (a.name || a.id).localeCompare(b.name || b.id));
}

export function subscribeConnectionProfiles(listener) {
    const context = getSillyTavernContext();
    const events = context?.eventTypes || context?.event_types || {};
    const names = ['APP_READY', 'CONNECTION_PROFILE_CREATED', 'CONNECTION_PROFILE_UPDATED', 'CONNECTION_PROFILE_DELETED', 'CONNECTION_PROFILE_LOADED']
        .map((key) => events[key]).filter(Boolean);
    for (const name of names) context?.eventSource?.on?.(name, listener);
    return () => {
        for (const name of names) context?.eventSource?.removeListener?.(name, listener);
    };
}

// Matches Extension-Live2d's shared assets discovery. The server returns
// user-relative web paths, not filesystem paths, including nested models.
export async function fetchLive2DModels({ signal } = {}) {
    const response = await fetch('/api/assets/get', {
        method: 'POST',
        headers: getSillyTavernHeaders(),
        signal,
    });
    if (!response.ok) throw new Error(`Could not fetch Live2D models (${response.status}).`);
    const payload = await response.json();
    const files = Array.isArray(payload?.live2d) ? payload.live2d : [];
    const paths = [...new Set(files.filter((file) => typeof file === 'string')
        .map((file) => file.replace(/\\/g, '/'))
        // The server also lists unrelated JSON files whose path contains "model".
        .filter((file) => /(?:^|\/|\.)model3?\.json$/i.test(file)))];
    return paths.map((path) => ({
        path,
        label: path.replace(/^\/?assets\/live2d\//i, '').replace(/\.model3?\.json$/i, ''),
    })).sort((a, b) => a.label.localeCompare(b.label));
}
