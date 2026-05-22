/* =============================================
   SUPABASE-CLIENT.JS — Shared Supabase instance

   The anon key is safe in client code — it is a
   public key. All security is enforced by Row
   Level Security policies on the database.
   ============================================= */

(function () {
	var SUPABASE_URL = 'https://yfdfmqnhawgrxajtioxl.supabase.co';
	var SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlmZGZtcW5oYXdncnhhanRpb3hsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY2OTY1NDAsImV4cCI6MjA5MjI3MjU0MH0.9aLtQ36j83RhM0sOAwIwq20ZkH_gX1a_IAB6u6Lh3cI';

	if (typeof window.supabase === 'undefined' || !window.supabase.createClient) {
		console.error('Supabase JS SDK not loaded — include @supabase/supabase-js script tag before this file.');
		return;
	}

	window.sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
		auth: {
			persistSession: true,
			autoRefreshToken: true,
			storageKey: 'sot_supabase_session'
		}
	});
})();
