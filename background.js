/* Create context menu items */
chrome.runtime.onInstalled.addListener(() => {
    chrome.contextMenus.create({
        id: 'createGistFromSelection',
        title: 'Create Gist from Selection',
        contexts: ['selection']
    });
});

/* Handle context menu clicks */
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
    if (info.menuItemId === 'createGistFromSelection') {
        try {
            const { githubToken } = await chrome.storage.sync.get(['githubToken']);
            if (!githubToken) {
                throw new Error('No GitHub token found');
            }

            const results = await chrome.scripting.executeScript({
                target: { tabId: tab.id },
                func: injectedScript,
                args: [githubToken]
            });

            const result = results[0].result;
            if (result.error) {
                await chrome.scripting.executeScript({
                    target: { tabId: tab.id },
                    func: showNotification,
                    args: [result.error, true]
                });
            } else {
                chrome.tabs.create({ url: result.url });
            }
        } catch (error) {
            console.error('Error creating gist:', error);
        }
    }
});

/* Main injected script containing all required functions */
function injectedScript(token) {
    /* Captures selected content with computed styles */
    function captureSelection() {
        const selection = window.getSelection();
        if (!selection || !selection.rangeCount) {
            throw new Error('No text selected');
        }

        const range = selection.getRangeAt(0);
        const fragment = range.cloneContents();
        const container = document.createElement('div');
        
        /* Process each element to capture computed styles */
        function processNode(node) {
            if (node.nodeType === Node.ELEMENT_NODE) {
                const originalNode = range.commonAncestorContainer.parentElement.querySelector(
                    Array.from(node.parentElement?.children || [])
                        .indexOf(node) !== -1 ? 
                        `:scope > *:nth-child(${Array.from(node.parentElement.children).indexOf(node) + 1})` : 
                        '*'
                );
                
                if (originalNode) {
                    const computedStyle = window.getComputedStyle(originalNode);
                    const importantStyles = [
                        'color', 'background-color', 'font-family', 'font-size',
                        'font-weight', 'font-style', 'text-decoration', 'margin',
                        'padding', 'border', 'text-align', 'line-height'
                    ];

                    const styles = importantStyles
                        .filter(prop => computedStyle[prop] !== '')
                        .map(prop => `${prop}: ${computedStyle[prop]}`)
                        .join('; ');

                    if (styles) {
                        node.setAttribute('style', styles);
                    }
                }
            }
            node.childNodes.forEach(child => processNode(child));
        }

        /* Clone and process the fragment */
        const clonedFragment = fragment.cloneNode(true);
        Array.from(clonedFragment.childNodes).forEach(node => processNode(node));
        
        container.appendChild(clonedFragment);
        
        /* Add basic CSS reset to container */
        container.setAttribute('style', `
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif;
            line-height: 1.5;
            padding: 16px;
        `);

        return {
            title: document.title,
            content: container.outerHTML
        };
    }

    /* Creates a gist with the captured content */
    async function createGist(capturedContent) {
        const response = await fetch('https://api.github.com/gists', {
            method: 'POST',
            headers: {
                'Authorization': `token ${token}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                description: `Styled HTML from ${capturedContent.title}`,
                public: false,
                files: {
                    [`${capturedContent.title}-selection.html`]: {
                        content: capturedContent.content
                    }
                }
            })
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || `GitHub API error: ${response.status}`);
        }

        return await response.json();
    }

    /* Execute the capture and creation */
    return (async () => {
        try {
            const capturedContent = captureSelection();
            const gist = await createGist(capturedContent);
            return { url: gist.html_url };
        } catch (error) {
            return { error: error.message };
        }
    })();
}

/* Function to show notifications in the page */
function showNotification(message, isError = false) {
    const notification = document.createElement('div');
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 15px 20px;
        background: ${isError ? '#dc3545' : '#2ea44f'};
        color: white;
        border-radius: 4px;
        z-index: 999999;
        box-shadow: 0 2px 10px rgba(0,0,0,0.1);
    `;
    notification.textContent = message;
    document.body.appendChild(notification);
    setTimeout(() => notification.remove(), 3000);
}