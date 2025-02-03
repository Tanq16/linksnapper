document.addEventListener('DOMContentLoaded', function() {
    const linkForm = document.getElementById('linkForm');
    const linksList = document.getElementById('linksList');

    // Load existing links
    fetchLinks();

    // Handle form submission
    linkForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        const formData = {
            url: document.getElementById('url').value,
            name: document.getElementById('name').value || document.getElementById('url').value,
            description: document.getElementById('description').value,
            category: document.getElementById('category').value || 'Uncategorized'
        };

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
            fetchLinks();
        } catch (error) {
            console.error('Error:', error);
            alert('Failed to add link');
        }
    });

    async function fetchLinks() {
        try {
            const response = await fetch('/api/links');
            const links = await response.json();
            
            linksList.innerHTML = links.map(link => `
                <div class="link-item">
                    <h3><a href="${link.url}" target="_blank">${link.name}</a></h3>
                    <p>${link.description || ''}</p>
                    <small>Category: ${link.category}</small>
                </div>
            `).join('');
        } catch (error) {
            console.error('Error:', error);
            linksList.innerHTML = '<p>Failed to load links</p>';
        }
    }
});
