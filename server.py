#!/usr/bin/env python3
import json, os, re, sys, glob, random, shutil, tempfile, threading, time, urllib.parse, urllib.request
from datetime import datetime, timedelta
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler

HQ = os.path.dirname(os.path.realpath(__file__))
STATE = os.path.join(HQ, "state")
DASH = os.path.join(HQ, "dashboard")
TEAM = os.path.join(HQ, "team.json")
SAMPLES = os.path.join(HQ, "samples")
IDLE_AFTER = timedelta(hours=4)
STALE_AFTER = timedelta(seconds=90)
GENERAL = {"raw", "wiki", "outputs", "system", "templates", "inbox", "attachments", "daily"}
OLLAMA = "http://localhost:11434/api/chat"
DEFAULT_MODEL = "qwen3.5:9b"
CHAT = {"lock": threading.Lock(), "last": 0.0, "cache": {}, "seen": {}, "asks": {}, "call": None}
ALIASES = {}


def read(p, default=None):
    try:
        with open(p) as f:
            return json.load(f)
    except Exception:
        return default


def write(p, data):
    tmp = p + ".tmp"
    with open(tmp, "w") as f:
        json.dump(data, f, indent=2)
    os.replace(tmp, p)


def parse(ts):
    try:
        return datetime.fromisoformat(ts)
    except Exception:
        return None


def key(text):
    return re.sub(r"[^a-z0-9]", "", str(text).lower())


def team_file():
    team = read(TEAM, {}) or {}
    team.setdefault("agents", [])
    team["ceo"] = {"name": "You", "title": "Founder / CEO", **(team.get("ceo") or {})}
    team.setdefault("company", "AI HQ")
    team["vault"] = os.path.join(HQ, os.path.expanduser(team.get("vault") or "~/vault"))
    ALIASES.clear()
    ALIASES.update({key(k): v for k, v in (team.get("aliases") or {}).items()})
    return team


def contractors(now):
    data = read(os.path.join(STATE, "sessions.json"), {}) or {}
    ts = parse(data.get("ts", ""))
    stale = ts is None or now - ts > STALE_AFTER
    out = []
    for s in data.get("sessions", []):
        c = {k: s.get(k) for k in ("id", "project", "cwd", "pid", "status", "task", "since", "parent", "agent_type", "description", "asked", "asked_at", "said", "said_at", "question")}
        c["options"] = s.get("options") or []
        c.update(kind=s.get("kind") or "session", tools=s.get("tools") or [])
        if stale:
            c.update(status="idle", task="no signal")
        out.append(c)
    return out


def clean(bullet):
    bullet = re.sub(r"\[\[([^\]|#]+)(?:#[^\]|]*)?(?:\|[^\]]*)?\]\]", r"\1", bullet)
    return " ".join(bullet.replace("**", "").replace("`", "").split())


def section(text, title):
    m = re.search(r"^## " + re.escape(title) + r"\s*$(.*?)(?=^## |\Z)", text, re.M | re.S)
    return [clean(b) for b in re.findall(r"^- (.+)$", m.group(1), re.M)] if m else []


def project_folders(vault):
    out = []
    try:
        names = sorted(os.listdir(vault))
    except OSError:
        return out
    for name in names:
        folder = os.path.join(vault, name)
        if name.startswith(".") or name in GENERAL or not os.path.isdir(folder):
            continue
        marks = (os.path.join(folder, "Status.md"), os.path.join(folder, name + ".md"), os.path.join(folder, "Decisions.md"), os.path.join(folder, "Decisions log.md"))
        if any(os.path.exists(p) for p in marks):
            out.append(name)
    return out


def read_status(folder):
    try:
        with open(os.path.join(folder, "Status.md")) as f:
            text = f.read()
    except OSError:
        text = ""
    front = re.match(r"\A---\n(.*?)\n---\n", text, re.S)
    synced = re.search(r"^last_synced:\s*(.+)$", front.group(1), re.M) if front else None
    pending = section(text, "Pending")
    progress = section(text, "In progress")
    done = section(text, "Recently done")
    return {"status_line": progress[0] if progress else done[0] if done else "quiet",
            "pending": pending[:5], "pending_total": len(pending), "in_progress": progress,
            "last_done": done[0] if done else "", "last_synced": synced.group(1).strip() if synced else None}


def read_pet(folder, name):
    try:
        with open(os.path.join(folder, name + ".md")) as f:
            front = re.match(r"\A---\n(.*?)\n---\n", f.read(), re.S)
    except OSError:
        return name
    m = re.search(r"^pet:\s*(.+)$", front.group(1), re.M) if front else None
    return m.group(1).strip().strip("\"'") or name if m else name


def match_project(label, names):
    k = key(re.sub(r" \d+$", "", label or ""))
    if k in ALIASES and ALIASES[k] in names:
        return ALIASES[k]
    for name in names:
        if key(name) == k:
            return name
    return None


def projects(team, agents, sessions):
    vault = team["vault"]
    names = project_folders(vault)
    people = {name: [] for name in names}
    lab = []
    for a in agents:
        wanted = a.get("projects") or []
        targets = names if "all" in wanted else [p for p in (match_project(w, names) for w in wanted) if p]
        for p in targets:
            people[p].append(a["id"])
        if not targets:
            lab.append(a["id"])
    pets = {name: read_pet(os.path.join(vault, name), name) for name in names}
    leads, juniors = {}, {}
    for s in sorted(sessions, key=lambda s: s.get("kind") == "subagent"):
        p = match_project(s.get("project"), names)
        suffix = re.search(r" \d+$", s.get("project") or "")
        s["label"] = (pets[p] + (suffix.group(0) if suffix else "")) if p else s.get("project")
        if s.get("kind") == "subagent":
            n = juniors[s.get("parent")] = juniors.get(s.get("parent"), 0) + 1
            s["label"] = leads.get(s.get("parent"), s["label"]) + " jr" + (f" {n}" if n > 1 else "")
        else:
            leads[s["id"]] = s["label"]
        (people[p] if p else lab).append(s["id"])
    out = [{"name": name, "pet": pets[name], **read_status(os.path.join(vault, name)), "people": people[name]} for name in names]
    if lab:
        out.append({"name": "Lab", "pet": "Lab", "status_line": "quiet", "pending": [], "pending_total": 0, "in_progress": [],
                    "last_done": "", "last_synced": None, "people": lab})
    return out


def person_context(pid, st):
    projects = [p for p in st["projects"] if pid in p["people"]]
    agent = next((a for a in st["agents"] if a["id"] == pid), None)
    if agent:
        return {"id": pid, "name": agent.get("name", pid), "role": "HQ agent, " + (agent.get("role") or "generalist"), "projects": projects[:2], "said": agent.get("task") or "", "tools": []}
    c = next((c for c in st["contractors"] if c["id"] == pid), None)
    if not c:
        return None
    role = "junior sub-agent" if c.get("kind") == "subagent" else "lead developer (Claude Code session)"
    return {"id": pid, "name": c.get("label") or c.get("project") or pid, "role": role, "projects": projects[:1], "said": c.get("said") or c.get("task") or "", "tools": c.get("tools") or []}


def describe(ctx):
    lines = [f"{ctx['name']}: {ctx['role']}."]
    for p in ctx["projects"]:
        lines.append(f"Project {p['pet']}: {p['status_line']}. In progress: {'; '.join(p['in_progress'][:2]) or 'nothing noted'}. Pending: {'; '.join(p['pending'][:3]) or 'nothing'}.")
    if ctx["said"]:
        lines.append(f"Last thing they said: {ctx['said']}")
    if ctx["tools"]:
        lines.append("Recent tools: " + ", ".join(ctx["tools"]))
    return "\n".join(lines)


def chat_prompt(a, b, company):
    junior = next((c for c in (a, b) if "junior" in c["role"]), None)
    ask = f" {junior['name']} is a junior and asks the other what they have done today." if junior else ""
    system = (f"You write short office small talk between two colleagues at {company}. Each speaks in the first person about what they are doing today. "
              "Write 4 to 6 lines, alternating speakers, each line at most 110 characters, formatted exactly as 'Name: @OtherName text' (the text starts with @ and the name of the colleague addressed). "
              "Use the two names exactly as written below. Include one question about the other's work or experience today, one concrete suggestion or recommendation, and one thing somebody learned. No narration, no markdown.")
    user = f"{describe(a)}\n\n{describe(b)}\n\n{a['name']} speaks first.{ask}"
    return [{"role": "system", "content": system}, {"role": "user", "content": user}]


def parse_chat(text, a, b):
    text = re.sub(r"<think>.*?</think>", "", text or "", flags=re.S)
    names = {key(a["name"]): a["id"], key(b["name"]): b["id"]}
    lines = []
    for raw in text.splitlines():
        m = re.match(r"\s*[-*\d.)]*\s*\**([^:*]{1,40})\**\s*:\s*(.+)", raw)
        if not m:
            continue
        k = key(m.group(1))
        who = names.get(k) or next((v for n, v in names.items() if len(k) >= 3 and (n.startswith(k) or k.startswith(n))), None)
        if not who:
            continue
        lines.append({"who": who, "text": " ".join(m.group(2).split()).strip('"')})
    return lines[:6]


def ollama(messages, model, timeout=20):
    body = json.dumps({"model": model, "messages": messages, "stream": False, "think": False, "options": {"num_ctx": 4096, "temperature": 0.9}}).encode()
    req = urllib.request.Request(OLLAMA, data=body, headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return json.load(resp)["message"]["content"]


CANNED = [
    ["How is your day going so far?", "Busy. I spent the morning on {pa} and only now got to the fun part.", "Same here. One tip: write the test before the fix, it saved me an hour today.", "Noted. I learned today that reading the logs first beats guessing every time."],
    ["Did you get anywhere with {pa}?", "Slowly. What did you ship today?", "A small fix and a lot of reading. Try splitting the task in two, it worked for me.", "Good idea. Lesson of the day: the smallest diff wins."],
    ["Quick question, how do you keep the status page honest?", "I update it right after each step, otherwise I forget.", "I will do the same. Also, have you tried the new search tool?", "Not yet. Today I learned that a five minute break fixes more bugs than coffee."],
    ["Anything blocked on your side?", "One card is waiting for approval, the rest moves.", "Mine too. Suggestion: batch the questions so the boss decides once.", "Smart. I learned today that asking early costs less than asking late."],
]


def canned(messages):
    a, b = re.findall(r"^(.+?): (?:HQ agent|junior|lead developer)", messages[1]["content"], re.M)[:2]
    pa = (re.search(r"Project (.+?):", messages[1]["content"]) or [None, "the project"])[1]
    turns = random.choice(CANNED)
    return "\n".join(f"{(a, b)[i % 2]}: @{(b, a)[i % 2]} {t.format(pa=pa)}" for i, t in enumerate(turns))


def stamp(now, i=0):
    return (now + timedelta(milliseconds=i)).isoformat(timespec="milliseconds")


def log_messages(msgs):
    with open(os.path.join(STATE, "chat.jsonl"), "a") as f:
        for m in msgs:
            f.write(json.dumps(m) + "\n")


def chat_log(after=None, limit=100):
    rows = []
    try:
        with open(os.path.join(STATE, "chat.jsonl")) as f:
            for line in f:
                try:
                    rows.append(json.loads(line))
                except ValueError:
                    pass
    except OSError:
        return []
    if after:
        rows = [r for r in rows if r.get("ts", "") > after]
    return rows[-limit:]


def thread_messages(a, b, lines, now, place):
    names = {a["id"]: a["name"], b["id"]: b["name"]}
    chat_id = f"{now:%H%M%S}-{a['id'][:6]}"
    msgs, prev = [], None
    for i, l in enumerate(lines):
        to = b["id"] if l["who"] == a["id"] else a["id"]
        text = re.sub(r"^@\S+(?: \d+| [AB]\b)?\s*", "", l["text"]) if l["text"].startswith("@") else l["text"]
        text = f"@{names[to]} {text}"
        m = {"ts": stamp(now, i), "chat_id": chat_id, "who": l["who"], "who_name": names[l["who"]], "to": to, "to_name": names[to], "reply_to": prev, "text": text, "place": place}
        msgs.append(m)
        prev = m["ts"]
    return msgs


def track_visits(sessions, ceo_name, now):
    names = {s["id"]: s.get("label") or s.get("project") or s["id"] for s in sessions}
    msgs = []
    for i, s in enumerate(sessions):
        seen = CHAT["seen"].get(s["id"])
        pair = (s.get("asked_at"), s.get("said_at"))
        CHAT["seen"][s["id"]] = pair
        if seen is None or seen == pair:
            continue
        by = s.get("parent") if s.get("kind") == "subagent" and s.get("parent") in names else "ceo"
        by_name = names.get(by, ceo_name)
        if pair[0] != seen[0] and s.get("asked"):
            m = {"ts": stamp(now, i * 2), "chat_id": f"visit-{s['id'][:6]}-{pair[0]}", "who": by, "who_name": by_name, "to": s["id"], "to_name": names[s["id"]], "reply_to": None, "text": f"@{names[s['id']]} {s['asked']}", "place": "desk"}
            CHAT["asks"][s["id"]] = m
            msgs.append(m)
        if pair[1] != seen[1] and s.get("said"):
            ask = CHAT["asks"].get(s["id"])
            msgs.append({"ts": stamp(now, i * 2 + 1), "chat_id": ask["chat_id"] if ask else f"visit-{s['id'][:6]}-{pair[1]}", "who": s["id"], "who_name": names[s["id"]], "to": by, "to_name": by_name,
                         "reply_to": ask["ts"] if ask else None, "text": f"@{by_name} {s['said']}", "place": "desk"})
    if msgs:
        log_messages(msgs)
    return msgs


def chat(aid, bid, st=None, call=None, now=None, place=""):
    now = now or datetime.now().astimezone()
    st = st or state()
    a, b = person_context(aid, st), person_context(bid, st)
    if not a or not b or aid == bid:
        return {"lines": [], "why": "unknown"}
    k = tuple(sorted((aid, bid)))
    hit = CHAT["cache"].get(k)
    if hit and now.timestamp() - hit[0] < 600:
        return {"lines": hit[1], "cached": True}
    if now.timestamp() - CHAT["last"] < 45 or not CHAT["lock"].acquire(blocking=False):
        return {"lines": [], "why": "busy"}
    try:
        CHAT["last"] = now.timestamp()
        call = call or CHAT["call"] or (lambda m: ollama(m, st.get("model") or DEFAULT_MODEL))
        try:
            lines = parse_chat(call(chat_prompt(a, b, st.get("company") or "AI HQ")), a, b)
        except Exception:
            lines = []
        if len(lines) >= 2:
            msgs = thread_messages(a, b, lines, now, place)
            lines = [{"who": m["who"], "text": m["text"]} for m in msgs]
            CHAT["cache"][k] = (now.timestamp(), lines)
            log_messages(msgs)
        return {"lines": lines}
    finally:
        CHAT["lock"].release()


def state():
    now = datetime.now().astimezone()
    team = team_file()
    agents = []
    for a in team["agents"]:
        s = read(os.path.join(STATE, "agents", f"{a['id']}.json"), {}) or {}
        status = s.get("status", "idle")
        upd = parse(s.get("updated", ""))
        if status == "done" and upd and now - upd > IDLE_AFTER:
            status = "idle"
        agents.append({**a, "status": status, "task": s.get("task", ""), "updated": s.get("updated")})

    cards, queue = [], []
    week_ago = now - timedelta(days=7)
    for p in glob.glob(os.path.join(STATE, "cards", "*.json")):
        c = read(p)
        if not c:
            continue
        created = parse(c.get("created", ""))
        if c["status"] in ("pending", "hold") or (created and created > week_ago):
            cards.append(c)
    for p in glob.glob(os.path.join(STATE, "queue", "*.json")):
        q = read(p)
        if q and q.get("status") == "open":
            queue.append(q)
    sessions = contractors(now)
    out = {"ceo": team["ceo"], "company": team["company"], "credit": team.get("credit"), "model": team.get("ollama_model") or DEFAULT_MODEL, "agents": agents, "contractors": sessions,
           "sessions_ts": (read(os.path.join(STATE, "sessions.json"), {}) or {}).get("ts"),
           "projects": projects(team, agents, sessions), "cards": cards, "queue": queue, "now": now.isoformat(timespec="seconds")}
    track_visits(sessions, team["ceo"]["name"], now)
    return out


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *a, **kw):
        super().__init__(*a, directory=DASH, **kw)

    def log_message(self, *a):
        pass

    def send_json(self, data, code=200):
        body = json.dumps(data).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        if self.path.startswith("/api/state"):
            return self.send_json(state())
        if self.path.startswith("/api/chat/log"):
            q = dict(re.findall(r"(after)=([\w:.+-]+)", self.path.split("?", 1)[1] if "?" in self.path else ""))
            return self.send_json({"messages": chat_log(q.get("after"))})
        if self.path.startswith("/api/chat?"):
            q = dict(re.findall(r"([ab]|place)=([^&]*)", self.path.split("?", 1)[1]))
            return self.send_json(chat(q.get("a", ""), q.get("b", ""), place=urllib.parse.unquote(q.get("place", ""))[:40]))
        return super().do_GET()

    def do_POST(self):
        parts = self.path.strip("/").split("/")
        if len(parts) != 3 or parts[:2] != ["api", "cards"] or not parts[2].isalnum():
            return self.send_json({"error": "not found"}, 404)
        p = os.path.join(STATE, "cards", f"{parts[2]}.json")
        c = read(p)
        if not c:
            return self.send_json({"error": "card not found"}, 404)
        try:
            body = json.loads(self.rfile.read(int(self.headers.get("Content-Length", 0))) or b"{}")
        except Exception:
            return self.send_json({"error": "bad json"}, 400)
        decision = body.get("decision")
        if decision not in ("approved", "rejected", "hold"):
            return self.send_json({"error": "decision must be approved, rejected or hold"}, 400)
        c.update({"status": decision, "note": str(body.get("note", ""))[:2000],
                  "decided": datetime.now().astimezone().isoformat(timespec="seconds"), "acked": False})
        write(p, c)
        return self.send_json(c)


DEMO_TALK = [("Can you push the fix today?", "Yes, tests are green, pushing after lunch."), ("How far is the migration?", "Two tables left, done by tonight."),
             ("Did the client reply?", "Not yet, I drafted a follow-up for you to approve."), ("What broke in staging?", "A missing index, already fixed and deployed."),
             ("Can we ship the new onboarding this week?", "Yes if design signs off tomorrow."), ("Any blockers?", "None, just waiting on one card.")]


def today_text(text):
    return re.sub(r"\d{4}-\d{2}-\d{2}T", datetime.now().strftime("%Y-%m-%dT"), text)


def demo_setup():
    global STATE, TEAM
    STATE = tempfile.mkdtemp(prefix="hq-demo-")
    TEAM = os.path.join(SAMPLES, "team.json")
    for d in ("agents", "cards", "queue"):
        os.makedirs(os.path.join(STATE, d))
    for name in ("sessions.json", "chat.jsonl"):
        with open(os.path.join(SAMPLES, name)) as src, open(os.path.join(STATE, name), "w") as dst:
            dst.write(today_text(src.read()))
    for sub in ("cards", "agents"):
        for p in glob.glob(os.path.join(SAMPLES, sub, "*.json")):
            with open(p) as src, open(os.path.join(STATE, sub, os.path.basename(p)), "w") as dst:
                dst.write(today_text(src.read()))
    if not os.environ.get("OLLAMA"):
        CHAT["call"] = canned
    return STATE


def demo_tick(n):
    now = datetime.now().astimezone()
    path = os.path.join(STATE, "sessions.json")
    data = read(path, {"sessions": []})
    data["ts"] = now.isoformat(timespec="seconds")
    live = [s for s in data["sessions"] if s["kind"] == "session" and s["status"] == "working"]
    if live and n > 1:
        s = live[(n // 2) % len(live)]
        ask, reply = DEMO_TALK[(n // 2) % len(DEMO_TALK)]
        if n % 2 == 0:
            s.update(asked=ask, asked_at=now.isoformat(timespec="seconds"))
        else:
            s.update(said=reply, said_at=now.isoformat(timespec="seconds"), task=reply)
    write(path, data)
    for p in glob.glob(os.path.join(STATE, "agents", "*.json")):
        a = read(p, {}) or {}
        a["updated"] = now.isoformat(timespec="seconds")
        write(p, a)
    return data


def demo_loop():
    n = 0
    while True:
        try:
            demo_tick(n)
        except Exception:
            pass
        n += 1
        time.sleep(20)


def selfcheck():
    text = "---\ntags: [x]\nlast_synced: 2026-10-20 15:00\n---\n# P\n\n## In progress\n- **mod 1.0** waiting [[P/2026-10-20]]\n  - nested\n\n## Pending\n- a\n- b `c`\n- d\n- e\n- f\n- g\n\n## Recently done\n- 2026-10-20 shipped [[P/2026-10-20|note]]\n"
    global STATE, TEAM
    saved = (STATE, TEAM)
    with tempfile.TemporaryDirectory() as tmp:
        for d in ("Apollo", "Zephyr", "Lonely", "raw"):
            os.makedirs(os.path.join(tmp, d))
        with open(os.path.join(tmp, "Apollo", "Status.md"), "w") as f:
            f.write(text)
        with open(os.path.join(tmp, "Zephyr", "Zephyr.md"), "w") as f:
            f.write("hub")
        with open(os.path.join(tmp, "Apollo", "Apollo.md"), "w") as f:
            f.write("---\ntags: [apollo, hub]\npet: Rocket\n---\n# Apollo\n")
        with open(os.path.join(tmp, "raw", "Status.md"), "w") as f:
            f.write("x")
        assert project_folders(tmp) == ["Apollo", "Zephyr"], project_folders(tmp)
        st = read_status(os.path.join(tmp, "Apollo"))
        assert st["status_line"] == "mod 1.0 waiting P/2026-10-20" and st["pending_total"] == 6 and st["pending"] == ["a", "b c", "d", "e", "f"]
        assert st["last_done"] == "2026-10-20 shipped P/2026-10-20" and st["last_synced"] == "2026-10-20 15:00"
        empty = read_status(os.path.join(tmp, "Zephyr"))
        assert empty["status_line"] == "quiet" and empty["pending"] == [] and empty["last_synced"] is None
        ALIASES.clear(); ALIASES.update({"zeph": "Zephyr"})
        team = {"vault": tmp, "agents": [{"id": "pulse", "projects": ["all"]}, {"id": "forge", "projects": ["Zephyr", "Apollo", "Gone"]}, {"id": "shelf", "projects": ["Nope"]}]}
        sessions = [{"id": "s1", "project": "Apollo"}, {"id": "j1", "project": "Apollo 2", "kind": "subagent", "parent": "s2"}, {"id": "s2", "project": "Apollo 2"},
                    {"id": "s3", "project": "Nowhere"}, {"id": "s4", "project": "zeph"}, {"id": "j2", "project": "Apollo 2", "kind": "subagent", "parent": "s2"}]
        ps = {p["name"]: p for p in projects(team, team["agents"], sessions)}
        assert ps["Apollo"]["people"] == ["pulse", "forge", "s1", "s2", "j1", "j2"] and ps["Zephyr"]["people"] == ["pulse", "forge", "s4"], ps
        assert ps["Lab"]["people"] == ["shelf", "s3"] and ps["Lab"]["status_line"] == "quiet"
        assert ps["Apollo"]["pet"] == "Rocket" and ps["Zephyr"]["pet"] == "Zephyr", ps
        assert [s["label"] for s in sessions] == ["Rocket", "Rocket 2 jr", "Rocket 2", "Nowhere", "Zephyr", "Rocket 2 jr 2"], sessions
        assert match_project("Apollo 3", ["Apollo"]) == "Apollo" and match_project("", ["Apollo"]) is None
        ALIASES.clear()
        STATE = tmp
        TEAM = os.path.join(tmp, "team.json")
        assert team_file()["ceo"] == {"name": "You", "title": "Founder / CEO"} and team_file()["company"] == "AI HQ"
        write(TEAM, {"ceo": {"name": "Alex"}, "company": "Northstar", "vault": tmp, "aliases": {"old-name": "Apollo"}})
        t = team_file()
        assert t["ceo"] == {"name": "Alex", "title": "Founder / CEO"} and ALIASES == {"oldname": "Apollo"} and t["vault"] == tmp
        now = datetime.now().astimezone()
        assert contractors(now) == []
        fresh = {"ts": now.isoformat(timespec="seconds"), "sessions": [{"id": "a", "project": "Zephyr", "cwd": "/r", "pid": 1, "status": "working", "task": "t", "since": None},
                 {"id": "b", "parent": "a", "project": "Zephyr", "cwd": "/r", "pid": None, "status": "idle", "task": "sub", "since": None, "kind": "subagent", "agent_type": "general-purpose", "description": "d", "tools": ["WebSearch"]}]}
        write(os.path.join(STATE, "sessions.json"), fresh)
        rows = contractors(now)
        assert rows[0]["status"] == "working" and rows[0]["kind"] == "session" and rows[0]["tools"] == [] and rows[0]["parent"] is None and rows[0]["said"] is None
        assert rows[1]["kind"] == "subagent" and rows[1]["parent"] == "a" and rows[1]["tools"] == ["WebSearch"], rows
        write(os.path.join(STATE, "sessions.json"), {**fresh, "ts": (now - timedelta(seconds=120)).isoformat(timespec="seconds")})
        assert contractors(now)[0]["status"] == "idle" and contractors(now)[0]["task"] == "no signal"
        write(os.path.join(STATE, "sessions.json"), fresh)
        os.makedirs(os.path.join(STATE, "cards"))
        write(os.path.join(STATE, "cards", "c1.json"), {"id": "c1", "agent": "pulse", "status": "pending", "created": now.isoformat(timespec="seconds")})
        full = state()
        assert full["company"] == "Northstar" and full["ceo"]["name"] == "Alex" and len(full["cards"]) == 1 and [c["label"] for c in full["contractors"]] == ["Zephyr", "Zephyr jr"]
        assert full["projects"][0]["name"] == "Apollo" and full["projects"][1]["people"] == ["a", "b"]

        st = {"agents": [{"id": "pulse", "name": "Pulse", "role": "Project manager", "task": "daily brief"}], "company": "Northstar",
              "contractors": [{"id": "s1", "label": "Rocket", "kind": "session", "said": "Shipped the hotfix", "tools": ["Edit", "Bash"]}, {"id": "j1", "label": "Rocket jr", "kind": "subagent", "parent": "s1", "task": "Reading"}],
              "projects": [{"name": "Apollo", "pet": "Rocket", "status_line": "mod 1.0 waiting", "in_progress": ["mod 1.0 waiting"], "pending": ["a", "b"], "people": ["pulse", "s1", "j1"]}]}
        a, b = person_context("j1", st), person_context("s1", st)
        assert a["role"] == "junior sub-agent" and b["name"] == "Rocket" and person_context("pulse", st)["role"] == "HQ agent, Project manager" and person_context("nope", st) is None
        msgs = chat_prompt(a, b, "Northstar")
        assert "at Northstar" in msgs[0]["content"] and "Rocket jr speaks first" in msgs[1]["content"] and "is a junior and asks" in msgs[1]["content"] and "Pending: a; b" in msgs[1]["content"]
        text = "<think>plan</think>\n**Rocket jr**: What did you ship today?\n1. Rocket: The hotfix, " + "x" * 120 + "\nNarrator: ignored\nrocket jr: Nice, I learned to read the logs first.\n"
        lines = parse_chat(text, a, b)
        assert [l["who"] for l in lines] == ["j1", "s1", "j1"] and lines[0]["text"] == "What did you ship today?" and len(lines[1]["text"]) == 132, lines
        loose = parse_chat("Rocket jr: @Rocket hi\nRocket: @Colleague A hello\nSomeone: @Rocket and again\nNarrator: x", a, b)
        assert [l["who"] for l in loose] == ["j1", "s1"] and loose[0]["text"] == "@Rocket hi", loose
        tm = thread_messages(a, b, loose, datetime(2026, 10, 23, 12, 30).astimezone(), "gym")
        assert [m["text"] for m in tm] == ["@Rocket hi", "@Rocket jr hello"], tm
        can = parse_chat(canned(msgs), a, b)
        assert len(can) == 4 and [l["who"] for l in can] == ["j1", "s1", "j1", "s1"] and can[0]["text"].startswith("@Rocket ") and "{" not in "".join(l["text"] for l in can), can
        CHAT.update(last=0.0, cache={}, seen={}, asks={}, call=None)
        when = datetime(2026, 10, 23, 12, 30).astimezone()
        out = chat("j1", "s1", st, lambda m: text, when, "pantry")
        assert len(out["lines"]) == 3 and out["lines"][0]["text"] == "@Rocket What did you ship today?" and chat("s1", "j1", st, lambda m: "nope", when)["cached"]
        log = chat_log()
        assert [m["who"] for m in log] == ["j1", "s1", "j1"] and log[1]["reply_to"] == log[0]["ts"] and log[0]["reply_to"] is None and log[2]["place"] == "pantry" and log[1]["text"].startswith("@Rocket jr ")
        assert len({m["chat_id"] for m in log}) == 1 and chat_log(after=log[1]["ts"]) == [log[2]] and chat_log(limit=2) == log[1:]
        rows = [{"id": "s1", "label": "Rocket", "kind": "session", "asked": "fix it", "asked_at": "t1", "said": "on it", "said_at": "t2"}, {"id": "j1", "label": "Rocket jr", "kind": "subagent", "parent": "s1", "asked": "brief", "asked_at": "b1", "said": "ok", "said_at": "b2"}]
        assert track_visits(rows, "Alex", when) == [] and track_visits(rows, "Alex", when) == []
        rows[0].update(asked="push it", asked_at="t3")
        v = track_visits(rows, "Alex", when + timedelta(seconds=1))
        assert len(v) == 1 and v[0]["who"] == "ceo" and v[0]["who_name"] == "Alex" and v[0]["text"] == "@Rocket push it" and v[0]["to"] == "s1"
        rows[0].update(said="pushed", said_at="t4"); rows[1].update(said="done", said_at="b3")
        v = track_visits(rows, "Alex", when + timedelta(seconds=2))
        assert [m["who"] for m in v] == ["s1", "j1"] and v[0]["reply_to"] == chat_log()[-3]["ts"] and v[0]["text"] == "@Alex pushed" and v[1]["to_name"] == "Rocket" and v[1]["text"] == "@Rocket done"
        assert len(chat_log()) == 6
        assert chat("pulse", "s1", st, lambda m: text, when)["why"] == "busy" and chat("pulse", "s1", st, lambda m: (_ for _ in ()).throw(OSError()), when + timedelta(seconds=50)) == {"lines": []}
        CHAT.update(last=0.0, cache={}, seen={}, asks={}, call=None)
    STATE, TEAM = saved
    demo = demo_setup()
    try:
        d0 = read(os.path.join(demo, "sessions.json"))
        assert d0["ts"].startswith(datetime.now().strftime("%Y-%m-%d")) and len(d0["sessions"]) >= 14 and CHAT["call"] is canned
        full = state()
        assert len(full["projects"]) == 20 and full["ceo"]["name"] == "Alex Mercer" and full["company"] == "LOUWARD LABS" and full["credit"]["url"] == "https://louward.com" and len(full["cards"]) == 3
        assert sum(c["status"] == "waiting" for c in full["contractors"]) >= 1 and all(c["task"] != "no signal" for c in full["contractors"])
        assert all(match_project(c["project"], [p["name"] for p in full["projects"]]) for c in full["contractors"]), [c["project"] for c in full["contractors"]]
        assert any(a["status"] == "working" for a in full["agents"]) and len(chat_log()) >= 9
        before = {s["id"]: (s.get("asked"), s.get("said")) for s in d0["sessions"]}
        demo_tick(0); d1 = demo_tick(2); d2 = demo_tick(3)
        changed = [s["id"] for s in d2["sessions"] if (s.get("asked"), s.get("said")) != before[s["id"]]]
        assert d1["ts"] >= d0["ts"] and len(changed) == 1 and parse(read(glob.glob(os.path.join(demo, "agents", "*.json"))[0])["updated"]) is not None, changed
        CHAT.update(last=0.0, cache={}, seen={}, asks={})
        out = chat(full["agents"][0]["id"], full["contractors"][0]["id"], full)
        assert len(out["lines"]) == 4, out
    finally:
        shutil.rmtree(demo, ignore_errors=True)
        STATE, TEAM = saved
        CHAT.update(last=0.0, cache={}, seen={}, asks={}, call=None)
    print("selfcheck ok")


if __name__ == "__main__":
    if "--check" in sys.argv:
        selfcheck()
        sys.exit(0)
    port = int(sys.argv[sys.argv.index("--port") + 1]) if "--port" in sys.argv else 4747
    if "--demo" in sys.argv:
        demo_setup()
        threading.Thread(target=demo_loop, daemon=True).start()
        print(f"Demo mode: sample vault, team and sessions (state in {STATE})")
    else:
        for d in ("agents", "cards", "queue"):
            os.makedirs(os.path.join(STATE, d), exist_ok=True)
        if "--bridge" in sys.argv:
            import bridge
            bridge.start(STATE)
            print("Bridge: Claude Code sessions -> state/sessions.json every 20 s")
    print(f"HQ dashboard: http://localhost:{port}  (Ctrl+C to stop)")
    ThreadingHTTPServer(("127.0.0.1", port), Handler).serve_forever()
