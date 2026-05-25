/* =============================================
   EVENTS-PAGE.JS — Public event rendering

   Exposes two entry points:
     EventsPage.renderHomepagePreview() — #events
       section on the homepage; up to 3 upcoming
       events, hides the whole section if none.
     EventsPage.renderEventsPage()     — full list
       on events.html, with a collapsible past
       events section.
   ============================================= */

var EventsPage = (function () {

	function escapeHtml(str) {
		var d = document.createElement('div');
		d.textContent = str == null ? '' : str;
		return d.innerHTML;
	}

	function cardHtml(ev, variant) {
		var badge = Events.formatDateBadge(ev.eventDate);
		var dateStr = Events.formatDate(ev.eventDate);
		var timeStr = Events.formatTimeRange(ev.startTime, ev.endTime);

		var metaBits = [dateStr];
		if (timeStr) metaBits.push(timeStr);
		if (ev.location) metaBits.push(escapeHtml(ev.location));

		var descHtml = ev.description
			? '<div class="event-card-desc' + (variant === 'preview' ? ' event-card-desc-clamp' : '') + '">' + ev.description + '</div>'
			: '';

		var linkHtml = ev.linkUrl
			? '<a class="event-card-link" href="' + escapeHtml(ev.linkUrl) + '" target="_blank" rel="noopener">More Info</a>'
			: '';

		var catClass = ev.category === 'track' ? 'is-track' : 'is-church';
		var catLabel = ev.category === 'track' ? 'Track' : 'Church';
		var catBadge = '<span class="event-category-badge ' + catClass + '">' + catLabel + '</span>';

		return '<article class="event-card">'
			+ '<div class="event-card-badge">'
			+ '<span class="event-card-badge-month">' + badge.month + '</span>'
			+ '<span class="event-card-badge-day">' + badge.day + '</span>'
			+ '</div>'
			+ '<div class="event-card-body">'
			+ '<h3 class="event-card-title">' + escapeHtml(ev.title) + '</h3>'
			+ catBadge
			+ '<div class="event-card-meta">' + metaBits.join(' · ') + '</div>'
			+ descHtml
			+ linkHtml
			+ '</div>'
			+ '</article>';
	}

	// Group past events (already sorted newest-first) into
	// year → month buckets, preserving descending order.
	function groupByYearMonth(events) {
		var years = [];
		var yearMap = {};
		events.forEach(function (ev) {
			var d = new Date(ev.eventDate + 'T00:00:00');
			var year = d.getFullYear();
			var monthKey = year + '-' + d.getMonth();
			var monthLabel = d.toLocaleDateString('en-US', { month: 'long' });

			var yObj = yearMap[year];
			if (!yObj) {
				yObj = yearMap[year] = { year: year, months: [], monthMap: {} };
				years.push(yObj);
			}
			var mObj = yObj.monthMap[monthKey];
			if (!mObj) {
				mObj = yObj.monthMap[monthKey] = { label: monthLabel, events: [] };
				yObj.months.push(mObj);
			}
			mObj.events.push(ev);
		});
		return years;
	}

	function pastGroupedHtml(events) {
		return groupByYearMonth(events).map(function (yObj) {
			var monthsHtml = yObj.months.map(function (m) {
				return '<div class="events-month-group">'
					+ '<h4 class="events-month-heading">' + m.label + '</h4>'
					+ '<div class="events-list">'
					+ m.events.map(function (e) { return cardHtml(e, 'full'); }).join('')
					+ '</div>'
					+ '</div>';
			}).join('');
			return '<div class="events-year-group">'
				+ '<button type="button" class="events-year-heading" aria-expanded="false">'
				+ '<span class="events-year-arrow"></span>' + yObj.year
				+ '</button>'
				+ '<div class="events-year-content"><div class="events-year-content-inner">' + monthsHtml + '</div></div>'
				+ '</div>';
		}).join('');
	}

	function renderHomepagePreview() {
		var section = document.getElementById('events');
		if (!section) return;
		var listEl = section.querySelector('.events-preview-list');
		if (!listEl) return;

		Events.getUpcoming(3).then(function (events) {
			if (events.length === 0) {
				section.style.display = 'none';
				return;
			}
			listEl.innerHTML = events.map(function (e) { return cardHtml(e, 'preview'); }).join('');
		}).catch(function () {
			section.style.display = 'none';
		});
	}

	function renderEventsPage() {
		var upcomingEl = document.getElementById('eventsUpcomingList');
		var pastWrap   = document.getElementById('eventsPastWrap');
		var pastList   = document.getElementById('eventsPastList');
		var pastToggle = document.getElementById('eventsPastToggle');
		if (!upcomingEl) return;

		Events.getUpcoming().then(function (events) {
			if (events.length === 0) {
				upcomingEl.innerHTML = '<p class="events-empty">No upcoming events right now. Check back soon.</p>';
				return;
			}
			upcomingEl.innerHTML = events.map(function (e) { return cardHtml(e, 'full'); }).join('');
		});

		var pastLoaded = false;
		if (pastToggle) {
			pastToggle.addEventListener('click', function () {
				var isOpen = pastWrap.classList.toggle('is-open');
				pastToggle.textContent = isOpen ? 'Hide past events' : 'Show past events';
				if (isOpen && !pastLoaded) {
					pastLoaded = true;
					pastList.innerHTML = '<p class="events-empty">Loading…</p>';
					Events.getPast().then(function (events) {
						if (events.length === 0) {
							pastList.innerHTML = '<p class="events-empty">No past events.</p>';
							return;
						}
						pastList.innerHTML = pastGroupedHtml(events);
						// Collapse/expand a year group when its heading is clicked.
						pastList.addEventListener('click', function (ev) {
							var btn = ev.target.closest('.events-year-heading');
							if (!btn) return;
							var group = btn.parentNode;
							var isOpen = group.classList.toggle('open');
							btn.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
						});
					});
				}
			});
		}
	}

	return {
		renderHomepagePreview: renderHomepagePreview,
		renderEventsPage: renderEventsPage
	};
})();
