'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

import {
  IconActivity,
  IconAppWindow,
  IconArchive,
  IconArrowLeft,
  IconArrowRight,
  IconArrowUp,
  IconArrowUpRight,
  IconCheck,
  IconChevronDown,
  IconCode,
  IconCopy,
  IconDeviceMobile,
  IconDots,
  IconDownload,
  IconExternalLink,
  IconEye,
  IconFolder,
  IconHistory,
  IconLayoutDashboard,
  IconLoader2,
  IconLogout,
  IconMenu2,
  IconMessage,
  IconPaperclip,
  IconPlayerStop,
  IconPlus,
  IconRefresh,
  IconSearch,
  IconSettings,
  IconShieldLock,
  IconTrash,
  IconWorld,
  IconX
} from '@tabler/icons-react'

import { type Files, previewHTML, type ProjectType } from '@/lib/builder/files'
import { templateFiles, templates } from '@/lib/builder/templates'

import './builder.css'

type User = { id: string; name: string; email: string }
type Project = {
  id: string
  name: string
  type: ProjectType
  status: string
  visibility?: string
  archived: boolean
  files?: Files
  current_version_id?: string
  slug?: string
  prompt: string
}
type Version = { id: string; files: Files; summary: string; created_at: string }
type Job = {
  id: string
  prompt?: string
  state: string
  phase: string
  error?: string
  attempts: number
}
type BuildEvent = {
  id: number
  phase: string
  message: string
  created_at: string
}
type Detail = {
  project: Project
  versions: Version[]
  messages: { role: string; content: string; id: string }[]
  jobs: Job[]
  publication?: { slug: string }
  assets?: { id: string; name: string }[]
}
const modes = [
  { id: 'website', label: 'Website', icon: IconWorld },
  { id: 'webapp', label: 'Web App', icon: IconAppWindow },
  { id: 'pwa', label: 'Mobile App', icon: IconDeviceMobile }
] as const
export async function api(path: string, method = 'GET', body?: unknown) {
  const r = await fetch('/api/builder/' + path, {
    method,
    credentials: 'same-origin',
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined
  })
  const data = await r
    .json()
    .catch(() => ({ error: 'The connection was interrupted. Please retry.' }))
  if (!r.ok)
    throw Object.assign(
      new Error(data.error || 'Something went wrong. Please retry.'),
      { status: r.status, reference: data.reference }
    )
  return data
}
export function NovaMark({ busy = false }: { busy?: boolean }) {
  return (
    <span
      className={'builder-mark ' + (busy ? 'is-building' : '')}
      aria-hidden="true"
    >
      <i />
      <i />
      <b>
        <em />
        <em />
      </b>
    </span>
  )
}
function Dialog({
  title,
  children,
  onClose
}: {
  title: string
  children: React.ReactNode
  onClose: () => void
}) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    ref.current?.showModal()
    const el = ref.current
    return () => el?.close()
  }, [])
  return (
    <dialog
      ref={ref}
      className="builder-dialog"
      onCancel={onClose}
      onClick={e => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <header>
        <h2>{title}</h2>
        <button
          className="icon-btn"
          onClick={onClose}
          aria-label="Close dialog"
        >
          <IconX />
        </button>
      </header>
      {children}
    </dialog>
  )
}
function Preview({
  files,
  title,
  mini = false,
  width = '100%'
}: {
  files: Files
  title: string
  mini?: boolean
  width?: string
}) {
  return (
    <div
      className={mini ? 'mini-preview' : 'project-preview'}
      style={!mini ? { maxWidth: width } : undefined}
    >
      <iframe
        title={title}
        sandbox="allow-scripts"
        referrerPolicy="no-referrer"
        srcDoc={previewHTML(files)}
        loading={mini ? 'lazy' : undefined}
        tabIndex={mini ? -1 : 0}
      />
    </div>
  )
}
function ErrorNotice({
  message,
  onDismiss
}: {
  message: string
  onDismiss?: () => void
}) {
  return (
    <div className="builder-notice" role="alert">
      <span>{message}</span>
      {onDismiss && (
        <button
          onClick={onDismiss}
          className="icon-btn"
          aria-label="Dismiss message"
        >
          <IconX />
        </button>
      )}
    </div>
  )
}
export default function Builder({ projectId }: { projectId?: string }) {
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null),
    [me, setMe] = useState<any>(null),
    [loading, setLoading] = useState(true)
  const [projects, setProjects] = useState<Project[]>([]),
    [detail, setDetail] = useState<Detail | null>(null)
  const [prompt, setPrompt] = useState(''),
    [type, setType] = useState<ProjectType>('website'),
    [search, setSearch] = useState(''),
    [filter, setFilter] = useState('all'),
    [category, setCategory] = useState('All')
  const [dialog, setDialog] = useState<string | null>(null),
    [selectedTemplate, setSelectedTemplate] = useState<string | null>(null),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false)
  const [authMode, setAuthMode] = useState('signup'),
    [name, setName] = useState(''),
    [email, setEmail] = useState(''),
    [password, setPassword] = useState('')
  const [activeTab, setActiveTab] = useState('Preview'),
    [viewport, setViewport] = useState('100%'),
    [job, setJob] = useState<Job | null>(null),
    [events, setEvents] = useState<BuildEvent[]>([])
  const [selectedFile, setSelectedFile] = useState('index.html'),
    [code, setCode] = useState(''),
    [editing, setEditing] = useState(false),
    [success, setSuccess] = useState(''),
    [motion, setMotion] = useState(false),
    [appearance, setAppearance] = useState('slate')
  const [pendingAction, setPendingAction] = useState<
      null | (() => Promise<void>)
    >(null),
    [menu, setMenu] = useState(false),
    [intro, setIntro] = useState(false)
  const [refFile, setRefFile] = useState<File | null>(null),
    [referencePreview, setReferencePreview] = useState('')
  const [confirm, setConfirm] = useState<{
    title: string
    text: string
    run: () => Promise<void>
  } | null>(null)
  const uploadRef = useRef<HTMLInputElement>(null),
    requestKey = useRef<string | null>(null),
    submitGuard = useRef(false)
  const files = detail?.versions.find(
    v => v.id === detail.project.current_version_id
  )?.files
  const working = job?.state === 'queued' || job?.state === 'building'
  useEffect(() => {
    try {
      const draft = JSON.parse(
        localStorage.getItem('nova-builder-draft') || '{}'
      )
      if (!projectId) {
        setPrompt(draft.prompt || '')
        setType(draft.type || 'website')
      } else {
        const saved = JSON.parse(
          localStorage.getItem('nova-project-draft:' + projectId) || '{}'
        )
        setPrompt(saved.prompt || '')
      }
      const prefs = JSON.parse(
        localStorage.getItem('nova-builder-preferences') || '{}'
      )
      setMotion(prefs.motion || false)
      setAppearance(prefs.appearance || 'slate')
      const seen = localStorage.getItem('nova-welcome-seen')
      if (!seen) {
        setIntro(true)
        localStorage.setItem('nova-welcome-seen', 'true')
      }
    } catch {}
  }, [projectId])
  useEffect(() => {
    localStorage.setItem(
      projectId ? 'nova-project-draft:' + projectId : 'nova-builder-draft',
      JSON.stringify({ prompt, type })
    )
  }, [prompt, type, projectId])
  useEffect(() => {
    if (!refFile) {
      setReferencePreview('')
      return
    }
    const url = URL.createObjectURL(refFile)
    setReferencePreview(url)
    return () => URL.revokeObjectURL(url)
  }, [refFile])
  const refresh = useCallback(async () => {
    try {
      const m = await api('me')
      setUser(m.user)
      setMe(m)
      setName(m.user.name)
      setMotion(m.preferences?.reduced_motion || false)
      setAppearance(m.preferences?.appearance || 'slate')
      if (projectId) {
        const d = await api('projects/' + projectId)
        setDetail(d)
        setType(d.project.type)
        const active =
          d.jobs.find((j: Job) => ['queued', 'building'].includes(j.state)) ||
          d.jobs[0]
        setJob(active || null)
        if (active?.state === 'failed')
          setPrompt(previous => previous || active.prompt || '')
        if (active) {
          const state = await api('jobs/' + active.id)
          setEvents(state.events)
        }
      } else {
        setProjects((await api('projects')).projects)
      }
    } catch (e: any) {
      if (e.status === 401) {
        setUser(null)
        if (projectId) setError('Sign in to reopen this private project.')
      } else setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [projectId])
  useEffect(() => {
    void refresh()
  }, [refresh])
  const currentJobId = job?.id
  useEffect(() => {
    if (!currentJobId || !working) return
    const timer = setInterval(async () => {
      try {
        const state = await api('jobs/' + currentJobId)
        setJob(state.job)
        setEvents(state.events)
        if (!['queued', 'building'].includes(state.job.state)) {
          void refresh()
          setBusy(false)
          submitGuard.current = false
          if (state.job.state === 'failed') {
            setPrompt(previous => previous || state.job.prompt || '')
          }
          if (state.job.state === 'ready') {
            setSuccess('A new version is ready.')
            setActiveTab('Preview')
          }
        }
      } catch (e: any) {
        setError(e.message)
      }
    }, 2500)
    return () => clearInterval(timer)
  }, [currentJobId, working, refresh])
  useEffect(() => {
    function offline() {
      setError(
        'You are offline. Your prompt is kept on this device; reconnect before building.'
      )
    }
    window.addEventListener('offline', offline)
    return () => window.removeEventListener('offline', offline)
  }, [])
  function requireUser(action: () => Promise<void>) {
    if (!user) {
      setPendingAction(() => action)
      setDialog('auth')
      return
    }
    void action()
  }
  async function guarded(action: () => Promise<void>) {
    if (submitGuard.current) return
    submitGuard.current = true
    setBusy(true)
    setError('')
    try {
      await action()
    } catch (e: any) {
      setError(
        e.message +
          (e.reference ? ' Reference: ' + e.reference.slice(0, 8) : '')
      )
      if (e.status === 401) setDialog('auth')
    } finally {
      setBusy(false)
      submitGuard.current = false
    }
  }
  async function createFromTemplate(id: string) {
    await guarded(async () => {
      const data = await api('projects', 'POST', {
        name: templates.find(t => t.id === id)?.name,
        type,
        templateId: id,
        prompt
      })
      setDialog(null)
      router.push('/project/' + data.project.id)
    })
  }
  async function startBuild() {
    if (prompt.trim().length < 3) {
      setError('Tell NOVA a little about what you want to build.')
      return
    }
    if (!navigator.onLine) {
      setError(
        'Reconnect to start building. Your prompt is saved on this device.'
      )
      return
    }
    requireUser(() =>
      guarded(async () => {
        let id = projectId
        if (!id) {
          const result = await api('projects', 'POST', {
            name: prompt.slice(0, 60),
            type,
            prompt
          })
          id = result.project.id
        }
        if (refFile) {
          if (refFile.size > 2 * 1024 * 1024)
            throw Error('Choose an image smaller than 2 MB.')
          const b64 = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader()
            reader.onload = () => resolve(String(reader.result).split(',')[1])
            reader.onerror = reject
            reader.readAsDataURL(refFile)
          })
          await api('projects/' + id + '/assets', 'POST', {
            name: refFile.name,
            mediaType: refFile.type,
            data: b64
          })
        }
        requestKey.current ||= crypto.randomUUID()
        const data = await api('projects/' + id + '/build', 'POST', {
          prompt,
          requestKey: requestKey.current
        })
        requestKey.current = null
        setJob(data.job)
        setActiveTab('Activity')
        if (!projectId) router.push('/project/' + id)
        else {
          setPrompt('')
          void refresh()
        }
      })
    )
  }
  async function auth(e: React.FormEvent) {
    e.preventDefault()
    await guarded(async () => {
      const response = await fetch(
        '/api/builder/auth/' +
          (authMode === 'signup' ? 'sign-up/email' : 'sign-in/email'),
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, email, password })
        }
      )
      const result = await response.json()
      if (!response.ok)
        throw Error(
          result.message || 'Could not sign in. Check your information.'
        )
      setPassword('')
      setDialog(null)
      await refresh()
      setSuccess('Your personal workspace is ready.')
      if (pendingAction) {
        const action = pendingAction
        setPendingAction(null)
        setTimeout(() => void action(), 0)
      }
    })
  }
  async function projectAction(p: Project, action: string) {
    await guarded(async () => {
      if (action === 'rename') {
        const value = window.prompt('Project name', p.name)
        if (value === null) return
        await api('projects/' + p.id, 'PATCH', { name: value })
      } else if (action === 'duplicate') {
        const r = await api('projects/' + p.id + '/duplicate', 'POST', {})
        router.push('/project/' + r.project.id)
      } else if (action === 'archive') {
        await api('projects/' + p.id, 'PATCH', { archived: !p.archived })
      } else if (action === 'delete') {
        await api('projects/' + p.id, 'DELETE')
        if (projectId) router.push('/')
      }
      await refresh()
    })
  }
  const shownProjects = projects.filter(
    p =>
      (filter === 'archived' ? p.archived : !p.archived) &&
      (filter !== 'published' || Boolean(p.slug)) &&
      (filter !== 'draft' || p.status === 'draft') &&
      p.name.toLowerCase().includes(search.toLowerCase())
  )
  function cardMenu(p: Project) {
    setDialog('project:' + p.id)
  }
  return (
    <div
      className={
        'builder-app ' +
        (motion ? 'reduce-motion ' : '') +
        (appearance === 'soft' ? 'soft-tone ' : '') +
        (intro ? 'welcome-once' : '')
      }
    >
      <header className="builder-header">
        <Link className="builder-brand" href="/" aria-label="NOVA dashboard">
          <NovaMark />
          <span>NOVA</span>
        </Link>
        <nav
          className={'main-nav ' + (menu ? 'nav-open' : '')}
          aria-label="Main navigation"
        >
          <Link href="/" className={!projectId ? 'selected' : ''}>
            <IconLayoutDashboard />
            Home
          </Link>
          <Link href="/#projects">
            <IconFolder />
            Projects
          </Link>
          <Link href="/#templates">Templates</Link>
        </nav>
        <div className="header-actions">
          <button
            className="workspace-selector"
            onClick={() => setDialog('workspace')}
          >
            Personal workspace <IconChevronDown />
          </button>
          <button
            className="new-project"
            onClick={() => {
              router.push('/')
              setPrompt('')
              document.getElementById('builder-prompt')?.focus()
            }}
          >
            <IconPlus />
            <span>New project</span>
          </button>
          <button
            className="icon-btn"
            aria-label="Settings"
            onClick={() => setDialog('settings')}
          >
            <IconSettings />
          </button>
          <button
            className="avatar"
            aria-label={user ? 'Profile menu' : 'Sign in'}
            onClick={() => setDialog(user ? 'profile' : 'auth')}
          >
            {user ? user.name.slice(0, 1).toUpperCase() : <IconShieldLock />}
          </button>
          <button
            className="icon-btn mobile-menu"
            aria-label="Toggle navigation"
            aria-expanded={menu}
            onClick={() => setMenu(!menu)}
          >
            <IconMenu2 />
          </button>
        </div>
      </header>
      {error && (
        <div className="notice-container">
          <ErrorNotice message={error} onDismiss={() => setError('')} />
        </div>
      )}
      {success && (
        <div className="success-notice" role="status">
          <IconCheck />
          {success}
          <button
            aria-label="Dismiss success"
            className="icon-btn"
            onClick={() => setSuccess('')}
          >
            <IconX />
          </button>
        </div>
      )}
      {!projectId ? (
        <main className="builder-dashboard">
          <section className="builder-hero">
            <div className="welcome-symbol">
              <NovaMark />
            </div>
            <div className="hero-eyebrow">
              A LITTLE IDEA. A WORLD OF POSSIBILITIES.
            </div>
            <h1>
              What will you <span>build today?</span>
            </h1>
            <p>
              Turn a thought into something you can open, explore, and make your
              own.
            </p>
            <div className="prompt-box">
              <div
                className="build-type-tabs"
                role="tablist"
                aria-label="Project type"
              >
                {modes.map(m => (
                  <button
                    key={m.id}
                    role="tab"
                    aria-selected={type === m.id}
                    onClick={() => setType(m.id)}
                    className={type === m.id ? 'active' : ''}
                  >
                    <m.icon />
                    {m.label}
                  </button>
                ))}
              </div>
              <label className="sr-only" htmlFor="builder-prompt">
                Describe your project
              </label>
              <textarea
                id="builder-prompt"
                value={prompt}
                onChange={e => setPrompt(e.target.value)}
                maxLength={6000}
                placeholder={
                  type === 'website'
                    ? 'A beautiful portfolio for my photography, with a gallery and a little about me…'
                    : type === 'webapp'
                      ? 'A simple app to plan my week, with tasks and a calm dashboard…'
                      : 'A mobile-friendly habit tracker I can take anywhere…'
                }
              />
              {refFile && (
                <div className="reference-chip">
                  {referencePreview && (
                    <img src={referencePreview} alt="Your reference" />
                  )}
                  <span>{refFile.name}</span>
                  <button
                    className="icon-btn"
                    aria-label="Remove reference"
                    onClick={() => setRefFile(null)}
                  >
                    <IconX />
                  </button>
                </div>
              )}
              <div className="prompt-toolbar">
                <button
                  className="attachment-action"
                  onClick={() => setDialog('attachment')}
                >
                  <IconPaperclip />
                  <span>Add a reference</span>
                </button>
                <span className="prompt-mode-note">
                  {type === 'pwa'
                    ? 'PWA source · not a native app'
                    : 'No code. No GitHub required.'}
                </span>
                <button
                  className="build-button"
                  disabled={busy}
                  onClick={() => void startBuild()}
                >
                  {busy ? <IconLoader2 className="spin" /> : <IconArrowUp />}
                  <span>Build it</span>
                </button>
              </div>
            </div>
            <div className="suggestion-row">
              <span>A place to start</span>
              {[
                'A personal portfolio',
                'A store for handmade objects',
                'A weekly planner'
              ].map(s => (
                <button key={s} onClick={() => setPrompt(s)}>
                  {s}
                  <IconArrowUpRight />
                </button>
              ))}
            </div>
          </section>
          <section id="projects" className="dashboard-section">
            <div className="section-top">
              <div>
                <span className="section-eyebrow">
                  YOUR CORNER OF THE INTERNET
                </span>
                <h2>Recent projects</h2>
              </div>
              <div className="project-search">
                <IconSearch />
                <input
                  aria-label="Search projects"
                  placeholder="Find a project"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                />
              </div>
            </div>
            <div className="filter-row" aria-label="Project filters">
              {['all', 'draft', 'published', 'archived'].map(f => (
                <button
                  key={f}
                  className={filter === f ? 'active' : ''}
                  onClick={() => setFilter(f)}
                >
                  {f[0].toUpperCase() + f.slice(1)}
                </button>
              ))}
              <span>
                {user
                  ? 'Private unless you publish'
                  : 'Your projects will appear after you sign in'}
              </span>
            </div>
            {loading ? (
              <div className="project-grid">
                {[1, 2, 3].map(i => (
                  <div
                    key={i}
                    className="project-skeleton"
                    aria-label="Loading projects"
                  />
                ))}
              </div>
            ) : shownProjects.length ? (
              <div className="project-grid">
                {shownProjects.map(p => (
                  <article key={p.id} className="saved-project">
                    <button
                      className="project-open"
                      onClick={() => router.push('/project/' + p.id)}
                    >
                      {p.current_version_id ? (
                        <div className="mini-preview">
                          <iframe
                            title={p.name + ' thumbnail'}
                            src={'/api/builder/projects/' + p.id + '/preview'}
                            sandbox="allow-scripts"
                            referrerPolicy="no-referrer"
                            loading="lazy"
                            tabIndex={-1}
                          />
                        </div>
                      ) : (
                        <div className="draft-thumb">
                          <NovaMark />
                          <span>Your next idea lives here.</span>
                        </div>
                      )}
                    </button>
                    <div className="project-caption">
                      <button onClick={() => router.push('/project/' + p.id)}>
                        <h3>{p.name}</h3>
                        <span className={'status-badge ' + p.status}>
                          {p.status}
                        </span>
                        <small>{modes.find(m => m.id === p.type)?.label}</small>
                      </button>
                      <button
                        className="icon-btn"
                        onClick={() => cardMenu(p)}
                        aria-label={'Actions for ' + p.name}
                      >
                        <IconDots />
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <div className="empty-projects">
                <div className="empty-drawing">
                  <IconFolder />
                  <span>+</span>
                </div>
                <div>
                  <h3>
                    {search
                      ? 'No matching projects'
                      : filter === 'all'
                        ? 'Make room for your first idea.'
                        : 'Nothing here just yet.'}
                  </h3>
                  <p>
                    {search
                      ? 'Try another name.'
                      : 'Start from a template below, or tell NOVA what you have in mind.'}
                  </p>
                </div>
                <button
                  className="text-action"
                  onClick={() =>
                    document
                      .getElementById('templates')
                      ?.scrollIntoView({ behavior: motion ? 'auto' : 'smooth' })
                  }
                >
                  Explore starters <IconArrowRight />
                </button>
              </div>
            )}
          </section>
          <section
            id="templates"
            className="dashboard-section template-section"
          >
            <div className="section-top">
              <div>
                <span className="section-eyebrow">SKIP THE BLANK CANVAS</span>
                <h2>A little inspiration.</h2>
                <p>Real starter projects. Ready to make yours.</p>
              </div>
              <span className="template-label">
                NOVA templates · Example content
              </span>
            </div>
            <div className="category-row">
              {[
                'All',
                'Portfolio',
                'Business',
                'Store',
                'Dashboard',
                'Personal'
              ].map(c => (
                <button
                  key={c}
                  className={category === c ? 'active' : ''}
                  onClick={() => setCategory(c)}
                >
                  {c}
                </button>
              ))}
            </div>
            <div className="template-grid">
              {templates
                .filter(t => category === 'All' || t.category === category)
                .map((t, i) => (
                  <article className="template-card" key={t.id}>
                    <button
                      className="template-visual"
                      onClick={() => {
                        setSelectedTemplate(t.id)
                        setDialog('template')
                      }}
                      aria-label={'Preview ' + t.name}
                    >
                      <Preview
                        files={templateFiles(t.id)}
                        title={t.name + ' starter preview'}
                        mini
                      />
                      <span className="template-view">
                        <IconEye /> Preview
                      </span>
                    </button>
                    <div className="template-copy">
                      <small>
                        {t.category} / Starter {String(i + 1).padStart(2, '0')}
                      </small>
                      <h3>{t.name}</h3>
                      <p>{t.description}</p>
                      <button
                        onClick={() =>
                          requireUser(() => createFromTemplate(t.id))
                        }
                      >
                        Use template <IconArrowUpRight />
                      </button>
                    </div>
                  </article>
                ))}
            </div>
          </section>
          <footer className="builder-footer">
            <div>
              <NovaMark />
              <span>Small beginnings. Real possibilities.</span>
            </div>
            <span>Built with NOVA · Your ideas belong to you.</span>
          </footer>
        </main>
      ) : (
        <main className="builder-workspace">
          <div className="workspace-top">
            <button
              className="icon-btn"
              onClick={() => router.push('/')}
              aria-label="Back to dashboard"
            >
              <IconArrowLeft />
            </button>
            <div>
              <h1>{detail?.project.name || 'Your project'}</h1>
              <span>
                {detail?.project.visibility === 'public'
                  ? 'Published version is public'
                  : 'Private project'}{' '}
                ·{' '}
                {detail?.project.type === 'pwa'
                  ? 'PWA source'
                  : detail?.project.type === 'webapp'
                    ? 'Browser app'
                    : 'Website'}
              </span>
            </div>
            <div className="workspace-top-actions">
              <Link
                className={'secondary-button ' + (!files ? 'disabled' : '')}
                href={'/api/builder/projects/' + projectId + '/download'}
                aria-disabled={!files}
                onClick={e => {
                  if (!files) e.preventDefault()
                }}
              >
                <IconDownload />
                <span>Download</span>
              </Link>
              <button
                className="primary-button"
                disabled={!files || working}
                onClick={() =>
                  setConfirm({
                    title: 'Publish this version?',
                    text: 'Anyone with the published link will be able to view this version. Your conversation and unpublished versions stay private.',
                    run: () =>
                      guarded(async () => {
                        const r = await api(
                          'projects/' + projectId + '/publish',
                          'POST',
                          { confirmPublic: true }
                        )
                        await refresh()
                        setSuccess('Published: ' + r.url)
                        setConfirm(null)
                      })
                  })
                }
              >
                Publish <IconArrowUpRight />
              </button>
              <button
                className="icon-btn"
                aria-label="Project settings"
                onClick={() => setDialog('project-settings')}
              >
                <IconSettings />
              </button>
            </div>
          </div>
          <div
            className="workspace-mobile-tabs"
            role="tablist"
            aria-label="Workspace panel"
          >
            {[
              { name: 'Chat', icon: IconMessage },
              { name: 'Preview', icon: IconEye },
              { name: 'Activity', icon: IconActivity },
              { name: 'Files', icon: IconCode }
            ].map(t => (
              <button
                role="tab"
                aria-selected={activeTab === t.name}
                className={activeTab === t.name ? 'active' : ''}
                key={t.name}
                onClick={() => setActiveTab(t.name)}
              >
                <t.icon />
                {t.name}
              </button>
            ))}
          </div>
          <div className="workspace-layout">
            <aside
              className={
                'conversation-panel ' +
                (activeTab === 'Chat' ? 'mobile-active' : '')
              }
            >
              <div className="panel-heading">
                <span>
                  <IconMessage />
                  Your conversation
                </span>
                <span className="private-chip">
                  <IconShieldLock />
                  Private
                </span>
              </div>
              <div className="conversation-messages">
                {detail?.messages.length ? (
                  detail.messages.map(m => (
                    <div
                      key={m.id}
                      className={'conversation-message ' + m.role}
                    >
                      {m.role === 'assistant' && <NovaMark />}
                      <p>{m.content}</p>
                    </div>
                  ))
                ) : (
                  <div className="workspace-intro">
                    <NovaMark />
                    <h2>One idea, one step at a time.</h2>
                    <p>
                      {files
                        ? 'Your template is saved. Explore the preview, then describe a change.'
                        : 'Describe the project you want to make. Your build activity will appear as work actually happens.'}
                    </p>
                  </div>
                )}
                {job?.state === 'failed' && (
                  <ErrorNotice
                    message={
                      job.error ||
                      'The build could not finish. Your last working version is safe.'
                    }
                  />
                )}
              </div>
              <form
                className="workspace-composer"
                onSubmit={e => {
                  e.preventDefault()
                  void startBuild()
                }}
              >
                <label className="sr-only" htmlFor="edit-prompt">
                  Describe a change
                </label>
                <textarea
                  id="edit-prompt"
                  value={prompt}
                  onChange={e => setPrompt(e.target.value)}
                  maxLength={6000}
                  placeholder="What would you like to change?"
                />
                <div>
                  <span>
                    {working
                      ? 'A build is in progress'
                      : 'Your last working version stays safe'}
                  </span>
                  <button
                    className="build-button"
                    type="submit"
                    aria-label="Build requested change"
                    disabled={busy || working || !prompt.trim()}
                  >
                    <IconArrowUp />
                  </button>
                </div>
              </form>
            </aside>
            <section className="workspace-main">
              <div className="desktop-workspace-tabs">
                {['Preview', 'Activity', 'Files', 'Versions'].map(t => (
                  <button
                    className={activeTab === t ? 'active' : ''}
                    key={t}
                    onClick={() => setActiveTab(t)}
                  >
                    {t}
                  </button>
                ))}
              </div>
              <div
                className={
                  'workspace-preview-panel ' +
                  (activeTab === 'Preview' ? 'mobile-active' : '')
                }
                hidden={!['Preview', 'Chat'].includes(activeTab)}
              >
                <div className="preview-toolbar">
                  <div role="group" aria-label="Preview width">
                    {[
                      { w: '100%', label: 'Desktop', icon: IconAppWindow },
                      {
                        w: '768px',
                        label: 'Tablet',
                        icon: IconLayoutDashboard
                      },
                      { w: '390px', label: 'Mobile', icon: IconDeviceMobile }
                    ].map(v => (
                      <button
                        className={viewport === v.w ? 'active' : ''}
                        aria-label={v.label + ' preview'}
                        key={v.w}
                        onClick={() => setViewport(v.w)}
                      >
                        <v.icon />
                      </button>
                    ))}
                  </div>
                  <span>Isolated preview</span>
                  <div>
                    <button
                      className="icon-btn"
                      aria-label="Reload preview"
                      onClick={() => {
                        const iframe = document.querySelector(
                          '.workspace-preview-panel iframe'
                        ) as HTMLIFrameElement
                        if (iframe && files) iframe.srcdoc = previewHTML(files)
                      }}
                    >
                      <IconRefresh />
                    </button>
                    <button
                      className="icon-btn"
                      aria-label="Open preview in a new tab"
                      disabled={!files}
                      onClick={() => {
                        const blob = new Blob([previewHTML(files!)], {
                          type: 'text/html'
                        })
                        const url = URL.createObjectURL(blob)
                        window.open(url, '_blank', 'noopener,noreferrer')
                        setTimeout(() => URL.revokeObjectURL(url), 60000)
                      }}
                    >
                      <IconExternalLink />
                    </button>
                  </div>
                </div>
                {files ? (
                  <div className="preview-stage">
                    <Preview
                      files={files}
                      title={detail?.project.name + ' live preview'}
                      width={viewport}
                    />
                  </div>
                ) : (
                  <div className="preview-empty">
                    <NovaMark busy={working} />
                    <h2>
                      {working
                        ? 'Your idea is taking shape.'
                        : 'Your preview belongs here.'}
                    </h2>
                    <p>
                      {working
                        ? 'Follow the real build events in Activity.'
                        : 'Start from a template or send a build request. Your last successful version will always appear here.'}
                    </p>
                    <button
                      className="secondary-button"
                      onClick={() =>
                        setActiveTab(working ? 'Activity' : 'Chat')
                      }
                    >
                      {working ? 'View activity' : 'Describe your idea'}
                      <IconArrowRight />
                    </button>
                  </div>
                )}
              </div>
              {activeTab === 'Activity' && (
                <div className="activity-panel">
                  <div className="activity-title">
                    <NovaMark busy={working} />
                    <div>
                      <h2>
                        {working
                          ? 'Building, thoughtfully.'
                          : job?.state === 'ready'
                            ? 'A new version is ready.'
                            : job?.state === 'failed'
                              ? 'Let’s take another approach.'
                              : 'Every step, in the open.'}
                      </h2>
                      <p>Events are recorded by the server as work happens.</p>
                    </div>
                  </div>
                  {working && (
                    <button
                      className="secondary-button"
                      onClick={() =>
                        void guarded(async () => {
                          await api('jobs/' + job!.id + '/cancel', 'POST', {})
                          await refresh()
                        })
                      }
                    >
                      <IconPlayerStop />
                      Cancel build
                    </button>
                  )}
                  <ol className="build-events" aria-live="polite">
                    {events.map(e => (
                      <li
                        key={e.id}
                        className={e.phase === 'failed' ? 'event-failed' : ''}
                      >
                        <span className="event-dot">
                          {e.phase === 'failed' ? <IconX /> : <IconCheck />}
                        </span>
                        <div>
                          <strong>
                            {e.phase === 'dependencies'
                              ? 'Dependencies'
                              : e.phase[0].toUpperCase() + e.phase.slice(1)}
                          </strong>
                          <p>{e.message}</p>
                          <time>
                            {new Date(e.created_at).toLocaleTimeString()}
                          </time>
                        </div>
                      </li>
                    ))}
                  </ol>
                  {!events.length && (
                    <div className="quiet-empty">
                      <IconActivity />
                      <h3>No build has started yet.</h3>
                      <p>
                        A template creates files immediately. AI builds show
                        their progress here.
                      </p>
                    </div>
                  )}
                  {job?.state === 'failed' && (
                    <button
                      className="secondary-button"
                      onClick={() => {
                        setPrompt(job.prompt || '')
                        setActiveTab('Chat')
                      }}
                    >
                      Return to saved request
                      <IconArrowLeft />
                    </button>
                  )}
                  {job && (
                    <small className="reference-id">
                      Build reference: {job.id}
                    </small>
                  )}
                </div>
              )}
              {activeTab === 'Files' && (
                <div className="files-panel">
                  {files ? (
                    <>
                      <div
                        className="file-list"
                        role="tablist"
                        aria-label="Project files"
                      >
                        {Object.keys(files).map(f => (
                          <button
                            role="tab"
                            aria-selected={selectedFile === f}
                            className={selectedFile === f ? 'active' : ''}
                            key={f}
                            onClick={() => {
                              setSelectedFile(f)
                              setEditing(false)
                            }}
                          >
                            <IconCode />
                            {f}
                          </button>
                        ))}
                        {detail?.assets?.map(a => (
                          <Link
                            key={a.id}
                            href={
                              '/api/builder/projects/' +
                              projectId +
                              '/assets/' +
                              a.id
                            }
                            target="_blank"
                            rel="noopener noreferrer"
                            className="asset-link"
                          >
                            <IconPaperclip />
                            {a.name}
                          </Link>
                        ))}
                      </div>
                      <div className="code-panel">
                        <div>
                          <span>{selectedFile}</span>
                          <button
                            className="secondary-button"
                            disabled={
                              busy ||
                              !!(
                                job &&
                                ['queued', 'building'].includes(job.state)
                              )
                            }
                            onClick={() =>
                              void guarded(async () => {
                                const result = await api(
                                  'projects/' + projectId + '/check',
                                  'POST',
                                  { requestKey: crypto.randomUUID() }
                                )
                                setJob(result.job)
                                setActiveTab('Activity')
                                await refresh()
                              })
                            }
                          >
                            Check project
                          </button>
                          <button
                            className="secondary-button"
                            onClick={() => {
                              setCode(files[selectedFile] || '')
                              setEditing(!editing)
                            }}
                          >
                            {editing ? 'Cancel edit' : 'Edit file'}
                          </button>
                          {editing && (
                            <button
                              className="primary-button"
                              onClick={() =>
                                void guarded(async () => {
                                  await api(
                                    'projects/' + projectId + '/files',
                                    'POST',
                                    {
                                      files: { ...files, [selectedFile]: code },
                                      baseVersionId:
                                        detail?.project.current_version_id
                                    }
                                  )
                                  setEditing(false)
                                  await refresh()
                                  setSuccess('Saved as a new version.')
                                })
                              }
                            >
                              Save version
                            </button>
                          )}
                        </div>
                        {editing ? (
                          <textarea
                            aria-label={'Edit ' + selectedFile}
                            spellCheck={false}
                            value={code}
                            onChange={e => setCode(e.target.value)}
                          />
                        ) : (
                          <pre>
                            <code>
                              {files[selectedFile] || 'Select a file.'}
                            </code>
                          </pre>
                        )}
                      </div>
                    </>
                  ) : (
                    <div className="quiet-empty">
                      <IconCode />
                      <h3>No files yet.</h3>
                      <p>Build a project or begin with a template.</p>
                    </div>
                  )}
                </div>
              )}
              {activeTab === 'Versions' && (
                <div className="version-panel">
                  <h2>Your project, over time.</h2>
                  <p>
                    Successful versions are saved separately. Restoring never
                    removes the others.
                  </p>
                  {detail?.versions.map(v => (
                    <article key={v.id}>
                      <IconHistory />
                      <div>
                        <h3>{v.summary}</h3>
                        <p>{new Date(v.created_at).toLocaleString()}</p>
                      </div>
                      <button
                        className="secondary-button"
                        disabled={
                          working || v.id === detail.project.current_version_id
                        }
                        onClick={() =>
                          setConfirm({
                            title: 'Restore this version?',
                            text: 'Your other versions will remain available.',
                            run: () =>
                              guarded(async () => {
                                await api(
                                  'projects/' + projectId + '/restore',
                                  'POST',
                                  { versionId: v.id }
                                )
                                setConfirm(null)
                                await refresh()
                                setActiveTab('Preview')
                              })
                          })
                        }
                      >
                        {v.id === detail.project.current_version_id
                          ? 'Current'
                          : 'Restore'}
                      </button>
                    </article>
                  ))}
                  {!detail?.versions.length && (
                    <p>Your first saved version will appear here.</p>
                  )}
                </div>
              )}
            </section>
          </div>
        </main>
      )}
      {dialog === 'auth' && (
        <Dialog
          title={
            authMode === 'signup' ? 'A home for your ideas.' : 'Welcome back.'
          }
          onClose={() => setDialog(null)}
        >
          <p className="dialog-description">
            {authMode === 'signup'
              ? 'Create your personal NOVA workspace. No GitHub account needed.'
              : 'Sign in to pick up where you left off.'}{' '}
            Your prompt stays right here.
          </p>
          <form className="auth-form" onSubmit={auth}>
            {authMode === 'signup' && (
              <label>
                Your name
                <input
                  required
                  autoComplete="name"
                  value={name}
                  maxLength={80}
                  onChange={e => setName(e.target.value)}
                />
              </label>
            )}
            <label>
              Email
              <input
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={e => setEmail(e.target.value)}
              />
            </label>
            <label>
              Password
              <input
                type="password"
                minLength={10}
                maxLength={128}
                required
                autoComplete={
                  authMode === 'signup' ? 'new-password' : 'current-password'
                }
                value={password}
                onChange={e => setPassword(e.target.value)}
              />
              <small>At least 10 characters.</small>
            </label>
            {error && <ErrorNotice message={error} />}
            <button className="primary-button" disabled={busy}>
              {busy ? (
                <IconLoader2 className="spin" />
              ) : authMode === 'signup' ? (
                'Create workspace'
              ) : (
                'Sign in'
              )}
              <IconArrowRight />
            </button>
          </form>
          <button
            className="dialog-text-button"
            onClick={() => {
              setAuthMode(authMode === 'signup' ? 'signin' : 'signup')
              setError('')
            }}
          >
            {authMode === 'signup'
              ? 'Already have an account? Sign in'
              : 'New to NOVA? Create an account'}
          </button>
          <p className="dialog-footnote">
            Email recovery is not configured yet. Keep your password somewhere
            safe.
          </p>
        </Dialog>
      )}
      {dialog === 'settings' && (
        <Dialog title="Make yourself at home." onClose={() => setDialog(null)}>
          <div className="settings-group">
            <h3>Appearance</h3>
            <div className="appearance-options">
              <button
                className={appearance === 'slate' ? 'active' : ''}
                onClick={() => setAppearance('slate')}
              >
                <span className="color-dot slate" />
                Deep slate{appearance === 'slate' && <IconCheck />}
              </button>
              <button
                className={appearance === 'soft' ? 'active' : ''}
                onClick={() => setAppearance('soft')}
              >
                <span className="color-dot soft" />
                Soft blue-grey{appearance === 'soft' && <IconCheck />}
              </button>
            </div>
            <label className="setting-row">
              <span>
                <b>Reduce motion</b>
                <small>Keep transitions calm and still.</small>
              </span>
              <input
                type="checkbox"
                checked={motion}
                onChange={e => setMotion(e.target.checked)}
              />
            </label>
            <div className="setting-row">
              <span>
                <b>Private by default</b>
                <small>Only you can open a project until you publish it.</small>
              </span>
              <IconShieldLock />
            </div>
          </div>
          <div className="settings-group">
            <h3>Connections</h3>
            <p>
              GitHub is optional. Download a project’s source ZIP to use it
              anywhere. Repository import is not enabled yet.
            </p>
          </div>
          {user && (
            <div className="settings-group">
              <h3>Today’s usage</h3>
              <p>
                {me?.usage?.builds || 0} of 5 build attempts used. Resets at
                midnight UTC. Templates do not use AI builds.
              </p>
            </div>
          )}
          <button
            className="primary-button"
            onClick={() =>
              void guarded(async () => {
                if (user)
                  await api('me', 'PATCH', {
                    name,
                    reduced_motion: motion,
                    appearance
                  })
                localStorage.setItem(
                  'nova-builder-preferences',
                  JSON.stringify({ motion, appearance })
                )
                setSuccess('Preferences saved.')
                setDialog(null)
              })
            }
          >
            Save preferences
            <IconCheck />
          </button>
        </Dialog>
      )}
      {dialog === 'profile' && (
        <Dialog title="Your profile" onClose={() => setDialog(null)}>
          <div className="profile-heading">
            <span className="avatar large">{user?.name.slice(0, 1)}</span>
            <div>
              <h3>{user?.name}</h3>
              <p>{user?.email}</p>
            </div>
          </div>
          <label className="form-label">
            Display name
            <input
              value={name}
              maxLength={80}
              onChange={e => setName(e.target.value)}
            />
          </label>
          <button
            className="primary-button"
            onClick={() =>
              void guarded(async () => {
                await api('me', 'PATCH', {
                  name,
                  reduced_motion: motion,
                  appearance
                })
                await refresh()
                setSuccess('Profile updated.')
              })
            }
          >
            Save profile
          </button>
          <div className="profile-links">
            <button onClick={() => setDialog('workspace')}>
              <IconFolder />
              Personal workspace
              <IconArrowUpRight />
            </button>
            <button
              onClick={() =>
                void guarded(async () => {
                  await fetch('/api/builder/auth/sign-out', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: '{}'
                  })
                  setUser(null)
                  setProjects([])
                  setDialog(null)
                  router.push('/')
                  router.refresh()
                })
              }
            >
              <IconLogout />
              Sign out
            </button>
            <button
              className="danger-text"
              onClick={() => {
                setPassword('')
                setDialog('delete-account')
              }}
            >
              <IconTrash />
              Delete account
            </button>
          </div>
        </Dialog>
      )}
      {dialog === 'delete-account' && (
        <Dialog
          title="Delete your account?"
          onClose={() => setDialog('profile')}
        >
          <p className="dialog-description">
            This permanently deletes your projects, files, versions,
            conversations and published links. Download anything you want to
            keep first.
          </p>
          <label className="form-label">
            Confirm your password
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={e => setPassword(e.target.value)}
            />
          </label>
          <button
            className="danger-button"
            disabled={busy || !password}
            onClick={() =>
              void guarded(async () => {
                const r = await fetch('/api/builder/auth/delete-user', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ password })
                })
                const data = await r.json()
                if (!r.ok)
                  throw Error(
                    data.message ||
                      'Could not delete this account. Sign in again and retry.'
                  )
                setPassword('')
                setDialog(null)
                setUser(null)
                setProjects([])
                router.push('/')
                router.refresh()
              })
            }
          >
            Permanently delete account
          </button>
        </Dialog>
      )}
      {dialog === 'workspace' && (
        <Dialog title="Your workspace" onClose={() => setDialog(null)}>
          <div className="workspace-option">
            <IconFolder />
            <div>
              <h3>Personal workspace</h3>
              <p>
                {user
                  ? 'Only you have access.'
                  : 'Sign in to save projects here.'}
              </p>
            </div>
            {user && <IconCheck />}
          </div>
          <p className="dialog-description">
            Projects, versions and conversations live together here. Team
            workspaces are not enabled.
          </p>
          {!user && (
            <button
              className="primary-button"
              onClick={() => setDialog('auth')}
            >
              Create your workspace
              <IconArrowRight />
            </button>
          )}
        </Dialog>
      )}
      {dialog === 'attachment' && (
        <Dialog title="Add a visual reference" onClose={() => setDialog(null)}>
          <p className="dialog-description">
            PNG, JPEG or WebP, up to 2 MB. The reference is stored privately
            with your next project. The current text model does not analyse
            images; describe the details you want NOVA to use.
          </p>
          <input
            ref={uploadRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            aria-label="Choose reference image"
            onChange={e => {
              const f = e.target.files?.[0]
              if (f) {
                if (f.size > 2 * 1024 * 1024) {
                  setError('Choose an image smaller than 2 MB.')
                  return
                }
                setRefFile(f)
                setDialog(null)
              }
            }}
          />
        </Dialog>
      )}
      {dialog === 'template' && selectedTemplate && (
        <Dialog
          title={
            templates.find(t => t.id === selectedTemplate)?.name ||
            'Template preview'
          }
          onClose={() => setDialog(null)}
        >
          <p className="dialog-description">
            An interactive starter with labelled example content. You can
            replace every detail.
          </p>
          <div className="template-dialog-preview">
            <Preview
              files={templateFiles(selectedTemplate, type)}
              title="Interactive template preview"
            />
          </div>
          <button
            className="primary-button"
            disabled={busy}
            onClick={() =>
              requireUser(() => createFromTemplate(selectedTemplate))
            }
          >
            Use this template
            <IconArrowUpRight />
          </button>
        </Dialog>
      )}
      {dialog?.startsWith('project:') &&
        (() => {
          const p = projects.find(p => p.id === dialog.split(':')[1])
          return p ? (
            <Dialog title={p.name} onClose={() => setDialog(null)}>
              <div className="profile-links">
                <button
                  onClick={() => {
                    setDialog(null)
                    void projectAction(p, 'rename')
                  }}
                >
                  <IconCode />
                  Rename
                </button>
                <button
                  onClick={() => {
                    setDialog(null)
                    void projectAction(p, 'duplicate')
                  }}
                >
                  <IconCopy />
                  Duplicate
                </button>
                <button
                  onClick={() => {
                    setDialog(null)
                    void projectAction(p, 'archive')
                  }}
                >
                  <IconArchive />
                  {p.archived ? 'Unarchive' : 'Archive'}
                </button>
                <button
                  className="danger-text"
                  onClick={() => {
                    setDialog(null)
                    setConfirm({
                      title: 'Delete this project?',
                      text: 'Its files, versions, conversation and published link will be permanently removed.',
                      run: async () => {
                        await projectAction(p, 'delete')
                        setConfirm(null)
                      }
                    })
                  }}
                >
                  <IconTrash />
                  Delete project
                </button>
              </div>
            </Dialog>
          ) : null
        })()}
      {dialog === 'project-settings' && detail && (
        <Dialog title="Project settings" onClose={() => setDialog(null)}>
          <div className="profile-links">
            <button
              onClick={() => void projectAction(detail.project, 'rename')}
            >
              <IconCode />
              Rename project
            </button>
            <button
              onClick={() => void projectAction(detail.project, 'duplicate')}
            >
              <IconCopy />
              Duplicate project
            </button>
            <button
              onClick={() => {
                setActiveTab('Versions')
                setDialog(null)
              }}
            >
              <IconHistory />
              Version history
            </button>
            <button
              onClick={() => void projectAction(detail.project, 'archive')}
            >
              <IconArchive />
              {detail.project.archived ? 'Unarchive' : 'Archive'} project
            </button>
            {detail.publication && (
              <>
                <Link
                  className="secondary-button"
                  href={'/p/' + detail.publication.slug}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <IconExternalLink />
                  Open published page
                </Link>
                <button
                  onClick={() =>
                    void guarded(async () => {
                      await api(
                        'projects/' + projectId + '/unpublish',
                        'POST',
                        {}
                      )
                      await refresh()
                      setSuccess('Your project is private again.')
                    })
                  }
                >
                  <IconShieldLock />
                  Unpublish
                </button>
              </>
            )}
            <button
              className="danger-text"
              onClick={() => {
                setDialog(null)
                setConfirm({
                  title: 'Delete this project?',
                  text: 'All versions and its public link will be removed. Download your source first if you need a copy.',
                  run: async () => {
                    await projectAction(detail.project, 'delete')
                    setConfirm(null)
                  }
                })
              }}
            >
              <IconTrash />
              Delete project
            </button>
          </div>
        </Dialog>
      )}
      {confirm && (
        <Dialog title={confirm.title} onClose={() => setConfirm(null)}>
          <p className="dialog-description">{confirm.text}</p>
          <div className="dialog-actions">
            <button
              className="secondary-button"
              onClick={() => setConfirm(null)}
            >
              Keep working
            </button>
            <button
              className={
                confirm.title.includes('Delete')
                  ? 'danger-button'
                  : 'primary-button'
              }
              disabled={busy}
              onClick={() => void confirm.run()}
            >
              {confirm.title.includes('Publish')
                ? 'Publish this version'
                : confirm.title.includes('Restore')
                  ? 'Restore version'
                  : 'Delete project'}
            </button>
          </div>
        </Dialog>
      )}
    </div>
  )
}
