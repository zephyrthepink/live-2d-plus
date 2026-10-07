import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ANALYSIS_SOURCES, BUILTIN_CLASSIFIER_EMOTION_LABELS, DEFAULT_EMOTION_LABELS, fetchOpenAiModels } from './dynamicAnalysis';
import { MODEL_SOURCES } from './settings';
import { fetchLive2DModels, readConnectionProfiles, subscribeConnectionProfiles } from './integrations';

export const LIVE2D_PLUS_SETTINGS_STYLES = `
.live2d-plus-settings {
    --l2d-accent: var(--SmartThemeUnderlineColor, #d7a9c7);
    --l2d-border: color-mix(in srgb, var(--SmartThemeBodyColor, #ddd) 18%, transparent);
    --l2d-surface: color-mix(in srgb, var(--SmartThemeBodyColor, #ddd) 4%, transparent);
    color: var(--SmartThemeBodyColor, inherit);
}

.live2d-plus-settings .settings-body {
    container: live2d-settings / inline-size;
    padding: 10px 0 4px;
}

.live2d-plus-settings .settings-overview {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 12px;
    border: 1px solid var(--l2d-border);
    border-radius: 10px;
    background: var(--l2d-surface);
}

.live2d-plus-settings .settings-overview .checkbox_label {
    padding: 0;
    font-weight: 700;
}

.live2d-plus-settings .status-badge {
    flex-shrink: 0;
    padding: 4px 8px;
    border-radius: 20px;
    border: 1px solid var(--l2d-border);
    font-size: 0.75em;
}

.live2d-plus-settings .status-badge.active {
    color: var(--l2d-accent);
    border-color: var(--l2d-accent);
}

.live2d-plus-settings .settings-group {
    margin-top: 22px;
}

.live2d-plus-settings .settings-group-heading {
    display: flex;
    align-items: center;
    gap: 8px;
    margin: 0 2px 8px;
    font-size: 0.75em;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
}

.live2d-plus-settings .settings-group-heading::after {
    content: '';
    flex: 1;
    border-top: 1px solid var(--l2d-border);
}

.live2d-plus-settings .section-details {
    margin-top: 8px;
    border: 1px solid var(--l2d-border);
    border-radius: 10px;
    background: var(--l2d-surface);
    overflow: hidden;
}

.live2d-plus-settings .section-details > summary {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 12px;
    cursor: pointer;
    list-style: none;
    user-select: none;
}

.live2d-plus-settings .section-details > summary::-webkit-details-marker {
    display: none;
}

.live2d-plus-settings .section-icon {
    flex: 0 0 28px;
    display: flex;
    align-items: center;
    justify-content: center;
    height: 28px;
    color: var(--l2d-accent);
    border-radius: 7px;
    background: color-mix(in srgb, var(--l2d-accent) 10%, transparent);
}

.live2d-plus-settings .section-heading {
    flex: 1;
    min-width: 0;
}

.live2d-plus-settings .section-heading b {
    display: block;
    font-size: 0.9em;
}

.live2d-plus-settings .section-description {
    display: block;
    margin-top: 3px;
    font-size: 0.75em;
    opacity: 0.75;
    line-height: 1.4;
}

.live2d-plus-settings .section-chevron {
    font-size: 0.7em;
    opacity: 0.7;
}

.live2d-plus-settings .section-details[open] > summary .section-chevron {
    transform: rotate(90deg);
}

.live2d-plus-settings .section-details[open] > summary {
    border-bottom: 1px solid var(--l2d-border);
}

.live2d-plus-settings .section-details-content {
    padding: 12px;
    min-width: 0;
}

.live2d-plus-settings .section-details-content > :last-child {
    margin-bottom: 0;
}

.live2d-plus-settings .field-group + .field-group {
    margin-top: 16px;
    padding-top: 14px;
    border-top: 1px solid var(--l2d-border);
}

.live2d-plus-settings .field-group-heading,
.live2d-plus-settings .section-caption {
    display: block;
    margin: 16px 0 8px;
    font-size: 0.8em;
    font-weight: 700;
    color: var(--l2d-accent);
}

.live2d-plus-settings .field-group-heading {
    margin-top: 0;
}

.live2d-plus-settings .field,
.live2d-plus-settings .inline-control {
    display: block;
    min-width: 0;
    margin-bottom: 12px;
}

.live2d-plus-settings .field > span,
.live2d-plus-settings .inline-control > span,
.live2d-plus-settings .slider-header > small {
    display: block;
    margin-bottom: 5px;
    font-size: 0.82em;
    font-weight: 600;
}

.live2d-plus-settings .checkbox_label {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 7px 0;
    margin: 0;
    cursor: pointer;
    font-size: 0.9em;
}

.live2d-plus-settings .checkbox_label input {
    flex-shrink: 0;
    margin: 0;
}

.live2d-plus-settings .text_pole {
    width: 100%;
    min-width: 0;
    box-sizing: border-box;
    margin: 0;
}

.live2d-plus-settings .menu_button {
    width: auto;
    max-width: 100%;
    margin: 0;
    padding: 7px 10px;
    font: inherit;
    font-size: 0.85em;
    line-height: 1.3;
    white-space: normal;
}

.live2d-plus-settings .menu_button:disabled {
    opacity: 0.45;
    cursor: default;
}

.live2d-plus-settings .section-details > summary:hover,
.live2d-plus-settings .checkbox_label:hover {
    background: var(--l2d-surface);
}

.live2d-plus-settings :focus-visible {
    outline: 2px solid var(--l2d-accent);
    outline-offset: 2px;
}

.live2d-plus-settings .section-details > summary:focus-visible {
    outline-offset: -3px;
}

.live2d-plus-settings .inline-actions,
.live2d-plus-settings .row-actions {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 6px;
}

.live2d-plus-settings .source-selector {
    display: flex;
    gap: 6px;
    margin-bottom: 10px;
}

.live2d-plus-settings .source-selector .menu_button {
    flex: 1;
    text-align: center;
}

.live2d-plus-settings .source-selector [aria-pressed='true'] {
    color: var(--l2d-accent);
    border-color: var(--l2d-accent);
    background: color-mix(in srgb, var(--l2d-accent) 12%, transparent);
    font-weight: 700;
}

.live2d-plus-settings .full-width-action {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    width: 100%;
    box-sizing: border-box;
    margin-top: 10px;
    text-align: center;
}

.live2d-plus-settings .slider-with-input {
    margin-bottom: 14px;
}

.live2d-plus-settings .slider-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    margin-bottom: 4px;
}

.live2d-plus-settings .slider-header > small {
    margin: 0;
}

.live2d-plus-settings .slider-value-input {
    width: 82px;
    flex: 0 0 82px;
    padding: 4px 6px;
    text-align: right;
    font-variant-numeric: tabular-nums;
}

.live2d-plus-settings input[type='range'] {
    display: block;
    width: 100%;
    margin: 0;
}

.live2d-plus-settings .hint {
    display: block;
    margin: 6px 0 12px;
    font-size: 0.8em;
    opacity: 0.75;
    line-height: 1.5;
}

.live2d-plus-settings small,
.live2d-plus-settings .hint,
.live2d-plus-settings .mapping-row strong,
.live2d-plus-settings code {
    overflow-wrap: anywhere;
}

.live2d-plus-settings .mapping-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
    max-height: 360px;
    overflow-y: auto;
    overscroll-behavior: contain;
    padding: 2px;
    margin-bottom: 10px;
}

.live2d-plus-settings .mapping-list.compact {
    max-height: none;
}

.live2d-plus-settings .mapping-row {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 10px;
    align-items: end;
    padding: 10px;
    border: 1px solid var(--l2d-border);
    border-radius: 8px;
    background: var(--l2d-surface);
}

.live2d-plus-settings .mapping-row > strong,
.live2d-plus-settings .mapping-row > .compact-field,
.live2d-plus-settings .mapping-row > button {
    grid-column: 1 / -1;
}

.live2d-plus-settings .mapping-row > strong {
    font-size: 0.85em;
}

.live2d-plus-settings .mapping-row > button {
    justify-self: end;
}

.live2d-plus-settings .mapping-row .field,
.live2d-plus-settings .mapping-row .inline-control {
    margin-bottom: 0;
}

.live2d-plus-settings .mapping-row.tap-row {
    grid-template-columns: minmax(0, 1fr);
    align-items: start;
}

.live2d-plus-settings .tap-fields {
    display: flex;
    flex-direction: column;
    min-width: 0;
    gap: 10px;
}

.live2d-plus-settings .tap-selects {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 10px;
}

.live2d-plus-settings textarea.text_pole {
    min-height: 60px;
    resize: vertical;
}

.live2d-plus-settings .tap-meta {
    margin: 8px 0 14px;
}

.live2d-plus-settings .tap-meta small {
    font-size: 0.8em;
    opacity: 0.75;
}

.live2d-plus-settings .mapping-row.priority-row {
    grid-template-columns: minmax(0, 1fr) auto;
    align-items: center;
    font-size: 0.85em;
}

.live2d-plus-settings .priority-row .row-actions {
    flex-wrap: nowrap;
}

.live2d-plus-settings .effect-card {
    padding: 8px 10px;
    margin-bottom: 8px;
    border: 1px solid var(--l2d-border);
    border-radius: 8px;
}

.live2d-plus-settings .effect-parameters {
    padding: 8px 0 0;
}

.live2d-plus-settings .searchable-picker {
    width: 100%;
    border: 1px solid var(--l2d-border);
    border-radius: 8px;
    overflow: hidden;
}
.live2d-plus-settings .picker-trigger {
    display: flex;
    justify-content: space-between;
    gap: 10px;
    width: 100%;
    border: 0;
    margin: 0;
    text-align: left;
    list-style: none;
    min-height: 36px;
}
.live2d-plus-settings .picker-trigger::-webkit-details-marker { display: none; }
.live2d-plus-settings .picker-trigger span { min-width: 0; overflow-wrap: anywhere; }
.live2d-plus-settings .picker-panel { padding: 10px; border-top: 1px solid var(--l2d-border); }
.live2d-plus-settings .picker-filters { margin-top: 8px; }
.live2d-plus-settings .picker-options { max-height: 260px; overflow-y: auto; padding: 3px; margin-top: 8px; overscroll-behavior: contain; }
.live2d-plus-settings .picker-option {
    display: block;
    width: 100%;
    padding: 9px;
    margin: 0 0 4px;
    border: 1px solid transparent;
    border-radius: 6px;
    color: inherit;
    background: transparent;
    text-align: left;
    font: inherit;
    font-size: 0.85em;
    cursor: pointer;
    overflow-wrap: anywhere;
}
.live2d-plus-settings .picker-option small { display: block; opacity: 0.7; margin-top: 3px; }
.live2d-plus-settings .picker-option:hover,
.live2d-plus-settings .picker-option[aria-selected='true'] { background: var(--l2d-surface); border-color: var(--l2d-accent); }
.live2d-plus-settings .emotion-editor { display: flex; flex-wrap: wrap; align-items: end; gap: 8px; }
.live2d-plus-settings .emotion-editor .field { flex: 1 1 130px; margin: 0; }
.live2d-plus-settings .custom-emotion-badge { margin-left: 8px; font-size: 0.75em; color: var(--l2d-accent); }

@container live2d-settings (min-width: 580px) {
    .live2d-plus-settings .mapping-row {
        grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) minmax(0, 1fr) auto;
    }
    .live2d-plus-settings .mapping-row > strong,
    .live2d-plus-settings .mapping-row > .compact-field,
    .live2d-plus-settings .mapping-row > button {
        grid-column: auto;
    }
    .live2d-plus-settings .mapping-row.tap-row {
        grid-template-columns: minmax(0, 0.7fr) minmax(0, 2fr);
    }
}

@container live2d-settings (max-width: 320px) {
    .live2d-plus-settings .mapping-row,
    .live2d-plus-settings .tap-selects {
        grid-template-columns: minmax(0, 1fr);
    }
    .live2d-plus-settings .mapping-row.priority-row {
        grid-template-columns: minmax(0, 1fr);
    }
}
`;

const EMPTY_MODEL_INFO = Object.freeze({ name: '', motions: {}, expressions: [], hitAreas: [] });

function modelInfoSignature(info = EMPTY_MODEL_INFO) {
    const motions = Object.entries(info?.motions || {})
        .map(([groupName, groupMotions]) => [groupName, Array.isArray(groupMotions) ? groupMotions.length : 0])
        .sort(([left], [right]) => left.localeCompare(right));
    const expressions = Array.isArray(info?.expressions) ? info.expressions.map((expression, index) => getExpressionLabel(expression, index)) : [];
    const hitAreas = Array.isArray(info?.hitAreas)
        ? info.hitAreas.map((hitArea) => `${hitArea.id || ''}:${hitArea.name || ''}:${hitArea.index ?? ''}`)
        : [];

    return JSON.stringify({ name: info?.name || '', motions, expressions, hitAreas });
}

function setModelInfoIfChanged(setModelInfo, nextInfo) {
    const next = nextInfo || EMPTY_MODEL_INFO;
    setModelInfo((current) => (
        modelInfoSignature(current) === modelInfoSignature(next) ? current : next
    ));
    return next;
}

function readLiveModelInfo(readRuntimeModelInfo) {
    if (typeof window === 'undefined' || typeof readRuntimeModelInfo !== 'function') {
        return EMPTY_MODEL_INFO;
    }

    return window.live2dPlusModelInfo || readRuntimeModelInfo(window.live2dPlusModel) || EMPTY_MODEL_INFO;
}

export function CheckboxRow({ label, checked, onChange }) {
    return (
        <label className="checkbox_label">
            <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
            <span>{label}</span>
        </label>
    );
}

export function Slider({ label, value, min, max, step, onChange, displayValue, showInput = false, inputMin, inputMax, inputStep }) {
    const display = displayValue !== undefined ? displayValue : value;
    const numericValue = Number(value);
    const rangeValue = Number.isFinite(numericValue)
        ? Math.min(Math.max(numericValue, min), max)
        : min;
    const handleInputChange = (event) => {
        const next = Number(event.target.value);
        if (Number.isFinite(next)) onChange(next);
    };

    return (
        <div className="slider-with-input">
            <div className="slider-header">
                <small>{label}</small>
                {showInput ? (
                    <input
                        type="number"
                        className="text_pole slider-value-input"
                        aria-label={`${label} value`}
                        min={inputMin ?? min}
                        max={inputMax}
                        step={inputStep ?? step}
                        value={value}
                        onChange={handleInputChange}
                    />
                ) : (
                    <small style={{ opacity: 0.7 }}>{display}</small>
                )}
            </div>
            <input
                type="range"
                aria-label={label}
                min={min}
                max={max}
                step={step}
                value={rangeValue}
                onChange={(e) => onChange(Number(e.target.value))}
                style={{ width: '100%' }}
            />
        </div>
    );
}

export function formatNumber(value, digits = 2) {
    return Number(value).toFixed(digits).replace(/\.0+$/, '').replace(/(\.\d*?)0+$/, '$1');
}

export function ColorInput({ label, value, onChange }) {
    return (
        <div className="field">
            <span>{label}</span>
            <div className="inline-actions">
                <input
                    type="color"
                    aria-label={`${label} picker`}
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    style={{ width: '36px', height: '32px', cursor: 'pointer', border: 'none', background: 'none' }}
                />
                <input
                    type="text"
                    aria-label={label}
                    className="text_pole"
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    style={{ flex: 1, fontFamily: 'monospace', fontSize: '0.9em' }}
                />
            </div>
        </div>
    );
}

export function SettingsGroup({ title, children }) {
    return (
        <section className="settings-group" aria-label={title}>
            <h4 className="settings-group-heading">{title}</h4>
            {children}
        </section>
    );
}

export function FieldGroup({ title, children }) {
    return (
        <div className="field-group">
            <h5 className="field-group-heading">{title}</h5>
            {children}
        </div>
    );
}

export function SubDrawer({ title, description, icon, children, defaultOpen = false }) {
    return (
        <details className="section-details" open={defaultOpen || undefined}>
            <summary>
                {icon && <span className="section-icon" aria-hidden="true"><i className={`fa-solid ${icon}`} /></span>}
                <span className="section-heading">
                    <b>{title}</b>
                    {description && <small className="section-description">{description}</small>}
                </span>
                <i className="fa-solid fa-chevron-right section-chevron" aria-hidden="true" />
            </summary>
            <div className="section-details-content">
                {children}
            </div>
        </details>
    );
}

// Native details provides keyboard activation and keeps the search/filter
// controls inside the dropdown, without depending on SillyTavern's Select2.
export function SearchablePicker({ label, options, value, onChange, filters = [] }) {
    const pickerRef = useRef(null);
    const searchRef = useRef(null);
    const [query, setQuery] = useState('');
    const [filter, setFilter] = useState('all');
    const selected = options.find((option) => option.id === value);
    const visible = options.filter((option) => (
        (filter === 'all' || option.type === filter)
        && `${option.label} ${option.description || ''}`.toLowerCase().includes(query.trim().toLowerCase())
    ));
    const close = () => {
        if (pickerRef.current) {
            pickerRef.current.open = false;
            pickerRef.current.querySelector('summary')?.focus();
        }
    };
    const handleKeyDown = (event) => {
        if (event.key === 'Escape') {
            event.preventDefault();
            close();
        } else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            const buttons = [...pickerRef.current.querySelectorAll('[role="option"]')];
            if (!buttons.length) return;
            event.preventDefault();
            const current = buttons.indexOf(document.activeElement);
            const direction = event.key === 'ArrowDown' ? 1 : -1;
            const next = current < 0 ? (direction === 1 ? 0 : buttons.length - 1) : (current + direction + buttons.length) % buttons.length;
            buttons[next].focus();
        }
    };
    return (
        <details className="searchable-picker" ref={pickerRef} onKeyDown={handleKeyDown}
            onToggle={(event) => { if (event.currentTarget.open) searchRef.current?.focus(); }}>
            <summary className="menu_button picker-trigger" aria-label={label}>
                <span>{selected?.label || 'Choose…'}</span>
                <i className="fa-solid fa-chevron-down" aria-hidden="true" />
            </summary>
            <div className="picker-panel">
                <input ref={searchRef} className="text_pole" type="search" aria-label={`Search ${label.toLowerCase()}`}
                    placeholder="Search by name…" value={query} onChange={(event) => setQuery(event.target.value)} />
                {filters.length > 0 && (
                    <div className="source-selector picker-filters" role="group" aria-label="Filter cue type">
                        {[{ value: 'all', label: 'All' }, ...filters].map((item) => (
                            <button type="button" className="menu_button" key={item.value} aria-pressed={filter === item.value}
                                onClick={() => setFilter(item.value)}>{item.label}</button>
                        ))}
                    </div>
                )}
                <div className="picker-options" role="listbox" aria-label={label}>
                    {visible.map((option) => (
                        <button type="button" role="option" aria-selected={option.id === value} className="picker-option" key={option.id}
                            onClick={() => { onChange(option.id); close(); }}>
                            <span>{option.label}</span>
                            {option.description && <small>{option.description}</small>}
                        </button>
                    ))}
                    {visible.length === 0 && <div className="hint">No matching items.</div>}
                </div>
            </div>
        </details>
    );
}

export function ModelSettingsSection({ settings, onChange, onReload }) {
    const [urlDraft, setUrlDraft] = useState(settings.customModelUrl);
    useEffect(() => setUrlDraft(settings.customModelUrl), [settings.customModelUrl, settings.modelSource]);
    const commitUrl = () => {
        const url = urlDraft.trim();
        if (url !== settings.customModelUrl) onChange({ customModelUrl: url });
    };
    const [models, setModels] = useState([]);
    const [fetchState, setFetchState] = useState({ loading: false, message: '' });
    const requestRef = useRef(null);
    const refresh = useCallback(async () => {
        requestRef.current?.abort();
        const controller = new AbortController();
        requestRef.current = controller;
        setFetchState({ loading: true, message: '' });
        try {
            const list = await fetchLive2DModels({ signal: controller.signal });
            if (controller.signal.aborted) return;
            setModels(list);
            setFetchState({ loading: false, message: list.length ? `${list.length} model${list.length === 1 ? '' : 's'} found.` : 'No models found. Add model folders to data/<user-handle>/assets/live2d, then refresh.' });
        } catch (error) {
            if (controller.signal.aborted) return;
            setFetchState({ loading: false, message: error.message || 'Could not fetch models.' });
        }
    }, []);
    useEffect(() => {
        if (settings.modelSource === MODEL_SOURCES.LOCAL) refresh();
        return () => requestRef.current?.abort();
    }, [settings.modelSource, refresh]);
    const selectedAvailable = models.some((model) => model.path === settings.localModelPath);
    const options = models.map((model) => ({ id: model.path, label: model.label }));
    // Preserve an existing selection on temporary errors or while refreshing.
    if (settings.localModelPath && !selectedAvailable) {
        options.unshift({ id: settings.localModelPath, label: settings.localModelPath, description: 'Saved selection · not found in the current list' });
    }
    return (
        <SubDrawer title="Model" icon="fa-cube" description="Choose a model source and reload" defaultOpen>
            <div className="field">
                <span>Source</span>
                <div className="source-selector" role="group" aria-label="Model source">
                    {[
                        { value: MODEL_SOURCES.DEFAULT, label: 'Default' },
                        { value: MODEL_SOURCES.URL, label: 'URL' },
                        { value: MODEL_SOURCES.LOCAL, label: 'Library' },
                    ].map(({ value, label }) => (
                        <button type="button" key={value} className="menu_button" aria-pressed={settings.modelSource === value}
                            onClick={() => onChange({ modelSource: value })}>{label}</button>
                    ))}
                </div>
            </div>
            <small className="hint">Settings save automatically for each model. Switching models restores its rendering, mappings, interactions, and other options.</small>
            {settings.modelSource === MODEL_SOURCES.DEFAULT && <small className="hint">Using Shizuku demo model (CDN).</small>}
            {settings.modelSource === MODEL_SOURCES.URL && (
                <label className="field"><span>Model URL</span>
                    <input type="url" aria-label="Model URL" className="text_pole" placeholder="https://…" value={urlDraft}
                        onChange={(event) => setUrlDraft(event.target.value)} onBlur={commitUrl}
                        onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); commitUrl(); } }} />
                    <small className="hint">Press Enter or leave this field to load the model.</small>
                </label>
            )}
            {settings.modelSource === MODEL_SOURCES.LOCAL && (
                <>
                    <div className="field"><span>Live2D model</span>
                        <SearchablePicker label="Live2D model" options={options} value={settings.localModelPath}
                            onChange={(path) => onChange({ localModelPath: path })} />
                    </div>
                    <button type="button" className="menu_button full-width-action" disabled={fetchState.loading} onClick={refresh}>
                        {fetchState.loading ? 'Loading models…' : 'Refresh Models'}
                    </button>
                    {fetchState.message && <div className="hint" role="status">{fetchState.message}</div>}
                    <small className="hint">Uses the same assets/live2d folder as the original Live2D extension. Keep each model’s JSON, textures, motions, and expressions together.</small>
                </>
            )}
            <button type="button" className="menu_button full-width-action" onClick={onReload}>
                <i className="fa-solid fa-rotate-right" aria-hidden="true" /> Reload Model
            </button>
        </SubDrawer>
    );
}

export function getMotionLabel(motion, index) {
    const raw = typeof motion === 'string'
        ? motion
        : motion?.File || motion?.file || motion?.name || motion?.Name || `Motion ${index + 1}`;
    return String(raw).replace(/\.(mtn|json)$/i, '');
}

export function getExpressionLabel(expr, index) {
    if (typeof expr === 'string') return expr.replace(/\.(exp3?|json)$/i, '');
    return expr?.name || expr?.Name || expr?.File || expr?.file || `Expression ${index}`;
}

export function MotionTestSection({
    defaultStateResetDelayMs = 1800,
    resetDynamicState,
    stopModelMotionsOnly,
    readMotionDurationMs,
    getMotionManager,
    modelInfoEventName = 'Live2DPlusModelInfoChanged',
}) {
    const [modelInfo, setModelInfo] = useState({ name: '', motions: {}, expressions: [], message: '' });
    const resetTimerRef = useRef(0);
    const [selectedId, setSelectedId] = useState('');

    const clearTestReset = useCallback(() => {
        if (resetTimerRef.current && typeof window !== 'undefined') {
            window.clearTimeout(resetTimerRef.current);
        }
        resetTimerRef.current = 0;
    }, []);

    const scheduleTestReset = useCallback((model, delayMs = defaultStateResetDelayMs) => {
        clearTestReset();
        if (!model) return;
        if (typeof window === 'undefined') {
            resetDynamicState?.(model);
            return;
        }

        const safeDelay = Math.min(Math.max(Number(delayMs) || 0, 0), 60000);
        resetTimerRef.current = window.setTimeout(() => {
            resetTimerRef.current = 0;
            resetDynamicState?.(model);
        }, safeDelay);
    }, [clearTestReset, defaultStateResetDelayMs, resetDynamicState]);

    useEffect(() => clearTestReset, [clearTestReset]);

    const refresh = useCallback(() => {
        const model = window.live2dPlusModel;
        if (!model) {
            setModelInfo({ name: '', motions: {}, expressions: [], message: 'No Live2D model loaded yet.' });
            return;
        }

        const internalSettings = model.internalModel?.settings || {};
        const rawMotions = internalSettings.motions || model.internalModel?.motionManager?.definitions || {};
        const motions = {};
        for (const [group, list] of Object.entries(rawMotions)) {
            if (Array.isArray(list) && list.length > 0) motions[group] = list;
        }

        const expSource = internalSettings.expressions
            || model.internalModel?.motionManager?.expressionManager?.definitions
            || [];
        const expressions = Array.isArray(expSource)
            ? expSource
            : expSource && typeof expSource === 'object'
                ? Object.values(expSource).filter(Boolean)
                : [];

        const name = internalSettings.name || 'Active Model';
        const hasAny = Object.keys(motions).length > 0 || expressions.length > 0;
        setModelInfo({ name, motions, expressions, message: hasAny ? '' : 'No motions or expressions found.' });
    }, []);

    useEffect(() => {
        refresh();
        window.addEventListener(modelInfoEventName, refresh);
        return () => window.removeEventListener(modelInfoEventName, refresh);
    }, [refresh, modelInfoEventName]);

    const cues = useMemo(() => [
        ...modelInfo.expressions.map((expression, index) => ({
            id: `expression:${index}`, type: 'expression', index,
            label: getExpressionLabel(expression, index), description: 'Expression',
        })),
        ...Object.entries(modelInfo.motions).flatMap(([group, motions]) => motions.map((motion, index) => ({
            id: `motion:${group}:${index}`, type: 'motion', group, index,
            label: getMotionLabel(motion, index), description: `Motion · ${group || 'Default group'}`,
        }))),
    ], [modelInfo]);
    const selectedCue = cues.find((cue) => cue.id === selectedId);
    useEffect(() => setSelectedId(''), [modelInfo]);

    async function playMotion(group, index) {
        const model = window.live2dPlusModel;
        if (!model?.motion) return;

        const motionManager = getMotionManager?.(model);
        let resetHandled = false;
        let detachMotionFinish = () => {};

        const resetOnce = () => {
            if (resetHandled) return;
            resetHandled = true;
            detachMotionFinish();
            clearTestReset();
            resetDynamicState?.(model);
        };

        try {
            clearTestReset();
            stopModelMotionsOnly?.(model);

            if (motionManager?.on) {
                const handleMotionFinish = () => resetOnce();
                motionManager.on('motionFinish', handleMotionFinish);
                detachMotionFinish = () => {
                    try { motionManager.off?.('motionFinish', handleMotionFinish); } catch { /* noop */ }
                    try { motionManager.removeListener?.('motionFinish', handleMotionFinish); } catch { /* noop */ }
                };
            }

            let fallbackDelay = defaultStateResetDelayMs;
            try {
                const motion = await motionManager?.loadMotion?.(group, index);
                fallbackDelay = readMotionDurationMs?.(motion) ?? defaultStateResetDelayMs;
            } catch { /* use fallback */ }

            clearTestReset();
            if (typeof window === 'undefined') {
                resetOnce();
            } else {
                const safeDelay = Math.min(Math.max(Number(fallbackDelay) || 0, 0), 60000) + 250;
                resetTimerRef.current = window.setTimeout(resetOnce, safeDelay);
            }
            const result = model.motion(group, index, undefined, { volume: 0 });
            Promise.resolve(result)
                .then((started) => {
                    if (started === false) resetOnce();
                })
                .catch((err) => {
                    console.error('[Live2D+] Motion error:', err);
                    resetOnce();
                });
        } catch (err) {
            console.error('[Live2D+] Motion error:', err);
            resetOnce();
        }
    }

    function playExpression(index) {
        const model = window.live2dPlusModel;
        if (!model?.expression) return;

        try {
            clearTestReset();
            const result = model.expression(index);
            Promise.resolve(result)
                .catch((err) => console.error('[Live2D+] Expression error:', err))
                .finally(() => scheduleTestReset(model));
        } catch (err) {
            console.error('[Live2D+] Expression error:', err);
            scheduleTestReset(model);
        }
    }

    return (
        <div>
            <div className="inline-actions">
                {modelInfo.name && <small className="hint">{modelInfo.name}</small>}
                <button type="button" className="menu_button" onClick={refresh}>
                    <i className="fa-solid fa-rotate" aria-hidden="true" /> Refresh
                </button>
            </div>
            {modelInfo.message && <div className="hint" role="status">{modelInfo.message}</div>}
            <div className="field">
                <span>Motion or expression</span>
                <SearchablePicker label="Motion or expression" options={cues} value={selectedId} onChange={setSelectedId}
                    filters={[{ value: 'expression', label: 'Expressions' }, { value: 'motion', label: 'Motions' }]} />
            </div>
            <button type="button" className="menu_button full-width-action" disabled={!selectedCue}
                onClick={() => {
                    if (selectedCue?.type === 'expression') playExpression(selectedCue.index);
                    else if (selectedCue) playMotion(selectedCue.group, selectedCue.index);
                }}>
                <i className="fa-solid fa-play" aria-hidden="true" /> Play Selected
            </button>
        </div>
    );
}

function MappingSelect({ label, value, options, onChange }) {
    return (
        <label className="inline-control">
            <span>{label}</span>
            <select className="text_pole" aria-label={label} value={value || ''} onChange={(event) => onChange(event.target.value)}>
                <option value="">None</option>
                {options.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                ))}
            </select>
        </label>
    );
}

function readMappingByLabel(mappings, label) {
    const key = typeof label === 'string' ? label.trim() : '';
    if (!key || !mappings || typeof mappings !== 'object') return {};
    if (mappings[key]) return mappings[key];
    const lowerKey = key.toLowerCase();
    const matchedKey = Object.keys(mappings).find((mappingKey) => mappingKey.toLowerCase() === lowerKey);
    return matchedKey ? mappings[matchedKey] : {};
}

export function DynamicSettingsSection({ settings, onChange, readRuntimeModelInfo, modelInfoEventName }) {
    const [modelInfo, setModelInfo] = useState(() => readLiveModelInfo(readRuntimeModelInfo));
    const [availableModels, setAvailableModels] = useState([]);
    const [profiles, setProfiles] = useState(readConnectionProfiles);
    const [newEmotion, setNewEmotion] = useState('');
    const [emotionMessage, setEmotionMessage] = useState('');

    useEffect(() => {
        const refreshProfiles = () => setProfiles(readConnectionProfiles());
        refreshProfiles();
        return subscribeConnectionProfiles(refreshProfiles);
    }, []);
    const [modelFetchState, setModelFetchState] = useState({ loading: false, message: '' });

    useEffect(() => {
        if (typeof window === 'undefined') return undefined;
        const updateModelInfo = (event) => setModelInfoIfChanged(
            setModelInfo,
            event.detail || readLiveModelInfo(readRuntimeModelInfo),
        );
        window.addEventListener(modelInfoEventName, updateModelInfo);
        setModelInfoIfChanged(setModelInfo, readLiveModelInfo(readRuntimeModelInfo));
        return () => window.removeEventListener(modelInfoEventName, updateModelInfo);
    }, [modelInfoEventName, readRuntimeModelInfo]);

    const motionOptions = Object.entries(modelInfo?.motions || {}).flatMap(([groupName, motions]) => (
        motions.map((motion, index) => ({
            value: `${groupName}:${index}`,
            label: `${groupName} / ${getMotionLabel(motion, index)}`,
        }))
    ));
    const expressionOptions = (modelInfo?.expressions || []).map((expression, index) => ({
        value: String(index),
        label: getExpressionLabel(expression, index),
    }));
    const isBuiltInClassifier = settings.analysisSource === ANALYSIS_SOURCES.SILLYTAVERN_CLASSIFIER;
    const isCustom = settings.analysisSource === ANALYSIS_SOURCES.OPENAI;
    const selectedProfile = profiles.find((profile) => profile.id === settings.analysisProfileId);
    const emotionLabels = isBuiltInClassifier ? BUILTIN_CLASSIFIER_EMOTION_LABELS : settings.emotionLabels;
    const priorityRows = settings.priorityList
        .map((item, originalIndex) => ({ item, originalIndex }))
        .filter(({ item }) => !isBuiltInClassifier || item.type !== 'action');

    // Send only the changed keys. handleChange merges the patch onto the
    // authoritative settings object, so spreading the whole (render-time)
    // `settings` snapshot here would revert any field changed since this
    // render and cause lost updates.
    const update = (patch) => onChange({
        routeTtsToLive2D: true,
        blockOriginalTtsPlayback: true,
        ...patch,
    });
    const updateAnalysisSource = (analysisSource) => {
        const patch = { analysisSource };
        if (analysisSource === ANALYSIS_SOURCES.SILLYTAVERN_CLASSIFIER) {
            patch.disableSettings = {
                ...settings.disableSettings,
                actionMotions: true,
                actionExpressions: true,
            };
        }
        update(patch);
    };
    const updateDisable = (key, value) => {
        if (isBuiltInClassifier && key.startsWith('action')) return;
        update({ disableSettings: { ...settings.disableSettings, [key]: value } });
    };
    const updateEmotionMapping = (emotion, patch) => update({
        emotionMappings: {
            ...settings.emotionMappings,
            [emotion]: { ...(settings.emotionMappings?.[emotion] || {}), ...patch },
        },
    });
    const updateActionMapping = (index, patch) => update({
        actionMappings: settings.actionMappings.map((action, actionIndex) => (
            actionIndex === index ? { ...action, ...patch } : action
        )),
    });
    const movePriority = (index, direction) => {
        const visibleIndex = priorityRows.findIndex((row) => row.originalIndex === index);
        const targetRow = priorityRows[visibleIndex + direction];
        if (!targetRow) return;
        const next = [...settings.priorityList];
        const target = targetRow.originalIndex;
        if (target < 0 || target >= next.length) return;
        [next[index], next[target]] = [next[target], next[index]];
        update({ priorityList: next.map((item, itemIndex) => ({ ...item, priority: next.length - itemIndex })) });
    };

    const addActionMapping = () => update({
        actionMappings: [
            ...settings.actionMappings,
            { id: `action-${Date.now()}`, description: '', motion: '', expression: '' },
        ],
    });

    const removeActionMapping = (index) => update({
        actionMappings: settings.actionMappings.filter((_, actionIndex) => actionIndex !== index),
    });

    const fetchModels = async () => {
        if (!isCustom) return;
        setModelFetchState({ loading: true, message: 'Fetching models...' });
        try {
            const models = await fetchOpenAiModels({ baseUrl: settings.analysisBaseUrl, apiKey: settings.analysisApiKey });
            setAvailableModels(models);
            if (models.length > 0 && !settings.analysisModel) update({ analysisModel: models[0].id });
            setModelFetchState({ loading: false, message: `${models.length} model${models.length === 1 ? '' : 's'} found.` });
        } catch (error) {
            setModelFetchState({ loading: false, message: error?.message || 'Failed to fetch models.' });
        }
    };

    const baseEmotionKeys = new Set(DEFAULT_EMOTION_LABELS.map((emotion) => emotion.toLowerCase()));
    const addEmotion = (event) => {
        event.preventDefault();
        const label = newEmotion.trim();
        if (!label) { setEmotionMessage('Enter an emotion name.'); return; }
        if (settings.emotionLabels.some((emotion) => emotion.toLowerCase() === label.toLowerCase())) {
            setEmotionMessage('That emotion is already in the list.'); return;
        }
        update({ emotionLabels: [...settings.emotionLabels, label] });
        setNewEmotion('');
        setEmotionMessage('');
    };
    const removeEmotion = (emotion) => {
        const mappings = { ...settings.emotionMappings };
        for (const key of Object.keys(mappings)) {
            if (key.toLowerCase() === emotion.toLowerCase()) delete mappings[key];
        }
        update({ emotionLabels: settings.emotionLabels.filter((label) => label !== emotion), emotionMappings: mappings });
    };

    return (
        <SubDrawer title="Dynamic Analysis" icon="fa-wand-magic-sparkles" description="Analysis source, cue priorities, and mappings">
            <FieldGroup title="Playback behavior">
                <CheckboxRow
                    label="Dynamic cue mode"
                    checked={settings.dynamicMode}
                    onChange={(value) => update({ dynamicMode: value })}
                />
                <CheckboxRow
                    label="Reload model after playback"
                    checked={settings.reloadModelAfterPlayback}
                    onChange={(value) => update({ reloadModelAfterPlayback: value })}
                />

            </FieldGroup>
            <FieldGroup title="Analysis connection">
                <label className="field">
                    <span>Analysis source</span>
                    <select
                        className="text_pole"
                        aria-label="Analysis source"
                        value={settings.analysisSource}
                        onChange={(event) => updateAnalysisSource(event.target.value)}
                    >
                        <option value={ANALYSIS_SOURCES.OPENAI}>Custom</option>
                        <option value={ANALYSIS_SOURCES.CONNECTION_PROFILE}>Connection Profile</option>
                        <option value={ANALYSIS_SOURCES.SILLYTAVERN_CLASSIFIER}>SillyTavern built-in classifier</option>
                    </select>
                </label>

                {isBuiltInClassifier && (
                    <div className="hint">
                        Built-in classifier mode returns one emotion for the whole TTS text, so Live2D+ plays it as a single segment. Segment splitting and action mappings are only available with Custom or Connection Profile analysis.
                    </div>
                )}

                {isCustom && (
                    <>
                        <label className="field">
                            <span>OpenAI-compatible URL</span>
                            <input
                                className="text_pole"
                                type="url"
                                value={settings.analysisBaseUrl}
                                onChange={(event) => update({ analysisBaseUrl: event.target.value })}
                                placeholder="https://proxy.example.com/v1"
                            />
                        </label>
                        <label className="field">
                            <span>API key</span>
                            <input
                                className="text_pole"
                                type="password"
                                value={settings.analysisApiKey}
                                onChange={(event) => update({ analysisApiKey: event.target.value })}
                                placeholder="Optional bearer token"
                            />
                        </label>
                        <button className="menu_button full-width-action" type="button" onClick={fetchModels} disabled={modelFetchState.loading}>
                            {modelFetchState.loading ? 'Fetching...' : 'Fetch Models'}
                        </button>
                        {modelFetchState.message && <div className="hint">{modelFetchState.message}</div>}
                        <label className="field">
                            <span>Analysis model</span>
                            <select
                                className="text_pole"
                                aria-label="Analysis model"
                                value={settings.analysisModel}
                                onChange={(event) => update({ analysisModel: event.target.value })}
                            >
                                <option value={settings.analysisModel}>{settings.analysisModel || 'Select a model'}</option>
                                {availableModels.map((model) => (
                                    <option key={model.id} value={model.id}>{model.name || model.id}</option>
                                ))}
                            </select>
                        </label>
                    </>
                )}

                {settings.analysisSource === ANALYSIS_SOURCES.CONNECTION_PROFILE && (
                    <>
                        <label className="field"><span>Connection Profile</span>
                            <select className="text_pole" aria-label="Connection Profile" value={settings.analysisProfileId}
                                onChange={(event) => update({ analysisProfileId: event.target.value })}>
                                <option value="">Select a profile</option>
                                {settings.analysisProfileId && !selectedProfile && <option value={settings.analysisProfileId}>Saved profile unavailable</option>}
                                {profiles.map((profile) => <option key={profile.id} value={profile.id}>{profile.name || profile.id} · {profile.model || profile.api}</option>)}
                            </select>
                        </label>
                        <button type="button" className="menu_button full-width-action" onClick={() => setProfiles(readConnectionProfiles())}>Refresh Profiles</button>
                        <div className="hint">Uses the selected profile’s model, API, credentials, and presets. {profiles.length === 0 ? 'Create a supported profile in SillyTavern’s Connection Manager first.' : selectedProfile ? `Model: ${selectedProfile.model || 'API default'}` : 'Choose a profile to enable analysis requests.'}</div>
                    </>
                )}
            </FieldGroup>
            <FieldGroup title="Enabled cue sources">
                <CheckboxRow label="Emotion motions" checked={!settings.disableSettings.emotionMotions} onChange={(value) => updateDisable('emotionMotions', !value)} />
                <CheckboxRow label="Emotion expressions" checked={!settings.disableSettings.emotionExpressions} onChange={(value) => updateDisable('emotionExpressions', !value)} />
                {!isBuiltInClassifier && (
                    <>
                        <CheckboxRow label="Action motions" checked={!settings.disableSettings.actionMotions} onChange={(value) => updateDisable('actionMotions', !value)} />
                        <CheckboxRow label="Action expressions" checked={!settings.disableSettings.actionExpressions} onChange={(value) => updateDisable('actionExpressions', !value)} />
                    </>
                )}

            </FieldGroup>
            <SubDrawer title="Cue priority" description="Top entries take precedence">
                <div className="mapping-list compact">
                    {priorityRows.map(({ item, originalIndex }, visibleIndex) => (
                        <div className="mapping-row priority-row" key={`${item.type}-${item.target}`}>
                            <span>{item.label}</span>
                            <div className="row-actions">
                                <button className="menu_button" type="button" onClick={() => movePriority(originalIndex, -1)} disabled={visibleIndex === 0}>Up</button>
                                <button className="menu_button" type="button" onClick={() => movePriority(originalIndex, 1)} disabled={visibleIndex === priorityRows.length - 1}>Down</button>
                            </div>
                        </div>
                    ))}
                </div>

            </SubDrawer>
            <SubDrawer title="Emotion mappings" description={`${emotionLabels.length} emotions · assign motions and expressions`}>
                {!isBuiltInClassifier && (
                    <>
                        <form className="emotion-editor" onSubmit={addEmotion}>
                            <label className="field"><span>Add an emotion</span>
                                <input className="text_pole" aria-label="New emotion" value={newEmotion} onChange={(event) => { setNewEmotion(event.target.value); setEmotionMessage(''); }} placeholder="e.g. Playful" />
                            </label>
                            <button type="submit" className="menu_button">Add Emotion</button>
                        </form>
                        <div className="hint">Additional emotions are used only while Dynamic cue mode is enabled with Custom or Connection Profile analysis.</div>
                        {emotionMessage && <div className="hint" role="status">{emotionMessage}</div>}
                    </>
                )}
                <div className="mapping-list">
                    {emotionLabels.map((emotion) => {
                        const mapping = readMappingByLabel(settings.emotionMappings, emotion);
                        return (
                            <div className="mapping-row" key={emotion}>
                                <strong>{emotion}{!isBuiltInClassifier && !baseEmotionKeys.has(emotion.toLowerCase()) && <small className="custom-emotion-badge">Custom</small>}</strong>
                                <MappingSelect label="Motion" value={mapping.motion} options={motionOptions} onChange={(value) => updateEmotionMapping(emotion, { motion: value })} />
                                <MappingSelect label="Expression" value={mapping.expression} options={expressionOptions} onChange={(value) => updateEmotionMapping(emotion, { expression: value })} />
                                {!isBuiltInClassifier && !baseEmotionKeys.has(emotion.toLowerCase()) && <button type="button" className="menu_button" aria-label={`Remove emotion ${emotion}`} onClick={() => removeEmotion(emotion)}>Remove</button>}
                            </div>
                        );
                    })}
                </div>

            </SubDrawer>
            {!isBuiltInClassifier && (
                <SubDrawer title="Action mappings" description={`${settings.actionMappings.length} actions · describe and assign cues`}>
                    <div className="mapping-list">
                        {settings.actionMappings.map((action, index) => (
                            <div className="mapping-row" key={action.id || index}>
                                <label className="field compact-field">
                                    <span>Action</span>
                                    <input
                                        className="text_pole"
                                        type="text"
                                        value={action.description || ''}
                                        onChange={(event) => updateActionMapping(index, { description: event.target.value })}
                                        placeholder="laughs, sighs, waves..."
                                    />
                                </label>
                                <MappingSelect label="Motion" value={action.motion} options={motionOptions} onChange={(value) => updateActionMapping(index, { motion: value })} />
                                <MappingSelect label="Expression" value={action.expression} options={expressionOptions} onChange={(value) => updateActionMapping(index, { expression: value })} />
                                <button className="menu_button" type="button" onClick={() => removeActionMapping(index)}>Remove</button>
                            </div>
                        ))}
                    </div>
                    <button className="menu_button full-width-action" type="button" onClick={addActionMapping}>Add Action</button>
                </SubDrawer>
            )}
        </SubDrawer>
    );
}

function TapMessageInput({ value, onChange }) {
    return (
        <label className="field compact-field">
            <span>Message</span>
            <textarea
                aria-label="Message"
                className="text_pole"
                rows={2}
                value={value || ''}
                onChange={(event) => onChange(event.target.value)}
                placeholder="Optional user message"
            />
        </label>
    );
}

export function TapInteractionsSection({ settings, onChange, readRuntimeModelInfo, modelInfoEventName }) {
    const [modelInfo, setModelInfo] = useState(() => readLiveModelInfo(readRuntimeModelInfo));

    const refreshModelInfo = useCallback(() => {
        if (typeof window === 'undefined' || typeof readRuntimeModelInfo !== 'function') {
            setModelInfoIfChanged(setModelInfo, EMPTY_MODEL_INFO);
            return EMPTY_MODEL_INFO;
        }

        const detail = readRuntimeModelInfo(window.live2dPlusModel);
        window.live2dPlusModelInfo = detail;
        setModelInfoIfChanged(setModelInfo, detail);
        return detail;
    }, [readRuntimeModelInfo]);

    useEffect(() => {
        if (typeof window === 'undefined') return undefined;
        const updateModelInfo = (event) => setModelInfoIfChanged(
            setModelInfo,
            event.detail || readLiveModelInfo(readRuntimeModelInfo),
        );
        window.addEventListener(modelInfoEventName, updateModelInfo);
        refreshModelInfo();
        return () => window.removeEventListener(modelInfoEventName, updateModelInfo);
    }, [modelInfoEventName, readRuntimeModelInfo, refreshModelInfo]);

    useEffect(() => {
        refreshModelInfo();
    }, [refreshModelInfo, settings.modelSource, settings.customModelUrl, settings.localModelPath, settings.reloadKey]);

    const motionOptions = Object.entries(modelInfo?.motions || {}).flatMap(([groupName, motions]) => (
        motions.map((motion, index) => ({
            value: `${groupName}:${index}`,
            label: `${groupName} / ${getMotionLabel(motion, index)}`,
        }))
    ));
    const expressionOptions = (modelInfo?.expressions || []).map((expression, index) => ({
        value: String(index),
        label: getExpressionLabel(expression, index),
    }));
    const hitAreas = Array.isArray(modelInfo?.hitAreas) ? modelInfo.hitAreas : [];
    const tapInteractions = settings.tapInteractions || {};
    const defaultMapping = tapInteractions.defaultMapping || {};
    const hitAreaMappings = tapInteractions.hitAreaMappings || {};

    const updateTapInteractions = (patch) => onChange({
        tapInteractions: { ...tapInteractions, ...patch },
    });
    const updateDefaultMapping = (patch) => updateTapInteractions({
        defaultMapping: { ...defaultMapping, ...patch },
    });
    const updateHitAreaMapping = (hitArea, patch) => {
        const current = hitAreaMappings[hitArea.id] || hitAreaMappings[hitArea.name] || {};
        updateTapInteractions({
            hitAreaMappings: {
                ...hitAreaMappings,
                [hitArea.id]: { ...current, ...patch },
            },
        });
    };

    const renderMappingRow = ({ id, name }, mapping, updateMapping) => (
        <div className="mapping-row tap-row" key={id}>
            <strong>{name}</strong>
            <div className="tap-fields">
                <div className="tap-selects">
                    <MappingSelect label="Motion" value={mapping.motion} options={motionOptions} onChange={(value) => updateMapping({ motion: value })} />
                    <MappingSelect label="Expression" value={mapping.expression} options={expressionOptions} onChange={(value) => updateMapping({ expression: value })} />
                </div>
                <TapMessageInput value={mapping.message} onChange={(value) => updateMapping({ message: value })} />
            </div>
        </div>
    );

    return (
        <SubDrawer title="Tap Interactions" icon="fa-hand-pointer" description="Tap responses, hit areas, and chat messages">
            <CheckboxRow
                label="Enable tap interactions"
                checked={tapInteractions.enabled !== false}
                onChange={(value) => updateTapInteractions({ enabled: value })}
            />
            <CheckboxRow
                label="Auto-send interaction"
                checked={!!tapInteractions.autoSend}
                onChange={(value) => updateTapInteractions({ autoSend: value })}
            />
            <CheckboxRow
                label="Allow spam click"
                checked={!!tapInteractions.allowSpamClick}
                onChange={(value) => updateTapInteractions({ allowSpamClick: value })}
            />
            <small className="hint">Reloads the model before a tap motion so repeated clicks can restart it.</small>

            <div className="tap-meta">
                <small>
                    {modelInfo?.name ? `${modelInfo.name}: ${hitAreas.length} hit area${hitAreas.length === 1 ? '' : 's'}` : 'No active model loaded.'}
                </small>
                <button className="menu_button full-width-action" type="button" onClick={refreshModelInfo}>
                    Refresh Hit Areas
                </button>
            </div>

            <div className="section-caption">Default tap</div>
            <div className="mapping-list compact">
                {renderMappingRow(
                    { id: 'default', name: 'Default / model body' },
                    defaultMapping,
                    updateDefaultMapping,
                )}
            </div>

            <div className="section-caption">Hit areas</div>
            {hitAreas.length === 0 ? (
                <div className="hint">No hit areas found on the active model.</div>
            ) : (
                <div className="mapping-list">
                    {hitAreas.map((hitArea) => renderMappingRow(
                        hitArea,
                        hitAreaMappings[hitArea.id] || hitAreaMappings[hitArea.name] || {},
                        (patch) => updateHitAreaMapping(hitArea, patch),
                    ))}
                </div>
            )}
        </SubDrawer>
    );
}
