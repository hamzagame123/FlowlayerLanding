const ORDERED_APIS = [
    { id: 'places', label: 'Google Places', matcher: url => /maps\.googleapis\.com\/maps\/api\/js/i.test(url) },
    { id: 'routes', label: 'Google Routes', matcher: url => /routes\.googleapis\.com/i.test(url) },
    { id: 'live-token', label: 'Gemini Live Token', matcher: url => /\/api\/live-token$/i.test(url) },
    { id: 'live-session', label: 'Gemini Live Session', matcher: url => /gemini-live-session/i.test(url) },
    { id: 'route-radar', label: 'Gemini Route Radar', matcher: url => /\/api\/route-radar$/i.test(url) },
];

function timeLabel() {
    return new Date().toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
    });
}

function normalizeUrl(input) {
    if (typeof input === 'string') return input;
    if (input instanceof URL) return input.toString();
    if (typeof Request !== 'undefined' && input instanceof Request) return input.url;
    return String(input || '');
}

export class ApiTracker {
    constructor() {
        this.states = new Map(ORDERED_APIS.map(item => [item.id, {
            label: item.label,
            status: 'idle',
            detail: 'Waiting',
            count: 0,
        }]));
        this.logs = [];
        this.fetchInstalled = false;
        this.bound = false;
    }

    bind() {
        if (this.bound) return;
        this.stackListEl = document.getElementById('apiCallStackList');
        this.logListEl = document.getElementById('apiCallLogList');
        this.bound = true;
        this.render();
    }

    installFetchHook() {
        if (this.fetchInstalled || typeof window === 'undefined' || typeof window.fetch !== 'function') return;
        this.fetchInstalled = true;
        const originalFetch = window.fetch.bind(window);
        window.fetch = async (...args) => {
            const url = normalizeUrl(args[0]);
            const matched = this.match(url);
            const handle = matched ? this.begin(matched.id, matched.label, this.describe(url)) : null;
            try {
                const response = await originalFetch(...args);
                if (handle) {
                    this.finish(handle, response.ok ? 'success' : 'error', `${response.status} ${response.statusText || ''}`.trim());
                }
                return response;
            } catch (error) {
                if (handle) {
                    this.finish(handle, 'error', String(error?.message || error));
                }
                throw error;
            }
        };
    }

    match(url) {
        return ORDERED_APIS.find(item => item.matcher(url)) || null;
    }

    describe(url) {
        if (/maps\.googleapis\.com\/maps\/api\/js/i.test(url)) return 'Loading browser library';
        if (/routes\.googleapis\.com/i.test(url)) return 'Computing route';
        if (/\/api\/live-token$/i.test(url)) return 'Minting ephemeral token';
        if (/\/api\/route-radar$/i.test(url)) return 'Grounding nearby places';
        return 'Request in flight';
    }

    begin(id, label, detail = 'Starting') {
        const state = this.states.get(id) || { label, status: 'idle', detail: 'Waiting', count: 0 };
        state.status = 'active';
        state.detail = detail;
        state.count += 1;
        this.states.set(id, state);
        this.pushLog(label, 'active', detail);
        this.render();
        return { id, label };
    }

    finish(handle, status, detail = '') {
        if (!handle) return;
        const state = this.states.get(handle.id);
        if (state) {
            state.status = status;
            state.detail = detail || (status === 'success' ? 'Ready' : 'Issue');
            this.states.set(handle.id, state);
        }
        this.pushLog(handle.label, status, detail);
        this.render();
    }

    mark(id, status, detail = '') {
        const item = ORDERED_APIS.find(entry => entry.id === id);
        const label = item?.label || id;
        const state = this.states.get(id) || { label, status: 'idle', detail: 'Waiting', count: 0 };
        state.status = status;
        state.detail = detail || state.detail;
        this.states.set(id, state);
        this.pushLog(label, status, detail);
        this.render();
    }

    pushLog(label, status, detail) {
        this.logs.unshift({
            label,
            status,
            detail: detail || '',
            at: timeLabel(),
        });
        this.logs = this.logs.slice(0, 6);
    }

    render() {
        this.bind();
        if (this.stackListEl) {
            this.stackListEl.innerHTML = ORDERED_APIS.map(item => {
                const state = this.states.get(item.id);
                return `
                    <li class="api-stack-item is-${state.status}">
                        <span class="api-stack-dot"></span>
                        <div class="api-stack-copy">
                            <span class="api-stack-name">${state.label}</span>
                            <span class="api-stack-detail">${state.detail}</span>
                        </div>
                    </li>
                `;
            }).join('');
        }

        if (this.logListEl) {
            this.logListEl.innerHTML = this.logs.map(entry => `
                <li class="api-log-item is-${entry.status}">
                    <span class="api-log-time">${entry.at}</span>
                    <span class="api-log-label">${entry.label}</span>
                </li>
            `).join('');
        }
    }
}

export function installApiTracker() {
    const tracker = new ApiTracker();
    tracker.installFetchHook();
    if (typeof window !== 'undefined') {
        window.flowlayerApiTracker = tracker;
    }
    return tracker;
}
