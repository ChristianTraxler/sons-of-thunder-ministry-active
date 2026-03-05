/* =============================================
   SERMONS-PAGE.JS — Public Sermons Renderer
   Reads from localStorage, builds sermon cards
   Splits into Recent vs Archived (3-month cutoff)
   ============================================= */

(function () {
	var container = document.querySelector('.sermons-list');
	var archiveSection = document.getElementById('archive');
	var archiveList = document.querySelector('.sermons-archive-list');
	if (!container) return;

	var sermons = Sermons.getAll(); // already sorted newest-first

	if (sermons.length === 0) {
		// Leave the placeholder as-is
		return;
	}

	// Calculate cutoff: 3 months ago from today
	var cutoff = new Date();
	cutoff.setMonth(cutoff.getMonth() - 3);
	cutoff.setHours(0, 0, 0, 0);

	var recent = [];
	var archived = [];

	sermons.forEach(function (sermon) {
		var sermonDate = new Date(sermon.date + 'T00:00:00');
		if (sermonDate > cutoff) {
			recent.push(sermon);
		} else {
			archived.push(sermon);
		}
	});

	// Clear placeholder
	container.innerHTML = '';

	// --- Render recent sermons ---
	if (recent.length > 0) {
		recent.forEach(function (sermon) {
			container.appendChild(buildSermonCard(sermon));
		});
	} else {
		var msg = document.createElement('p');
		msg.className = 'sermons-placeholder';
		msg.textContent = 'No recent sermons. Check the archive below for past messages.';
		container.appendChild(msg);
	}

	// --- Render archived sermons into separate section ---
	if (archived.length > 0 && archiveSection && archiveList) {
		archiveList.innerHTML = '';

		// Group by year, then month (both descending)
		var grouped = groupByYearMonth(archived);
		var years = Object.keys(grouped).sort(function (a, b) { return b - a; });

		years.forEach(function (year) {
			// Year heading (collapsed by default)
			var yearSection = document.createElement('div');
			yearSection.className = 'archive-year-section';

			var yearHeading = document.createElement('button');
			yearHeading.className = 'archive-year';
			yearHeading.setAttribute('aria-expanded', 'false');
			yearHeading.innerHTML = '<span class="archive-year-arrow"></span>' + escapeHtml(year);
			yearSection.appendChild(yearHeading);

			var yearContent = document.createElement('div');
			yearContent.className = 'archive-year-content';

			var months = Object.keys(grouped[year]).sort(function (a, b) { return b - a; });

			months.forEach(function (month) {
				var monthName = new Date(2000, parseInt(month, 10), 1).toLocaleString('en-US', { month: 'long' });

				var monthHeading = document.createElement('h4');
				monthHeading.className = 'archive-month';
				monthHeading.textContent = monthName;
				yearContent.appendChild(monthHeading);

				grouped[year][month].forEach(function (sermon) {
					yearContent.appendChild(buildSermonCard(sermon));
				});
			});

			yearSection.appendChild(yearContent);
			archiveList.appendChild(yearSection);

			// Toggle handler
			yearHeading.addEventListener('click', function () {
				var isOpen = yearSection.classList.toggle('open');
				yearHeading.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
			});
		});
	}

	// --- Helpers ---

	function buildSermonCard(sermon) {
		var card = document.createElement('div');
		card.className = 'sermon-card-full';

		var html = '';

		// YouTube embed
		if (sermon.youtubeId) {
			html += '<div class="sermon-video-wrap">'
				+ '<iframe src="https://www.youtube-nocookie.com/embed/' + sermon.youtubeId
				+ '" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>'
				+ '</div>';
		}

		// Sermon info
		html += '<div class="sermon-card-body">';

		// Title
		html += '<h3 class="sermon-card-title">' + escapeHtml(sermon.title) + '</h3>';

		// Meta line
		var meta = [];
		if (sermon.author) meta.push(escapeHtml(sermon.author));
		if (sermon.date) {
			var dateStr = new Date(sermon.date + 'T00:00:00').toLocaleDateString('en-US', {
				year: 'numeric', month: 'long', day: 'numeric'
			});
			meta.push(dateStr);
		}
		if (meta.length) {
			html += '<div class="sermon-card-meta">' + meta.join(' &middot; ') + '</div>';
		}

		// Content (already HTML from rich editor)
		if (sermon.content && sermon.content.trim() && sermon.content !== '<br>') {
			html += '<div class="sermon-card-content">' + sermon.content + '</div>';
		}

		html += '</div>';
		card.innerHTML = html;
		return card;
	}

	function groupByYearMonth(sermons) {
		var groups = {};
		sermons.forEach(function (sermon) {
			var d = new Date(sermon.date + 'T00:00:00');
			var year = d.getFullYear();
			var month = d.getMonth(); // 0-11
			if (!groups[year]) groups[year] = {};
			if (!groups[year][month]) groups[year][month] = [];
			groups[year][month].push(sermon);
		});
		return groups;
	}

	function escapeHtml(str) {
		var div = document.createElement('div');
		div.textContent = str || '';
		return div.innerHTML;
	}
})();
