#!/usr/bin/env python3
import datetime, json, os, pathlib, re, sys, threading, time

HQ = pathlib.Path(__file__).resolve().parent
SESSIONS = pathlib.Path.home() / ".claude" / "sessions"
PROJECTS = pathlib.Path.home() / ".claude" / "projects"
INTERVAL = 20
LIVE_SECONDS = 600
WORK_SECONDS = 90
GENERAL = {"raw", "wiki", "outputs", "system", "templates", "inbox", "attachments", "daily"}
EMPTY = {"said": "", "said_at": None, "asked": "", "asked_at": None, "tools": [], "question": "", "options": []}
NOISE = ("<", "This session is being continued", "Base directory for this skill")


def key(text):
    return re.sub(r"[^a-z0-9]", "", str(text).lower())


def team():
    try:
        with open(HQ / "team.json") as f:
            t = json.load(f)
    except (OSError, ValueError):
        t = {}
    vault = HQ / os.path.expanduser(t.get("vault") or "~/vault")
    try:
        names = sorted(p.name for p in vault.iterdir() if p.is_dir() and not p.name.startswith(".") and p.name not in GENERAL)
    except OSError:
        names = []
    return names, {key(k): v for k, v in (t.get("aliases") or {}).items()}


def label(cwd, names, aliases):
    k = key(cwd)
    for alias, name in aliases.items():
        if alias and alias in k:
            return name
    for name in sorted(names, key=len, reverse=True):
        if len(key(name)) >= 3 and key(name) in k:
            return name
    return pathlib.Path(cwd).name


def suffixed(labels):
    counts, out = {}, []
    for name in labels:
        counts[name] = counts.get(name, 0) + 1
        out.append(name if counts[name] == 1 else f"{name} {counts[name]}")
    return out


def alive(pid):
    try:
        os.kill(pid, 0)
        return True
    except (OSError, TypeError):
        return False


def sessions():
    found = []
    for path in SESSIONS.glob("*.json"):
        try:
            meta = json.loads(path.read_text())
        except (OSError, ValueError):
            continue
        if alive(meta.get("pid")) and meta.get("sessionId") and meta.get("cwd"):
            found.append(meta)
    return sorted(found, key=lambda s: (s.get("name") or "", s["sessionId"]))


def transcript(session):
    return PROJECTS / re.sub(r"[^A-Za-z0-9]", "-", session["cwd"]) / f"{session['sessionId']}.jsonl"


def tail(path, size=2_000_000):
    with open(path, "rb") as f:
        f.seek(0, 2)
        end = f.tell()
        f.seek(max(0, end - size))
        data = f.read().decode(errors="ignore")
    lines = data.splitlines()[1:] if end > size else data.splitlines()
    out = []
    for line in lines:
        try:
            out.append(json.loads(line))
        except ValueError:
            pass
    return out


def texts(entry):
    content = (entry.get("message") or {}).get("content")
    if isinstance(content, str):
        return [content]
    if isinstance(content, list):
        return [b.get("text", "") for b in content if isinstance(b, dict) and b.get("type") == "text"]
    return []


def tools(entry):
    content = (entry.get("message") or {}).get("content")
    return [b.get("name", "") for b in content if isinstance(b, dict) and b.get("type") == "tool_use"] if isinstance(content, list) else []


def user_texts(entry):
    return [t for t in texts(entry) if t.strip() and not t.startswith(NOISE)]


def status_word(word):
    word = (word or "").lower()
    if word in ("busy", "shell"):
        return "working"
    if "wait" in word or "input" in word:
        return "waiting"
    return "idle"


def clip(text, limit=120):
    text = " ".join(text.split()).replace("**", "").replace("`", "")
    return text if len(text) <= limit else text[:limit - 1].rstrip() + "…"


def ask_text(block):
    qs = ((block.get("input") or {}).get("questions") or [])
    if not qs:
        return "", []
    q = qs[0]
    options = [{"label": o.get("label", ""), "description": o.get("description", "")} for o in q.get("options") or []]
    text = clip(q.get("question", ""), 120) + " — " + " · ".join(f"{i + 1} {o['label']}" for i, o in enumerate(options))
    return clip(text, 200), options


def recent(path):
    try:
        entries = tail(path)
    except OSError:
        return dict(EMPTY)
    out, used, ask, last_q = dict(EMPTY), [], None, ""
    for e in entries:
        if e.get("type") == "user":
            ts = user_texts(e)
            if ts:
                out["asked"], out["asked_at"] = clip(ts[-1]), e.get("timestamp")
        elif e.get("type") == "assistant":
            ts = [t for t in texts(e) if t.strip()]
            if ts:
                out["said"], out["said_at"] = clip(ts[-1]), e.get("timestamp")
                last_q = clip(ts[-1], 200) if ts[-1].rstrip().endswith("?") else last_q
            used += [t for t in tools(e) if t]
            blocks = (e.get("message") or {}).get("content")
            asks = [b for b in blocks if isinstance(b, dict) and b.get("type") == "tool_use" and b.get("name") == "AskUserQuestion"] if isinstance(blocks, list) else []
            ask = asks[-1] if asks else ask
    out["tools"] = used[-5:]
    out["question"], out["options"] = ask_text(ask) if ask else (last_q or out["said"], [])
    return out


def briefing(path):
    try:
        with open(path, "rb") as f:
            entry = json.loads(f.readline().decode(errors="ignore") or "{}")
    except (OSError, ValueError):
        return "", None
    ts = user_texts(entry) if entry.get("type") == "user" else []
    return (clip(ts[0]), entry.get("timestamp")) if ts else ("", None)


def iso(ms):
    return datetime.datetime.fromtimestamp(ms / 1000).astimezone().isoformat(timespec="seconds") if ms else None


def subagents(session, project, now=None):
    now = time.time() if now is None else now
    folder = transcript(session).with_suffix("") / "subagents"
    rows = []
    for meta_path in sorted(folder.glob("agent-*.meta.json")):
        log = meta_path.with_name(meta_path.name[:-len(".meta.json")] + ".jsonl")
        try:
            meta = json.loads(meta_path.read_text())
            age = now - log.stat().st_mtime
        except (OSError, ValueError):
            continue
        if meta.get("finished") or age > LIVE_SECONDS:
            continue
        r = recent(log)
        r["asked"], r["asked_at"] = briefing(log)
        r["question"], r["options"] = "", []
        rows.append({"id": meta_path.name[len("agent-"):-len(".meta.json")], "parent": session["sessionId"], "project": project,
                     "cwd": session["cwd"], "pid": None, "status": "working" if age < WORK_SECONDS else "idle",
                     "task": r["said"] or meta.get("description", ""), "since": iso(int(meta_path.stat().st_mtime * 1000)),
                     "kind": "subagent", "agent_type": meta.get("agentType", ""), "description": meta.get("description", ""), **r})
    return rows


def snapshot():
    names, aliases = team()
    found = sessions()
    rows = []
    for s, project in zip(found, suffixed([label(s["cwd"], names, aliases) for s in found])):
        r = recent(transcript(s))
        status = status_word(s.get("status"))
        if status != "waiting":
            r["question"], r["options"] = "", []
        rows.append({"id": s["sessionId"], "project": project, "cwd": s["cwd"], "pid": s.get("pid"), "status": status, "task": r["said"],
                     "since": iso(s.get("statusUpdatedAt") or s.get("updatedAt")), "kind": "session", **r})
        rows.extend(subagents(s, project))
    return {"ts": datetime.datetime.now().astimezone().isoformat(timespec="seconds"), "sessions": rows}


def write(state_dir):
    data = snapshot()
    state_dir = pathlib.Path(state_dir)
    state_dir.mkdir(parents=True, exist_ok=True)
    tmp = state_dir / "sessions.tmp"
    tmp.write_text(json.dumps(data))
    tmp.replace(state_dir / "sessions.json")
    return data


def start(state_dir, interval=INTERVAL):
    def loop():
        while True:
            try:
                write(state_dir)
            except Exception:
                pass
            time.sleep(interval)
    threading.Thread(target=loop, daemon=True, name="bridge").start()


def selfcheck():
    import tempfile
    global SESSIONS, PROJECTS, HQ
    assert [status_word(w) for w in ("busy", "shell", "waiting", "needs input", "idle", None, "odd")] == ["working", "working", "waiting", "waiting", "idle", "idle", "idle"]
    assert suffixed(["Apollo", "Zephyr", "Apollo", "Apollo"]) == ["Apollo", "Zephyr", "Apollo 2", "Apollo 3"]
    assert clip("**Done**,  the `fix` is\nin.") == "Done, the fix is in." and len(clip("x" * 300)) == 120
    assert user_texts({"message": {"content": [{"type": "text", "text": "<system-reminder>x</system-reminder>"}, {"type": "tool_result", "content": "y"}]}}) == []
    assert user_texts({"message": {"content": "This session is being continued from x"}}) == [] and user_texts({"message": {"content": "fix it"}}) == ["fix it"]
    assert iso(None) is None and iso(1792733512115).startswith("2026-10-2")
    names = ["Northwind Analytics", "Ledgerly", "Pixel Foundry"]
    assert label("/home/me/code/northwind-analytics", names, {}) == "Northwind Analytics" and label("/srv/LEDGERLY/api", names, {}) == "Ledgerly"
    assert label("/home/me/foundry-game", names, {}) == "foundry-game" and label("/home/me/foundry-game", names, {"foundrygame": "Pixel Foundry"}) == "Pixel Foundry"
    saved = (SESSIONS, PROJECTS, HQ)
    with tempfile.TemporaryDirectory() as tmp:
        tmp = pathlib.Path(tmp)
        SESSIONS, PROJECTS, HQ = tmp / "sessions", tmp / "projects", tmp
        (tmp / "vault" / "Apollo").mkdir(parents=True)
        (tmp / "vault" / "raw").mkdir()
        (tmp / "team.json").write_text(json.dumps({"vault": str(tmp / "vault"), "aliases": {"legacy-shop": "Apollo"}}))
        assert team() == (["Apollo"], {"legacyshop": "Apollo"})
        SESSIONS.mkdir()
        cwd = str(tmp / "work" / "apollo-api")
        (SESSIONS / "1.json").write_text(json.dumps({"pid": os.getpid(), "sessionId": "S1", "cwd": cwd, "name": "api", "status": "waiting", "statusUpdatedAt": 1792733512115}))
        (SESSIONS / "2.json").write_text(json.dumps({"pid": 999999, "sessionId": "S2", "cwd": cwd, "name": "dead", "status": "busy"}))
        (SESSIONS / "3.json").write_text(json.dumps({"pid": os.getpid(), "sessionId": "S3", "cwd": str(tmp / "legacy-shop"), "name": "shop", "status": "busy", "updatedAt": 1792733512115}))
        (SESSIONS / "bad.json").write_text("{")
        folder = PROJECTS / re.sub(r"[^A-Za-z0-9]", "-", cwd)
        sub = folder / "S1" / "subagents"
        sub.mkdir(parents=True)
        brief = {"type": "user", "timestamp": "2026-10-23T08:00:00Z", "message": {"content": "Build the **office** please"}}
        noise = {"type": "user", "timestamp": "2026-10-23T08:01:00Z", "message": {"content": [{"type": "text", "text": "<system-reminder>ignore</system-reminder>"}]}}
        entry = {"type": "assistant", "timestamp": "2026-10-23T08:02:00Z", "message": {"content": [{"type": "text", "text": "Reading the **spec** now"}, {"type": "tool_use", "name": "WebSearch"}, {"type": "tool_use", "name": "Read"}]}}
        q_only = {"type": "assistant", "timestamp": "2026-10-23T08:02:30Z", "message": {"content": [{"type": "text", "text": "Push now or wait for the report?"}]}}
        ask = {"type": "assistant", "timestamp": "2026-10-23T08:03:00Z", "message": {"content": [{"type": "tool_use", "name": "AskUserQuestion", "input": {"questions": [{"question": "Ship today?", "options": [{"label": "Yes (Recommended)", "description": "d1"}, {"label": "Tomorrow", "description": "d2"}]}]}}]}}
        dump = lambda *es: "\n".join(json.dumps(e) for e in es) + "\n"
        (folder / "S1.jsonl").write_text(dump(brief, q_only, entry, ask))
        r = recent(folder / "S1.jsonl")
        assert r["asked"] == "Build the office please" and r["asked_at"] == "2026-10-23T08:00:00Z" and r["said"] == "Reading the spec now" and r["tools"] == ["WebSearch", "Read", "AskUserQuestion"], r
        assert r["question"] == "Ship today? — 1 Yes (Recommended) · 2 Tomorrow" and r["options"][1]["description"] == "d2", r
        (folder / "S1q.jsonl").write_text(dump(brief, q_only, entry))
        assert recent(folder / "S1q.jsonl")["question"] == "Push now or wait for the report?"
        assert recent(folder / "nope.jsonl") == EMPTY and briefing(folder / "nope.jsonl") == ("", None)
        assert len(ask_text({"input": {"questions": [{"question": "x" * 300, "options": [{"label": "y" * 50}]}]}})[0]) <= 200
        for name, meta in (("a1", {"agentType": "general-purpose", "description": "Build X"}), ("a2", {"agentType": "web-fetch", "description": "Fetch", "finished": True}), ("a3", {"agentType": "x", "description": "Old"})):
            (sub / f"agent-{name}.meta.json").write_text(json.dumps(meta))
            (sub / f"agent-{name}.jsonl").write_text(dump(brief, entry, noise))
        old = time.time() - LIVE_SECONDS - 5
        os.utime(sub / "agent-a3.jsonl", (old, old))
        rows = subagents({"sessionId": "S1", "cwd": cwd}, "Apollo 2")
        assert [x["id"] for x in rows] == ["a1"] and rows[0]["parent"] == "S1" and rows[0]["project"] == "Apollo 2" and rows[0]["status"] == "working", rows
        assert rows[0]["task"] == "Reading the spec now" and rows[0]["asked"] == "Build the office please" and rows[0]["agent_type"] == "general-purpose" and rows[0]["question"] == ""
        data = write(tmp / "state")
        saved_json = json.loads((tmp / "state" / "sessions.json").read_text())
        assert saved_json == data and not (tmp / "state" / "sessions.tmp").exists()
        by = {s["id"]: s for s in data["sessions"]}
        assert set(by) == {"S1", "S3", "a1"}, by
        assert by["S1"]["project"] == "Apollo" and by["S1"]["status"] == "waiting" and by["S1"]["question"].startswith("Ship today?") and by["S1"]["since"].startswith("2026-10-2")
        assert by["S3"]["project"] == "Apollo 2" and by["S3"]["status"] == "working" and by["S3"]["question"] == "" and by["S3"]["said"] == "" and by["S3"]["pid"] == os.getpid()
        assert by["a1"]["kind"] == "subagent" and by["a1"]["parent"] == "S1" and by["a1"]["project"] == "Apollo"
        base = {"id", "project", "cwd", "pid", "status", "task", "since", "kind", "tools", "said", "said_at", "asked", "asked_at", "question", "options"}
        assert set(by["S1"]) == base and set(by["a1"]) == base | {"parent", "agent_type", "description"}
    SESSIONS, PROJECTS, HQ = saved
    print("bridge selfcheck ok")


if __name__ == "__main__":
    if "--check" in sys.argv:
        selfcheck()
        sys.exit(0)
    state = HQ / "state"
    data = write(state)
    print(f"bridge: {sum(s['kind'] == 'session' for s in data['sessions'])} sessions, {sum(s['kind'] == 'subagent' for s in data['sessions'])} sub-agents -> {state / 'sessions.json'}")
    if "--once" not in sys.argv:
        while True:
            time.sleep(INTERVAL)
            try:
                write(state)
            except Exception:
                pass
