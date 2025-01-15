/* Initialize form with existing token */
chrome.storage.sync.get(['githubToken'], function(result) {
    if (result.githubToken) {
        document.getElementById('token').value = result.githubToken;
    }
});

/* Save token handler */
document.getElementById('saveToken').addEventListener('click', async () => {
    const token = document.getElementById('token').value;
    if (!token) {
        showStatus('Please enter a token', true);
        return;
    }

    try {
        const response = await fetch('https://api.github.com/gists', {
            headers: { 'Authorization': `token ${token}` }
        });

        if (!response.ok) {
            throw new Error('Invalid token');
        }

        await chrome.storage.sync.set({ githubToken: token });
        showStatus('Token saved successfully!');
    } catch (error) {
        showStatus('Invalid GitHub token', true);
    }
});

/* Clear token handler */
document.getElementById('clearToken').addEventListener('click', async () => {
    if (confirm('Are you sure you want to clear the saved token?')) {
        await chrome.storage.sync.remove('githubToken');
        document.getElementById('token').value = '';
        showStatus('Token cleared');
    }
});

/* Status message helper */
function showStatus(message, isError = false) {
    const status = document.getElementById('status');
    status.textContent = message;
    status.className = `status ${isError ? 'error' : 'success'}`;
    status.style.display = 'block';
    setTimeout(() => status.style.display = 'none', 3000);
}