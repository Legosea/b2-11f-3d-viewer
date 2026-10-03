from __future__ import annotations
import json, re
from pathlib import Path
from typing import Any
import fitz

M_PER_POINT = 0.0254 / 72 * 60
W3_A = (301.52, 393.44)
W3_B = (428.12, 393.44)
W3_TARGET_M = 2.68
GRAY = 0.8627451062202454

def _seq(v: Any):
    if isinstance(v, fitz.Point):
        return [round(v.x, 4), round(v.y, 4)]
    if isinstance(v, fitz.Rect):
        return [round(v.x0, 4), round(v.y0, 4), round(v.x1, 4), round(v.y1, 4)]
    if isinstance(v, fitz.Quad):
        return [_seq(p) for p in [v.ul, v.ur, v.lr, v.ll]]
    if isinstance(v, (tuple, list)):
        return [_seq(x) for x in v]
    if isinstance(v, (int, float)):
        return round(float(v), 6)
    if v is None or isinstance(v, (str, bool)):
        return v
    return str(v)

def _is_structural_gray(d):
    fill = d.get('fill')
    if not fill or len(fill) < 3:
        return False
    if max(abs(float(fill[i]) - GRAY) for i in range(3)) > 1e-4:
        return False
    r = d['rect']
    return 100 < r.x0 < 750 and 90 < r.y0 < 500 and r.width < 600 and r.height < 400

def _drawing_record(i, d):
    return {
        'index': i,
        'rect': _seq(d['rect']),
        'width': round(float(d.get('width') or 0), 6),
        'color': _seq(d.get('color')),
        'fill': _seq(d.get('fill')),
        'closePath': bool(d.get('closePath')),
        'items': _seq(d.get('items', [])),
    }

def extract_plan(pdf_path: Path | str, out_dir: Path | str) -> dict:
    pdf_path = Path(pdf_path)
    out_dir = Path(out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    doc = fitz.open(pdf_path)
    if len(doc) != 1:
        raise ValueError(f'B2 plan source must be one page, got {len(doc)}')
    page = doc[0]
    drawings = page.get_drawings()
    structural = [d for d in drawings if _is_structural_gray(d)]
    if not structural:
        raise ValueError('structural gray plan bands were not found')

    x0 = min(d['rect'].x0 for d in structural)
    y0 = min(d['rect'].y0 for d in structural)
    x1 = max(d['rect'].x1 for d in structural)
    y1 = max(d['rect'].y1 for d in structural)
    crop = fitz.Rect(x0, y0, x1, y1)

    selected = [(i, d) for i, d in enumerate(drawings) if d['rect'].intersects(crop)]
    text = page.get_text('text') or ''
    source_width = W3_B[0] - W3_A[0]
    measured_w3 = source_width * M_PER_POINT
    transform = {
        'sourceUnits': 'PDF points',
        'scaleClaim': '1/60',
        'scaleClaimSource': 'visually confirmed title block and user-approved v5 specification',
        'metresPerSourceUnit': M_PER_POINT,
        'originSource': [round(x0, 4), round(y0, 4)],
        'reviewSourceBounds': [round(x0, 4), round(y0, 4), round(x1, 4), round(y1, 4)],
        'reviewBoundsM': {
            'minX': 0.0, 'minZ': 0.0,
            'maxX': round((x1 - x0) * M_PER_POINT, 6),
            'maxZ': round((y1 - y0) * M_PER_POINT, 6),
        },
        'status': 'confirmed',
        'w3Calibration': {
            'sourceStart': list(W3_A), 'sourceEnd': list(W3_B),
            'sourceWidthPoints': source_width,
            'measuredWidthM': round(measured_w3, 4),
            'targetWidthM': W3_TARGET_M,
            'differenceM': round(measured_w3 - W3_TARGET_M, 6),
            'status': 'confirmed' if abs(measured_w3 - W3_TARGET_M) < 0.005 else 'discrepant',
        },
    }
    vector = {
        'version': 1,
        'pdf': pdf_path.name,
        'pageCount': len(doc),
        'pageRect': _seq(page.rect),
        'cropSource': _seq(crop),
        'structuralDrawingCount': len(structural),
        'selectedDrawingCount': len(selected),
        'drawings': [_drawing_record(i, d) for i, d in selected],
        'text': text,
        'transform': transform,
    }
    (out_dir / 'plan-vector-full.json').write_text(json.dumps(vector, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')

    svg = page.get_svg_image(matrix=fitz.Matrix(1, 1), text_as_path=True)
    replacement = f'width="{x1-x0:.4f}" height="{y1-y0:.4f}" viewBox="{x0:.4f} {y0:.4f} {x1-x0:.4f} {y1-y0:.4f}"'
    svg, count = re.subn(r'width="[^"]+" height="[^"]+" viewBox="[^"]+"', replacement, svg, count=1)
    if count != 1:
        raise ValueError('could not rewrite SVG root viewBox')
    (out_dir / 'plan-overlay-full.svg').write_text(svg, encoding='utf-8')
    doc.close()
    return vector

if __name__ == '__main__':
    import argparse
    ap = argparse.ArgumentParser()
    ap.add_argument('pdf')
    ap.add_argument('out_dir')
    args = ap.parse_args()
    result = extract_plan(args.pdf, args.out_dir)
    print(json.dumps({k: result[k] for k in ['pageCount','selectedDrawingCount','cropSource','transform']}, ensure_ascii=False, indent=2))
