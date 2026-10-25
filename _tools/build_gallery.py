#!/usr/bin/env python3
"""Build the project page's video gallery from the supplementary sample.

Usage:  python3 _tools/build_gallery.py <supplementary_root> [page_root]

<supplementary_root> holds manifest.json, videos/ and tlvbench_data/
(DPAG/supplementary_20260925). The manifest has two groups:

  records[:252]   rule-selected sample, fixed before any clip was viewed
  records[252:]   curated pairs, ranked by judge margin and checked by eye

Videos are remuxed with +faststart (no re-encode) into static/videos/,
a first-frame poster goes to static/posters/, and the card data is written
to static/js/gallery-data.js so the page also opens from disk.
"""
import json
import os
import subprocess
import sys

PREFIX = "A realistic high-quality cinematic video."
BACKBONES = ["Wan2.1-14B", "CogVideoX-5B", "VideoCrafter2", "AnimateDiff"]
SPECS = ["neg", "conj", "order", "templog"]
ARM_LABEL = {
    "unsteered": "Unsteered",
    "switchcraft": "SwitchCraft",
    "videomsg": "Video-MSG",
    "free2guide": "Free2Guide",
    "videoguide": "VideoGuide",
    "tlessa": "T-LESSA (ours)",
}
ARM_ORDER = ["unsteered", "switchcraft", "videomsg", "free2guide", "videoguide", "tlessa"]
# Roles in tlvbench_data: keep/present/ordered must appear, suppress must not.
ROLE = {"keep": "appear", "present": "appear", "ordered": "appear", "suppress": "never"}


def load_specs(root):
    specs = {}
    for c in SPECS:
        path = os.path.join(root, "tlvbench_data", "tlvbench_%s.json" % c)
        for entry in json.load(open(path, encoding="utf-8")):
            specs[(c, entry["id"])] = entry
    return specs


def prompt_and_spans(entry):
    """Strip the shared style prefix and shift the event spans to match."""
    prompt = entry["prompt"]
    cut = 0
    if prompt.startswith(PREFIX):
        cut = len(PREFIX)
        while cut < len(prompt) and prompt[cut] == " ":
            cut += 1
    spans = []
    for i, p in enumerate(entry["propositions"]):
        start = p.get("char_start")
        end = p.get("char_end")
        if start is None:
            start = prompt.find(p["span_text"])
            end = start + len(p["span_text"])
        if start < cut:
            sys.exit("span %r of %s starts inside the prefix" % (p["span_text"], entry["id"]))
        spans.append([start - cut, end - cut, p["symbol"].upper(), ROLE[p["role"]], p["event"]])
    return prompt[cut:], spans


def stage(root, page, rel):
    """Remux one clip into the page and extract its poster; return web paths."""
    sub = rel[len("videos/"):]
    video = os.path.join("static", "videos", sub)
    poster = os.path.join("static", "posters", os.path.splitext(sub)[0] + ".jpg")
    src = os.path.join(root, rel)
    for out in (video, poster):
        os.makedirs(os.path.dirname(os.path.join(page, out)), exist_ok=True)
    if not os.path.exists(os.path.join(page, video)):
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", src, "-c", "copy",
                        "-movflags", "+faststart", os.path.join(page, video)], check=True)
    if not os.path.exists(os.path.join(page, poster)):
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", src, "-frames:v", "1",
                        "-q:v", "5", os.path.join(page, poster)], check=True)
    return video, poster


def card(root, page, specs, bb, spec, pid, recs, kind, note=None):
    entry = specs[(spec, pid)]
    prompt, spans = prompt_and_spans(entry)
    seeds = {r["seed"] for r in recs}
    if len(seeds) != 1:
        sys.exit("arms of %s/%s/%s are not paired on one seed: %s" % (bb, spec, pid, seeds))
    arms = []
    for r in sorted(recs, key=lambda r: ARM_ORDER.index(r["arm"])):
        video, poster = stage(root, page, r["rel_path"])
        arms.append([r["arm"], ARM_LABEL[r["arm"]], video, poster])
    item = {"kind": kind, "bb": bb, "spec": spec, "pid": pid, "seed": seeds.pop(),
            "prompt": prompt, "spans": spans, "arms": arms}
    # Some backbones were given a reformatted prompt; show it when it differs
    # beyond "video of ..." versus "video. ...".
    given = {r["prompt"].replace(PREFIX[:-1] + " of ", PREFIX + " ") for r in recs}
    if given != {entry["prompt"]}:
        item["given"] = sorted(r["prompt"] for r in recs)[0]
    if note:
        item["note"] = note
    return item


def interleave(items):
    """Round-robin over specification classes so every class shows up early."""
    by_spec = {s: [it for it in items if it["spec"] == s] for s in SPECS}
    out = []
    while any(by_spec.values()):
        for s in SPECS:
            if by_spec[s]:
                out.append(by_spec[s].pop(0))
    return out


def main():
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    root = sys.argv[1]
    page = sys.argv[2] if len(sys.argv) > 2 else os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    manifest = json.load(open(os.path.join(root, "manifest.json"), encoding="utf-8"))
    specs = load_specs(root)
    records = manifest["records"]
    curated = manifest["curated_addendum"]
    split = curated["records_start_index"]

    # Unfiltered sample: every arm except the phase-objective ablation.
    groups = {}
    for r in records[:split]:
        if r["arm"] == "tlessa_phase":
            continue
        groups.setdefault((r["backbone"], r["spec_class"], r["pid"]), []).append(r)
    sample = [card(root, page, specs, bb, spec, pid, groups[(bb, spec, pid)], "sample")
              for bb in BACKBONES for spec in SPECS
              for (b, s, pid) in sorted(groups) if (b, s) == (bb, spec)]

    # Selected: one comparator/T-LESSA pair per visible-difference note.
    extra = records[split:]
    selected = []
    for v in curated["visible_difference"]:
        recs = [r for r in extra
                if (r["backbone"], r["spec_class"], r["pid"]) == (v["backbone"], v["spec_class"], v["pid"])
                and r["arm"] in (v["comparator"], "tlessa")]
        if sorted(r["arm"] for r in recs) != sorted([v["comparator"], "tlessa"]):
            sys.exit("curated pair %s is incomplete" % v)
        selected.append(card(root, page, specs, v["backbone"], v["spec_class"], v["pid"],
                             recs, "selected", v["note"]))

    data = {"selected": interleave(selected), "sample": sample}
    out = os.path.join(page, "static", "js", "gallery-data.js")
    with open(out, "w", encoding="utf-8") as f:
        f.write("// Generated by _tools/build_gallery.py. Do not edit by hand.\n")
        f.write("window.TLESSA_GALLERY = ")
        json.dump(data, f, ensure_ascii=False, separators=(",", ":"))
        f.write(";\n")
    print("selected %d cards, sample %d cards -> %s" % (len(selected), len(sample), out))


if __name__ == "__main__":
    main()
