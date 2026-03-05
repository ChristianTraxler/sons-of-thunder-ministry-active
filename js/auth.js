/* =============================================
   AUTH.JS — Admin Authentication Module
   localStorage: sot_admin_hash (password hash)
   sessionStorage: sot_admin_session (active session)
   ============================================= */

var Auth = (function () {
	var HASH_KEY = 'sot_admin_hash';
	var SESSION_KEY = 'sot_admin_session';

	// Simple hash function (SHA-256 via SubtleCrypto)
	function hashPassword(password) {
		var encoder = new TextEncoder();
		var data = encoder.encode(password);
		return crypto.subtle.digest('SHA-256', data).then(function (buffer) {
			var hashArray = Array.from(new Uint8Array(buffer));
			return hashArray.map(function (b) { return b.toString(16).padStart(2, '0'); }).join('');
		});
	}

	// Check if a password has been set
	function isFirstVisit() {
		return !localStorage.getItem(HASH_KEY);
	}

	// Set password (first visit)
	function setPassword(password) {
		return hashPassword(password).then(function (hash) {
			localStorage.setItem(HASH_KEY, hash);
			sessionStorage.setItem(SESSION_KEY, 'active');
		});
	}

	// Verify password and create session
	function login(password) {
		return hashPassword(password).then(function (hash) {
			var stored = localStorage.getItem(HASH_KEY);
			if (hash === stored) {
				sessionStorage.setItem(SESSION_KEY, 'active');
				return true;
			}
			return false;
		});
	}

	// Check if session is active
	function isLoggedIn() {
		return sessionStorage.getItem(SESSION_KEY) === 'active';
	}

	// Destroy session
	function logout() {
		sessionStorage.removeItem(SESSION_KEY);
	}

	// Guard: redirect if not logged in
	function requireAuth() {
		if (!isLoggedIn()) {
			window.location.href = 'admin-login.html';
			return false;
		}
		return true;
	}

	return {
		isFirstVisit: isFirstVisit,
		setPassword: setPassword,
		login: login,
		isLoggedIn: isLoggedIn,
		logout: logout,
		requireAuth: requireAuth
	};
})();
