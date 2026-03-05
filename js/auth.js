/* =============================================
   AUTH.JS — Admin Authentication Module
   localStorage: sot_admin_hash (password hash)
                 sot_admin_security (security question + answer hash)
   sessionStorage: sot_admin_session (active session)
   ============================================= */

var Auth = (function () {
	var HASH_KEY = 'sot_admin_hash';
	var SESSION_KEY = 'sot_admin_session';
	var SECURITY_KEY = 'sot_admin_security';

	// Seed localStorage from admin-config.js if browser data was cleared
	(function seedFromConfig() {
		if (typeof AdminConfig === 'undefined') return;
		if (!localStorage.getItem(HASH_KEY) && AdminConfig.passwordHash) {
			localStorage.setItem(HASH_KEY, AdminConfig.passwordHash);
		}
		if (!localStorage.getItem(SECURITY_KEY) && AdminConfig.securityQuestion && AdminConfig.securityAnswerHash) {
			localStorage.setItem(SECURITY_KEY, JSON.stringify({
				question: AdminConfig.securityQuestion,
				answerHash: AdminConfig.securityAnswerHash
			}));
		}
	})();

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

	// Save security question + hashed answer
	function setSecurityQuestion(question, answer) {
		return hashPassword(answer.trim().toLowerCase()).then(function (answerHash) {
			localStorage.setItem(SECURITY_KEY, JSON.stringify({
				question: question,
				answerHash: answerHash
			}));
		});
	}

	// Return stored question text or null
	function getSecurityQuestion() {
		var data = localStorage.getItem(SECURITY_KEY);
		if (!data) return null;
		return JSON.parse(data).question;
	}

	// Check if a security question has been set
	function hasSecurityQuestion() {
		return !!localStorage.getItem(SECURITY_KEY);
	}

	// Verify a security answer against stored hash
	function verifySecurityAnswer(answer) {
		var data = localStorage.getItem(SECURITY_KEY);
		if (!data) return Promise.resolve(false);
		var stored = JSON.parse(data).answerHash;
		return hashPassword(answer.trim().toLowerCase()).then(function (hash) {
			return hash === stored;
		});
	}

	// Reset password and create session
	function resetPassword(newPassword) {
		return hashPassword(newPassword).then(function (hash) {
			localStorage.setItem(HASH_KEY, hash);
			sessionStorage.setItem(SESSION_KEY, 'active');
		});
	}

	// Return current credential hashes for saving to admin-config.js
	function getCredentials() {
		var secData = localStorage.getItem(SECURITY_KEY);
		var parsed = secData ? JSON.parse(secData) : {};
		return {
			passwordHash: localStorage.getItem(HASH_KEY) || '',
			securityQuestion: parsed.question || '',
			securityAnswerHash: parsed.answerHash || ''
		};
	}

	return {
		isFirstVisit: isFirstVisit,
		setPassword: setPassword,
		login: login,
		isLoggedIn: isLoggedIn,
		logout: logout,
		requireAuth: requireAuth,
		setSecurityQuestion: setSecurityQuestion,
		getSecurityQuestion: getSecurityQuestion,
		hasSecurityQuestion: hasSecurityQuestion,
		verifySecurityAnswer: verifySecurityAnswer,
		resetPassword: resetPassword,
		getCredentials: getCredentials
	};
})();
