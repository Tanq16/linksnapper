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

    // Load initial categories and links
    fetchData();
    setupCategoryAutocomplete();

    downloadLinksBtn.addEventListener('click', async () => {
        try {
            const response = await fetch('/api/links');
            if (!response.ok) {
                throw new Error('Failed to fetch links');
            }
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
        if (searchTimeout) {
            clearTimeout(searchTimeout);
        }
        // Set a new timeout to prevent too many updates
        searchTimeout = setTimeout(() => {
            isSearching = searchTerm !== '';
            if (isSearching) {
                const searchWords = searchTerm.split(/\s+/).filter(word => word.length > 0);
                const searchResults = currentLinks.filter(link => {
                    const name = (link.name || '').toLowerCase();
                    const description = (link.description || '').toLowerCase();
                    const url = link.url.toLowerCase();
                    const path = link.path.join(' ').toLowerCase();
                    const allContent = `${name} ${description} ${url} ${path}`;
                    // Check if all search words appear in the content in any order
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
        const healthIcon = isUnhealthy ? 'fa-exclamation-circle' : 'fa-check-circle';
        const healthColorClass = isUnhealthy ? 'text-yellow-500' : 'text-green-500';
        const healthTitle = isUnhealthy ? `Unhealthy (${link.health.statusCode || 'Error'})` : `Healthy (${link.health.statusCode})`;
    
        return `<div class="bg-zinc-950 p-4 rounded-lg border border-zinc-800 shadow-md transition-all hover:bg-zinc-800 hover:shadow-lg flex flex-col gap-2">
            <div class="relative flex justify-between items-start w-full">
                <div class="flex-1 min-w-0 pr-24">
                    <h4 class="font-medium leading-tight">
                        <a href="${link.url}" target="_blank" class="text-white break-words hover:text-gray-200">${link.name}</a>
                    </h4>
                </div>
                <div class="absolute right-0 top-0 flex items-center gap-1">
                    <button class="health-btn bg-transparent border-none cursor-pointer p-1 rounded" title="${healthTitle} ${link.lastChecked ? `as of ${new Date(link.lastChecked).toLocaleDateString()}` : ''}">
                        <i class="fas ${healthIcon} ${healthColorClass}"></i>
                    </button>
                    <button class="edit-btn bg-transparent border-none cursor-pointer p-1 rounded transition-colors text-gray-400 hover:text-gray-200" data-id="${link.id}">
                        <i class="fas fa-pen-nib"></i>
                    </button>
                    <button class="delete-btn bg-transparent border-none cursor-pointer p-1 rounded transition-colors text-gray-400 hover:text-red-500" data-id="${link.id}">
                        <i class="fas fa-trash-alt"></i>
                    </button>
                </div>
            </div>
            ${link.description ? `<p class="text-gray-300 text-sm leading-tight mt-1 break-words">${link.description}</p>` : ''}
        </div>`;
    }

    function renderSearchResults(results, searchTerm) {
        let html = `<h3 class="text-lg font-medium text-center my-6 pb-2 border-b border-zinc-800">Search Results for "${searchTerm}"</h3>`;
        if (results.length === 0) {
            html += '<p>No matches found</p>';
        } else {
            html += '<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 mt-4">';
            results.forEach(link => {
                html += renderLinkItem(link);
            });
            html += '</div>';
        }
        contentArea.innerHTML = html;
        attachLinkActionHandlers();
    }

    function attachLinkActionHandlers() {
        // Add click handlers for delete buttons
        contentArea.querySelectorAll('.delete-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const id = e.target.closest('.delete-btn').dataset.id;
                const linkElement = e.target.closest('.link-item');
                const linkName = linkElement.querySelector('h4 a').textContent;
                if (confirm(`Are you sure you want to delete "${linkName}"?`)) {
                    try {
                        const response = await fetch(`/api/links/${id}`, {
                            method: 'DELETE'
                        });
                        if (!response.ok) {
                            throw new Error('Failed to delete link');
                        }
                        fetchData();
                    } catch (error) {
                        console.error('Error deleting link:', error);
                        alert('Failed to delete link');
                    }
                }
            });
        });
        // Add click handlers for edit buttons
        contentArea.querySelectorAll('.edit-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const id = btn.dataset.id;
                const link = currentLinks.find(l => l.id === id);
                if (link) {
                    showEditForm(link);
                }
            });
        });
    }

    addLinkBtn.addEventListener('click', () => {
        addLinkForm.style.display = 'block';
        addLinkBtn.style.display = 'none';
    });

    cancelBtn.addEventListener('click', () => {
        addLinkForm.style.display = 'none';
        addLinkBtn.style.display = 'block';
        linkForm.reset();
        delete linkForm.dataset.mode;
        delete linkForm.dataset.editId;
    });

    // Handle form submission
    linkForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        const formData = {
            url: document.getElementById('url').value,
            name: document.getElementById('name').value || document.getElementById('url').value,
            description: document.getElementById('description').value,
            path: document.getElementById('category').value.split('/').filter(p => p.trim() !== '')
        };
        if (formData.path.length === 0) {
            formData.path = ['Uncategorized'];
        }
        try {
            let response;
            if (this.dataset.mode === 'edit') {
                response = await fetch(`/api/links/${this.dataset.editId}`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(formData)
                });
            } else {
                response = await fetch('/api/links', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(formData)
                });
            }
            if (!response.ok) {
                throw new Error(this.dataset.mode === 'edit' ? 'Failed to update link' : 'Failed to add link');
            }
    
            this.reset();
            delete this.dataset.mode;
            delete this.dataset.editId;
            addLinkForm.style.display = 'none';
            addLinkBtn.style.display = 'block';
            fetchData();
        } catch (error) {
            console.error('Error:', error);
            alert(error.message);
        }
    });

    async function fetchData() {
        try {
            const response = await fetch('/api/links');
            if (!response.ok) {
                throw new Error('Failed to fetch links');
            }
            const links = await response.json();
            currentLinks = links;
            renderCurrentLevel();
        } catch (error) {
            console.error('Error fetching data:', error);
            contentArea.innerHTML = '<p>Failed to load data. Please try refreshing the page.</p>';
        }
    }

    function renderBreadcrumb() {
        const homeItem = `<a href="#" class="text-white hover:bg-zinc-800 py-1 px-2 rounded" data-path="">Home</a>`;
        const breadcrumbItems = currentPath.map((segment, index) => {
            const path = currentPath.slice(0, index + 1).join('/');
            return `<a href="#" class="text-white hover:bg-zinc-800 py-1 px-2 rounded" data-path="${path}">${segment}</a>`;
        });
    
        const separator = `<span class="text-gray-500">/</span>`;
        breadcrumb.innerHTML = [homeItem, ...breadcrumbItems].join(separator);
        
        breadcrumb.querySelectorAll('a').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const pathStr = e.target.dataset.path;
                currentPath = pathStr ? pathStr.split('/') : [];
                renderCurrentLevel();
            });
        });
    }

    function renderCurrentLevel() {
        renderBreadcrumb();
        const currentLevelLinks = filterLinksByPath(currentPath);
        const subCategories = getSubCategories(currentPath);
        let html = '';

        // Render subcategories
        if (subCategories.length > 0) {
            html += '<h3 class="text-lg font-medium text-center my-6 pb-2 border-b border-zinc-800">Categories</h3>';
            html += '<div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 mb-6">';
            subCategories.forEach(category => {
                html += `<div class="bg-zinc-950 p-3 rounded-lg border border-zinc-800 shadow-md transition-all hover:bg-zinc-800 hover:shadow-lg">
                    <a href="#" class="category-link text-white font-medium block" data-category="${category}">${category}</a>
                </div>`;
            });
            html += '</div>';
        }

        // Render links in current category
        if (currentLevelLinks.length > 0) {
            html += '<h3 class="text-lg font-medium text-center my-6 pb-2 border-b border-zinc-800">Links</h3>';
            html += '<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 mt-4">';
            currentLevelLinks.forEach(link => {
                html += renderLinkItem(link);
            });
            html += '</div>';
        }

        if (currentLevelLinks.length === 0 && subCategories.length === 0) {
            html = '<p>No content in this category</p>';
        }
        contentArea.innerHTML = html;

        // Add click handlers for categories
        contentArea.querySelectorAll('.category-link').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const category = e.target.dataset.category;
                currentPath.push(category);
                renderCurrentLevel();
            });
        });

        attachLinkActionHandlers();
    }

    function filterLinksByPath(path) {
        const pathStr = path.join('/');
        return currentLinks.filter(link => link.path.join('/') === pathStr);
    }

    function getSubCategories(currentPath) {
        const pathStr = currentPath.join('/');
        const subCategories = new Set();
        currentLinks.forEach(link => {
            const linkPathStr = link.path.join('/');
            if (linkPathStr.startsWith(pathStr + (pathStr ? '/' : ''))) {
                const remainingPath = linkPathStr.slice(pathStr ? pathStr.length + 1 : 0);
                const nextLevel = remainingPath.split('/')[0];
                if (nextLevel) {
                    subCategories.add(nextLevel);
                }
            }
        });
        return Array.from(subCategories).sort();
    }

    function showEditForm(link) {
        const addLinkForm = document.getElementById('addLinkForm');
        const addLinkBtn = document.getElementById('addLinkBtn');
        const linkForm = document.getElementById('linkForm');
        
        // Show the form
        addLinkForm.style.display = 'block';
        addLinkBtn.style.display = 'none';
        
        // Populate form fields
        document.getElementById('url').value = link.url;
        document.getElementById('name').value = link.name;
        document.getElementById('description').value = link.description || '';
        document.getElementById('category').value = link.path.join('/');
        
        // Add data attribute to form for edit mode
        linkForm.dataset.mode = 'edit';
        linkForm.dataset.editId = link.id;
    }

    function getAllUniquePaths() {
        const paths = new Set();
        currentLinks.forEach(link => {
            // Add full path
            paths.add(link.path.join('/'));
            // Add partial paths
            let partialPath = '';
            link.path.forEach(segment => {
                partialPath = partialPath ? `${partialPath}/${segment}` : segment;
                paths.add(partialPath);
            });
        });
        return Array.from(paths).sort();
    }
    
    function setupCategoryAutocomplete() {
        const categoryInput = document.getElementById('category');
        const suggestionsDiv = document.createElement('div');
        suggestionsDiv.className = 'absolute top-full left-0 right-0 bg-zinc-950 border border-zinc-800 rounded-lg mt-0.5 max-h-52 overflow-y-auto z-50 shadow-lg';
        suggestionsDiv.style.display = 'none';
        categoryInput.parentNode.appendChild(suggestionsDiv);
    
        categoryInput.addEventListener('input', () => {
            const value = categoryInput.value.toLowerCase();
            const paths = getAllUniquePaths();
            const matches = paths.filter(path => 
                path.toLowerCase().includes(value)
            );
            if (matches.length > 0 && value) {
                suggestionsDiv.innerHTML = matches
                    .map(path => `<div class="suggestion-item px-3 py-2.5 cursor-pointer transition-colors text-white hover:bg-zinc-800">${path}</div>`)
                    .join('');
                suggestionsDiv.style.display = 'block';
            } else {
                suggestionsDiv.style.display = 'none';
            }
        });
    
        // Handle clicking on a suggestion
        suggestionsDiv.addEventListener('click', (e) => {
            const suggestion = e.target.closest('.suggestion-item');
            if (suggestion) {
                categoryInput.value = suggestion.textContent;
                suggestionsDiv.style.display = 'none';
            }
        });
    
        // Hide suggestions when clicking outside
        document.addEventListener('click', (e) => {
            if (!categoryInput.contains(e.target) && !suggestionsDiv.contains(e.target)) {
                suggestionsDiv.style.display = 'none';
            }
        });
    
        // Handle keyboard navigation
        categoryInput.addEventListener('keydown', (e) => {
            const items = Array.from(suggestionsDiv.querySelectorAll('.suggestion-item'));
            if (suggestionsDiv.style.display === 'none') {
                if (e.key === 'ArrowDown') categoryInput.dispatchEvent(new Event('input'));
                return;
            }

            const activeItem = suggestionsDiv.querySelector('.suggestion-item.active');
            let currentIndex = items.indexOf(activeItem);
    
            switch(e.key) {
                case 'ArrowDown':
                    e.preventDefault();
                    currentIndex = activeItem ? (currentIndex + 1) % items.length : 0;
                    break;
                case 'ArrowUp':
                    e.preventDefault();
                    currentIndex = activeItem ? (currentIndex - 1 + items.length) % items.length : items.length - 1;
                    break;
                case 'Enter':
                    if (activeItem) {
                        e.preventDefault();
                        categoryInput.value = activeItem.textContent;
                        suggestionsDiv.style.display = 'none';
                    }
                    return;
                case 'Escape':
                    suggestionsDiv.style.display = 'none';
                    return;
                default:
                    return;
            }
    
            if (activeItem) activeItem.classList.remove('active', 'bg-zinc-700');
            if (items[currentIndex]) {
                items[currentIndex].classList.add('active', 'bg-zinc-700');
                items[currentIndex].scrollIntoView({ block: 'nearest' });
            }
        });
    }
});

if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js')
            .then(registration => {
                console.log('ServiceWorker registration successful');
            })
            .catch(err => {
                console.log('ServiceWorker registration failed: ', err);
            });
    });
}
