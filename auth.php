<?php
// api/auth.php
// Authentication handler for login, registration, and session management

// Add CORS headers for local development
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

// Handle preflight OPTIONS request
if ($_SERVER['REQUEST_METHOD'] == 'OPTIONS') {
    exit(0);
}

session_start();
include 'db.php';

// Get the action parameter
$action = $_GET['action'] ?? $_POST['action'] ?? null;

if ($action === 'register') {
    $username = trim($_POST['username'] ?? '');
    $password = $_POST['password'] ?? '';
    
    // Validation
    if (empty($username) || empty($password)) {
        send_json(['success' => false, 'message' => 'Username and password are required.']);
    }
    
    if (strlen($username) < 3) {
        send_json(['success' => false, 'message' => 'Username must be at least 3 characters long.']);
    }
    
    if (strlen($password) < 6) {
        send_json(['success' => false, 'message' => 'Password must be at least 6 characters long.']);
    }
    
    try {
        // Check if username already exists
        $stmt = $conn->prepare("SELECT id FROM users WHERE username = ?");
        $stmt->execute([$username]);
        if ($stmt->fetch()) {
            send_json(['success' => false, 'message' => 'Username already exists.']);
        }
        
        // Hash password and create user
        $hashedPassword = password_hash($password, PASSWORD_DEFAULT);
        $stmt = $conn->prepare("INSERT INTO users (username, password) VALUES (?, ?)");
        $stmt->execute([$username, $hashedPassword]);
        
        send_json(['success' => true, 'message' => 'Registration successful!']);
        
    } catch (PDOException $e) {
        error_log("Registration error: " . $e->getMessage());
        send_json(['success' => false, 'message' => 'Registration failed. Please try again.']);
    }
}

if ($action === 'login') {
    $username = trim($_POST['username'] ?? '');
    $password = $_POST['password'] ?? '';
    
    if (empty($username) || empty($password)) {
        send_json(['success' => false, 'message' => 'Username and password are required.']);
    }
    
    try {
        $stmt = $conn->prepare("SELECT id, username, password FROM users WHERE username = ?");
        $stmt->execute([$username]);
        $user = $stmt->fetch();
        
        if ($user && password_verify($password, $user['password'])) {
            $_SESSION['user_id'] = $user['id'];
            $_SESSION['username'] = $user['username'];
            send_json(['success' => true, 'message' => 'Login successful!']);
        } else {
            send_json(['success' => false, 'message' => 'Invalid username or password.']);
        }
        
    } catch (PDOException $e) {
        error_log("Login error: " . $e->getMessage());
        send_json(['success' => false, 'message' => 'Login failed. Please try again.']);
    }
}

if ($action === 'logout') {
    session_destroy();
    send_json(['success' => true, 'message' => 'Logged out successfully.']);
}

if ($action === 'status') {
    if (isset($_SESSION['user_id'])) {
        send_json([
            'loggedIn' => true, 
            'username' => $_SESSION['username'] ?? 'User',
            'user_id' => $_SESSION['user_id']
        ]);
    } else {
        send_json(['loggedIn' => false]);
    }
}

// If no valid action, return error
send_json(['success' => false, 'message' => 'Invalid action.']);
?>