#!/usr/bin/env python3
"""Gera assets/lib/terra.js: pontos de terra firme num globo (Natural Earth 110m via world-atlas), embutidos para o render."""
import json
import math
import sys
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "tools"))
from _common import emit  # noqa: E402

N = 14000  # pontos na esfera (fibonacci); ~4 mil caem em terra


def decode(topo):
    sx, sy = topo["transform"]["scale"]
    tx, ty = topo["transform"]["translate"]
    arcs = []
    for arc in topo["arcs"]:
        x = y = 0
        pts = []
        for dx, dy in arc:
            x += dx; y += dy
            pts.append((x * sx + tx, y * sy + ty))
        arcs.append(pts)

    def ring(idx):
        pts = []
        for i in idx:
            a = arcs[i] if i >= 0 else arcs[~i][::-1]
            pts.extend(a if not pts else a[1:])
        return np.array(pts)

    polys = []
    for g in topo["objects"]["land"]["geometries"]:
        groups = g["arcs"] if g["type"] == "MultiPolygon" else [g["arcs"]]
        for poly in groups:
            polys.append([ring(r) for r in poly])
    return polys


def inside(lon, lat, rings):
    """Par-ímpar sobre todos os anéis (contorno e buracos)."""
    res = np.zeros(lon.shape, dtype=bool)
    for r in rings:
        x, y = r[:, 0], r[:, 1]
        x2, y2 = np.roll(x, -1), np.roll(y, -1)
        for i in range(len(x)):
            cond = ((y[i] > lat) != (y2[i] > lat))
            xint = (x2[i] - x[i]) * (lat - y[i]) / ((y2[i] - y[i]) + 1e-12) + x[i]
            res ^= cond & (lon < xint)
    return res


try:
    topo = json.loads((ROOT / "video/node_modules/world-atlas/land-110m.json").read_text())
    polys = decode(topo)
    i = np.arange(N) + 0.5
    lat = np.degrees(np.arcsin(1 - 2 * i / N))
    lon = (np.degrees(math.pi * (1 + 5 ** 0.5) * i) % 360) - 180
    land = np.zeros(N, dtype=bool)
    for rings in polys:
        r0 = rings[0]
        box = (lon >= r0[:, 0].min()) & (lon <= r0[:, 0].max()) & (lat >= r0[:, 1].min()) & (lat <= r0[:, 1].max())
        if box.any():
            sub = inside(lon[box], lat[box], rings)
            land[np.where(box)[0][sub]] = True
    pts = np.round(np.stack([lat[land], lon[land]], 1).ravel(), 2)
    out = ROOT / "assets/lib/terra.js"
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text("// Natural Earth 110m (domínio público) via world-atlas: [lat, lon, ...] de pontos em terra\n"
                   f"export const TERRA = new Float32Array([{','.join(f'{v:g}' for v in pts)}]);\n")
    emit("terra", pontos=int(land.sum()), arquivo=str(out.relative_to(ROOT)))
except Exception as e:  # noqa: BLE001
    emit("terra", ok=False, error=str(e))
