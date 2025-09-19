// Wait for the DOM to be fully loaded before running the script
document.addEventListener('DOMContentLoaded', () => {

    // --- Element References ---
    const editor = document.getElementById('editor');
    const preview = document.getElementById('preview');
    const modalOverlay = document.getElementById('modalOverlay');
    const optionsModal = document.getElementById('optionsModal');
    const sidebar = document.getElementById('sidebar');
    const treeRoot = document.getElementById('treeRoot');
    const renameInput = document.getElementById('renameInput');
    const userInfoDiv = document.getElementById('user-info');
    const currentFileNameSpan = document.getElementById('current-file-name');
    const wordCountSpan = document.getElementById('word-count');
    const charCountSpan = document.getElementById('char-count');
    const saveStatusSpan = document.getElementById('save-status');
    
    // Command Palette Elements
    const commandPaletteOverlay = document.getElementById('command-palette-overlay');
    const commandPalette = document.getElementById('command-palette');
    const commandInput = document.getElementById('command-input');
    const commandHint = document.querySelector('.command-hint');
    if (commandHint) {
        commandHint.textContent = 'Press Ctrl+Shift+P for commands';
    }


    // Button References
    const sidebarToggleBtn = document.getElementById('sidebar-toggle-btn');
    const previewToggleBtn = document.getElementById('preview-toggle');
    const darkModeToggleBtn = document.getElementById('dark-mode-toggle');
    const newFileBtn = document.getElementById('new-file-btn');
    const newFolderBtn = document.getElementById('new-folder-btn');
    const renameBtn = document.getElementById('renameBtn');
    const deleteBtn = document.getElementById('deleteBtn');
    const cancelBtn = document.getElementById('cancelBtn');
    const modalCloseBtn = document.getElementById('modal-close-btn');

    // --- State Management ---
    let selectedItem = null; // { id, type, name, element }
    let notesData = []; // Flat list of all notes from DB
    let saveTimeout;
    let isSaving = false;

    // --- API Helper ---
    async function apiCall(endpoint, action, method = 'GET', body = null) {
        try {
            // FIX: Added 'no-cache' to prevent browser from showing stale data
            const options = { method, cache: 'no-cache' };
            let url = `api/${endpoint}.php`;

            if (method === 'POST') {
                const formData = new FormData();
                formData.append('action', action);
                if (body) {
                    for (const key in body) {
                        formData.append(key, body[key]);
                    }
                }
                options.body = formData;
            } else { // GET
                const params = new URLSearchParams({ action, ...body });
                url += `?${params}`;
            }
            
            const response = await fetch(url, options);

            if (response.status === 401) { // Unauthorized
                window.location.href = 'login.html';
                return null;
            }
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`API call failed: ${response.statusText} - ${errorText}`);
            }
            
            return await response.json();
        } catch (error) {
            console.error(`API Error (${action}):`, error);
            return null;
        }
    }

    // --- Authentication ---
    async function checkAuth() {
        const authStatus = await apiCall('auth', 'status');
        if (authStatus && authStatus.loggedIn) {
            userInfoDiv.innerHTML = `
                <span class="welcome-text">Welcome, ${authStatus.username}</span>
                <button id="logout-btn" class="nav-btn"><i class="fas fa-sign-out-alt"></i> Logout</button>
            `;
            document.getElementById('logout-btn').addEventListener('click', async () => {
                await apiCall('auth', 'logout', 'POST');
                window.location.href = 'login.html';
            });
            init(); // Start the app
        } else {
            window.location.href = 'login.html';
        }
    }

    // --- Main App Initialization ---
    async function init() {
        notesData = await apiCall('notes', 'get_all');
        if (notesData) {
            buildTree();
        }
        if (!document.body.dataset.listenersAdded) {
            addEventListeners();
            document.body.dataset.listenersAdded = 'true';
        }
        if (localStorage.getItem('darkMode') === 'enabled') {
            document.body.classList.add('dark-mode');
        }
    }

    // --- File Tree Logic ---
    function buildTree() {
        treeRoot.innerHTML = '';
        const tree = createTreeStructure(notesData, null);
        const ul = document.createElement('ul');
        tree.forEach(node => {
            ul.appendChild(createTreeElement(node));
        });
        treeRoot.appendChild(ul);
    }

    function createTreeStructure(items, parentId) {
        return items
            .filter(item => item.parent_id == parentId)
            .map(item => ({
                ...item,
                children: createTreeStructure(items, item.id)
            }));
    }

    function createTreeElement(item) {
        const li = document.createElement('li');
        li.dataset.id = item.id;
        li.dataset.type = item.type;
        li.className = 'tree-node';

        const contentDiv = document.createElement('div');
        contentDiv.className = 'tree-item';

        if (item.type === 'folder') {
            contentDiv.innerHTML = `
                <span class="caret"></span>
                <i class="fas fa-folder"></i>
                <span class="tree-item-name">${item.name}</span>
            `;
        } else {
            contentDiv.innerHTML = `
                <i class="fas fa-file-alt"></i>
                <span class="tree-item-name">${item.name}</span>
            `;
        }

        li.appendChild(contentDiv);

        if (item.type === 'folder' && item.children.length > 0) {
            const childrenUl = document.createElement('ul');
            childrenUl.className = 'nested';
            item.children.forEach(child => childrenUl.appendChild(createTreeElement(child)));
            li.appendChild(childrenUl);
            contentDiv.querySelector('.caret').addEventListener('click', (e) => {
                e.stopPropagation();
                e.target.classList.toggle('caret-down');
                childrenUl.classList.toggle('active');
            });
        }

        contentDiv.addEventListener('click', (e) => {
            e.stopPropagation();
            handleItemSelect(item, contentDiv);
        });

        contentDiv.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            e.stopPropagation();
            showOptionsModal(item, contentDiv);
        });

        return li;
    }

    // --- Item Interaction ---
    async function handleItemSelect(item, element) {
        document.querySelectorAll('.tree-item.active-item').forEach(el => el.classList.remove('active-item'));
        
        selectedItem = { id: item.id, type: item.type, name: item.name, element };
        element.classList.add('active-item');

        if (item.type === 'file') {
            editor.value = 'Loading...';
            editor.disabled = true;
            const data = await apiCall('notes', 'get_content', 'GET', { id: item.id });
            editor.value = data ? data.content : 'Failed to load content.';
            currentFileNameSpan.textContent = item.name;
            editor.disabled = false;
            updateStatusBar();
        } else {
            editor.value = 'Select a file to start editing.';
            editor.disabled = true;
            currentFileNameSpan.textContent = 'No file selected';
        }
    }
    
    // --- Modals and Command Palette ---
    function showOptionsModal(item, element) {
        selectedItem = { id: item.id, type: item.type, name: item.name, element };
        renameInput.value = item.name;
        optionsModal.classList.remove('hidden');
        modalOverlay.classList.remove('hidden');
    }

    function hideOptionsModal() {
        optionsModal.classList.add('hidden');
        modalOverlay.classList.add('hidden');
    }
    
    function showCommandPalette() {
        commandPalette.classList.remove('hidden');
        commandPaletteOverlay.classList.remove('hidden');
        commandInput.focus();
    }

    function hideCommandPalette() {
        commandPalette.classList.add('hidden');
        commandPaletteOverlay.classList.add('hidden');
        commandInput.value = '';
    }

    // --- Editor and Content ---
    function updateStatusBar() {
        const text = editor.value;
        const words = text.trim().split(/\s+/).filter(Boolean).length;
        wordCountSpan.textContent = `${words} words`;
        charCountSpan.textContent = `${text.length} characters`;
    }

    async function saveContent() {
        if (!selectedItem || selectedItem.type !== 'file' || isSaving) return;
        isSaving = true;
        saveStatusSpan.textContent = 'Saving...';
        const result = await apiCall('notes', 'update_content', 'POST', { id: selectedItem.id, content: editor.value });
        isSaving = false;
        saveStatusSpan.textContent = result && result.success ? 'All changes saved' : 'Save failed';
    }
    
    // --- Action Handlers ---
// ... existing code ...

async function createNewItem(type, providedName = null) {
    // Get name from user or use provided name
    const name = providedName || prompt(`Enter ${type} name:`);
    if (!name || !name.trim()) return; // Cancel if no name or empty name
    
    // Determine parent ID - if a folder is selected, use it as parent
    const parentId = (selectedItem?.type === 'folder') ? selectedItem.id : null;
    
    try {
        // Call your existing API to create the item
        const result = await apiCall('notes', 'create', 'POST', {
            name: name.trim(),
            type: type,
            parent_id: parentId
        });
        
        if (result && result.success) {
            // Refresh the entire notes data and rebuild the tree
            notesData = await apiCall('notes', 'get_all');
            if (notesData) {
                buildTree();
                
                // Try to find and select the newly created item
                setTimeout(() => {
                    const newItem = notesData.find(item => 
                        item.name === name.trim() && 
                        item.type === type && 
                        item.parent_id == parentId
                    );
                    
                    if (newItem) {
                        const newElement = document.querySelector(`[data-id="${newItem.id}"] .tree-item`);
                        if (newElement) {
                            handleItemSelect(newItem, newElement);
                        }
                    }
                }, 100);
            }
        } else {
            alert('Failed to create item. Please try again.');
        }
    } catch (error) {
        console.error('Error creating new item:', error);
        alert('An error occurred while creating the item.');
    }
}

// ... existing code ...
// Also update your command handling to work with the fixed function
function handleCommand(command) {
    const lowerCommand = command.toLowerCase().trim();
    
    if (lowerCommand.startsWith('new file')) {
        const fileName = command.substring(8).trim() || null;
        createNewItem('file', fileName);
    } else if (lowerCommand.startsWith('new folder')) {
        const folderName = command.substring(10).trim() || null;
        createNewItem('folder', folderName);
    } else if (lowerCommand === 'toggle dark mode') {
        darkModeToggleBtn.click();
    } else {
        alert(`Unknown command: "${command}"`);
    }
    
    hideCommandPalette();
}
 // Add to your addEventListeners() function
newFileBtn.addEventListener('click', () => createNewItem('file'));
newFolderBtn.addEventListener('click', () => createNewItem('folder'));
    
    async function handleRename() {
        const newName = renameInput.value.trim();
        if (!newName || !selectedItem) return;

        const result = await apiCall('notes', 'rename', 'POST', { id: selectedItem.id, name: newName });
        if (result && result.success) {
            hideOptionsModal();
            await init();
        }
    }

    async function handleDelete() {
        if (!selectedItem || !confirm(`Are you sure you want to delete "${selectedItem.name}"?`)) return;

        const result = await apiCall('notes', 'delete', 'POST', { id: selectedItem.id });
        if (result && result.success) {
            hideOptionsModal();
            if (editor.dataset.fileId == selectedItem.id) {
                 editor.value = '';
                 editor.disabled = true;
                 currentFileNameSpan.textContent = 'No file selected';
            }
            await init();
        }
    }
    
    function handleCommand(command) {
        const lowerCommand = command.toLowerCase().trim();
        
        if (lowerCommand.startsWith('new file')) {
            const fileName = command.substring(8).trim() || null;
            createNewItem('file', fileName);
        } else if (lowerCommand.startsWith('new folder')) {
            const folderName = command.substring(10).trim() || null;
            createNewItem('folder', folderName);
        } else if (lowerCommand === 'toggle dark mode') {
            darkModeToggleBtn.click();
        } else {
            alert(`Unknown command: "${command}"`);
        }
        
        hideCommandPalette();
    }

    // --- Event Listeners ---
    function addEventListeners() {
        sidebarToggleBtn.addEventListener('click', () => sidebar.classList.toggle('hidden'));
        
        darkModeToggleBtn.addEventListener('click', () => {
             document.body.classList.toggle('dark-mode');
             localStorage.setItem('darkMode', document.body.classList.contains('dark-mode') ? 'enabled' : 'disabled');
        });

        previewToggleBtn.addEventListener('click', () => {
             preview.classList.toggle('hidden');
             editor.classList.toggle('hidden');
             if (!preview.classList.contains('hidden')) {
                 preview.innerHTML = marked.parse(editor.value);
             }
        });

        newFileBtn.addEventListener('click', () => createNewItem('file'));
        newFolderBtn.addEventListener('click', () => createNewItem('folder'));

        // Modal listeners
        modalCloseBtn.addEventListener('click', hideOptionsModal);
        cancelBtn.addEventListener('click', hideOptionsModal);
        modalOverlay.addEventListener('click', hideOptionsModal);
        
        renameBtn.addEventListener('click', handleRename);
        deleteBtn.addEventListener('click', handleDelete);
        
        // Editor listeners
        editor.addEventListener('input', () => {
            updateStatusBar();
            clearTimeout(saveTimeout);
            saveStatusSpan.textContent = 'Typing...';
            saveTimeout = setTimeout(saveContent, 1500);
        });
        
        // Command Palette Listeners
        document.addEventListener('keydown', (e) => {
            // FIX: Changed shortcut to Ctrl+Shift+P to avoid browser conflicts
            if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'p') {
                e.preventDefault(); // This stops the browser's default action
                showCommandPalette();
            }
            if (e.key === 'Escape') {
                hideCommandPalette();
                hideOptionsModal();
            }
        });
        
        commandPaletteOverlay.addEventListener('click', hideCommandPalette);
        
        commandInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && commandInput.value) {
                e.preventDefault();
                handleCommand(commandInput.value);
            }
        });
    }

    // --- Start the application ---
    checkAuth();
});

