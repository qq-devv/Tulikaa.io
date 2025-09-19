<?php
// api/db.php

// --- DEVELOPMENT ONLY: ENABLE FULL ERROR REPORTING ---
// These lines make PHP display all errors, warnings, and notices.
// This is extremely useful for debugging but should be turned off in a live production environment.
error_reporting(E_ALL);
ini_set('display_errors', 1);

// --- DATABASE CONFIGURATION ---
$servername = "localhost";
$username = "root";
$password = "";
$dbname = "tulika_db";

// --- ESTABLISH DATABASE CONNECTION ---
try {
    $conn = new PDO("mysql:host=$servername;dbname=$dbname", $username, $password);
    $conn->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    $conn->setAttribute(PDO::ATTR_DEFAULT_FETCH_MODE, PDO::FETCH_ASSOC);
} catch(PDOException $e) {
    http_response_code(500);
    // Make sure to output the error in a JSON format so the frontend can read it.
    die(json_encode(['error' => "Database Connection failed: " . $e->getMessage()]));
}

// --- HELPER FUNCTION TO SEND JSON RESPONSE ---
function send_json($data) {
    header('Content-Type: application/json');
    echo json_encode($data);
    exit();
}
?>
