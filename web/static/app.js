document.addEventListener('DOMContentLoaded', function() {
    const addLinkBtn = document.getElementById('addLinkBtn');
    const addLinkForm = document.getElementById('addLinkForm');
    const linkForm = document.getElementById('linkForm');
    const cancelBtn = document.getElementById('cancelBtn');
    const contentArea = document.getElementById('contentArea');
    const breadcrumb = document.getElementById('breadcrumb');
    const searchInput = document.getElementById('searchInput');
    
    let searchTimeout;
    let isSearching = false;
    let currentLinks = [];
    let currentPath = [];

    // Load initial categories and links
    fetchData();
    setupCategoryAutocomplete();

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
        const healthIndicator = getHealthIndicator(link);
        return `<div class="link-item">
            <div class="link-header">
                <div class="link-title">
                    <h4>
                        <a href="${link.url}" target="_blank">${link.name}</a>
                        ${healthIndicator}
                    </h4>
                </div>
                <div class="link-actions">
                    <button class="edit-btn" data-id="${link.id}">
                        <i class="fas fa-pencil-alt"></i>
                    </button>
                    <button class="delete-btn" data-id="${link.id}">
                        <i class="fas fa-trash-alt"></i>
                    </button>
                </div>
            </div>
            ${link.description ? `<p>${link.description}</p>` : ''}
        </div>`;
    }
    
    function getHealthIndicator(link) {
        if (!link.health || link.health.status === 'unknown') {
            return '';
        }
        const tooltipText = link.health.status === 'unhealthy' 
            ? `Unhealthy (${link.health.statusCode || 'Error'}: ${link.health.error || 'Unknown error'})`
            : `Healthy (${link.health.statusCode})`;
        const iconClass = link.health.status === 'unhealthy' 
            ? 'fa-exclamation-triangle warning-icon' 
            : 'fa-check-circle success-icon';
        return `<span class="health-indicator" title="${tooltipText} ${link.lastChecked ? ` as of ${new Date(link.lastChecked).toLocaleDateString()}` : ''}">
            <i class="fas ${iconClass}"></i>
        </span>`;
    }

    function renderSearchResults(results, searchTerm) {
        let html = `<h3>Search Results for "${searchTerm}"</h3>`;
        if (results.length === 0) {
            html += '<p>No matches found</p>';
        } else {
            html += '<div class="links-list">';
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
        const items = [`<a href="#" data-path="">Home</a>`];
        let currentPathStr = '';
        currentPath.forEach((segment, index) => {
            currentPathStr += (currentPathStr ? '/' : '') + segment;
            items.push(`<a href="#" data-path="${currentPathStr}">${segment}</a>`);
        });
        breadcrumb.innerHTML = items.join(' > ');
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
            html += '<h3>Categories</h3>';
            html += '<div class="categories-list">';
            html += '<div class="categories-grid">';
            subCategories.forEach(category => {
                html += `<div class="category-item">
                    <a href="#" class="category-link" data-category="${category}">${category}</a>
                </div>`;
            });
            html += '</div></div>';
        }

        // Render links in current category
        if (currentLevelLinks.length > 0) {
            html += '<h3>Links</h3>';
            html += '<div class="links-list">';
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
        suggestionsDiv.className = 'category-suggestions';
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
                    .map(path => `<div class="suggestion-item">${path}</div>`)
                    .join('');
                suggestionsDiv.style.display = 'block';
            } else {
                suggestionsDiv.style.display = 'none';
            }
        });
    
        // Handle clicking on a suggestion
        suggestionsDiv.addEventListener('click', (e) => {
            if (e.target.classList.contains('suggestion-item')) {
                categoryInput.value = e.target.textContent;
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
            const items = suggestionsDiv.getElementsByClassName('suggestion-item');
            const activeItem = suggestionsDiv.querySelector('.suggestion-item.active');
            switch(e.key) {
                case 'ArrowDown':
                    e.preventDefault();
                    if (suggestionsDiv.style.display === 'none') {
                        categoryInput.dispatchEvent(new Event('input'));
                        return;
                    }
                    if (!activeItem && items.length > 0) {
                        items[0].classList.add('active');
                    } else if (activeItem && activeItem.nextElementSibling) {
                        activeItem.classList.remove('active');
                        activeItem.nextElementSibling.classList.add('active');
                    }
                    break;
                case 'ArrowUp':
                    e.preventDefault();
                    if (activeItem && activeItem.previousElementSibling) {
                        activeItem.classList.remove('active');
                        activeItem.previousElementSibling.classList.add('active');
                    }
                    break;
                case 'Enter':
                    if (activeItem) {
                        e.preventDefault();
                        categoryInput.value = activeItem.textContent;
                        suggestionsDiv.style.display = 'none';
                    }
                    break;
                case 'Escape':
                    suggestionsDiv.style.display = 'none';
                    break;
            }
        });
    }
});
