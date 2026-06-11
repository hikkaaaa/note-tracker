"""One-shot recovery of the orphaned 'Arrays' and 'Environments' notes.

Reads the two orphaned notes (their block rows already live in note_tracker.db with
no parent note/folder) and:
  1. exports a readable standalone .html for each (safety net), and
  2. re-inserts them as real folders + notes + sections owned by user 1 (hixie_owner),
     giving every copied section a brand-new id and remapping the layout block-order
     so nothing collides with existing rows. Existing orphan rows are left untouched.
"""
import json
import html
import sqlite3
import os

DB = os.path.expanduser("~/Desktop/note-tracker/backend/note_tracker.db")
OUT = os.path.expanduser("~/Desktop/note-tracker/recovered")
USER_ID = 1  # hixie_owner

# (orphan note_id, new note title, folder name, folder purpose, folder color)
TARGETS = [
    (1779886949741, "Arrays", "Big Tech Preparation", "FAANG / interview prep", "indigo"),
    (1780239984990, "Environments", "Software", "Engineering & deployment notes", "sky"),
]


def fetch_sections(conn, note_id):
    rows = conn.execute(
        "SELECT id, type, content, title FROM sections WHERE note_id=? ORDER BY id", (note_id,)
    ).fetchall()
    return [dict(id=r[0], type=r[1], content=r[2] or "", title=r[3]) for r in rows]


def layout_order(sections):
    """Return the list of block ids in display order from the note's layout row,
    then append any blocks the layout didn't mention."""
    layout = next((s for s in sections if s["type"] == "layout"), None)
    ordered = []
    if layout:
        try:
            for row in json.loads(layout["content"]):
                for bid in row:
                    ordered.append(int(bid))
        except Exception:
            pass
    present = {s["id"] for s in sections}
    # keep only ids that actually exist, then append any non-layout blocks not listed
    ordered = [i for i in ordered if i in present]
    for s in sections:
        if s["type"] != "layout" and s["id"] not in ordered:
            ordered.append(s["id"])
    return ordered


# ---------- READABLE HTML EXPORT ----------
def render_block(s):
    t, c = s["type"], s["content"]
    title = f'<div class="bt">{html.escape(s["title"])}</div>' if s.get("title") else ""
    if t in ("text", "table"):
        return title + c  # already HTML
    if t == "code":
        try:
            d = json.loads(c)
            lang = html.escape(d.get("language", ""))
            code = html.escape(d.get("code", ""))
            return f'{title}<div class="lang">{lang}</div><pre><code>{code}</code></pre>'
        except Exception:
            return title + f"<pre><code>{html.escape(c)}</code></pre>"
    if t == "list":
        try:
            d = json.loads(c)
            tag = "ol" if str(d.get("style", "")).strip() not in ("bullet", "") else "ul"
            items = "".join(f"<li>{it.get('text','')}</li>" for it in d.get("items", []))
            return f"{title}<{tag}>{items}</{tag}>"
        except Exception:
            return title + c
    if t in ("checklist", "tickbox"):
        try:
            items = json.loads(c)
            lis = "".join(
                f'<li>{"☑" if it.get("checked") else "☐"} {it.get("text","")}</li>'
                for it in items
            )
            return f'{title}<ul class="chk">{lis}</ul>'
        except Exception:
            return title + c
    if t == "image":
        try:
            d = json.loads(c)
            src = d.get("src") or d.get("url") or ""
            if src:
                return f'{title}<img src="{html.escape(src)}" style="max-width:100%">'
        except Exception:
            pass
        return title + "<p><em>[image]</em></p>"
    return title + html.escape(c)


def export_html(title, sections, order_ids, path):
    by_id = {s["id"]: s for s in sections}
    body = "\n".join(render_block(by_id[i]) for i in order_ids if i in by_id)
    doc = f"""<!doctype html><html><head><meta charset="utf-8"><title>{html.escape(title)}</title>
<style>body{{font-family:Geist,system-ui,sans-serif;max-width:820px;margin:40px auto;padding:0 20px;line-height:1.55;color:#1B1326}}
pre{{background:#1B1326;color:#FBF7F2;padding:14px;border-radius:10px;overflow:auto}}
code{{font-family:ui-monospace,Menlo,monospace;font-size:13px}}
.lang{{font-size:12px;font-weight:700;color:#7758A3;margin-top:14px}}
.bt{{font-weight:700;margin-top:18px}}
table{{border-collapse:collapse}}td,th{{border:1px solid #ccc;padding:6px}}
ul.chk{{list-style:none;padding-left:0}}</style></head>
<body><h1>{html.escape(title)}</h1>{body}</body></html>"""
    with open(path, "w", encoding="utf-8") as f:
        f.write(doc)


# ---------- MAIN ----------
conn = sqlite3.connect(DB)
conn.execute("BEGIN")
try:
    summary = []
    for note_id, title, fname, fpurpose, fcolor in TARGETS:
        sections = fetch_sections(conn, note_id)
        order = layout_order(sections)

        # 1) export readable file
        path = os.path.join(OUT, f"{title.lower()}.html")
        export_html(title, sections, order, path)

        # 2) folder (reuse if a folder with this name already exists for the user)
        row = conn.execute(
            "SELECT id FROM folders WHERE name=? AND user_id=?", (fname, USER_ID)
        ).fetchone()
        if row:
            folder_id = row[0]
        else:
            cur = conn.execute(
                "INSERT INTO folders (name, purpose, color, user_id) VALUES (?,?,?,?)",
                (fname, fpurpose, fcolor, USER_ID),
            )
            folder_id = cur.lastrowid

        # 3) note (fresh auto id)
        cur = conn.execute(
            "INSERT INTO notes (title, purpose, folder_id) VALUES (?,?,?)",
            (title, None, folder_id),
        )
        new_note_id = cur.lastrowid

        # 4) copy every non-layout block with a fresh id, build old->new map
        id_map = {}
        for s in sections:
            if s["type"] == "layout":
                continue
            cur = conn.execute(
                "INSERT INTO sections (note_id, type, content, title) VALUES (?,?,?,?)",
                (new_note_id, s["type"], s["content"], s["title"]),
            )
            id_map[s["id"]] = cur.lastrowid

        # 5) remap + insert the layout block last
        layout = next((s for s in sections if s["type"] == "layout"), None)
        if layout:
            try:
                grid = json.loads(layout["content"])
                grid = [[id_map.get(int(b), int(b)) for b in row] for row in grid]
                new_layout = json.dumps(grid)
            except Exception:
                new_layout = layout["content"]
            conn.execute(
                "INSERT INTO sections (note_id, type, content, title) VALUES (?,?,?,?)",
                (new_note_id, "layout", new_layout, layout["title"]),
            )

        summary.append((title, fname, folder_id, new_note_id, len(id_map) + (1 if layout else 0), path))

    conn.commit()
    print("✅ recovery committed\n")
    for title, fname, fid, nid, nblocks, path in summary:
        print(f'  "{title}"  ->  folder "{fname}" (id {fid}), note id {nid}, {nblocks} blocks')
        print(f"     exported: {path}")
except Exception as e:
    conn.rollback()
    print("❌ rolled back, no changes written:", repr(e))
    raise
finally:
    conn.close()
