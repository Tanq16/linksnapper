document.addEventListener('DOMContentLoaded', () => {
    const ALL_ICONS = [
        'bookmark', 'folder', 'globe', 'github', 'server', 'layout-dashboard',
        'mail', 'hard-drive', 'wifi', 'box', 'shield', 'activity',
        'star', 'link', 'terminal', 'database', 'cloud', 'house',
        'lock', 'file-text', 'code', 'settings', 'folder-open', 'files',
        'file-code', 'book-open', 'library', 'clipboard', 'archive', 'gitlab',
        'git-branch', 'bug', 'braces', 'cpu', 'monitor', 'network',
        'router', 'key', 'shield-check', 'container', 'package', 'calendar',
        'clock', 'message-circle', 'inbox', 'phone', 'bell', 'list-todo',
        'camera', 'image', 'video', 'music', 'gauge', 'plug',
        'lightbulb', 'heart', 'zap', 'external-link', 'pin', 'tag',
        'rocket', 'search', 'compass', 'map', 'map-pin', 'plane',
        'train-front', 'car', 'bus', 'bike', 'ship', 'luggage',
        'hotel', 'shopping-cart', 'store', 'gift', 'wallet', 'credit-card',
        'receipt', 'coins', 'circle-dollar-sign', 'chart-line', 'trending-up', 'calculator',
        'bitcoin', 'heart-pulse', 'hospital', 'stethoscope', 'pill', 'dumbbell',
        'apple', 'utensils', 'coffee', 'book', 'graduation-cap', 'school',
        'pencil', 'notebook-pen', 'headphones', 'podcast', 'film', 'tv',
        'newspaper', 'mic', 'speaker', 'user', 'users', 'briefcase',
        'download', 'upload', 'share-2', 'send', 'printer', 'wrench',
        'palette', 'layers', 'eye', 'keyboard', 'laptop', 'smartphone',
        'sun', 'moon', 'mountain', 'trees', 'paw-print', 'ticket',
        'timer', 'bluetooth', 'satellite', 'rss', 'youtube', 'linkedin', 'slack'
    ];
    const COLORS = ['mauve', 'lavender', 'blue', 'sapphire', 'sky', 'teal', 'green', 'yellow', 'peach', 'red', 'pink', 'subtext0'];
    const state = {
        bookmarks: [],
        links: [],
        route: { view: 'bookmarks', path: [] },
        bookmarkEditID: null,
        linkEditID: null,
        selectedIcon: 'bookmark',
        selectedColor: 'mauve',
        iconsExpanded: false,
        collapsedIconCount: -1,
    };
    let toastTimer;

    const elements = {
        bookmarkFormPanel: document.getElementById('addBmForm'),
        bookmarkForm: document.getElementById('bookmarkForm'),
        bookmarksRoot: document.getElementById('bookmarksRoot'),
        bmEmpty: document.getElementById('bmEmpty'),
        bmSearch: document.getElementById('bmSearch'),
        bmName: document.getElementById('bmName'),
        bmUrl: document.getElementById('bmUrl'),
        bmFolder: document.getElementById('bmFolder'),
        saveBmBtn: document.getElementById('saveBmBtn'),
        iconPicker: document.getElementById('iconPicker'),
        iconMoreBtn: document.getElementById('iconMoreBtn'),
        iconMoreLabel: document.getElementById('iconMoreLabel'),
        colorPicker: document.getElementById('colorPicker'),
        linkFormPanel: document.getElementById('addLinkForm'),
        linkForm: document.getElementById('linkForm'),
        linkList: document.getElementById('linkList'),
        resEmpty: document.getElementById('resEmpty'),
        resSearch: document.getElementById('resSearch'),
        pathTree: document.getElementById('pathTree'),
        resPathLabel: document.getElementById('resPathLabel'),
        resTitle: document.getElementById('resTitle'),
        resCount: document.getElementById('resCount'),
        url: document.getElementById('url'),
        name: document.getElementById('name'),
        category: document.getElementById('category'),
        description: document.getElementById('description'),
        saveLinkBtn: document.getElementById('saveLinkBtn'),
        categorySuggestions: document.getElementById('categorySuggestions'),
        toast: document.getElementById('toast'),
    };

    function escapeHTML(value) {
        return String(value ?? '')
            .replaceAll('&', '&amp;')
            .replaceAll('<', '&lt;')
            .replaceAll('>', '&gt;')
            .replaceAll('"', '&quot;')
            .replaceAll("'", '&#039;');
    }

    function createIcons() {
        if (window.lucide) window.lucide.createIcons();
    }

    function showToast(message, type = 'info') {
        const color = { success: 'text-green', error: 'text-red', warning: 'text-yellow', info: 'text-text' }[type];
        elements.toast.textContent = message;
        elements.toast.className = `fixed bottom-4 right-4 z-50 bg-surface0 px-4 py-3 rounded-lg shadow-xl ${color}`;
        clearTimeout(toastTimer);
        toastTimer = setTimeout(() => elements.toast.classList.add('hidden'), 3500);
    }

    async function api(url, options = {}) {
        const response = await fetch(url, options);
        if (!response.ok) {
            const message = (await response.text()).trim() || `Request failed (${response.status})`;
            throw new Error(message);
        }
        if (response.status === 204) return null;
        const text = await response.text();
        return text ? JSON.parse(text) : null;
    }

    function safeURL(value) {
        try {
            const url = new URL(value);
            return ['http:', 'https:'].includes(url.protocol) ? url.href : '#';
        } catch {
            return '#';
        }
    }

    function hostname(value) {
        try {
            return new URL(value).host;
        } catch {
            return value;
        }
    }

    function normalizeBookmarks(payload) {
        const records = Array.isArray(payload) ? payload : payload?.bookmarks;
        if (!Array.isArray(records)) return [];
        if (records.every((item) => item && ('url' in item || 'id' in item))) {
            return records.map((bookmark) => ({
                ...bookmark,
                id: String(bookmark.id ?? ''),
                folder: String(bookmark.folder || 'Uncategorized'),
                icon: ALL_ICONS.includes(bookmark.icon) ? bookmark.icon : 'bookmark',
                color: COLORS.includes(bookmark.color) ? bookmark.color : 'mauve',
            }));
        }
        const flat = [];
        records.forEach((category) => {
            const categoryName = category.category || category.name || 'Uncategorized';
            (category.links || []).forEach((bookmark, index) => flat.push({
                ...bookmark,
                id: String(bookmark.id ?? `legacy-${flat.length}-${index}`),
                folder: categoryName,
                icon: ALL_ICONS.includes(bookmark.icon) ? bookmark.icon : 'bookmark',
                color: COLORS.includes(bookmark.color) ? bookmark.color : (COLORS.includes(category.color) ? category.color : 'mauve'),
            }));
            (category.folders || []).forEach((folder) => {
                (folder.links || []).forEach((bookmark, index) => flat.push({
                    ...bookmark,
                    id: String(bookmark.id ?? `legacy-${flat.length}-${index}`),
                    folder: `${categoryName}/${folder.name || 'Folder'}`,
                    icon: ALL_ICONS.includes(bookmark.icon) ? bookmark.icon : (ALL_ICONS.includes(folder.icon) ? folder.icon : 'bookmark'),
                    color: COLORS.includes(bookmark.color) ? bookmark.color : (COLORS.includes(category.color) ? category.color : 'mauve'),
                }));
            });
        });
        return flat;
    }

    function normalizeLinks(payload) {
        return (Array.isArray(payload) ? payload : payload?.links || []).map((link) => ({
            ...link,
            id: String(link.id ?? ''),
            path: Array.isArray(link.path)
                ? link.path.map(String).filter(Boolean)
                : String(link.path || link.category || 'Uncategorized').split('/').map((part) => part.trim()).filter(Boolean),
        }));
    }

    async function loadBookmarks() {
        try {
            state.bookmarks = normalizeBookmarks(await api('/api/bookmarks'));
            renderBookmarks();
        } catch (error) {
            state.bookmarks = [];
            renderBookmarks();
            showToast(`Bookmarks: ${error.message}`, 'error');
        }
    }

    async function loadLinks() {
        try {
            state.links = normalizeLinks(await api('/api/links'));
            renderResourcePathTree();
            renderResources();
        } catch (error) {
            state.links = [];
            renderResourcePathTree();
            renderResources();
            showToast(`Resources: ${error.message}`, 'error');
        }
    }

    function bookmarkTree(bookmarks) {
        const root = { name: '', items: [], children: new Map() };
        bookmarks.forEach((bookmark) => {
            const segments = String(bookmark.folder || 'Uncategorized').split('/').map((part) => part.trim()).filter(Boolean);
            let node = root;
            (segments.length ? segments : ['Uncategorized']).forEach((segment) => {
                if (!node.children.has(segment)) node.children.set(segment, { name: segment, items: [], children: new Map() });
                node = node.children.get(segment);
            });
            node.items.push(bookmark);
        });
        return root;
    }

    function bookmarkItemHTML(bookmark) {
        const icon = ALL_ICONS.includes(bookmark.icon) ? bookmark.icon : 'bookmark';
        const color = COLORS.includes(bookmark.color) ? bookmark.color : 'mauve';
        return `<article class="bm-item group flex items-center gap-2 bg-base rounded-lg pl-3.5 pr-2 py-2 hover:bg-surface0 transition-colors">
            <a href="${escapeHTML(safeURL(bookmark.url))}" target="_blank" rel="noopener" class="flex items-center gap-2.5 min-w-0 flex-1 py-0.5">
                <i data-lucide="${icon}" class="w-4 h-4 flex-shrink-0" style="color:var(--${color})"></i>
                <span class="min-w-0">
                    <span class="block text-sm font-medium text-text group-hover:text-mauve transition-colors truncate">${escapeHTML(bookmark.name || bookmark.url)}</span>
                    <span class="block text-[11px] text-subtext0 truncate font-mono">${escapeHTML(hostname(bookmark.url))}</span>
                </span>
            </a>
            <span class="action-buttons flex items-center gap-1 flex-shrink-0">
                <button type="button" data-action="edit-bookmark" data-id="${escapeHTML(bookmark.id)}" class="p-1.5 text-subtext1 hover:text-blue" title="Edit"><i data-lucide="pen" class="w-3.5 h-3.5"></i></button>
                <button type="button" data-action="delete-bookmark" data-id="${escapeHTML(bookmark.id)}" class="p-1.5 text-subtext1 hover:text-red" title="Delete"><i data-lucide="trash-2" class="w-3.5 h-3.5"></i></button>
            </span>
        </article>`;
    }

    function bookmarkGridHTML(items) {
        if (!items.length) return '';
        return `<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">${items.map(bookmarkItemHTML).join('')}</div>`;
    }

    function folderHTML(node, depth = 0) {
        const childFolders = [...node.children.values()].sort((a, b) => a.name.localeCompare(b.name));
        const color = node.items.find((item) => COLORS.includes(item.color))?.color || 'peach';
        return `<details open class="${depth ? 'bm-folder' : ''}">
            <summary class="flex items-center text-subtext1 hover:text-rosewater transition-colors mb-2 text-sm">
                <i data-lucide="chevron-right" class="chevron-icon w-4 h-4 mr-2"></i>
                <i data-lucide="folder" class="w-4 h-4 mr-2" style="color:var(--${color})"></i>${escapeHTML(node.name)}
            </summary>
            <div class="${depth ? 'bm-folder-body' : ''} space-y-3">
                ${bookmarkGridHTML(node.items)}
                ${childFolders.map((child) => folderHTML(child, depth + 1)).join('')}
            </div>
        </details>`;
    }

    function renderBookmarks() {
        const query = elements.bmSearch.value.trim().toLowerCase();
        const visible = state.bookmarks.filter((bookmark) => {
            const searchable = [bookmark.name, bookmark.url, bookmark.folder].join(' ').toLowerCase();
            return !query || query.split(/\s+/).every((word) => searchable.includes(word));
        });
        const tree = bookmarkTree(visible);
        const categories = [...tree.children.values()].sort((a, b) => a.name.localeCompare(b.name));
        elements.bookmarksRoot.innerHTML = categories.map((category) => {
            const categoryColor = category.items.find((item) => COLORS.includes(item.color))?.color || 'sapphire';
            const children = [...category.children.values()].sort((a, b) => a.name.localeCompare(b.name));
            return `<section>
                <details open>
                    <summary class="font-semibold mb-3 flex items-center text-sm tracking-wide" style="color:var(--${categoryColor})">
                        <i data-lucide="chevron-right" class="chevron-icon w-4 h-4 mr-2"></i>${escapeHTML(category.name)}
                    </summary>
                    <div class="space-y-3">${bookmarkGridHTML(category.items)}${children.map((child) => folderHTML(child, 1)).join('')}</div>
                </details>
            </section>`;
        }).join('');
        elements.bookmarksRoot.classList.toggle('hidden', visible.length === 0);
        elements.bmEmpty.classList.toggle('hidden', visible.length !== 0);
        elements.bmEmpty.textContent = query ? 'No bookmarks match that filter.' : 'No bookmarks yet.';
        createIcons();
    }

    function fitIconCount() {
        const width = elements.iconPicker.clientWidth || elements.iconPicker.parentElement.clientWidth;
        return width ? Math.max(8, Math.floor((width + 4) / 32)) : 22;
    }

    function renderIconPicker() {
        const count = state.iconsExpanded ? ALL_ICONS.length : Math.min(fitIconCount(), ALL_ICONS.length);
        if (!state.iconsExpanded) state.collapsedIconCount = count;
        elements.iconPicker.innerHTML = ALL_ICONS.slice(0, count).map((icon) =>
            `<button type="button" class="icon-pick ${icon === state.selectedIcon ? 'selected' : ''} rounded-md bg-crust hover:bg-surface0 flex items-center justify-center text-subtext1" data-icon="${icon}" title="${icon}"><i data-lucide="${icon}" class="w-3.5 h-3.5"></i></button>`
        ).join('');
        createIcons();
    }

    function renderColorPicker() {
        elements.colorPicker.innerHTML = COLORS.map((color) =>
            `<button type="button" class="swatch ${color === state.selectedColor ? 'selected' : ''} w-7 h-7 rounded-full" style="background:var(--${color})" data-color="${color}" title="${color === 'subtext0' ? 'muted' : color}"></button>`
        ).join('');
    }

    function openBookmarkForm(bookmark = null) {
        state.bookmarkEditID = bookmark?.id || null;
        elements.bookmarkForm.reset();
        elements.bmName.value = bookmark?.name || '';
        elements.bmUrl.value = bookmark?.url || '';
        elements.bmFolder.value = bookmark?.folder || '';
        state.selectedIcon = ALL_ICONS.includes(bookmark?.icon) ? bookmark.icon : 'bookmark';
        state.selectedColor = COLORS.includes(bookmark?.color) ? bookmark.color : 'mauve';
        elements.saveBmBtn.textContent = bookmark ? 'Update Bookmark' : 'Save Bookmark';
        elements.bookmarkFormPanel.classList.remove('hidden');
        document.getElementById('addBmBtn').classList.add('hidden');
        renderColorPicker();
        requestAnimationFrame(renderIconPicker);
        elements.bookmarkFormPanel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    function closeBookmarkForm() {
        state.bookmarkEditID = null;
        elements.bookmarkFormPanel.classList.add('hidden');
        document.getElementById('addBmBtn').classList.remove('hidden');
        elements.bookmarkForm.reset();
    }

    async function saveBookmark(event) {
        event.preventDefault();
        const record = {
            name: elements.bmName.value.trim(),
            url: elements.bmUrl.value.trim(),
            folder: elements.bmFolder.value.trim() || 'Uncategorized',
            icon: state.selectedIcon,
            color: state.selectedColor,
        };
        const editing = state.bookmarkEditID !== null;
        try {
            await api(editing ? `/api/bookmarks/${encodeURIComponent(state.bookmarkEditID)}` : '/api/bookmarks', {
                method: editing ? 'PUT' : 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(record),
            });
            closeBookmarkForm();
            await loadBookmarks();
            showToast(editing ? 'Bookmark updated.' : 'Bookmark added.', 'success');
        } catch (error) {
            showToast(error.message, 'error');
        }
    }

    async function deleteBookmark(bookmark) {
        if (!window.confirm(`Delete "${bookmark.name || bookmark.url}"?`)) return;
        try {
            await api(`/api/bookmarks/${encodeURIComponent(bookmark.id)}`, { method: 'DELETE' });
            await loadBookmarks();
            showToast('Bookmark deleted.', 'success');
        } catch (error) {
            showToast(error.message, 'error');
        }
    }

    function pathTree() {
        const root = { name: '', path: [], count: 0, children: new Map() };
        state.links.forEach((link) => {
            root.count++;
            let node = root;
            link.path.forEach((segment) => {
                if (!node.children.has(segment)) node.children.set(segment, {
                    name: segment,
                    path: [...node.path, segment],
                    count: 0,
                    children: new Map(),
                });
                node = node.children.get(segment);
                node.count++;
            });
        });
        return root;
    }

    function pathButtonHTML(node, depth) {
        const value = node.path.join('/');
        const current = state.route.path.join('/');
        const exact = value === current;
        const parent = current.startsWith(`${value}/`);
        const classes = exact ? (depth ? 'active-child' : 'active') : (parent ? 'active' : '');
        const children = [...node.children.values()].sort((a, b) => a.name.localeCompare(b.name));
        return `<div>
            <button type="button" data-path="${escapeHTML(value)}" class="path-btn ${classes} w-full text-left px-2.5 py-1.5 rounded-md text-subtext1 hover:bg-surface0 hover:text-text flex items-center justify-between transition-colors" style="padding-left:${0.625 + depth * 0.75}rem">
                <span class="truncate">${escapeHTML(node.name)}</span><span class="text-[10px] font-mono text-overlay0">${node.count}</span>
            </button>
            ${children.map((child) => pathButtonHTML(child, depth + 1)).join('')}
        </div>`;
    }

    function renderResourcePathTree() {
        const tree = pathTree();
        const current = state.route.path.length === 0;
        elements.pathTree.innerHTML = `<button type="button" data-path="" class="path-btn ${current ? 'active' : ''} w-full text-left px-2.5 py-1.5 rounded-md text-subtext1 hover:bg-surface0 hover:text-text flex items-center justify-between transition-colors"><span>All</span><span class="text-[10px] font-mono text-overlay0">${tree.count}</span></button>${[...tree.children.values()].sort((a, b) => a.name.localeCompare(b.name)).map((node) => pathButtonHTML(node, 0)).join('')}`;
    }

    function healthPresentation(link) {
        const status = String(link.health?.status || '').toLowerCase();
        if (['unhealthy', 'down', 'error'].includes(status)) return ['triangle-alert', 'red', link.health?.error || 'Unhealthy'];
        if (['pending', 'checking', 'unknown'].includes(status) || !status) return ['circle-help', 'overlay1', 'Health unknown'];
        return ['check-circle', 'green', `Healthy${link.health?.statusCode ? ` (${link.health.statusCode})` : ''}`];
    }

    function resourceRowHTML(link) {
        const [healthIcon, healthColor, healthTitle] = healthPresentation(link);
        return `<article class="res-row group flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-base transition-colors">
            <i data-lucide="${healthIcon}" class="w-4 h-4 flex-shrink-0" style="color:var(--${healthColor})" title="${escapeHTML(healthTitle)}"></i>
            <a href="${escapeHTML(safeURL(link.url))}" target="_blank" rel="noopener" class="min-w-0 flex-1">
                <span class="block text-sm font-medium group-hover:text-mauve transition-colors truncate">${escapeHTML(link.name || link.url)}</span>
                <span class="block text-xs text-subtext0 truncate">${escapeHTML(link.description || link.url)}</span>
            </a>
            <span class="text-[10px] font-mono text-overlay0 hidden md:block flex-shrink-0">${escapeHTML(hostname(link.url))}</span>
            <span class="action-buttons flex items-center gap-2 flex-shrink-0">
                <button type="button" data-action="edit-link" data-id="${escapeHTML(link.id)}" class="text-subtext1 hover:text-blue" title="Edit"><i data-lucide="pen" class="w-3.5 h-3.5"></i></button>
                <button type="button" data-action="delete-link" data-id="${escapeHTML(link.id)}" class="text-subtext1 hover:text-red" title="Delete"><i data-lucide="trash-2" class="w-3.5 h-3.5"></i></button>
            </span>
        </article>`;
    }

    function renderResources() {
        const query = elements.resSearch.value.trim().toLowerCase();
        const currentPath = state.route.path.join('/');
        const links = state.links.filter((link) => {
            const matchesPath = query || !currentPath || link.path.join('/') === currentPath;
            const searchable = [link.name, link.description, link.url, ...link.path].join(' ').toLowerCase();
            return matchesPath && (!query || query.split(/\s+/).every((word) => searchable.includes(word)));
        });
        const title = query ? 'Search results' : (state.route.path.at(-1) || 'Library');
        elements.resPathLabel.textContent = query ? `Searching all resources for “${elements.resSearch.value.trim()}”` : (currentPath ? state.route.path.join(' / ') : 'All resources');
        elements.resTitle.textContent = title;
        elements.resCount.textContent = `${links.length} ${links.length === 1 ? 'resource' : 'resources'}`;
        elements.linkList.innerHTML = links.map(resourceRowHTML).join('');
        elements.linkList.classList.toggle('hidden', links.length === 0);
        elements.resEmpty.classList.toggle('hidden', links.length !== 0);
        elements.resEmpty.textContent = query ? 'No matches found.' : 'No resources in this path.';
        createIcons();
    }

    function allResourcePaths() {
        const paths = new Set();
        state.links.forEach((link) => {
            link.path.forEach((_, index) => paths.add(link.path.slice(0, index + 1).join('/')));
        });
        return [...paths].sort();
    }

    function openLinkForm(link = null) {
        state.linkEditID = link?.id || null;
        elements.linkForm.reset();
        elements.url.value = link?.url || '';
        elements.name.value = link?.name || '';
        elements.category.value = link?.path?.join('/') || (state.route.path.join('/') || '');
        elements.description.value = link?.description || '';
        elements.saveLinkBtn.textContent = link ? 'Update Link' : 'Save Link';
        elements.linkFormPanel.classList.remove('hidden');
        document.getElementById('addLinkBtn').classList.add('hidden');
        elements.linkFormPanel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    function closeLinkForm() {
        state.linkEditID = null;
        elements.linkFormPanel.classList.add('hidden');
        document.getElementById('addLinkBtn').classList.remove('hidden');
        elements.categorySuggestions.classList.add('hidden');
        elements.linkForm.reset();
    }

    async function saveLink(event) {
        event.preventDefault();
        const record = {
            url: elements.url.value.trim(),
            name: elements.name.value.trim() || elements.url.value.trim(),
            description: elements.description.value.trim(),
            path: elements.category.value.split('/').map((part) => part.trim()).filter(Boolean),
        };
        if (!record.path.length) record.path = ['Uncategorized'];
        const editing = state.linkEditID !== null;
        try {
            await api(editing ? `/api/links/${encodeURIComponent(state.linkEditID)}` : '/api/links', {
                method: editing ? 'PUT' : 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(record),
            });
            closeLinkForm();
            await loadLinks();
            showToast(editing ? 'Resource updated.' : 'Resource added.', 'success');
        } catch (error) {
            showToast(error.message, 'error');
        }
    }

    async function deleteLink(link) {
        if (!window.confirm(`Delete "${link.name || link.url}"?`)) return;
        try {
            await api(`/api/links/${encodeURIComponent(link.id)}`, { method: 'DELETE' });
            await loadLinks();
            showToast('Resource deleted.', 'success');
        } catch (error) {
            showToast(error.message, 'error');
        }
    }

    function routeHashFor(path) {
        return `#resources${path.length ? `/${path.map(encodeURIComponent).join('/')}` : ''}`;
    }

    function readRoute() {
        const raw = window.location.hash.replace(/^#\/?/, '');
        const parts = raw.split('/').filter(Boolean);
        const view = ['bookmarks', 'resources', 'settings'].includes(parts[0]) ? parts[0] : 'bookmarks';
        const path = view === 'resources' ? parts.slice(1).map((part) => {
            try { return decodeURIComponent(part); } catch { return part; }
        }) : [];
        state.route = { view, path };
        document.querySelectorAll('.view').forEach((viewElement) => viewElement.classList.toggle('active', viewElement.id === `view-${view}`));
        document.querySelectorAll('.view-btn').forEach((button) => {
            const active = button.dataset.view === view;
            button.classList.toggle('bg-surface0', active);
            button.classList.toggle('text-text', active);
            button.classList.toggle('text-subtext0', !active);
            button.setAttribute('aria-current', active ? 'page' : 'false');
        });
        if (view === 'resources') {
            renderResourcePathTree();
            renderResources();
        }
        createIcons();
    }

    async function downloadFrom(endpoint, filename) {
        try {
            const response = await fetch(endpoint);
            if (!response.ok) throw new Error((await response.text()).trim() || 'Export failed');
            const blob = await response.blob();
            const url = URL.createObjectURL(blob);
            const anchor = document.createElement('a');
            anchor.href = url;
            anchor.download = filename;
            document.body.appendChild(anchor);
            anchor.click();
            anchor.remove();
            URL.revokeObjectURL(url);
            showToast('Export downloaded.', 'success');
        } catch (error) {
            showToast(error.message, 'error');
        }
    }

    async function importFile(file, kind) {
        if (!file) return;
        try {
            const parsed = JSON.parse(await file.text());
            const key = kind === 'resources' ? 'links' : 'bookmarks';
            const records = Array.isArray(parsed) ? parsed : parsed[key];
            if (!Array.isArray(records)) throw new Error(`The file does not contain a ${key} array.`);
            await api(kind === 'resources' ? '/api/links/import' : '/api/bookmarks/import', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ mode: 'merge', [key]: records }),
            });
            if (kind === 'resources') await loadLinks();
            else await loadBookmarks();
            showToast(`${records.length} ${kind} submitted for merge.`, 'success');
        } catch (error) {
            showToast(error.message, 'error');
        }
    }

    document.querySelectorAll('.view-btn').forEach((button) => button.addEventListener('click', () => {
        window.location.hash = button.dataset.view;
    }));
    window.addEventListener('hashchange', readRoute);

    document.getElementById('addBmBtn').addEventListener('click', () => openBookmarkForm());
    document.getElementById('cancelBmBtn').addEventListener('click', closeBookmarkForm);
    elements.bookmarkForm.addEventListener('submit', saveBookmark);
    elements.bmSearch.addEventListener('input', renderBookmarks);
    elements.iconPicker.addEventListener('click', (event) => {
        const button = event.target.closest('[data-icon]');
        if (!button) return;
        state.selectedIcon = button.dataset.icon;
        renderIconPicker();
    });
    elements.colorPicker.addEventListener('click', (event) => {
        const button = event.target.closest('[data-color]');
        if (!button) return;
        state.selectedColor = button.dataset.color;
        renderColorPicker();
    });
    elements.iconMoreBtn.addEventListener('click', () => {
        state.iconsExpanded = !state.iconsExpanded;
        elements.iconMoreLabel.textContent = state.iconsExpanded ? 'Show less' : 'Show more';
        elements.iconMoreBtn.classList.toggle('is-expanded', state.iconsExpanded);
        renderIconPicker();
    });
    elements.bookmarksRoot.addEventListener('click', (event) => {
        const button = event.target.closest('[data-action]');
        if (!button) return;
        const bookmark = state.bookmarks.find((item) => item.id === button.dataset.id);
        if (!bookmark) return;
        if (button.dataset.action === 'edit-bookmark') openBookmarkForm(bookmark);
        if (button.dataset.action === 'delete-bookmark') deleteBookmark(bookmark);
    });

    document.getElementById('addLinkBtn').addEventListener('click', () => openLinkForm());
    document.getElementById('cancelLinkBtn').addEventListener('click', closeLinkForm);
    elements.linkForm.addEventListener('submit', saveLink);
    elements.resSearch.addEventListener('input', renderResources);
    elements.pathTree.addEventListener('click', (event) => {
        const button = event.target.closest('[data-path]');
        if (!button) return;
        window.location.hash = routeHashFor(button.dataset.path ? button.dataset.path.split('/') : []);
    });
    elements.linkList.addEventListener('click', (event) => {
        const button = event.target.closest('[data-action]');
        if (!button) return;
        const link = state.links.find((item) => item.id === button.dataset.id);
        if (!link) return;
        if (button.dataset.action === 'edit-link') openLinkForm(link);
        if (button.dataset.action === 'delete-link') deleteLink(link);
    });
    elements.category.addEventListener('input', () => {
        const query = elements.category.value.trim().toLowerCase();
        const matches = query ? allResourcePaths().filter((path) => path.toLowerCase().includes(query)).slice(0, 10) : [];
        elements.categorySuggestions.innerHTML = matches.map((path) => `<button type="button" class="category-suggestion block w-full text-left p-2.5 text-subtext1 hover:bg-surface1">${escapeHTML(path)}</button>`).join('');
        elements.categorySuggestions.classList.toggle('hidden', matches.length === 0);
    });
    elements.categorySuggestions.addEventListener('click', (event) => {
        const suggestion = event.target.closest('.category-suggestion');
        if (!suggestion) return;
        elements.category.value = suggestion.textContent;
        elements.categorySuggestions.classList.add('hidden');
    });
    document.addEventListener('click', (event) => {
        if (!elements.category.contains(event.target) && !elements.categorySuggestions.contains(event.target)) {
            elements.categorySuggestions.classList.add('hidden');
        }
    });

    const date = new Date().toISOString().slice(0, 10);
    document.getElementById('exportResourcesBtn').addEventListener('click', () => downloadFrom('/api/links', `linksnapper-resources-${date}.json`));
    document.getElementById('exportBookmarksBtn').addEventListener('click', () => downloadFrom('/api/bookmarks/export', `linksnapper-bookmarks-${date}.json`));
    document.getElementById('importResourcesBtn').addEventListener('click', () => document.getElementById('resourcesFileInput').click());
    document.getElementById('importBookmarksBtn').addEventListener('click', () => document.getElementById('bookmarksFileInput').click());
    document.getElementById('resourcesFileInput').addEventListener('change', async (event) => {
        await importFile(event.target.files[0], 'resources');
        event.target.value = '';
    });
    document.getElementById('bookmarksFileInput').addEventListener('change', async (event) => {
        await importFile(event.target.files[0], 'bookmarks');
        event.target.value = '';
    });

    if ('ResizeObserver' in window) {
        new ResizeObserver(() => {
            if (!state.iconsExpanded && fitIconCount() !== state.collapsedIconCount) renderIconPicker();
        }).observe(elements.iconPicker.parentElement);
    }

    api('/api/health').then((health) => {
        if (health?.version) document.getElementById('appVersion').textContent = String(health.version);
    }).catch(() => {});
    if (!window.location.hash) window.location.hash = 'bookmarks';
    readRoute();
    renderColorPicker();
    renderIconPicker();
    Promise.all([loadBookmarks(), loadLinks()]);
    createIcons();
});

if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => navigator.serviceWorker.register('/static/sw.js').catch(() => {}));
}
