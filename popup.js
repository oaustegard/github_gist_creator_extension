/* Initialize popup */
chrome.storage.sync.get(['githubToken'], function(result) {
    if (!result.githubToken) {
        chrome.runtime.openOptionsPage();
        window.close();
    }
});

/* Create full page gist handler */
document.getElementById('createFullGist').addEventListener('click', async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    try {
        const { githubToken } = await chrome.storage.sync.get(['githubToken']);
        if (!githubToken) {
            throw new Error('No GitHub token found');
        }

        const results = await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            func: createFullPageGist,
            args: [githubToken]
        });

        const result = results[0].result;
        if (result.error) {
            throw new Error(result.error);
        }

        chrome.tabs.create({ url: result.url });
        window.close();
    } catch (error) {
        showStatus(error.message, true);
        setTimeout(() => {
            chrome.runtime.openOptionsPage();
            window.close();
        }, 2000);
    }
});

/* Status message helper */
function showStatus(message, isError = false) {
    const status = document.getElementById('status');
    status.textContent = message;
    status.className = `status ${isError ? 'error' : 'success'}`;
    status.style.display = 'block';
}

/* Function to be injected - simplified for full page only */
async function createFullPageGist(token) {
    try {
        const response = await fetch('https://api.github.com/gists', {
            method: 'POST',
            headers: {
                'Authorization': `token ${token}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                description: `Full page HTML from ${document.title}`,
                public: false,
                files: {
                    [`${document.title}-full.html`]: {
                        content: document.documentElement.outerHTML
                    }
                }
            })
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || `GitHub API error: ${response.status}`);
        }

        const gist = await response.json();
        return { url: gist.html_url };
    } catch (error) {
        return { error: error.message };
    }
}