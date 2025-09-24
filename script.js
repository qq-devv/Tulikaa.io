
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
    const url = `http://localhost/tulika/${endpoint}.php`;
    const options = { method, cache: 'no-cache' };

    try {
        if (method === 'POST') {
            const formData = new FormData();
            formData.append('action', action);
            if (body) {
                Object.entries(body).forEach(([k, v]) => formData.append(k, v));
            }
            options.body = formData;
            
            const response = await fetch(url, options);

            if (response.status === 401) {
                window.location.href = 'login.html';
                return null;
            }

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            return await response.json();
            
        } else { // GET - FIXED: Proper URL construction and fetch
            const params = new URLSearchParams({ action, ...(body || {}) });
            const response = await fetch(`${url}?${params}`, options);
            
            if (response.status === 401) {
                window.location.href = 'login.html';
                return null;
            }

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            return await response.json();
        }
    } catch (err) {
        console.error(`API Error (${action}):`, err);
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
    try {
        console.log('Initializing app...');
        
        notesData = await apiCall('notes', 'get_all');
        console.log('Received notes data:', notesData);
        
        if (notesData) {
            buildTree();
        } else {
            console.error('Failed to fetch notes data');
            treeRoot.innerHTML = '<p>Failed to load files</p>';
        }
        
        if (!document.body.dataset.listenersAdded) {
            addEventListeners();
            document.body.dataset.listenersAdded = 'true';
        }
        
        if (localStorage.getItem('darkMode') === 'enabled') {
            document.body.classList.add('dark-mode');
        }
        
        console.log('App initialized successfully');
    } catch (error) {
        console.error('Error during initialization:', error);
    }
}

// --- File Tree Logic ---
function buildTree() {
    console.log('Building tree with data:', notesData);
    
    if (!notesData || !Array.isArray(notesData)) {
        console.error('Invalid notes data for tree building');
        treeRoot.innerHTML = '<p>No data available</p>';
        return;
    }
    
    treeRoot.innerHTML = '';
    
    // FIXED: Start with 0 instead of null since your data uses 0 for root items
    const tree = createTreeStructure(notesData, 0);
    
    console.log('Generated tree structure:', tree); // Debug log
    
    if (tree.length === 0) {
        console.log('Tree is empty, trying with null as parent...');
        // Fallback: try with null in case some items use null
        const fallbackTree = createTreeStructure(notesData, null);
        if (fallbackTree.length === 0) {
            treeRoot.innerHTML = '<p>No files or folders found</p>';
            return;
        } else {
            tree.push(...fallbackTree);
        }
    }
    
    const ul = document.createElement('ul');
    tree.forEach(node => {
        const element = createTreeElement(node);
        if (element) ul.appendChild(element);
    });
    treeRoot.appendChild(ul);
    
    console.log('Tree built successfully with', tree.length, 'root items');
}

function createTreeStructure(items, parentId) {
    if (!items || !Array.isArray(items)) {
        return [];
    }
    
    const filtered = items.filter(item => {
        const itemParentId = item.parent_id;
        
        // Handle root level items (can be 0, null, or missing)
        if (parentId === null || parentId === 0 || parentId === undefined) {
            return itemParentId === 0 || 
                   itemParentId === null || 
                   itemParentId === undefined ||
                   itemParentId === '0' || 
                   itemParentId === 'null' ||
                   itemParentId === '';
        }
        
        // Handle child items - convert both to numbers for comparison
        return parseInt(itemParentId) === parseInt(parentId);
    });
    
    return filtered.map(item => ({
        ...item,
        children: createTreeStructure(items, item.id)
    }));
}

function createTreeElement(item) {
    if (!item || !item.id || !item.name || !item.type) {
        console.error('Invalid item for tree element:', item);
        return document.createElement('li'); // Return empty li to prevent crashes
    }
    
    const li = document.createElement('li');
    li.dataset.id = item.id;
    li.dataset.type = item.type;
    li.className = 'tree-node';

    const contentDiv = document.createElement('div');
    contentDiv.className = 'tree-item';

    if (item.type === 'folder') {
        const hasChildren = item.children && item.children.length > 0;
        contentDiv.innerHTML = `
            ${hasChildren ? '<span class="caret"></span>' : '<span class="caret-placeholder"></span>'}
            <i class="fas fa-folder"></i>
            <span class="tree-item-name">${escapeHtml(item.name)}</span>
        `;
        
        // Add children if they exist
        if (hasChildren) {
            const childrenUl = document.createElement('ul');
            childrenUl.className = 'nested';
            item.children.forEach(child => {
                const childElement = createTreeElement(child);
                if (childElement) childrenUl.appendChild(childElement);
            });
            li.appendChild(childrenUl);
            
            // Add caret click handler
            const caretElement = contentDiv.querySelector('.caret');
            if (caretElement) {
                caretElement.addEventListener('click', (e) => {
                    e.stopPropagation();
                    e.target.classList.toggle('caret-down');
                    childrenUl.classList.toggle('active');
                });
            }
        }
    } else {
        contentDiv.innerHTML = `
            <i class="fas fa-file-alt"></i>
            <span class="tree-item-name">${escapeHtml(item.name)}</span>
        `;
    }

    li.appendChild(contentDiv);

    // Add click and context menu handlers
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

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// --- Item Interaction ---
async function handleItemSelect(item, element) {
    document.querySelectorAll('.tree-item.active-item').forEach(el => el.classList.remove('active-item'));
    
    selectedItem = { id: item.id, type: item.type, name: item.name, element };
    element.classList.add('active-item');

    if (item.type === 'file') {
        editor.value = 'Loading...';
        editor.disabled = true;
        const data = await apiCall('notes', 'get_content', 'GET', { id: item.id })
        console.log("NOTES API response:", data);
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
    
    console.log(result);
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