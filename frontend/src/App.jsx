import { useCallback, useEffect, useMemo, useState } from 'react';
import io from 'socket.io-client';
import {
  AlertTriangle,
  Activity,
  Bug,
  Check,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Copy,
  Search,
  X,
  RefreshCw,
} from 'lucide-react';
import { fetchIssues, fetchIssueDetails, updateStatus } from './api';
import './App.css';

const SOCKET_SERVER_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:2000';
const STATUSES = ['', 'UNRESOLVED', 'IN_PROGRESS', 'RESOLVED'];

const formatDate = (date) => {
  if (!date) return '—';
  const parsedDate = new Date(date);
  return Number.isNaN(parsedDate.getTime())
    ? '—'
    : parsedDate.toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
};

export default function App() {
  const [issues, setIssues] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIssue, setSelectedIssue] = useState(null);
  const [issueDetails, setIssueDetails] = useState(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [error, setError] = useState('');
  const [detailsError, setDetailsError] = useState('');
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [copied, setCopied] = useState(false);

  const loadIssues = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetchIssues();
      if (!res.success) throw new Error('The issue service returned an unsuccessful response.');
      setIssues(res.data);
    } catch (err) {
      console.error('Failed to load issues:', err);
      setError('Could not load issues. Check that the ErrorPulse API is available, then try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchIssues()
      .then((res) => {
        if (!res.success) throw new Error('The issue service returned an unsuccessful response.');
        setIssues(res.data);
      })
      .catch((err) => {
        console.error('Failed to load issues:', err);
        setError('Could not load issues. Check that the ErrorPulse API is available, then try again.');
      })
      .finally(() => setLoading(false));
  }, [loadIssues]);

  useEffect(() => {
    const socket = io(SOCKET_SERVER_URL);
    socket.on('connect', () => socket.emit('join_room', 'developers-room'));
    socket.on('new_error_event', loadIssues);
    socket.on('issue_status_changed', loadIssues);
    return () => socket.disconnect();
  }, [loadIssues]);

  const handleSelectIssue = (issue) => {
    setSelectedIssue(issue);
    setLoadingDetails(true);
    setDetailsError('');
    setIssueDetails(null);
  };

  const selectedIssueId = selectedIssue?._id;
  useEffect(() => {
    if (!selectedIssueId) return undefined;
    let active = true;
    fetchIssueDetails(selectedIssueId)
      .then((res) => {
        if (!active) return;
        if (!res.success) throw new Error('The issue service returned an unsuccessful response.');
        setIssueDetails(res.data);
      })
      .catch((err) => {
        if (!active) return;
        console.error('Failed to load issue details:', err);
        setDetailsError('Could not load the issue details. Please try closing and reopening this issue.');
      })
      .finally(() => {
        if (active) setLoadingDetails(false);
      });
    return () => {
      active = false;
    };
  }, [selectedIssueId]);

  useEffect(() => {
    if (!selectedIssue) return undefined;
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') setSelectedIssue(null);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedIssue]);

  const visibleIssues = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return issues.filter((issue) => {
      const matchesStatus = !filterStatus || issue.status === filterStatus;
      const matchesQuery = !query || issue.title?.toLowerCase().includes(query);
      return matchesStatus && matchesQuery;
    });
  }, [filterStatus, issues, searchQuery]);

  const counts = useMemo(
    () => ({
      total: issues.length,
      UNRESOLVED: issues.filter((issue) => issue.status === 'UNRESOLVED').length,
      IN_PROGRESS: issues.filter((issue) => issue.status === 'IN_PROGRESS').length,
      RESOLVED: issues.filter((issue) => issue.status === 'RESOLVED').length,
    }),
    [issues],
  );

  const handleStatusChange = async (issueId, newStatus) => {
    setUpdatingStatus(true);
    setError('');
    try {
      const res = await updateStatus(issueId, newStatus);
      if (res.success === false) throw new Error('The issue service did not update the status.');
      setIssues((currentIssues) =>
        currentIssues.map((issue) =>
          issue._id === issueId ? { ...issue, status: newStatus } : issue,
        ),
      );
      setSelectedIssue((currentIssue) =>
        currentIssue?._id === issueId ? { ...currentIssue, status: newStatus } : currentIssue,
      );
    } catch (err) {
      console.error('Failed to update status:', err);
      setError('Status could not be updated. Please try again.');
    } finally {
      setUpdatingStatus(false);
    }
  };

  const handleCopyTrace = async () => {
    const stackTrace = issueDetails?.issue?.stackTrace;
    if (!stackTrace) return;
    try {
      await navigator.clipboard.writeText(stackTrace);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch (err) {
      console.error('Failed to copy stack trace:', err);
      setDetailsError('Clipboard access was blocked. Select and copy the stack trace manually.');
    }
  };

  return (
    <div className="app-shell">
      <header className="topbar">
        <a className="brand" href="#" aria-label="ErrorPulse home">
          <span className="brand-mark"><Activity size={20} strokeWidth={2.5} /></span>
          <span className="brand-name">error<span>pulse</span></span>
        </a>
        <div className="topbar-right">
          <span className="live-indicator"><i /> Live monitoring</span>
          <button className="refresh-button" onClick={loadIssues} disabled={loading}>
            <RefreshCw size={15} className={loading ? 'spin' : ''} />
            <span>{loading ? 'Refreshing' : 'Refresh'}</span>
          </button>
        </div>
      </header>

      <main className="dashboard">
        <section className="welcome-row">
          <div>
            <p className="eyebrow">DEVELOPER CONSOLE <span>/</span> OVERVIEW</p>
            <h1>Issue activity</h1>
            <p className="page-subtitle">Catch problems early. Keep your systems healthy.</p>
          </div>
          <div className="updated-chip"><span className="pulse-dot" /> Real-time updates enabled</div>
        </section>

        <section className="metrics-grid" aria-label="Issue summary">
          <article className="metric-card metric-total">
            <div className="metric-icon"><Bug size={18} /></div>
            <span className="metric-label">Total issues</span>
            <strong>{counts.total}</strong>
            <span className="metric-foot">Across all statuses</span>
          </article>
          <article className="metric-card metric-open">
            <div className="metric-icon"><AlertTriangle size={18} /></div>
            <span className="metric-label">Unresolved</span>
            <strong>{counts.UNRESOLVED}</strong>
            <span className="metric-foot">Need your attention</span>
          </article>
          <article className="metric-card metric-progress">
            <div className="metric-icon"><Clock3 size={18} /></div>
            <span className="metric-label">In progress</span>
            <strong>{counts.IN_PROGRESS}</strong>
            <span className="metric-foot">Being investigated</span>
          </article>
          <article className="metric-card metric-resolved">
            <div className="metric-icon"><CheckCircle2 size={18} /></div>
            <span className="metric-label">Resolved</span>
            <strong>{counts.RESOLVED}</strong>
            <span className="metric-foot">Back under control</span>
          </article>
        </section>

        <section className="issues-panel">
          <div className="panel-heading">
            <div>
              <h2>All issues <span className="issue-total">{counts.total}</span></h2>
              <p>Review, prioritize, and resolve errors from your projects.</p>
            </div>
            <label className="search-box">
              <Search size={16} />
              <input
                type="search"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Search issues..."
                aria-label="Search issues"
              />
              {searchQuery && (
                <button className="clear-search" onClick={() => setSearchQuery('')} aria-label="Clear search">
                  <X size={14} />
                </button>
              )}
            </label>
          </div>

          <div className="filter-bar" role="tablist" aria-label="Filter issues by status">
            {STATUSES.map((status) => {
              const count = status ? counts[status] : counts.total;
              return (
                <button
                  key={status || 'all'}
                  role="tab"
                  aria-selected={filterStatus === status}
                  onClick={() => setFilterStatus(status)}
                  className={`filter-tab ${filterStatus === status ? 'active' : ''}`}
                >
                  {status === '' ? 'All issues' : status.replace('_', ' ')}
                  <span className="filter-count">{count}</span>
                </button>
              );
            })}
          </div>

          {error && (
            <div className="inline-error" role="alert">
              <AlertTriangle size={16} />
              <span>{error}</span>
              <button onClick={loadIssues}>Try again</button>
            </div>
          )}

          <div className="table-scroll">
            <table className="issues-table">
              <thead>
                <tr>
                  <th>Issue</th>
                  <th>Status</th>
                  <th className="occurrences-column">Occurrences</th>
                  <th>Last seen</th>
                  <th aria-label="Open issue details" />
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan="5"><div className="table-state"><span className="loader" /> Loading your issues...</div></td></tr>
                ) : visibleIssues.length === 0 ? (
                  <tr>
                    <td colSpan="5">
                      <div className="table-state empty-state">
                        <span className="empty-icon"><CheckCircle2 size={22} /></span>
                        <strong>{error ? 'Issues are unavailable' : searchQuery ? 'No matching issues' : 'All clear'}</strong>
                        <span>{error ? 'We could not reach the issue service.' : searchQuery ? 'Try another search or status filter.' : 'No issues match this filter. Your systems look healthy.'}</span>
                        {searchQuery && <button className="text-button" onClick={() => setSearchQuery('')}>Clear search</button>}
                      </div>
                    </td>
                  </tr>
                ) : visibleIssues.map((issue) => (
                  <tr key={issue._id} onClick={() => handleSelectIssue(issue)} className="issue-row">
                    <td>
                      <button className="issue-title-button" onClick={() => handleSelectIssue(issue)}>
                        <span className="issue-alert"><AlertTriangle size={15} /></span>
                        <span className="issue-title-text">
                          <strong>{issue.title}</strong>
                          <small>ID: {String(issue._id).slice(-8)}</small>
                        </span>
                      </button>
                    </td>
                    <td><StatusBadge status={issue.status} /></td>
                    <td className="occurrences-column"><span className="occurrence-count">{issue.count}</span></td>
                    <td><span className="last-seen">{formatDate(issue.lastSeen)}</span></td>
                    <td><button className="open-issue" onClick={() => handleSelectIssue(issue)} aria-label={`Open ${issue.title}`}><ChevronRight size={17} /></button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!loading && visibleIssues.length > 0 && (
            <footer className="panel-footer">
              Showing <strong>{visibleIssues.length}</strong> of <strong>{counts.total}</strong> issues
              <span><i /> Updates arrive automatically</span>
            </footer>
          )}
        </section>
        <footer className="page-footer">ErrorPulse <span>·</span> Keeping your applications healthy</footer>
      </main>

      {selectedIssue && (
        <div className="drawer-backdrop" onMouseDown={(event) => {
          if (event.target === event.currentTarget) setSelectedIssue(null);
        }}>
          <aside className="issue-drawer" role="dialog" aria-modal="true" aria-labelledby="drawer-title">
            <header className="drawer-header">
              <div>
                <p className="eyebrow">ISSUE DETAILS</p>
                <h2 id="drawer-title">{selectedIssue.title}</h2>
              </div>
              <button className="icon-button close-drawer" onClick={() => setSelectedIssue(null)} aria-label="Close issue details"><X size={19} /></button>
            </header>

            <div className="drawer-content">
              <section className="detail-summary">
                <div className="detail-summary-top"><StatusBadge status={selectedIssue.status} /><span className="detail-id">#{String(selectedIssue._id).slice(-8)}</span></div>
                <div className="detail-stats">
                  <div><span>Occurrences</span><strong>{selectedIssue.count}</strong></div>
                  <div><span>Last seen</span><strong>{formatDate(selectedIssue.lastSeen)}</strong></div>
                </div>
              </section>

              <section className="status-section">
                <div className="section-title-row"><h3>Update status</h3>{updatingStatus && <span className="saving-label">Saving...</span>}</div>
                <div className="status-options">
                  {STATUSES.slice(1).map((status) => (
                    <button
                      key={status}
                      disabled={updatingStatus || selectedIssue.status === status}
                      onClick={() => handleStatusChange(selectedIssue._id, status)}
                      className={`status-option ${status.toLowerCase()} ${selectedIssue.status === status ? 'selected' : ''}`}
                    >
                      {selectedIssue.status === status && <Check size={14} />}
                      {status.replace('_', ' ')}
                    </button>
                  ))}
                </div>
              </section>

              {detailsError && <div className="inline-error detail-error" role="alert"><AlertTriangle size={15} />{detailsError}</div>}
              {loadingDetails ? (
                <div className="detail-loading"><span className="loader" /> Fetching event details...</div>
              ) : issueDetails && (
                <>
                  <section className="trace-section">
                    <div className="section-title-row">
                      <h3>Stack trace</h3>
                      <button className="copy-button" onClick={handleCopyTrace} disabled={!issueDetails.issue?.stackTrace}>
                        {copied ? <Check size={14} /> : <Copy size={14} />}
                        {copied ? 'Copied' : 'Copy'}
                      </button>
                    </div>
                    <pre>{issueDetails.issue?.stackTrace || 'No stack trace was provided.'}</pre>
                  </section>

                  <section className="events-section">
                    <div className="section-title-row">
                      <h3>Recent occurrences</h3>
                      <span className="event-count">{issueDetails.events?.length || 0}</span>
                    </div>
                    {issueDetails.events?.length ? (
                      <div className="event-list">
                        {issueDetails.events.map((event, index) => (
                          <article className="event-card" key={event._id || `${event.createdAt}-${index}`}>
                            <div className="event-card-top">
                              <span>{event.requestMethod || 'POST'} {event.requestUrl || '/api/v1/logs'}</span>
                              <time>{formatDate(event.createdAt)}</time>
                            </div>
                            <p>Agent: {event.userAgent || 'Unknown agent'}</p>
                          </article>
                        ))}
                      </div>
                    ) : <p className="no-events">No occurrence history available.</p>}
                  </section>
                </>
              )}
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }) {
  const statusClass = status?.toLowerCase().replace('_', '-') || 'unknown';
  return <span className={`status-badge ${statusClass}`}><i />{status?.replace('_', ' ') || 'UNKNOWN'}</span>;
}
