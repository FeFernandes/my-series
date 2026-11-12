import re
import requests
from flask import Blueprint, jsonify, request
from app.database.connection import get_connection

api_bp = Blueprint("api", __name__)
BASE = "https://api.tvmaze.com"
HEADERS = {"User-Agent": "MySeriesLocal/3.2"}


def plain(text):
    return re.sub(r"<[^>]*>", "", text or "").strip()


def import_episodes(conn, local_id, provider_id):
    response = requests.get(f"{BASE}/shows/{provider_id}/episodes", headers=HEADERS, timeout=25)
    response.raise_for_status()
    episodes = response.json()
    for ep in episodes:
        conn.execute(
            """INSERT INTO episodes(show_id, provider_id, season, number, name, airdate, runtime_minutes)
               VALUES (?, ?, ?, ?, ?, ?, ?)
               ON CONFLICT(show_id, provider_id) DO UPDATE SET
                 season=excluded.season, number=excluded.number,
                 name=excluded.name, airdate=excluded.airdate, runtime_minutes=COALESCE(excluded.runtime_minutes, episodes.runtime_minutes)""",
            (local_id, ep["id"], ep.get("season"), ep.get("number"),
             ep.get("name") or "Episódio", ep.get("airdate"), ep.get("runtime")),
        )
    conn.execute("""UPDATE watch_history SET runtime_minutes=(
        SELECT e.runtime_minutes FROM episodes e WHERE e.id=watch_history.episode_id)
        WHERE runtime_minutes IS NULL AND episode_id IN
        (SELECT id FROM episodes WHERE show_id=?)""", (local_id,))
    return len(episodes)



def sync_show_catalog(conn, show):
    """Atualiza metadados da série e episódios sem alterar o histórico assistido."""
    response = requests.get(f"{BASE}/shows/{show['provider_id']}", headers=HEADERS, timeout=20)
    response.raise_for_status()
    data = response.json()
    image = data.get("image") or {}
    conn.execute(
        """UPDATE shows SET name=?, summary=?, image_url=?, premiered=?, status=?, genres=?
           WHERE id=?""",
        (data.get("name") or show["name"], plain(data.get("summary")),
         image.get("original") or image.get("medium"), data.get("premiered"),
         data.get("status"), ", ".join(data.get("genres") or []), show["id"]),
    )
    return import_episodes(conn, show["id"], show["provider_id"])


def show_json(row):
    item = dict(row)
    item["progress"] = round(item["watched_count"] / item["episode_count"] * 100) if item["episode_count"] else 0
    return item


@api_bp.get("/health")
def health():
    conn = get_connection()
    conn.execute("SELECT 1")
    conn.close()
    return jsonify({"status": "online", "application": "My Series", "database": True})


@api_bp.get("/search")
def search():
    q = request.args.get("q", "").strip()
    if len(q) < 2:
        return jsonify({"results": []})
    try:
        r = requests.get(f"{BASE}/search/shows", params={"q": q}, headers=HEADERS, timeout=20)
        r.raise_for_status()
        output = []
        for result in r.json()[:15]:
            s = result.get("show", {})
            img = s.get("image") or {}
            output.append({
                "provider_id": s.get("id"), "name": s.get("name"),
                "summary": plain(s.get("summary")),
                "image_url": img.get("original") or img.get("medium"),
                "premiered": s.get("premiered"), "status": s.get("status"),
                "genres": s.get("genres") or [],
            })
        return jsonify({"results": output})
    except requests.RequestException:
        return jsonify({"error": "Não foi possível consultar TVmaze. Verifique sua internet."}), 502


@api_bp.get("/shows")
def shows():
    conn = get_connection()
    rows = conn.execute("""SELECT s.*, COUNT(e.id) episode_count,
        COALESCE(SUM(e.watched),0) watched_count
        FROM shows s LEFT JOIN episodes e ON e.show_id=s.id
        GROUP BY s.id ORDER BY s.name COLLATE NOCASE""").fetchall()
    history = conn.execute("SELECT COALESCE(SUM(runtime_minutes),0) FROM watch_history").fetchone()[0]
    conn.close()
    return jsonify({"shows": [show_json(x) for x in rows], "watched_minutes": history})


@api_bp.post("/shows")
def add_show():
    data = request.get_json(silent=True) or {}
    pid = data.get("provider_id")
    if not pid:
        return jsonify({"error": "Série não identificada."}), 400
    conn = get_connection()
    if conn.execute("SELECT id FROM shows WHERE provider_id=?", (pid,)).fetchone():
        conn.close()
        return jsonify({"error": "Essa série já está na biblioteca."}), 409
    try:
        r = requests.get(f"{BASE}/shows/{pid}", headers=HEADERS, timeout=20)
        r.raise_for_status()
        s = r.json()
        img = s.get("image") or {}
        cur = conn.execute("""INSERT INTO shows(provider_id,name,summary,image_url,premiered,status,genres)
            VALUES(?,?,?,?,?,?,?)""",
            (s["id"], s.get("name") or "Sem título", plain(s.get("summary")),
             img.get("original") or img.get("medium"), s.get("premiered"),
             s.get("status"), ", ".join(s.get("genres") or [])))
        local_id = cur.lastrowid
        count = import_episodes(conn, local_id, pid)
        conn.commit()
        conn.close()
        return jsonify({"message": "Série adicionada.", "episodes": count}), 201
    except requests.RequestException:
        conn.rollback()
        conn.close()
        return jsonify({"error": "Falha ao importar a série. Tente novamente."}), 502


@api_bp.get("/shows/<int:sid>/episodes")
def episodes(sid):
    conn = get_connection()
    if not conn.execute("SELECT id FROM shows WHERE id=?", (sid,)).fetchone():
        conn.close()
        return jsonify({"error": "Série não encontrada."}), 404
    rows = conn.execute("SELECT * FROM episodes WHERE show_id=? ORDER BY season,number", (sid,)).fetchall()
    conn.close()
    return jsonify({"episodes": [dict(x) for x in rows]})


@api_bp.patch("/episodes/<int:eid>")
def mark_episode(eid):
    data = request.get_json(silent=True) or {}
    watched = 1 if data.get("watched") else 0
    conn = get_connection()
    before = conn.execute("SELECT * FROM episodes WHERE id=?", (eid,)).fetchone()
    if not before:
        conn.close()
        return jsonify({"error": "Episódio não encontrado."}), 404
    cur = conn.execute("""UPDATE episodes SET watched=?,
        watched_at=CASE WHEN ?=1 THEN datetime('now','localtime') ELSE NULL END WHERE id=?""",
        (watched, watched, eid))
    if watched and not before["watched"]:
        conn.execute("INSERT INTO watch_history(episode_id,show_id,runtime_minutes) VALUES(?,?,?)",
                     (eid, before["show_id"], before["runtime_minutes"]))
    conn.commit()
    if not cur.rowcount:
        conn.close()
        return jsonify({"error": "Episódio não encontrado."}), 404
    row = conn.execute("SELECT * FROM episodes WHERE id=?", (eid,)).fetchone()
    conn.close()
    return jsonify({"episode": dict(row)})


@api_bp.post("/shows/<int:sid>/sync")
def sync(sid):
    conn = get_connection()
    show = conn.execute("SELECT * FROM shows WHERE id=?", (sid,)).fetchone()
    if not show:
        conn.close()
        return jsonify({"error": "Série não encontrada."}), 404
    before = conn.execute("SELECT COUNT(*) FROM episodes WHERE show_id=?", (sid,)).fetchone()[0]
    try:
        sync_show_catalog(conn, show)
        conn.commit()
        after = conn.execute("SELECT COUNT(*) FROM episodes WHERE show_id=?", (sid,)).fetchone()[0]
        conn.close()
        return jsonify({"new_episodes": max(0, after-before), "total": after})
    except requests.RequestException:
        conn.rollback()
        conn.close()
        return jsonify({"error": "Não foi possível sincronizar. Verifique sua internet."}), 502


@api_bp.post("/shows/sync-all")
def sync_all():
    conn = get_connection()
    all_shows = conn.execute("SELECT id, provider_id, name FROM shows ORDER BY name COLLATE NOCASE").fetchall()
    added = []
    failures = []
    for show in all_shows:
        before = conn.execute("SELECT COUNT(*) FROM episodes WHERE show_id=?", (show["id"],)).fetchone()[0]
        try:
            sync_show_catalog(conn, show)
            conn.commit()
            after = conn.execute("SELECT COUNT(*) FROM episodes WHERE show_id=?", (show["id"],)).fetchone()[0]
            if after > before:
                added.append({"show": show["name"], "count": after-before})
        except requests.RequestException:
            conn.rollback()
            failures.append(show["name"])
    conn.close()
    return jsonify({"checked": len(all_shows), "added": added, "failures": failures})


@api_bp.delete("/shows/<int:sid>")
def remove_show(sid):
    conn = get_connection()
    cur = conn.execute("DELETE FROM shows WHERE id=?", (sid,))
    conn.commit()
    conn.close()
    if not cur.rowcount:
        return jsonify({"error": "Série não encontrada."}), 404
    return jsonify({"message": "Série removida."})


@api_bp.patch("/shows/<int:sid>/favorite")
def favorite_show(sid):
    data = request.get_json(silent=True) or {}
    favorite = 1 if data.get("favorite") else 0
    conn = get_connection()
    cur = conn.execute("UPDATE shows SET favorite=? WHERE id=?", (favorite, sid))
    conn.commit()
    conn.close()
    if not cur.rowcount:
        return jsonify({"error": "Série não encontrada."}), 404
    return jsonify({"favorite": bool(favorite)})


@api_bp.post("/shows/<int:sid>/episodes/bulk")
def bulk_episodes(sid):
    data = request.get_json(silent=True) or {}
    watched = 1 if data.get("watched", True) else 0
    season = data.get("season", "__all__")
    conn = get_connection()
    if not conn.execute("SELECT id FROM shows WHERE id=?", (sid,)).fetchone():
        conn.close()
        return jsonify({"error": "Série não encontrada."}), 404
    where = "show_id=?"
    params = [sid]
    if season == "Especial":
        where += " AND season IS NULL"
    elif season != "__all__":
        where += " AND season=?"
        params.append(season)
    if watched:
        conn.execute(f"""INSERT INTO watch_history(episode_id,show_id,runtime_minutes)
            SELECT id,show_id,runtime_minutes FROM episodes WHERE {where} AND watched=0""", params)
    cur = conn.execute(f"""UPDATE episodes SET watched=?,
        watched_at=CASE WHEN ?=1 THEN datetime('now','localtime') ELSE NULL END
        WHERE {where}""", [watched, watched, *params])
    conn.commit()
    count = cur.rowcount
    conn.close()
    return jsonify({"updated": count, "watched": bool(watched)})


@api_bp.get("/calendar")
def calendar():
    conn = get_connection()
    rows = conn.execute("""SELECT h.id history_id, h.watched_at, h.runtime_minutes,
        e.id episode_id,e.name episode_name,e.season,e.number,
        s.id show_id,s.name show_name,s.image_url
        FROM watch_history h
        JOIN episodes e ON e.id=h.episode_id
        JOIN shows s ON s.id=h.show_id
        ORDER BY h.watched_at DESC, s.name COLLATE NOCASE""").fetchall()
    conn.close()
    return jsonify({"episodes": [dict(r) for r in rows]})
