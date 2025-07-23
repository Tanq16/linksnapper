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
        const healthIcon = isUnhealthy ? 'fa-exclamation-triangle' : 'fa-check-circle';
        const healthColorClass = isUnhealthy ? 'text-yellow' : 'text-green';
        const healthTitle = `${isUnhealthy ? 'Unhealthy' : 'Healthy'} (Status: ${link.health.statusCode || 'N/A'})`;

        return `<div class="group bg-surface0 rounded-lg transition-all duration-200 hover:bg-surface1 hover:shadow-xl relative">
            <a href="${link.url}" target="_blank" class="block p-5">
                <div class="flex items-start justify-between">
                    <p class="font-semibold text-text break-words pr-12">${link.name}</p>
                    <div title="${healthTitle}" class="flex-shrink-0 ml-2">
                        <i class="fas ${healthIcon} ${healthColorClass}"></i>
                    </div>
                </div>
                ${link.description ? `<p class="text-sm text-subtext0 mt-2 break-words">${link.description}</p>` : ''}
            </a>
            <div class="absolute bottom-3 right-3 flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                <button title="Edit" class="edit-btn w-8 h-8 flex items-center justify-center bg-overlay0 rounded-full text-subtext1 hover:bg-blue hover:text-crust transition-colors" data-id="${link.id}">
                    <i class="fas fa-pen-nib text-xs"></i>
                </button>
                <button title="Delete" class="delete-btn w-8 h-8 flex items-center justify-center bg-overlay0 rounded-full text-subtext1 hover:bg-red hover:text-crust transition-colors" data-id="${link.id}">
                    <i class="fas fa-trash-alt text-xs"></i>
                </button>
            </div>
        </div>`;
    }
    
    function renderSearchResults(results, searchTerm) {
        let html = `<h2 class="text-base font-semibold text-subtext1 mb-4">Search Results for "${searchTerm}"</h2>`;
        if (results.length === 0) {
            html += '<p class="text-subtext0">No matches found.</p>';
        } else {
            html += '<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">';
            results.forEach(link => { html += renderLinkItem(link); });
            html += '</div>';
        }
        contentArea.innerHTML = html;
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
            if (!response.ok) throw new Error(isEdit ? 'Failed to update link' : 'Failed to add link');
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
        const homeIcon = `<a href="#" class="hover:text-text" data-path=""><i class="fas fa-home"></i></a>`;
        const separator = `<i class="fas fa-chevron-right text-xs text-overlay0"></i>`;
        const items = currentPath.map((segment, index) => {
            const path = currentPath.slice(0, index + 1).join('/');
            return `<a href="#" class="hover:text-text" data-path="${path}">${segment}</a>`;
        });
    
        breadcrumb.innerHTML = [homeIcon, ...items].join(` <span class="px-1">${separator}</span> `);
        
        breadcrumb.querySelectorAll('a').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                currentPath = e.currentTarget.dataset.path ? e.currentTarget.dataset.path.split('/') : [];
                renderCurrentLevel();
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
                <h2 class="text-base font-semibold text-subtext1 mb-4">Categories</h2>
                <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">`;
            subCategories.forEach(category => {
                html += `<a href="#" class="category-link flex items-center gap-3 bg-surface0 p-4 rounded-lg hover:bg-surface1 transition-colors" data-category="${category}">
                    <i class="fas fa-folder text-blue"></i>
                    <span class="font-medium text-text">${category}</span>
                </a>`;
            });
            html += `</div></div>`;
        }

        if (currentLevelLinks.length > 0) {
            html += `<div>
                <h2 class="text-base font-semibold text-subtext1 mb-4">Links</h2>
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
                currentPath.push(e.currentTarget.dataset.category);
                renderCurrentLevel();
            });
        });
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

    /**
     * Correctly generates all unique full and partial category paths.
     * For a link with path ["A", "B", "C"], it will add "A", "A/B", and "A/B/C" to the set.
     */
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
