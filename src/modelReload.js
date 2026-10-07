// One reload in flight at a time. Callers wait for the new model's load event,
// so queued playback and tap motions cannot start on a destroyed model.
export function createModelReloadController(schedule) {
    let version = 0;
    let pending = null;
    const cancel = (targetVersion, error) => {
        if (!pending || (targetVersion != null && pending.version !== targetVersion)) return;
        const rejected = pending;
        pending = null;
        if (!error) { error = new Error('Model reload cancelled.'); error.name = 'AbortError'; }
        rejected.reject(error);
    };
    return {
        request(key) {
            if (pending?.key === key) return pending.promise;
            cancel();
            let resolve;
            let reject;
            const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
            pending = { key, version: ++version, promise, resolve, reject };
            schedule(version);
            return promise;
        },
        loaded(targetVersion, key, model) {
            if (pending?.version !== targetVersion || pending.key !== key) return;
            const loaded = pending;
            pending = null;
            loaded.resolve(model);
        },
        changingModel(key) {
            if (pending && pending.key !== key) cancel();
        },
        cancel,
    };
}
