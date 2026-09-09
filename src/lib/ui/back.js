// SPA pushState never sets document.referrer, so BackLink cannot use
// referrer to decide. If this tab has a previous entry, use history.back();
// otherwise the link follows href (usually /).
export function shouldHistoryBack({ historyLength }) {
	return historyLength > 1;
}
