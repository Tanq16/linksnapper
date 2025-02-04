document.addEventListener('DOMContentLoaded', function() {
    const addLinkBtn = document.getElementById('addLinkBtn');
    const addLinkForm = document.getElementById('addLinkForm');
    const linkForm = document.getElementById('linkForm');
    const cancelBtn = document.getElementById('cancelBtn');
    const contentArea = document.getElementById('contentArea');
    const breadcrumb = document.getElementById('breadcrumb');
    
    let currentLinks = [];
    let currentPath = [];

    // Load initial categories and links
    fetchData();

    // Toggle form visibility
    addLinkBtn.addEventListener('click', () => {
        addLinkForm.style.display = 'block';
        addLinkBtn.style.display = 'none';
    });

    cancelBtn.addEventListener('click', () => {
        addLinkForm.style.display = 'none';
        addLinkBtn.style.display = 'block';
        linkForm.reset();
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
            const response = await fetch('/api/links', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(formData)
            });

            if (!response.ok) {
                throw new Error('Failed to add link');
            }

            linkForm.reset();
            addLinkForm.style.display = 'none';
            addLinkBtn.style.display = 'block';
            fetchData();
        } catch (error) {
            console.error('Error:', error);
            alert('Failed to add link');
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
                html += `<div class="link-item">
                    <div class="link-header">
                        <h4><a href="${link.url}" target="_blank">${link.name}</a></h4>
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
                        // Refresh the view
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
            btn.addEventListener('click', async () => {
                try {
                    const response = await fetch('/api/health');
                    if (!response.ok) {
                        throw new Error('Failed to send edit request');
                    }
                    // For now, just show an alert
                    alert('Edit functionality coming soon!');
                } catch (error) {
                    console.error('Error:', error);
                    alert('Failed to process edit request');
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
});
