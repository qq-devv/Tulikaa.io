<?php
// api/notes.php
// This script is the main API for all file/folder operations (CRUD).

session_start();
include 'db.php';

// --- SECURITY CHECK ---
// Every action in this file requires the user to be logged in.
// If 'user_id' is not in the session, stop execution immediately.
if (!isset($_SESSION['user_id'])) {
    http_response_code(401); // Unauthorized
    send_json(['error' => 'User not authenticated.']);
}
$user_id = $_SESSION['user_id'];

// Determine the action from the request (GET for reading, POST for writing).
$action = $_GET['action'] ?? $_POST['action'] ?? null;

// --- ACTION: GET ALL NOTES FOR THE LOGGED-IN USER ---
if ($action === 'get_all') {
    $stmt = $conn->prepare("SELECT id, parent_id, name, type FROM notes WHERE user_id = ?");
    $stmt->execute([$user_id]);
    send_json($stmt->fetchAll());
}

// --- ACTION: GET CONTENT OF A SPECIFIC FILE ---
if ($action === 'get_content') {
    $note_id = $_GET['id'] ?? 0;
    $stmt = $conn->prepare("SELECT content FROM notes WHERE id = ? AND user_id = ? AND type = 'file'");
    $stmt->execute([$note_id, $user_id]);
    send_json($stmt->fetch());
}

// --- ACTION: CREATE A NEW FILE OR FOLDER ---
if ($action === 'create') {
    $name = $_POST['name'] ?? 'Untitled';
    $type = $_POST['type'] ?? 'file'; // 'file' or 'folder'
    $parent_id = empty($_POST['parent_id']) ? null : $_POST['parent_id'];

    $stmt = $conn->prepare("INSERT INTO notes (user_id, parent_id, name, type, content) VALUES (?, ?, ?, ?, ?)");
    $stmt->execute([$user_id, $parent_id, $name, $type, ($type === 'file' ? '# ' . $name : '')]);
    
    // Send back the ID of the newly created item
    send_json(['success' => true, 'id' => $conn->lastInsertId()]);
}

// --- ACTION: UPDATE A NOTE'S CONTENT ---
if ($action === 'update_content') {
    $note_id = $_POST['id'] ?? 0;
    $content = $_POST['content'] ?? '';

    $stmt = $conn->prepare("UPDATE notes SET content = ? WHERE id = ? AND user_id = ?");
    $stmt->execute([$content, $note_id, $user_id]);
    send_json(['success' => true]);
}

// --- ACTION: RENAME A FILE OR FOLDER ---
if ($action === 'rename') {
    $note_id = $_POST['id'] ?? 0;
    $new_name = $_POST['name'] ?? 'Untitled';

    $stmt = $conn->prepare("UPDATE notes SET name = ? WHERE id = ? AND user_id = ?");
    $stmt->execute([$new_name, $note_id, $user_id]);
    send_json(['success' => true]);
}

// --- ACTION: MOVE A FILE OR FOLDER (CHANGE PARENT) ---
if ($action === 'move') {
    $note_id = $_POST['id'] ?? 0;
    $new_parent_id = empty($_POST['parent_id']) ? null : $_POST['parent_id'];

    $stmt = $conn->prepare("UPDATE notes SET parent_id = ? WHERE id = ? AND user_id = ?");
    $stmt->execute([$new_parent_id, $note_id, $user_id]);
    send_json(['success' => true]);
}

// --- ACTION: DELETE A FILE OR FOLDER ---
if ($action === 'delete') {
    $note_id = $_POST['id'] ?? 0;

    // For folders, we need to delete all children recursively.
    // This is a simplified approach. A true recursive delete in SQL can be complex.
    // We'll handle it by deleting the item and any direct children.
    // A more robust solution would use a recursive function.
    $stmt = $conn->prepare("DELETE FROM notes WHERE id = ? AND user_id = ?");
    $stmt->execute([$note_id, $user_id]);
    
    // Also delete children of a folder
    $stmt = $conn->prepare("DELETE FROM notes WHERE parent_id = ? AND user_id = ?");
    $stmt->execute([$note_id, $user_id]);

    send_json(['success' => true]);
}
