// Admin CAPI log page: lists every event sent to Meta, with a details window
// showing the exact payload and Meta's reply.

(function () {
    const $ = id => document.getElementById(id);
    const state = { page: 1, status: '', event: '' };

    const LABELS = { sent: 'Sent', failed: 'Failed', skipped: 'Skipped' };
    const COLORS = { sent: '#1e7e46', failed: '#c0392b', skipped: '#8a5300' };
    const JSON_STYLE = 'white-space:pre-wrap;word-break:break-all;background:#f6f7f9;padding:12px;border-radius:8px;font-size:12px;';

    function el(tag, attrs = {}, children = []) {
        const node = document.createElement(tag);
        for (const [key, value] of Object.entries(attrs)) {
            if (key === 'class') node.className = value;
            else if (key.startsWith('on')) node.addEventListener(key.slice(2), value);
            else if (value === true) node.setAttribute(key, '');
            else if (value !== false && value != null) node.setAttribute(key, value);
        }
        const items = Array.isArray(children) ? children : [children];
        for (const child of items) {
            if (child == null) continue;
            node.append(child instanceof Node ? child : document.createTextNode(String(child)));
        }
        return node;
    }

    function fmt(value) {
        return new Date(value).toLocaleString('en-GB', {
            day: 'numeric', month: 'short', year: 'numeric',
            hour: '2-digit', minute: '2-digit', second: '2-digit'
        });
    }

    function isAuthError(err) {
        return err.message === 'Not logged in';
    }

    function showMessage(text, type) {
        const msg = $('page-message');
        msg.textContent = text;
        msg.className = 'form-message' + (type ? ' ' + type : '');
    }

    function emptyRow(text) {
        return el('tr', {}, el('td', { colspan: '7', class: 'empty-cell' }, text));
    }

    function row(log) {
        return el('tr', {}, [
            el('td', {}, fmt(log.createdAt)),
            el('td', {}, log.eventName),
            el('td', {}, log.orderNumber || '-'),
            el('td', {}, el('strong', { style: `color:${COLORS[log.status]}` }, LABELS[log.status] || log.status)),
            el('td', { class: 'num' }, String(log.eventsReceived || 0)),
            el('td', { class: 'muted-small' }, log.errorMessage || ''),
            el('td', {}, el('button', {
                type: 'button',
                class: 'link-order',
                onclick: () => openDetail(log._id)
            }, 'View'))
        ]);
    }

    async function load() {
        const body = $('log-table-body');
        body.replaceChildren(emptyRow('Loading...'));

        const params = new URLSearchParams({ page: String(state.page) });
        if (state.status) params.set('status', state.status);
        if (state.event) params.set('event', state.event);

        try {
            const data = await AdminApi.get(`/api/admin/capi-logs?${params.toString()}`);

            $('log-page-info').textContent = `Page ${data.page} of ${data.pages} (${data.total} entries)`;
            $('log-prev').disabled = data.page <= 1;
            $('log-next').disabled = data.page >= data.pages;

            if (!data.logs.length) {
                body.replaceChildren(emptyRow('No entries. Turn on "Save Conversion API log" in Settings, then trigger an event.'));
                return;
            }
            body.replaceChildren(...data.logs.map(row));
        } catch (err) {
            if (!isAuthError(err)) body.replaceChildren(emptyRow('Could not load the log.'));
        }
    }

    function section(title, ...children) {
        return el('section', { class: 'modal-section' }, [el('h3', {}, title), ...children]);
    }

    function jsonBox(value) {
        return el('pre', { style: JSON_STYLE }, JSON.stringify(value, null, 2));
    }

    async function openDetail(id) {
        $('modal-title').textContent = 'Log entry';
        $('modal-body').replaceChildren(el('p', { class: 'muted' }, 'Loading...'));
        $('log-modal').hidden = false;
        document.body.classList.add('no-scroll');

        try {
            const data = await AdminApi.get(`/api/admin/capi-logs/${encodeURIComponent(id)}`);
            const log = data.log;

            $('modal-title').textContent = `${log.eventName} - ${LABELS[log.status] || log.status}`;

            $('modal-body').replaceChildren(
                section('Summary',
                    el('p', {}, `Time: ${fmt(log.createdAt)}`),
                    el('p', {}, `Event ID: ${log.eventId || '-'}`),
                    el('p', {}, `Order: ${log.orderNumber || '-'}`),
                    el('p', {}, `Pixel ID: ${log.pixelId || '-'}`),
                    el('p', {}, `Test event code: ${log.testEventCode || 'none (live)'}`),
                    el('p', {}, `HTTP status: ${log.httpStatus || '-'}`),
                    el('p', {}, `Events Meta received: ${log.eventsReceived || 0}`),
                    el('p', {}, `Facebook trace ID: ${log.fbtraceId || '-'}`),
                    el('p', {}, `Error: ${log.errorMessage || 'none'}`)
                ),
                section('What the server sent to Meta', jsonBox(log.sentPayload)),
                section("Meta's reply", jsonBox(log.metaResponse))
            );
        } catch (err) {
            if (!isAuthError(err)) {
                $('modal-body').replaceChildren(el('p', { class: 'meta-error' }, err.message));
            }
        }
    }

    function closeDetail() {
        $('log-modal').hidden = true;
        document.body.classList.remove('no-scroll');
    }

    async function clearLog() {
        if (!confirm('Delete every entry in the CAPI log? This cannot be undone.')) return;
        try {
            await AdminApi.del('/api/admin/capi-logs');
            showMessage('Log cleared.', 'success');
            state.page = 1;
            load();
        } catch (err) {
            if (!isAuthError(err)) showMessage(err.message, 'error');
        }
    }

    function init() {
        $('status-filter').addEventListener('change', () => {
            state.status = $('status-filter').value;
            state.page = 1;
            load();
        });

        $('event-filter').addEventListener('change', () => {
            state.event = $('event-filter').value;
            state.page = 1;
            load();
        });

        $('log-prev').addEventListener('click', () => {
            if (state.page > 1) {
                state.page -= 1;
                load();
            }
        });

        $('log-next').addEventListener('click', () => {
            state.page += 1;
            load();
        });

        $('clear-logs').addEventListener('click', clearLog);
        $('modal-close').addEventListener('click', closeDetail);
        $('modal-backdrop').addEventListener('click', closeDetail);
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && !$('log-modal').hidden) closeDetail();
        });

        load();
    }

    init();
})();