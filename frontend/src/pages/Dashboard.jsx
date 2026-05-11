import { useEffect, useState, useCallback, useRef } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { meetingsApi, contactsApi, roomsApi } from '../api'
import { useAuth } from '../context/AuthContext'
import TopBar from '../components/TopBar'

// ── Constants ──────────────────────────────────────────────────────────────

const AVATAR_PALETTE = [
    ['#E6F1FB', '#0C447C'], ['#EEEDFE', '#3C3489'], ['#EAF3DE', '#27500A'],
    ['#FAEEDA', '#633806'], ['#FBEAF0', '#72243E'], ['#E1F5EE', '#085041'],
]
const CONTACT_CLASS = { ONLINE: 'badge-online', BUSY: 'badge-busy', OFFLINE: 'badge-offline' }
const CONTACT_LABEL = { ONLINE: 'online', BUSY: 'busy', OFFLINE: 'offline' }

function initials(c) { return `${c.firstName?.[0] ?? ''}${c.lastName?.[0] ?? ''}`.toUpperCase() }

// ── Toast ──────────────────────────────────────────────────────────────────

function Toast({ toasts }) {
    return (
        <div style={{ position: 'fixed', bottom: 24, right: 24, display: 'flex', flexDirection: 'column', gap: 8, zIndex: 1000, pointerEvents: 'none' }}>
            {toasts.map(t => (
                <div key={t.id} style={{
                    background: 'var(--color-text-primary)', color: 'var(--color-background-primary)',
                    padding: '10px 16px', borderRadius: 10, fontSize: 13,
                    animation: 'slideIn 0.2s ease',
                }}>
                    {t.message}
                </div>
            ))}
        </div>
    )
}

// ── Countdown hook ─────────────────────────────────────────────────────────

function useCountdown(targetDate) {
    const [label, setLabel] = useState('')
    useEffect(() => {
        const calc = () => {
            if (!targetDate) return setLabel('')
            const diff = new Date(targetDate) - new Date()
            if (diff < 0)         return setLabel('passed')
            const mins = Math.floor(diff / 60000)
            if (mins === 0)       return setLabel('now')
            if (mins < 60)        return setLabel(`in ${mins}m`)
            const hrs = Math.floor(mins / 60)
            if (hrs < 24)         return setLabel(`in ${hrs}h`)
            return setLabel(`in ${Math.floor(hrs / 24)}d`)
        }
        calc()
        const t = setInterval(calc, 30000)
        return () => clearInterval(t)
    }, [targetDate])
    return label
}

// ── Upcoming item ──────────────────────────────────────────────────────────

function UpcomingItem({ m }) {
    const countdown = useCountdown(m.scheduledAt)
    const isLive    = m.status === 'ACTIVE'
    const mins      = m.scheduledAt ? Math.floor((new Date(m.scheduledAt) - new Date()) / 60000) : 999
    const urgent    = !isLive && mins >= 0 && mins < 60

    const dotColor  = isLive ? '#1D9E75' : '#185FA5'
    const badgeText = isLive ? 'Live' : countdown
    const badgeBg   = isLive ? 'var(--green-light)' : urgent ? 'var(--amber-light)' : 'var(--blue-light)'
    const badgeClr  = isLive ? 'var(--green-800)'   : urgent ? 'var(--amber-800)'   : 'var(--blue-800)'

    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 0', borderBottom: '0.5px solid var(--color-border-tertiary)' }}>
            <div style={{ width: 7, height: 7, borderRadius: '50%', flexShrink: 0, background: dotColor }} />
            <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--color-text-primary)' }}>
                    {m.title}
                </div>
                <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 1 }}>
                    {m.scheduledAt ? new Date(m.scheduledAt).toLocaleString('en-US', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—'}
                </div>
            </div>
            <span className="badge" style={{ background: badgeBg, color: badgeClr }}>{badgeText}</span>
        </div>
    )
}

// ── Calendar ───────────────────────────────────────────────────────────────

function Calendar({ meetings, onDaySelect, selectedDay, onStart }) {
    const navigate  = useNavigate()
    const [view,    setView]    = useState(new Date())
    const [hovered, setHovered] = useState(null)

    const year    = view.getFullYear()
    const mo      = view.getMonth()
    const today   = new Date()

    const firstDay = new Date(year, mo, 1).getDay()
    const daysInMo = new Date(year, mo + 1, 0).getDate()
    const offset   = firstDay === 0 ? 6 : firstDay - 1

    // group meetings by day-of-month for this view month
    const byDay = {}
    meetings.filter(m => m.scheduledAt).forEach(m => {
        const d = new Date(m.scheduledAt)
        if (d.getFullYear() === year && d.getMonth() === mo) {
            const k = d.getDate()
            if (!byDay[k]) byDay[k] = []
            byDay[k].push(m)
        }
    })

    const isToday = d =>
        d === today.getDate() && year === today.getFullYear() && mo === today.getMonth()

    const isSelected = d =>
        !!selectedDay &&
        d === new Date(selectedDay).getDate() &&
        year === new Date(selectedDay).getFullYear() &&
        mo   === new Date(selectedDay).getMonth()

    const cells  = [...Array(offset).fill(null), ...Array.from({ length: daysInMo }, (_, i) => i + 1)]
    const moLabel = view.toLocaleString('en-US', { month: 'long', year: 'numeric' })

    const navBtn = (label, onClick) => (
        <button onClick={onClick} style={{
            width: 28, height: 28,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'transparent', border: '0.5px solid var(--color-border-secondary)',
            borderRadius: 7, cursor: 'pointer', color: 'var(--color-text-secondary)',
            fontSize: 15, lineHeight: 1, fontFamily: 'inherit',
            transition: 'background 0.1s',
        }}>{label}</button>
    )

    return (
        <div>
            {/* Header row */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
                <span style={{ fontSize: 15, fontWeight: 500, color: 'var(--color-text-primary)', letterSpacing: '-0.3px' }}>
                    {moLabel}
                </span>
                <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                    <button
                        onClick={() => setView(new Date(today.getFullYear(), today.getMonth(), 1))}
                        style={{
                            height: 28, padding: '0 10px', background: 'transparent',
                            border: '0.5px solid var(--color-border-secondary)', borderRadius: 7,
                            cursor: 'pointer', color: 'var(--color-text-muted)', fontSize: 11,
                            fontFamily: 'inherit', transition: 'background 0.1s',
                        }}>
                        Today
                    </button>
                    {navBtn('‹', () => setView(new Date(year, mo - 1, 1)))}
                    {navBtn('›', () => setView(new Date(year, mo + 1, 1)))}
                </div>
            </div>

            {/* Day-of-week headers */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', marginBottom: 4 }}>
                {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d, i) => (
                    <div key={i} style={{
                        textAlign: 'center', fontSize: 10, fontWeight: 600,
                        textTransform: 'uppercase', letterSpacing: '0.06em',
                        color: i >= 5 ? 'var(--amber-800)' : 'var(--color-text-muted)',
                        padding: '0 0 8px',
                    }}>{d}</div>
                ))}
            </div>

            {/* Day cells */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 3 }}>
                {cells.map((d, i) => {
                    if (!d) return <div key={i} />
                    const isT    = isToday(d)
                    const isSel  = isSelected(d)
                    const isHov  = hovered === i && !isT
                    const count  = byDay[d]?.length ?? 0
                    const weekend = i % 7 >= 5

                    return (
                        <div
                            key={i}
                            onClick={() => onDaySelect(isSel ? null : new Date(year, mo, d))}
                            onMouseEnter={() => setHovered(i)}
                            onMouseLeave={() => setHovered(null)}
                            style={{
                                display: 'flex', flexDirection: 'column',
                                alignItems: 'center', justifyContent: 'center',
                                height: 44, cursor: 'pointer', borderRadius: 9,
                                background: isT
                                    ? '#185FA5'
                                    : isSel
                                        ? 'var(--blue-light)'
                                        : isHov
                                            ? 'var(--color-background-secondary)'
                                            : 'transparent',
                                transition: 'background 0.1s',
                            }}
                        >
                            <span style={{
                                fontSize: 13, lineHeight: 1,
                                fontWeight: isT || isSel ? 600 : 400,
                                color: isT
                                    ? '#fff'
                                    : isSel
                                        ? 'var(--blue-800)'
                                        : weekend
                                            ? 'var(--amber-800)'
                                            : 'var(--color-text-primary)',
                            }}>
                                {d}
                            </span>

                            {/* Meeting dots */}
                            {count > 0 && (
                                <div style={{ display: 'flex', gap: 2, marginTop: 5 }}>
                                    {Array.from({ length: Math.min(count, 3) }).map((_, k) => (
                                        <div key={k} style={{
                                            width: 4, height: 4, borderRadius: '50%',
                                            background: isT
                                                ? 'rgba(255,255,255,0.7)'
                                                : k === 0
                                                    ? '#1D9E75'
                                                    : k === 1
                                                        ? '#185FA5'
                                                        : '#BA7517',
                                        }} />
                                    ))}
                                </div>
                            )}
                        </div>
                    )
                })}
            </div>

            {/* Selected day panel */}
            {selectedDay && (() => {
                const dayMtgs = meetings
                    .filter(m => m.scheduledAt && new Date(m.scheduledAt).toDateString() === selectedDay.toDateString())
                    .sort((a, b) => new Date(a.scheduledAt) - new Date(b.scheduledAt))
                return (
                    <div style={{ marginTop: 20, paddingTop: 18, borderTop: '0.5px solid var(--color-border-tertiary)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                            <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--color-text-primary)' }}>
                                {selectedDay.toLocaleDateString('en-US', { weekday: 'long', day: 'numeric', month: 'long' })}
                            </span>
                            <button onClick={() => onDaySelect(null)} style={{
                                background: 'none', border: 'none', cursor: 'pointer',
                                color: 'var(--color-text-muted)', fontSize: 20, lineHeight: 1, padding: 0,
                            }}>×</button>
                        </div>
                        {dayMtgs.length === 0 ? (
                            <div style={{ fontSize: 12, color: 'var(--color-text-muted)', padding: '4px 0' }}>
                                No meetings on this day
                            </div>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                                {dayMtgs.map(m => {
                                    const active = m.status === 'ACTIVE'
                                    return (
                                        <div key={m.id} style={{
                                            display: 'flex', alignItems: 'center', gap: 10,
                                            padding: '10px 14px', borderRadius: 9,
                                            background: active ? 'var(--green-light)' : 'var(--color-background-secondary)',
                                            border: '0.5px solid var(--color-border-tertiary)',
                                        }}>
                                            <div style={{
                                                width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
                                                background: active ? '#1D9E75' : '#185FA5',
                                            }} />
                                            <div style={{ flex: 1, minWidth: 0 }}>
                                                <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--color-text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                    {m.title}
                                                </div>
                                                <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 2 }}>
                                                    {new Date(m.scheduledAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                                                    {(m.participants?.length ?? 0) > 0 && ` · ${m.participants.length} participant${m.participants.length !== 1 ? 's' : ''}`}
                                                </div>
                                            </div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                                <span className={`badge badge-${m.status?.toLowerCase()}`}>
                                                    {active ? 'Live' : m.status?.charAt(0) + m.status?.slice(1).toLowerCase()}
                                                </span>
                                                {m.status === 'SCHEDULED' && (
                                                    <button className="btn btn-sm btn-primary"
                                                        style={{ fontSize: 11, padding: '3px 10px' }}
                                                        onClick={() => onStart?.(m.id)}>
                                                        Join
                                                    </button>
                                                )}
                                                {active && m.room?.inviteCode && (
                                                    <button className="btn btn-sm btn-primary"
                                                        style={{ fontSize: 11, padding: '3px 10px' }}
                                                        onClick={() => window.open(`/join/${m.room.inviteCode}`, '_blank')}>
                                                        Join
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        )}
                    </div>
                )
            })()}
        </div>
    )
}

// ── Dashboard ──────────────────────────────────────────────────────────────

export default function Dashboard() {
    const { user }    = useAuth()
    const navigate    = useNavigate()
    const calendarRef = useRef(null)

    const [allMeetings,   setAllMeetings]   = useState([])
    const [contacts,      setContacts]      = useState([])
    const [activeRooms,   setActiveRooms]   = useState([])
    const [selectedDay,   setSelectedDay]   = useState(null)
    const [generatedLink, setGeneratedLink] = useState('')
    const [generatedRoom, setGeneratedRoom] = useState(null)
    const [copiedId,      setCopiedId]      = useState(null)
    const [loading,       setLoading]       = useState(false)
    const [fetchLoading,  setFetchLoading]  = useState(true)
    const [toasts,        setToasts]        = useState([])

    const addToast = useCallback((msg) => {
        const id = Date.now()
        setToasts(t => [...t, { id, message: msg }])
        setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 4000)
    }, [])

    const loadData = useCallback(() =>
        Promise.all([meetingsApi.getAll(), contactsApi.getAll(), roomsApi.getActive()])
            .then(([m, c, r]) => { setAllMeetings(m.data); setContacts(c.data); setActiveRooms(r.data) })
            .catch(() => addToast('Error loading data'))
    , [addToast])

    useEffect(() => { setFetchLoading(true); loadData().finally(() => setFetchLoading(false)) }, [loadData])

    useEffect(() => {
        const token = localStorage.getItem('token')
        if (!token) return
        const es = new EventSource(`/api/sse/subscribe?token=${token}`)
        es.addEventListener('room.created', () => {
            roomsApi.getActive().then(r => setActiveRooms(r.data)).catch(() => {})
        })
        es.addEventListener('meeting.started', () => {
            Promise.all([meetingsApi.getAll(), roomsApi.getActive()])
                .then(([m, r]) => { setAllMeetings(m.data); setActiveRooms(r.data) }).catch(() => {})
        })
        return () => es.close()
    }, [])

    useEffect(() => {
        if (window.location.hash === '#calendar' && calendarRef.current) {
            setTimeout(() => calendarRef.current?.scrollIntoView({ behavior: 'smooth' }), 100)
        }
    }, [fetchLoading])

    const generateRoom = async () => {
        setLoading(true)
        try {
            const now = new Date()
            const hh  = String(now.getHours()).padStart(2, '0')
            const mm  = String(now.getMinutes()).padStart(2, '0')
            const res = await roomsApi.create({
                name:         `Huddle ${hh}:${mm}`,
                createdBy:    user ? `${user.firstName} ${user.lastName}` : 'admin',
                hostIdentity: user?.username || 'admin',
            })
            const room = res.data
            const link = `${window.location.origin}/join/${room.inviteCode}`
            setGeneratedLink(link)
            setGeneratedRoom(room)
            roomsApi.getActive().then(r => setActiveRooms(r.data))
            localStorage.setItem(`huddle_host_${room.inviteCode}`, JSON.stringify({
                token: room.token, url: room.url, roomId: room.id, roomName: room.name,
                name: user ? `${user.firstName} ${user.lastName}` : 'Host',
            }))
            window.open(link, '_blank')
        } catch (err) {
            addToast(err.response?.status === 429 ? 'Rate limit reached — max 10 rooms per hour.' : 'Error creating room.')
        } finally {
            setLoading(false)
        }
    }

    const handleStartMeeting = async (meetingId) => {
        try {
            const createdByName = user ? `${user.firstName} ${user.lastName}` : 'admin'
            const res = await meetingsApi.start(meetingId, { createdBy: createdByName })
            loadData()
            const inviteCode = res.data.room?.inviteCode
            if (inviteCode) window.open(`/join/${inviteCode}`, '_blank')
        } catch {
            addToast('Could not start meeting.')
        }
    }

    const copyLink = (link, id) => {
        navigator.clipboard.writeText(link)
        setCopiedId(id)
        setTimeout(() => setCopiedId(null), 2000)
    }

    const upcomingMeetings = [
        ...allMeetings.filter(m => m.status === 'ACTIVE'),
        ...allMeetings.filter(m => m.status === 'SCHEDULED' && m.scheduledAt && new Date(m.scheduledAt) > new Date())
            .sort((a, b) => new Date(a.scheduledAt) - new Date(b.scheduledAt)),
    ].slice(0, 7)

    if (fetchLoading) return (
        <div className="main-content">
            <div className="page" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
                <div style={{ color: 'var(--color-text-muted)', fontSize: 13 }}>Loading…</div>
            </div>
        </div>
    )

    return (
        <div className="main-content">
            <Toast toasts={toasts} />
            <TopBar title="" />

            <div className="page">

                {/* ── Hero ──────────────────────────────────────────── */}
                <div style={{ textAlign: 'center', padding: '32px 0 36px', animation: 'fadeUp 0.4s ease' }}>
                    <div style={{
                        fontSize: 52, fontWeight: 500, letterSpacing: '-2px',
                        lineHeight: 1, marginBottom: 10,
                    }}>
                        <span style={{ color: '#185FA5' }}>hud</span>
                        <span style={{ color: 'var(--color-text-primary)' }}>dle</span>
                    </div>
                    <div style={{ fontSize: 13, color: 'var(--color-text-muted)', marginBottom: 32 }}>
                        Video meetings, simplified
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                        <button className="btn-hero btn-hero-primary" onClick={generateRoom} disabled={loading}>
                            {loading ? 'Creating…' : '⚡ Meeting now'}
                        </button>
                        <button className="btn-hero" onClick={() => navigate('/meetings')}>
                            📅 Schedule meeting
                        </button>
                        <button className="btn-hero" onClick={() => navigate('/contacts')}>
                            👤 Add contact
                        </button>
                    </div>
                </div>

                {/* Invite banner */}
                {generatedRoom && (() => {
                    const ngrokBase = import.meta.env.VITE_NGROK_URL
                    const ngrokLink = ngrokBase ? `${ngrokBase}/join/${generatedRoom.inviteCode}` : null
                    return (
                        <div style={{
                            background: '#E6F1FB', border: '0.5px solid #185FA5',
                            borderRadius: 'var(--border-radius-lg)',
                            padding: '12px 16px', marginBottom: 24,
                            display: 'flex', alignItems: 'center', gap: 12,
                        }}>
                            <div style={{ width: 34, height: 34, borderRadius: '50%', background: '#185FA5', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M7 9a4 4 0 0 0 5.7.7l1.3-1.3a4 4 0 0 0-5.7-5.7L7 4" />
                                    <path d="M9 7a4 4 0 0 0-5.7-.7L2 7.7a4 4 0 0 0 5.7 5.7L9 12" />
                                </svg>
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontSize: 12, fontWeight: 500, color: '#0C447C', marginBottom: 6 }}>Room created — share the invite link</div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: ngrokLink ? 5 : 0 }}>
                                    <span style={{ fontSize: 10, color: '#185FA5', background: 'rgba(24,95,165,0.12)', padding: '1px 5px', borderRadius: 3, flexShrink: 0 }}>local</span>
                                    <span style={{ fontSize: 11, fontFamily: 'monospace', color: '#185FA5', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{generatedLink}</span>
                                    <button className="btn btn-sm" style={{ flexShrink: 0 }} onClick={() => copyLink(generatedLink, 'banner')}>{copiedId === 'banner' ? '✓' : 'Copy'}</button>
                                </div>
                                {ngrokLink && (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                        <span style={{ fontSize: 10, color: '#0C447C', background: 'rgba(24,95,165,0.18)', padding: '1px 5px', borderRadius: 3, flexShrink: 0 }}>ngrok</span>
                                        <span style={{ fontSize: 11, fontFamily: 'monospace', color: '#185FA5', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{ngrokLink}</span>
                                        <button className="btn btn-sm" style={{ flexShrink: 0 }} onClick={() => copyLink(ngrokLink, 'banner-ngrok')}>{copiedId === 'banner-ngrok' ? '✓' : 'Copy'}</button>
                                    </div>
                                )}
                            </div>
                            <button className="btn btn-sm btn-primary" onClick={() => window.open(generatedLink, '_blank')}>Join</button>
                            <button onClick={() => { setGeneratedRoom(null); setGeneratedLink('') }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#185FA5', fontSize: 18, lineHeight: 1 }}>×</button>
                        </div>
                    )
                })()}

                {/* ── Two-column layout ── */}
                <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: 16, marginBottom: 28 }}>

                    {/* Left: Active rooms + Contacts */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

                        {/* Active rooms */}
                        <div className="card">
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                                <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#1D9E75', animation: 'pulse 2s infinite', flexShrink: 0 }} />
                                <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--color-text-primary)' }}>Active rooms</span>
                                <span style={{ fontSize: 11, color: 'var(--color-text-muted)', marginLeft: 'auto' }}>{activeRooms.length} live</span>
                            </div>

                            {activeRooms.length === 0 ? (
                                <div className="empty-state">No active rooms — start one with "Meeting now"</div>
                            ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                    {activeRooms.map(r => (
                                        <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', background: 'var(--color-background-secondary)', borderRadius: 'var(--border-radius-md)' }}>
                                            <div style={{ width: 28, height: 28, borderRadius: 6, background: '#E6F1FB', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="#185FA5" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                                                    <rect x="1" y="3.5" width="8.5" height="7" rx="1.5" />
                                                    <path d="M9.5 6.3L13 4.5V9.5L9.5 7.7" />
                                                </svg>
                                            </div>
                                            <div style={{ flex: 1, minWidth: 0 }}>
                                                <div style={{ fontSize: 13, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--color-text-primary)' }}>{r.name}</div>
                                                <div style={{ fontSize: 10, fontFamily: 'monospace', color: 'var(--color-text-muted)', marginTop: 1 }}>{r.inviteCode?.slice(0, 16)}…</div>
                                            </div>
                                            <button className="btn btn-sm" onClick={() => copyLink(`${window.location.origin}/join/${r.inviteCode}`, r.id)}>{copiedId === r.id ? '✓' : 'Copy'}</button>
                                            <button className="btn btn-sm btn-primary" onClick={() => window.open(`/join/${r.inviteCode}`, '_blank')}>Join</button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Contacts */}
                        <div className="card">
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                                <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--color-text-primary)' }}>Contacts</span>
                                <Link to="/contacts" style={{ fontSize: 11, color: '#185FA5', textDecoration: 'none' }}>all →</Link>
                            </div>
                            {contacts.length === 0 ? (
                                <div className="empty-state">No contacts yet</div>
                            ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                                    {contacts.slice(0, 8).map((c, i) => {
                                        const [bg, clr] = AVATAR_PALETTE[i % AVATAR_PALETTE.length]
                                        return (
                                            <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 4px', borderBottom: '0.5px solid var(--color-border-tertiary)' }}>
                                                <div style={{ width: 30, height: 30, borderRadius: '50%', background: bg, color: clr, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 500, flexShrink: 0 }}>
                                                    {initials(c)}
                                                </div>
                                                <div style={{ flex: 1, minWidth: 0 }}>
                                                    <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--color-text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.firstName} {c.lastName}</div>
                                                    <div style={{ fontSize: 10, fontFamily: 'monospace', color: 'var(--color-text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.email}</div>
                                                </div>
                                                <span className={`badge ${CONTACT_CLASS[c.status] || 'badge-offline'}`}>
                                                    {CONTACT_LABEL[c.status] || 'offline'}
                                                </span>
                                            </div>
                                        )
                                    })}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Right: Upcoming meetings */}
                    <div className="card">
                        <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--color-text-primary)', marginBottom: 14 }}>Upcoming meetings</div>
                        {upcomingMeetings.length === 0 ? (
                            <div className="empty-state">No upcoming meetings</div>
                        ) : (
                            upcomingMeetings.map(m => <UpcomingItem key={m.id} m={m} />)
                        )}
                    </div>
                </div>

                {/* ── Calendar (full width) ── */}
                <div ref={calendarRef} className="card" style={{ padding: '24px 28px' }} id="calendar">
                    <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 20 }}>
                        Calendar
                    </div>
                    <Calendar meetings={allMeetings} onDaySelect={setSelectedDay} selectedDay={selectedDay} onStart={handleStartMeeting} />
                </div>

            </div>
        </div>
    )
}
