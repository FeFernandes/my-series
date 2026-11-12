import { useEffect, useMemo, useRef, useState } from 'react'
import { Search, Library, CalendarDays, Heart, Plus, Check, Circle, RefreshCw, Trash2, Tv, Clapperboard, X, ChevronDown, ChevronRight, Bell, PlayCircle, ChevronLeft, Clock3 } from 'lucide-react'
import './App.css'

async function api(path, options = {}) {
  const response = await fetch(`/api${path}`, { headers: { 'Content-Type': 'application/json' }, ...options })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(data.error || 'Erro ao acessar o servidor.')
  return data
}

export default function App() {
  const [page, setPage] = useState('home')
  const [shows, setShows] = useState([])
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [searching, setSearching] = useState(false)
  const [selected, setSelected] = useState(null)
  const [episodes, setEpisodes] = useState([])
  const [calendar, setCalendar] = useState([])
  const [watchedMinutes, setWatchedMinutes] = useState(0)
  const [calendarMonth, setCalendarMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1))
  const [calendarDay, setCalendarDay] = useState(() => new Date().toLocaleDateString('en-CA'))
  const [genreFilter, setGenreFilter] = useState('')
  const [busy, setBusy] = useState(false)
  const [toast, setToast] = useState('')
  const [online, setOnline] = useState(false)
  const [collapsed, setCollapsed] = useState({})
  const [favoritesOnly, setFavoritesOnly] = useState(false)
  const lastAutoSync = useRef(0)
  const toastTimer = useRef(null)

  const notify = (message) => {
    setToast(message)
    if (toastTimer.current) window.clearTimeout(toastTimer.current)
    toastTimer.current = window.setTimeout(() => setToast(''), 4500)
  }

  const load = async () => {
    try {
      const data = await api('/shows')
      setShows(data.shows)
      setWatchedMinutes(data.watched_minutes || 0)
      setOnline(true)
      return data.shows
    } catch {
      setOnline(false)
    }
  }

  useEffect(() => {
    load()
    const timer = window.setInterval(load, 60000)
    return () => window.clearInterval(timer)
  }, [])

  // Verifica atualizações somente enquanto o aplicativo está aberto: primeira checagem após 5 min e depois a cada 6 h.
  useEffect(() => {
    const check = async () => {
      if (document.visibilityState !== 'visible' || !shows.length || busy) return
      const now = Date.now()
      if (lastAutoSync.current && now - lastAutoSync.current < 6 * 60 * 60 * 1000) return
      lastAutoSync.current = now
      try {
        const data = await api('/shows/sync-all', { method: 'POST' })
        await load()
        const total = data.added.reduce((sum, item) => sum + item.count, 0)
        if (total) notify(`${total} episódio(s) novo(s) encontrado(s) em ${data.added.length} série(s).`)
      } catch {
        // A sincronização automática não interrompe o uso do aplicativo.
      }
    }
    const timer = window.setTimeout(check, 5 * 60 * 1000)
    const interval = window.setInterval(check, 30 * 60 * 1000)
    return () => { window.clearTimeout(timer); window.clearInterval(interval) }
  }, [shows.length, busy])

  useEffect(() => {
    if (query.trim().length < 2) { setResults([]); return }
    const timer = window.setTimeout(async () => {
      setSearching(true)
      try { setResults((await api(`/search?q=${encodeURIComponent(query)}`)).results) }
      catch (error) { notify(error.message) }
      finally { setSearching(false) }
    }, 450)
    return () => window.clearTimeout(timer)
  }, [query])

  const stats = useMemo(() => ({
    watched: shows.reduce((sum, show) => sum + show.watched_count, 0),
    total: shows.reduce((sum, show) => sum + show.episode_count, 0),
  }), [shows])

  const open = async (show) => {
    setSelected(show)
    setCollapsed({})
    try { setEpisodes((await api(`/shows/${show.id}/episodes`)).episodes) }
    catch (error) { notify(error.message) }
  }

  const add = async (show) => {
    setBusy(true)
    try {
      await api('/shows', { method: 'POST', body: JSON.stringify({ provider_id: show.provider_id }) })
      await load(); setQuery(''); setResults([]); notify(`${show.name} adicionada!`)
    } catch (error) { notify(error.message) }
    finally { setBusy(false) }
  }

  const mark = async (episode) => {
    try {
      const data = await api(`/episodes/${episode.id}`, { method: 'PATCH', body: JSON.stringify({ watched: !episode.watched }) })
      setEpisodes((old) => old.map((item) => item.id === episode.id ? data.episode : item))
      await load()
    } catch (error) { notify(error.message) }
  }

  const bulk = async (season = '__all__', watched = true) => {
    if (!selected) return
    try {
      const data = await api(`/shows/${selected.id}/episodes/bulk`, { method: 'POST', body: JSON.stringify({ season, watched }) })
      setEpisodes((old) => old.map((episode) => {
        const matches = season === '__all__' || (season === 'Especial' ? episode.season == null : episode.season === season)
        return matches ? { ...episode, watched: watched ? 1 : 0 } : episode
      }))
      await load()
      notify(`${data.updated} episódio(s) atualizados.`)
    } catch (error) { notify(error.message) }
  }

  const sync = async (show = selected) => {
    if (!show) return
    setBusy(true)
    try {
      const data = await api(`/shows/${show.id}/sync`, { method: 'POST' })
      if (selected?.id === show.id) setEpisodes((await api(`/shows/${show.id}/episodes`)).episodes)
      const updatedShows = await load()
      const refreshed = updatedShows?.find((item) => item.id === show.id)
      if (refreshed && selected?.id === show.id) setSelected(refreshed)
      notify(data.new_episodes ? `${data.new_episodes} episódio(s) novo(s) encontrado(s)!` : 'Catálogo atualizado. Nenhum episódio novo.')
    } catch (error) { notify(error.message) }
    finally { setBusy(false) }
  }

  const syncAll = async () => {
    setBusy(true)
    try {
      const data = await api('/shows/sync-all', { method: 'POST' })
      const updatedShows = await load()
      if (selected) {
        setEpisodes((await api(`/shows/${selected.id}/episodes`)).episodes)
        const refreshed = updatedShows?.find((item) => item.id === selected.id)
        if (refreshed) setSelected(refreshed)
      }
      const total = data.added.reduce((sum, item) => sum + item.count, 0)
      notify(total ? `${total} episódio(s) novo(s) encontrado(s).` : 'Biblioteca atualizada. Nenhum episódio novo.')
      if (data.failures.length) notify(`Não foi possível atualizar: ${data.failures.join(', ')}`)
    } catch (error) { notify(error.message) }
    finally { setBusy(false) }
  }

  const remove = async () => {
    if (!selected || !confirm(`Remover ${selected.name} da biblioteca?`)) return
    try { await api(`/shows/${selected.id}`, { method: 'DELETE' }); setSelected(null); await load(); notify('Série removida.') }
    catch (error) { notify(error.message) }
  }

  const toggleFavorite = async (show) => {
    try {
      await api(`/shows/${show.id}/favorite`, { method: 'PATCH', body: JSON.stringify({ favorite: !show.favorite }) })
      await load()
      if (selected?.id === show.id) setSelected({ ...selected, favorite: !selected.favorite })
    } catch (error) { notify(error.message) }
  }

  const date = (value) => value ? new Date(`${value}T12:00:00`).toLocaleDateString('pt-BR') : 'Data não informada'
  const genreOptions = [...new Set(shows.flatMap((show) => (show.genres || '').split(',').map((g) => g.trim()).filter(Boolean)))].sort((a, b) => a.localeCompare(b, 'pt-BR'))
  const filtered = shows.filter((show) => (!favoritesOnly || show.favorite) && (!genreFilter || (show.genres || '').split(',').map((g) => g.trim()).includes(genreFilter)))
  const historyByDay = calendar.reduce((acc, item) => { const key = (item.watched_at || '').slice(0, 10); if (key) (acc[key] ||= []).push(item); return acc }, {})
  const monthYear = calendarMonth.getFullYear(), monthIndex = calendarMonth.getMonth()
  const monthDays = new Date(monthYear, monthIndex + 1, 0).getDate()
  const monthOffset = new Date(monthYear, monthIndex, 1).getDay()
  const calendarCells = [...Array(monthOffset).fill(null), ...Array.from({ length: monthDays }, (_, i) => i + 1)]
  const selectedDayEntries = historyByDay[calendarDay] || []
  const hoursText = watchedMinutes > 0 ? `${Math.floor(watchedMinutes / 60)}h ${watchedMinutes % 60}min` : '—'
  const isoDay = (year, month, day) => `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
  const formatWatchedAt = (value) => value ? new Date(value.replace(' ', 'T')).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : ''
  const seasons = Object.entries(episodes.reduce((acc, episode) => {
    (acc[episode.season ?? 'Especial'] ??= []).push(episode)
    return acc
  }, {}))

  return <div className="shell">
    <aside className="sidebar">
      <div className="brand"><span className="brand-icon"><Clapperboard size={20} /></span>My Series</div>
      <div className="side-label">ESPAÇO PESSOAL</div>
      <nav>
        <button className={page === 'home' ? 'active' : ''} onClick={() => { setPage('home'); setSelected(null) }}><Tv />Visão geral</button>
        <button className={page === 'library' ? 'active' : ''} onClick={() => { setPage('library'); setSelected(null) }}><Library />Minha biblioteca</button>
        <button className={page === 'calendar' ? 'active' : ''} onClick={async () => { setPage('calendar'); setSelected(null); try { setCalendar((await api('/calendar')).episodes) } catch (error) { notify(error.message) } }}><CalendarDays />Calendário</button>
      </nav>
      <div className="side-bottom"><span className={online ? 'dot online' : 'dot'} />{online ? 'Servidor conectado' : 'Conectando...'}<small>MY SERIES · V3.2</small></div>
    </aside>

    <main className="main">
      <header><div><small>SEU CATÁLOGO PESSOAL</small><h1>{selected ? selected.name : page === 'library' ? 'Minha biblioteca' : page === 'calendar' ? 'Calendário' : 'Visão geral'}</h1></div><div className="header-note"><Bell size={17} /><span>Avisos no aplicativo</span></div></header>

      {selected ? <section className="detail">
        <button className="back" onClick={() => setSelected(null)}>← Voltar</button>
        <div className="detail-card">
          {selected.image_url ? <img src={selected.image_url} alt={selected.name} /> : <div className="no-poster"><Tv /></div>}
          <div className="detail-copy"><span className="tag">{selected.status || 'Série'}</span><h2>{selected.name}</h2><p>{selected.summary || 'Sinopse não disponível.'}</p><small>{selected.premiered ? `Estreia: ${date(selected.premiered)}` : ''} {selected.genres ? `· ${selected.genres}` : ''}</small>
            <div className="actions"><button className="primary" onClick={() => sync()} disabled={busy}><RefreshCw size={15} />{busy ? 'Atualizando' : 'Sincronizar episódios'}</button><button className="icon-action" onClick={() => toggleFavorite(selected)} title="Favoritar"><Heart fill={selected.favorite ? 'currentColor' : 'none'} color={selected.favorite ? '#df6c91' : 'currentColor'} /></button><button className="remove" onClick={remove} title="Remover"><Trash2 size={16} /></button></div>
            <div className="bar"><span style={{ width: `${selected.progress || 0}%` }} /></div>
          </div>
        </div>
        <div className="section-head"><div><h2>Episódios</h2><p>Marque episódios individualmente ou uma temporada inteira.</p></div><button className="text-action" onClick={() => bulk('__all__', true)}>Marcar série toda</button></div>
        {seasons.map(([season, list]) => <div className="season" key={season}><div className="season-head"><button onClick={() => setCollapsed((old) => ({ ...old, [season]: !(old[season] ?? true) }))}>{(collapsed[season] ?? true) ? <ChevronRight /> : <ChevronDown />}{season === 'Especial' ? 'Especiais' : `Temporada ${season}`} <small>{list.filter((episode) => episode.watched).length}/{list.length} assistidos</small></button><button className="text-action" onClick={() => bulk(season === 'Especial' ? 'Especial' : Number(season), true)}>Marcar temporada</button></div>{collapsed[season] === false && list.map((episode) => <button className={`episode ${episode.watched ? 'watched' : ''}`} key={episode.id} onClick={() => mark(episode)}>{episode.watched ? <Check /> : <Circle />}<b>{episode.number ? `E${String(episode.number).padStart(2, '0')}` : 'Especial'}</b><span>{episode.name}</span><small>{date(episode.airdate)}</small></button>)}</div>)}
      </section> : <>
        {page === 'home' && <section className="hero"><div><small>UM LUGAR PARA TODAS AS SUAS HISTÓRIAS</small><h2>O que vamos assistir hoje?</h2><p>Acompanhe episódios novos, organize temporadas e mantenha seu histórico em um só lugar.</p></div><Clapperboard size={70} /></section>}
        <section className="stats"><article><small>Séries na biblioteca</small><strong>{shows.length}</strong><span>Seu catálogo pessoal</span></article><article><small>Episódios assistidos</small><strong>{stats.watched}</strong><span>Seu histórico</span></article><article><small>Tempo assistido</small><strong className="hours-stat">{hoursText}</strong><span>Estimativa baseada nas durações disponíveis</span></article><article><small>Episódios cadastrados</small><strong>{stats.total}</strong><span>Nas suas séries</span></article><article><small>Progresso geral</small><strong>{stats.total ? Math.round(stats.watched / stats.total * 100) : 0}%</strong><span>Do catálogo cadastrado</span></article></section>
        {page !== 'calendar' && <section className="search-area"><div className="section-head"><div><h2>Encontrar séries</h2><p>Pesquisa no catálogo TVmaze.</p></div></div><div className="search"><Search /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Digite o nome de uma série..." />{query && <button onClick={() => { setQuery(''); setResults([]) }}><X /></button>}</div>{searching && <p className="muted">Pesquisando...</p>}{results.length > 0 && <div className="results">{results.map((show) => <article key={show.provider_id}>{show.image_url ? <img src={show.image_url} alt={show.name} /> : <div className="no-poster"><Tv /></div>}<div><b>{show.name}</b><small>{show.premiered?.slice(0, 4) || 'Ano não informado'} · {show.status || 'Status desconhecido'}</small><p>{show.summary || 'Sem sinopse disponível.'}</p><button className="primary" disabled={busy || shows.some((item) => item.provider_id === show.provider_id)} onClick={() => add(show)}>{shows.some((item) => item.provider_id === show.provider_id) ? <Check size={14} /> : <Plus size={14} />}{shows.some((item) => item.provider_id === show.provider_id) ? 'Adicionada' : 'Adicionar'}</button></div></article>)}</div>}{query.length >= 2 && !searching && !results.length && <p className="muted">Nenhum resultado encontrado.</p>}</section>}
        {page === 'calendar' ? <section className="library"><div className="section-head"><div><h2>Seu calendário de atividade</h2><p>Os dias marcados mostram quando você registrou episódios como assistidos.</p></div><div className="month-nav"><button className="filter-button" onClick={() => { setCalendarMonth(new Date(monthYear, monthIndex - 1, 1)); setCalendarDay(isoDay(monthYear, monthIndex - 1, 1)) }}><ChevronLeft size={16}/></button><strong>{calendarMonth.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}</strong><button className="filter-button" onClick={() => { setCalendarMonth(new Date(monthYear, monthIndex + 1, 1)); setCalendarDay(isoDay(monthYear, monthIndex + 1, 1)) }}><ChevronRight size={16}/></button></div></div><div className="calendar-panel"><div className="calendar-grid calendar-weekdays">{['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'].map((d) => <span key={d}>{d}</span>)}</div><div className="calendar-grid">{calendarCells.map((day, index) => { const key = day ? isoDay(monthYear, monthIndex, day) : `blank-${index}`; const count = day ? (historyByDay[key] || []).length : 0; return <button key={key} disabled={!day} className={`calendar-day ${count ? 'has-activity' : ''} ${calendarDay === key ? 'chosen' : ''}`} onClick={() => setCalendarDay(key)}>{day && <><span>{day}</span>{count > 0 && <i>{count} ep.</i>}</>}</button> })}</div></div><div className="calendar-day-detail"><div className="section-head"><div><h2>{new Date(`${calendarDay}T12:00:00`).toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' })}</h2><p>{selectedDayEntries.length} episódio(s) registrado(s)</p></div></div>{selectedDayEntries.length ? <div className="calendar-list">{selectedDayEntries.map((item) => <article key={item.history_id}><b><Clock3 size={13}/> {formatWatchedAt(item.watched_at)}</b><span><strong>{item.show_name}</strong> · T{item.season ?? '–'} E{item.number ?? '–'} — {item.episode_name}<small>{item.runtime_minutes ? ` · ${item.runtime_minutes} min` : ''}</small></span></article>)}</div> : <div className="empty compact-empty"><CalendarDays/><b>Nenhum episódio registrado neste dia</b><p>Quando marcar um episódio como assistido, ele aparecerá aqui.</p></div>}</div></section> : <section className="library"><div className="section-head"><div><h2>Minha biblioteca</h2><p>{filtered.length} séries cadastradas</p></div><div className="library-actions"><button className="filter-button" onClick={syncAll} disabled={busy}><RefreshCw size={14} /> Atualizar tudo</button><button className={`filter-button ${favoritesOnly ? 'selected' : ''}`} onClick={() => setFavoritesOnly(!favoritesOnly)}><Heart size={14} fill={favoritesOnly ? 'currentColor' : 'none'} /> Favoritas</button></div></div><div className="genre-filter"><label htmlFor="genre-filter">Gênero</label><select id="genre-filter" value={genreFilter} onChange={(e) => setGenreFilter(e.target.value)}><option value="">Todos os gêneros</option>{genreOptions.map((genre) => <option key={genre} value={genre}>{genre}</option>)}</select>{genreFilter && <button className="text-action" onClick={() => setGenreFilter('')}>Limpar filtro</button>}</div>{filtered.length ? <div className="cards">{filtered.map((show) => <div className="show-wrap" key={show.id}><button className="show-card" onClick={() => open(show)}>{show.image_url ? <img src={show.image_url} alt={show.name} /> : <div className="no-poster"><Tv /></div>}<b>{show.name}</b><small>{show.watched_count}/{show.episode_count} episódios · {show.progress}%</small><div className="bar"><span style={{ width: `${show.progress}%` }} /></div></button><button className="favorite-mini" onClick={() => toggleFavorite(show)} title="Favoritar"><Heart size={16} fill={show.favorite ? 'currentColor' : 'none'} /></button></div>)}</div> : <div className="empty"><Library /><b>{genreFilter ? `Nenhuma série do gênero ${genreFilter}` : favoritesOnly ? 'Nenhuma favorita ainda' : 'Sua biblioteca está vazia'}</b><p>Pesquise uma série acima e adicione ao seu catálogo.</p></div>}</section>}
      </>}
      <footer>Seus dados ficam salvos neste computador · Sem conta e sem mensalidade</footer>
    </main>
    {toast && <div className="toast"><PlayCircle size={17} />{toast}</div>}
  </div>
}
