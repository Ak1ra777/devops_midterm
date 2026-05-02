import { useEffect, useMemo, useState } from 'react'
import {
  BrowserRouter,
  Link,
  Navigate,
  Route,
  Routes,
  useNavigate,
  useParams,
} from 'react-router-dom'
import './App.css'

const API_ORIGIN = import.meta.env.DEV
  ? 'http://127.0.0.1:8000'
  : window.location.origin
const API_BASE_URL = `${API_ORIGIN}/api`

const STATUS_OPTIONS = ['pending', 'running', 'success', 'failed']
const ENVIRONMENT_OPTIONS = ['staging', 'production']

async function fetchJson(path, options = {}) {
  const { headers, ...fetchOptions } = options

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...fetchOptions,
    headers: {
      Accept: 'application/json',
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...headers,
    },
  })

  let data = null
  const text = await response.text()

  if (text) {
    try {
      data = JSON.parse(text)
    } catch {
      throw new Error('The API returned a response that was not JSON.')
    }
  }

  if (!response.ok) {
    throw new Error(getApiErrorMessage(data, response.status))
  }

  return data
}

function getApiErrorMessage(data, status) {
  if (typeof data?.detail === 'string') {
    return data.detail
  }

  if (Array.isArray(data?.detail) && data.detail.length > 0) {
    return data.detail.map((item) => item.msg || 'Validation error').join(', ')
  }

  return `Request failed with status ${status}.`
}

function normalizeDeployments(data) {
  if (Array.isArray(data)) {
    return data
  }

  if (Array.isArray(data?.deployments)) {
    return data.deployments
  }

  if (Array.isArray(data?.items)) {
    return data.items
  }

  return []
}

function getCreatedAt(deployment) {
  return (
    deployment?.created_at ||
    deployment?.createdAt ||
    deployment?.created_time ||
    deployment?.createdTime ||
    deployment?.created ||
    ''
  )
}

function formatDateTime(value) {
  if (!value) {
    return 'Not recorded'
  }

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return String(value)
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date)
}

function getHealthStatus(health) {
  if (!health) {
    return 'unknown'
  }

  if (typeof health.status === 'string') {
    return health.status
  }

  if (typeof health.ready === 'boolean') {
    return health.ready ? 'ready' : 'not ready'
  }

  if (typeof health.healthy === 'boolean') {
    return health.healthy ? 'healthy' : 'unhealthy'
  }

  return 'online'
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/deployments/:version" element={<DeploymentDetailPage />} />
        <Route path="/new-deployment" element={<NewDeploymentPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

function PageShell({ children }) {
  return (
    <div className="app-shell">
      <header className="topbar">
        <Link to="/" className="brand" aria-label="Dashboard home">
          <span className="brand-mark">DD</span>
          <span>
            <span className="brand-kicker">Release Operations</span>
            <span className="brand-title">DevOps Deployment Dashboard</span>
          </span>
        </Link>
        <nav className="topbar-actions" aria-label="Primary navigation">
          <Link to="/" className="nav-link">
            Dashboard
          </Link>
          <Link to="/new-deployment" className="button button-primary">
            New deployment
          </Link>
        </nav>
      </header>
      <main>{children}</main>
    </div>
  )
}

function DashboardPage() {
  const [health, setHealth] = useState(null)
  const [deployments, setDeployments] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const controller = new AbortController()

    async function loadDashboard() {
      try {
        setLoading(true)
        setError('')

        const [healthData, deploymentsData] = await Promise.all([
          fetchJson('/health', { signal: controller.signal }),
          fetchJson('/deployments', { signal: controller.signal }),
        ])

        setHealth(healthData)
        setDeployments(normalizeDeployments(deploymentsData))
      } catch (err) {
        if (err.name !== 'AbortError') {
          setError(err.message || 'Unable to load the dashboard.')
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false)
        }
      }
    }

    loadDashboard()

    return () => controller.abort()
  }, [])

  const metrics = useMemo(() => getDeploymentMetrics(deployments), [deployments])

  return (
    <PageShell>
      <section className="hero-section">
        <div>
          <p className="eyebrow">FastAPI backed deployment control plane</p>
          <h1>DevOps Deployment Dashboard</h1>
          <p className="hero-copy">
            Monitor service health, review release history, and register new
            deployments from a focused SRE workspace.
          </p>
        </div>
        <Link to="/new-deployment" className="button button-primary hero-action">
          Create deployment
        </Link>
      </section>

      {error ? <Alert message={error} /> : null}

      <section className="dashboard-grid" aria-label="Deployment summary">
        <HealthCard health={health} loading={loading} />
        <MetricCard label="Total deployments" value={metrics.total} />
        <MetricCard label="Successful releases" value={metrics.success} />
        <MetricCard label="Active or pending" value={metrics.active} />
      </section>

      <section className="panel deployments-panel">
        <div className="panel-header">
          <div>
            <p className="eyebrow">Deployment history</p>
            <h2>Recent releases</h2>
          </div>
          <Link to="/new-deployment" className="button button-secondary">
            Add deployment
          </Link>
        </div>

        {loading ? (
          <LoadingState message="Loading deployment history..." />
        ) : deployments.length > 0 ? (
          <DeploymentTable deployments={deployments} />
        ) : (
          <EmptyState />
        )}
      </section>
    </PageShell>
  )
}

function HealthCard({ health, loading }) {
  const status = loading ? 'checking' : getHealthStatus(health)
  const badgeStatus = getHealthBadgeStatus(status, loading)

  return (
    <article className="panel status-card">
      <div className="panel-header compact">
        <p className="eyebrow">API health</p>
        <StatusBadge status={badgeStatus} label={status} />
      </div>
      <h2>{loading ? 'Checking backend...' : 'Backend connection'}</h2>
      <p>
        {loading
          ? 'Waiting for /api/health.'
          : `Connected to ${API_BASE_URL}/health.`}
      </p>
    </article>
  )
}

function getHealthBadgeStatus(status, loading) {
  if (loading) {
    return 'running'
  }

  const normalizedStatus = status.toLowerCase()

  if (
    normalizedStatus.includes('unhealthy') ||
    normalizedStatus.includes('not') ||
    normalizedStatus.includes('down') ||
    normalizedStatus.includes('fail') ||
    normalizedStatus.includes('error')
  ) {
    return 'failed'
  }

  if (
    normalizedStatus.includes('healthy') ||
    normalizedStatus.includes('ready') ||
    normalizedStatus.includes('ok') ||
    normalizedStatus.includes('up') ||
    normalizedStatus.includes('online')
  ) {
    return 'success'
  }

  return 'unknown'
}

function MetricCard({ label, value }) {
  return (
    <article className="panel metric-card">
      <p className="metric-label">{label}</p>
      <strong>{value}</strong>
    </article>
  )
}

function getDeploymentMetrics(deployments) {
  return deployments.reduce(
    (summary, deployment) => {
      const status = String(deployment.status || '').toLowerCase()

      return {
        total: summary.total + 1,
        success: summary.success + (status === 'success' ? 1 : 0),
        active:
          summary.active +
          (status === 'pending' || status === 'running' ? 1 : 0),
      }
    },
    { total: 0, success: 0, active: 0 },
  )
}

function DeploymentTable({ deployments }) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Version</th>
            <th>Environment</th>
            <th>Status</th>
            <th>Owner</th>
            <th>Created</th>
            <th>
              <span className="visually-hidden">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {deployments.map((deployment) => (
            <tr key={deployment.version}>
              <td>
                <Link
                  to={`/deployments/${encodeURIComponent(deployment.version)}`}
                  className="version-link"
                >
                  {deployment.version}
                </Link>
              </td>
              <td>{deployment.environment || 'Unknown'}</td>
              <td>
                <StatusBadge status={deployment.status} />
              </td>
              <td>{deployment.owner || 'Unassigned'}</td>
              <td>{formatDateTime(getCreatedAt(deployment))}</td>
              <td className="table-action">
                <Link
                  to={`/deployments/${encodeURIComponent(deployment.version)}`}
                  className="button button-ghost"
                >
                  View
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function DeploymentDetailPage() {
  const { version } = useParams()
  const [deployment, setDeployment] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const controller = new AbortController()

    async function loadDeployment() {
      try {
        setLoading(true)
        setError('')

        const data = await fetchJson(`/deployments/${encodeURIComponent(version)}`, {
          signal: controller.signal,
        })

        setDeployment(data)
      } catch (err) {
        if (err.name !== 'AbortError') {
          setError(err.message || 'Unable to load deployment details.')
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false)
        }
      }
    }

    loadDeployment()

    return () => controller.abort()
  }, [version])

  return (
    <PageShell>
      <section className="detail-heading">
        <Link to="/" className="button button-secondary">
          Back to dashboard
        </Link>
        <div>
          <p className="eyebrow">Deployment detail</p>
          <h1>{version}</h1>
        </div>
      </section>

      {error ? <Alert message={error} /> : null}

      <section className="panel detail-panel">
        {loading ? (
          <LoadingState message="Loading deployment details..." />
        ) : deployment ? (
          <DeploymentDetails deployment={deployment} />
        ) : (
          <p className="muted">No deployment was returned for this version.</p>
        )}
      </section>
    </PageShell>
  )
}

function DeploymentDetails({ deployment }) {
  const details = [
    ['Version', deployment.version],
    ['Environment', deployment.environment],
    ['Status', <StatusBadge key="status" status={deployment.status} />],
    ['Owner', deployment.owner],
    ['Created time', formatDateTime(getCreatedAt(deployment))],
  ]

  return (
    <dl className="detail-list">
      {details.map(([label, value]) => (
        <div key={label} className="detail-item">
          <dt>{label}</dt>
          <dd>{value || 'Not recorded'}</dd>
        </div>
      ))}
    </dl>
  )
}

function NewDeploymentPage() {
  const navigate = useNavigate()
  const [formData, setFormData] = useState({
    version: '',
    environment: 'staging',
    status: 'pending',
    owner: '',
  })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  function handleChange(event) {
    const { name, value } = event.target

    setFormData((current) => ({
      ...current,
      [name]: value,
    }))
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setSubmitting(true)
    setError('')

    try {
      const createdDeployment = await fetchJson('/deployments', {
        method: 'POST',
        body: JSON.stringify({
          version: formData.version.trim(),
          environment: formData.environment,
          status: formData.status,
          owner: formData.owner.trim(),
        }),
      })

      const createdVersion = createdDeployment?.version || formData.version.trim()
      navigate(`/deployments/${encodeURIComponent(createdVersion)}`)
    } catch (err) {
      setError(err.message || 'Unable to create deployment.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <PageShell>
      <section className="detail-heading">
        <Link to="/" className="button button-secondary">
          Back to dashboard
        </Link>
        <div>
          <p className="eyebrow">New release record</p>
          <h1>Create deployment</h1>
        </div>
      </section>

      <section className="panel form-panel">
        <div className="panel-header">
          <div>
            <p className="eyebrow">Deployment metadata</p>
            <h2>Register a release</h2>
          </div>
        </div>

        {error ? <Alert message={error} /> : null}

        <form onSubmit={handleSubmit} className="deployment-form">
          <label>
            <span>Version</span>
            <input
              name="version"
              type="text"
              placeholder="v1.4.0"
              value={formData.version}
              onChange={handleChange}
              required
            />
          </label>

          <label>
            <span>Environment</span>
            <select
              name="environment"
              value={formData.environment}
              onChange={handleChange}
            >
              {ENVIRONMENT_OPTIONS.map((environment) => (
                <option key={environment} value={environment}>
                  {capitalize(environment)}
                </option>
              ))}
            </select>
          </label>

          <label>
            <span>Status</span>
            <select name="status" value={formData.status} onChange={handleChange}>
              {STATUS_OPTIONS.map((status) => (
                <option key={status} value={status}>
                  {capitalize(status)}
                </option>
              ))}
            </select>
          </label>

          <label>
            <span>Owner</span>
            <input
              name="owner"
              type="text"
              placeholder="platform-team"
              value={formData.owner}
              onChange={handleChange}
              required
            />
          </label>

          <div className="form-actions">
            <Link to="/" className="button button-secondary">
              Cancel
            </Link>
            <button type="submit" className="button button-primary" disabled={submitting}>
              {submitting ? 'Creating...' : 'Create deployment'}
            </button>
          </div>
        </form>
      </section>
    </PageShell>
  )
}

function StatusBadge({ status, label }) {
  const normalizedStatus = String(status || 'unknown').toLowerCase()
  const badgeClass = STATUS_OPTIONS.includes(normalizedStatus)
    ? normalizedStatus
    : normalizedStatus === 'healthy' || normalizedStatus === 'ready'
      ? 'success'
      : 'unknown'

  return (
    <span className={`status-badge status-${badgeClass}`}>
      <span className="status-dot" aria-hidden="true" />
      {label || capitalize(normalizedStatus)}
    </span>
  )
}

function LoadingState({ message }) {
  return (
    <div className="loading-state" role="status">
      <span className="loader" aria-hidden="true" />
      <span>{message}</span>
    </div>
  )
}

function EmptyState() {
  return (
    <div className="empty-state">
      <h2>No deployments yet</h2>
      <p>Create the first deployment record to start tracking releases.</p>
      <Link to="/new-deployment" className="button button-primary">
        Create deployment
      </Link>
    </div>
  )
}

function Alert({ message }) {
  return (
    <div className="alert" role="alert">
      <strong>Something needs attention.</strong>
      <span>{message}</span>
    </div>
  )
}

function capitalize(value) {
  if (!value) {
    return ''
  }

  return `${value.charAt(0).toUpperCase()}${value.slice(1)}`
}

export default App
