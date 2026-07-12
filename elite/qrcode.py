"""Small SVG renderer for zero-configuration LAN pairing QR codes."""

from __future__ import annotations

from ._vendor.qrcodegen import QrCode


def svg(text: str, *, border: int = 4) -> str:
    """Return a self-contained, crisp SVG QR code for *text*.

    The payload is encoded into the modules only; it is never copied into SVG
    metadata or text nodes.  This matters because pairing links are short-lived
    bearer capabilities.
    """
    if not isinstance(text, str) or not text:
        raise ValueError("QR payload must be a non-empty string")
    if not isinstance(border, int) or border < 0:
        raise ValueError("QR border must be a non-negative integer")
    qr = QrCode.encode_text(text, QrCode.Ecc.MEDIUM)
    size = qr.get_size()
    commands = " ".join(
        f"M{x + border},{y + border}h1v1h-1z"
        for y in range(size)
        for x in range(size)
        if qr.get_module(x, y)
    )
    extent = size + border * 2
    return (
        '<?xml version="1.0" encoding="UTF-8"?>'
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {extent} {extent}" '
        'shape-rendering="crispEdges" role="img" aria-label="Device pairing QR code">'
        f'<path fill="#fff" d="M0,0h{extent}v{extent}h-{extent}z"/>'
        f'<path fill="#071017" d="{commands}"/>'
        '</svg>'
    )
