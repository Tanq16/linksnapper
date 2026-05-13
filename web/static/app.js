document.addEventListener('DOMContentLoaded', function() {
    const addLinkBtn = document.getElementById('addLinkBtn');
    const addLinkForm = document.getElementById('addLinkForm');
    const linkForm = document.getElementById('linkForm');
    const cancelBtn = document.getElementById('cancelBtn');
    const contentArea = document.getElementById('contentArea');
    const breadcrumb = document.getElementById('breadcrumb');
    const searchInput = document.getElementById('searchInput');
    const downloadLinksBtn = document.getElementById('downloadLinksBtn');
    
    let searchTimeout;
    let isSearching = false;
    let currentLinks = [];
    let currentPath = [];

    const syncHashToPath = () => {
        let hash = window.location.hash.slice(1).replace(/^\//, '');
        currentPath = hash ? hash.split('/').map(decodeURIComponent) : [];
        renderCurrentLevel();
    };

    window.addEventListener('hashchange', syncHashToPath);


    setTimeout(syncHashToPath, 100);


    fetchData();
    setupCategoryAutocomplete();

    downloadLinksBtn.addEventListener('click', async () => {
        try {
            const response = await fetch('/api/links');
            if (!response.ok) throw new Error('Failed to fetch links');
            const links = await response.json();
            const blob = new Blob([JSON.stringify(links, null, 2)], { type: 'application/json' });
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `linksnapper-export-${new Date().toISOString().split('T')[0]}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
        } catch (error) {
            console.error('Error downloading links:', error);
            alert('Failed to download links');
        }
    });

    searchInput.addEventListener('input', (e) => {
        const searchTerm = e.target.value.toLowerCase().trim();
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => {
            isSearching = searchTerm !== '';
            if (isSearching) {
                const searchWords = searchTerm.split(/\s+/).filter(word => word.length > 0);
                const searchResults = currentLinks.filter(link => {
                    const allContent = [link.name, link.description, link.url, ...link.path].join(' ').toLowerCase();
                    return searchWords.every(word => allContent.includes(word));
                });
                renderSearchResults(searchResults, searchTerm);
            } else {
                renderCurrentLevel();
            }
        }, 300);
    });

    function renderLinkItem(link) {
        const isUnhealthy = link.health?.status === 'unhealthy';
        const healthIcon = isUnhealthy ? 'triangle-alert' : 'check-circle';
        const healthIconClass = isUnhealthy ? 'text-red w-4 h-4 mr-2' : 'text-green w-4 h-4 mr-2';
        return `<div class="group bg-base rounded-lg p-5 transition-all duration-200 hover:bg-surface0 hover:shadow-xl relative">
            <div class="absolute top-5 right-5 flex items-center gap-3">
                <button title="Edit" class="edit-btn text-subtext1 hover:text-blue transition-colors" data-id="${link.id}">
                    <i data-lucide="pen" class="w-4 h-4"></i>
                </button>
                <button title="Delete" class="delete-btn text-subtext1 hover:text-red transition-colors" data-id="${link.id}">
                    <i data-lucide="trash-2" class="w-4 h-4"></i>
                </button>
            </div>
            <a href="${link.url}" target="_blank" class="block pr-12">
                <div class="flex items-start gap-3">
                    <i data-lucide="${healthIcon}" class="${healthIconClass} mt-1 flex-shrink-0"></i>
                    <p class="font-semibold text-text break-words">${link.name}</p>
                </div>
                ${link.description ? `<p class="text-sm text-subtext0 mt-2 break-words">${link.description}</p>` : ''}
            </a>
        </div>`;
    }
    
    function renderSearchResults(results, searchTerm) {
        let html = `<h2 class="text-xl font-bold text-lavender mb-6 text-center tracking-wider uppercase">Search Results for "${searchTerm}"</h2>`;
        if (results.length === 0) {
            html += '<p class="text-subtext0 text-center">No matches found.</p>';
        } else {
            html += '<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">';
            results.forEach(link => { html += renderLinkItem(link); });
            html += '</div>';
        }
        contentArea.innerHTML = html;
        if (typeof lucide !== "undefined") lucide.createIcons();
        attachLinkActionHandlers();
    }

    function attachLinkActionHandlers() {
        contentArea.querySelectorAll('.delete-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const id = e.currentTarget.dataset.id;
                const linkName = e.currentTarget.closest('.group').querySelector('p.font-semibold').textContent;
                if (confirm(`Are you sure you want to delete "${linkName}"?`)) {
                    try {
                        const response = await fetch(`/api/links/${id}`, { method: 'DELETE' });
                        if (!response.ok) throw new Error('Failed to delete link');
                        fetchData();
                    } catch (error) {
                        console.error('Error deleting link:', error);
                        alert('Failed to delete link');
                    }
                }
            });
        });
        contentArea.querySelectorAll('.edit-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = e.currentTarget.dataset.id;
                const link = currentLinks.find(l => l.id === id);
                if (link) showEditForm(link);
            });
        });
    }

    addLinkBtn.addEventListener('click', () => {
        addLinkForm.style.display = 'block';
        addLinkBtn.classList.add('hidden');
        downloadLinksBtn.classList.add('hidden');
    });

    cancelBtn.addEventListener('click', () => {
        addLinkForm.style.display = 'none';
        addLinkBtn.classList.remove('hidden');
        downloadLinksBtn.classList.remove('hidden');
        linkForm.reset();
        delete linkForm.dataset.mode;
        delete linkForm.dataset.editId;
    });

    linkForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        const formData = {
            url: document.getElementById('url').value,
            name: document.getElementById('name').value || document.getElementById('url').value,
            description: document.getElementById('description').value,
            path: document.getElementById('category').value.split('/').filter(p => p.trim() !== '')
        };
        if (formData.path.length === 0) formData.path = ['Uncategorized'];
        const isEdit = this.dataset.mode === 'edit';
        const url = isEdit ? `/api/links/${this.dataset.editId}` : '/api/links';
        const method = isEdit ? 'PUT' : 'POST';
        try {
            const response = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(formData) });
            if (!response.ok) {
                let errorMessage = isEdit ? 'Failed to update link' : 'Failed to add link';
                if (response.status === 409) {
                    errorMessage = await response.text();
                }
                throw new Error(errorMessage);
            }
            cancelBtn.click();
            fetchData();
        } catch (error) {
            console.error('Error:', error);
            alert(error.message);
        }
    });

    async function fetchData() {
        try {
            const response = await fetch('/api/links');
            if (!response.ok) throw new Error('Failed to fetch links');
            currentLinks = await response.json() || [];
            renderCurrentLevel();
        } catch (error) {
            console.error('Error fetching data:', error);
            contentArea.innerHTML = '<p class="text-center text-red">Failed to load data. Please try refreshing the page.</p>';
        }
    }

    function renderBreadcrumb() {
        const homeIcon = `<a href="#" class="hover:text-text" data-path=""><i data-lucide="home" class="w-4 h-4"></i></a>`;
        const separator = `<i data-lucide="chevron-right" class="w-4 h-4 text-overlay1"></i>`;
        const items = currentPath.map((segment, index) => {
            const path = currentPath.slice(0, index + 1).join('/');
            return `<a href="#" class="hover:text-text" data-path="${path}">${segment}</a>`;
        });
        breadcrumb.innerHTML = [homeIcon, ...items].join(` <span class="px-2">${separator}</span> `);
        breadcrumb.querySelectorAll('a').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                window.location.hash = e.currentTarget.dataset.path || '/';
            });
        });
    }

    function renderCurrentLevel() {
        renderBreadcrumb();
        const currentLevelLinks = filterLinksByPath(currentPath);
        const subCategories = getSubCategories(currentPath);
        let html = '';
        if (subCategories.length > 0) {
            html += `<div class="mb-12">
                <h2 class="text-xl font-bold text-lavender mb-6 text-center tracking-wider uppercase">Categories</h2>
                <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">`;
            subCategories.forEach(category => {
                html += `<a href="#" class="category-link flex items-center gap-3 bg-base p-4 rounded-lg hover:bg-surface0 transition-colors" data-category="${category}">
                    <i data-lucide="folder" class="w-5 h-5 text-blue"></i>
                    <span class="font-medium text-text">${category}</span>
                </a>`;
            });
            html += `</div></div>`;
        }
        if (currentLevelLinks.length > 0) {
            html += `<div>
                <h2 class="text-xl font-bold text-lavender mb-6 text-center tracking-wider uppercase">Links</h2>
                <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">`;
            currentLevelLinks.forEach(link => { html += renderLinkItem(link); });
            html += `</div></div>`;
        }
        if (html === '') {
            html = '<p class="text-center text-subtext0">No content in this category.</p>';
        }
        contentArea.innerHTML = html;
        contentArea.querySelectorAll('.category-link').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const currentHash = window.location.hash.slice(1).replace(/^\//, '');
                window.location.hash = (currentHash ? currentHash + '/' : '') + e.currentTarget.dataset.category;
            });
        });
        if (typeof lucide !== "undefined") lucide.createIcons();
        attachLinkActionHandlers();
    }

    function filterLinksByPath(path) {
        return (currentLinks || []).filter(link => link.path.join('/') === path.join('/'));
    }

    function getSubCategories(currentPath) {
        const subCategories = new Set();
        const prefix = currentPath.length > 0 ? currentPath.join('/') + '/' : '';
        (currentLinks || []).forEach(link => {
            if (link.path.join('/').startsWith(prefix)) {
                const nextSegment = link.path[currentPath.length];
                if (nextSegment) subCategories.add(nextSegment);
            }
        });
        return Array.from(subCategories).sort();
    }

    function showEditForm(link) {
        document.getElementById('url').value = link.url;
        document.getElementById('name').value = link.name;
        document.getElementById('description').value = link.description || '';
        document.getElementById('category').value = link.path.join('/');
        linkForm.dataset.mode = 'edit';
        linkForm.dataset.editId = link.id;
        addLinkForm.style.display = 'block';
        addLinkBtn.classList.add('hidden');
        downloadLinksBtn.classList.add('hidden');
    }

    function getAllUniquePaths() {
        const paths = new Set();
        (currentLinks || []).forEach(link => {
            let partialPath = '';
            (link.path || []).forEach(segment => {
                partialPath = partialPath ? `${partialPath}/${segment}` : segment;
                paths.add(partialPath);
            });
        });
        return Array.from(paths).sort();
    }
    
    function setupCategoryAutocomplete() {
        const categoryInput = document.getElementById('category');
        const suggestionsDiv = document.createElement('div');
        suggestionsDiv.className = 'absolute top-full left-0 right-0 bg-surface0 border border-surface1 rounded-md mt-1 max-h-60 overflow-y-auto z-50 shadow-lg';
        suggestionsDiv.style.display = 'none';
        categoryInput.parentNode.insertBefore(suggestionsDiv, categoryInput.nextSibling);
        categoryInput.addEventListener('input', () => {
            const value = categoryInput.value.toLowerCase();
            const paths = getAllUniquePaths();
            const matches = value ? paths.filter(path => path.toLowerCase().includes(value)) : [];

            if (matches.length > 0) {
                suggestionsDiv.innerHTML = matches.map(path => `<div class="suggestion-item p-2.5 cursor-pointer text-subtext1 hover:bg-surface1">${path}</div>`).join('');
                suggestionsDiv.style.display = 'block';
            } else {
                suggestionsDiv.style.display = 'none';
            }
        });
        suggestionsDiv.addEventListener('click', (e) => {
            const suggestion = e.target.closest('.suggestion-item');
            if (suggestion) {
                categoryInput.value = suggestion.textContent;
                suggestionsDiv.style.display = 'none';
            }
        });
        document.addEventListener('click', (e) => {
            if (!categoryInput.contains(e.target) && !suggestionsDiv.contains(e.target)) {
                suggestionsDiv.style.display = 'none';
            }
        });
    }
});

if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js').then(
            () => console.log('ServiceWorker registration successful'),
            (err) => console.log('ServiceWorker registration failed: ', err)
        );
    });
}


document.addEventListener('DOMContentLoaded', () => {
    if (typeof lucide !== 'undefined') {
        lucide.createIcons();
    }
});


const createLinkHTML = (link) => `
    <a href="${link.url}" class="flex items-center text-ctp-subtext1 hover:text-ctp-rosewater transition-colors" target="_blank">
        <i data-lucide="${link.icon}" class="w-4 h-4 mr-3"></i>${link.name || 'Unnamed'}
    </a>`;

const createFolderHTML = (folder) => `
    <details ${folder.folded ? '' : 'open'}>
        <summary class="flex items-center text-ctp-subtext1 hover:text-ctp-rosewater transition-colors mb-2">
            <i data-lucide="chevron-right" class="chevron-icon w-4 h-4 mr-2"></i>
            <i data-lucide="${folder.icon}" class="w-4 h-4 mr-2 text-ctp-peach"></i>
            ${folder.name || 'Unnamed'}
        </summary>
        <div class="pl-10 space-y-2">
            ${folder.links.map(createLinkHTML).join('')}
        </div>
    </details>`;

const createCategoryHTML = (cat) => `
    <details ${cat.folded ? '' : 'open'}>
        <summary class="font-semibold text-${cat.color || 'ctp-green'} mb-2 flex items-center">
            <i data-lucide="chevron-right" class="chevron-icon w-4 h-4 mr-2"></i>${cat.category}
        </summary>
        <div class="space-y-2 pl-6 mb-4">
            ${(cat.links || []).map(createLinkHTML).join('')}
            ${(cat.folders || []).map(createFolderHTML).join('')}
        </div>
    </details>`;

const renderBookmarks = async () => {
    try {
        const response = await fetch('/api/bookmarks');
        if (response.ok) {
            const data = await response.json();
            const container = document.getElementById('bookmarks-container');
            if (data && data.length > 0) {
                container.innerHTML = data.map(createCategoryHTML).join('');
                if (typeof lucide !== 'undefined') lucide.createIcons();
            } else {
                container.innerHTML = '<p class="text-subtext0 italic">No bookmarks configured.</p>';
            }
        }
    } catch (e) {
        console.error("Failed to render bookmarks:", e);
    }
};

document.addEventListener('DOMContentLoaded', renderBookmarks);


const initSettingsModal = () => {
    const modal = document.getElementById('settings-modal');
    const openBtn = document.getElementById('open-settings-btn');
    const closeBtn = document.getElementById('close-modal-btn');
    const cancelBtn = document.getElementById('cancel-btn');
    const saveBtn = document.getElementById('save-btn');
    const saveBtnText = document.getElementById('save-btn-text');
    const saveSpinner = document.getElementById('save-spinner');
    const editor = document.getElementById('config-editor');
    const saveStatus = document.getElementById('save-status');

    const openModal = async () => {
        modal.classList.remove('hidden');
        modal.classList.add('flex');
        editor.value = 'Loading...';
        try {
            const response = await fetch('/api/config');
            if (response.ok) {
                editor.value = await response.text();
            } else {
                editor.value = 'Failed to load configuration.';
            }
        } catch (e) {
            editor.value = 'Error fetching configuration.';
        }
    };

    const closeModal = () => {
        modal.classList.add('hidden');
        modal.classList.remove('flex');
        saveStatus.textContent = '';
    };

    const saveConfig = async () => {
        saveBtn.disabled = true;
        saveBtnText.textContent = 'Saving...';
        saveSpinner.classList.remove('hidden');
        saveStatus.textContent = '';
        saveStatus.className = 'text-sm h-5 mt-2';

        try {
            const response = await fetch('/api/config', {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-yaml' },
                body: editor.value
            });

            if (response.ok) {
                saveStatus.textContent = 'Configuration saved successfully!';
                saveStatus.classList.add('text-green');
                setTimeout(() => {
                    closeModal();
                    renderBookmarks();
                }, 1000);
            } else {
                saveStatus.textContent = await response.text() || 'Failed to save configuration.';
                saveStatus.classList.add('text-red');
            }
        } catch (error) {
            saveStatus.textContent = 'Error saving configuration.';
            saveStatus.classList.add('text-red');
        } finally {
            saveBtn.disabled = false;
            saveBtnText.textContent = 'Save';
            saveSpinner.classList.add('hidden');
        }
    };

    openBtn?.addEventListener('click', openModal);
    closeBtn?.addEventListener('click', closeModal);
    cancelBtn?.addEventListener('click', closeModal);
    saveBtn?.addEventListener('click', saveConfig);


    modal?.addEventListener('click', (e) => {
        if (e.target === modal) closeModal();
    });
};

document.addEventListener('DOMContentLoaded', initSettingsModal);
