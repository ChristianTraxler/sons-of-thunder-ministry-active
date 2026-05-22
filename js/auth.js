/* =============================================
   AUTH.JS — Admin Authentication (Supabase Auth)

   Session persists in localStorage via the
   Supabase SDK. All writes are gated by the
   authenticated JWT + Row Level Security.
   ============================================= */

var Auth = (function () {
	// Cached session (populated by init/getSession)
	var _session = null;

	function getSession() {
		return sb.auth.getSession().then(function (res) {
			_session = res.data.session;
			return _session;
		});
	}

	function isLoggedIn() {
		return !!_session;
	}

	function currentUserEmail() {
		return _session && _session.user ? _session.user.email : null;
	}

	function login(email, password) {
		return sb.auth.signInWithPassword({ email: email, password: password })
			.then(function (res) {
				if (res.error) return { ok: false, error: res.error.message };
				_session = res.data.session;
				return { ok: true };
			});
	}

	function logout() {
		return sb.auth.signOut().then(function () {
			_session = null;
		});
	}

	// Guards the admin dashboard. Returns a promise that resolves to true
	// if logged in. Otherwise redirects to the login page and resolves false.
	function requireAuth() {
		return getSession().then(function (session) {
			if (!session) {
				window.location.href = 'admin-login.html';
				return false;
			}
			return true;
		});
	}

	function changePassword(newPassword) {
		return sb.auth.updateUser({ password: newPassword })
			.then(function (res) {
				if (res.error) return { ok: false, error: res.error.message };
				return { ok: true };
			});
	}

	function sendPasswordReset(email) {
		return sb.auth.resetPasswordForEmail(email, {
			redirectTo: window.location.origin + '/admin-login.html'
		}).then(function (res) {
			if (res.error) return { ok: false, error: res.error.message };
			return { ok: true };
		});
	}

	function rawDisplayName() {
		if (!_session || !_session.user) return null;
		var name = _session.user.user_metadata && _session.user.user_metadata.display_name;
		return (typeof name === 'string' && name.length > 0) ? name : null;
	}

	function displayName() {
		if (!_session || !_session.user) return null;
		var raw = rawDisplayName();
		if (raw) return raw;
		var email = _session.user.email || '';
		var at = email.indexOf('@');
		if (at > 0) {
			var local = email.slice(0, at);
			return local.charAt(0).toUpperCase() + local.slice(1);
		}
		return email || null;
	}

	function updateDisplayName(name) {
		var trimmed = (name || '').trim();
		var value = trimmed.length > 0 ? trimmed : null;
		return sb.auth.updateUser({ data: { display_name: value } })
			.then(function (res) {
				if (res.error) return { ok: false, error: res.error.message };
				// updateUser doesn't rotate tokens; only re-hydrate the user field.
				if (res.data && res.data.user) {
					if (_session) _session.user = res.data.user;
				}
				return { ok: true };
			});
	}

	return {
		getSession: getSession,
		isLoggedIn: isLoggedIn,
		currentUserEmail: currentUserEmail,
		login: login,
		logout: logout,
		requireAuth: requireAuth,
		changePassword: changePassword,
		sendPasswordReset: sendPasswordReset,
		rawDisplayName: rawDisplayName,
		displayName: displayName,
		updateDisplayName: updateDisplayName
	};
})();
