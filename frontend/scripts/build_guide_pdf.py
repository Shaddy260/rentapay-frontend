#!/usr/bin/env python3
"""
Builds the downloadable RentaPay guide PDF from the same markdown files
used by src/pages/Resources.jsx (src/content/guide/*.md).

This is deliberately NOT a separate hand-written document — editing a
section under src/content/guide/ and re-running this script is the only
way the PDF should ever be updated, so the webpage and PDF never drift
apart.

Usage:
    python3 scripts/build_guide_pdf.py

Requires: python3 -m pip install markdown --break-system-packages
          wkhtmltopdf (system binary)

Output: public/downloads/rentapay-guide.pdf (served as a static file;
the "Download PDF" button on /resources links directly to this path).
"""
import datetime
import pathlib
import subprocess
import sys

try:
    import markdown
except ImportError:
    sys.exit("Missing dependency. Run: pip install markdown --break-system-packages")

ROOT = pathlib.Path(__file__).resolve().parent.parent
GUIDE_DIR = ROOT / "src" / "content" / "guide"
OUT_DIR = ROOT / "public" / "downloads"
OUT_PDF = OUT_DIR / "rentapay-guide.pdf"

# Section order — must match src/pages/Resources.jsx SECTIONS array.
SECTION_FILES = [
    "01-intro.md",
    "02-pricing.md",
    "03-how-payments-flow.md",
    "04-landlord-portal.md",
    "05-tenant-portal.md",
    "08-security-deposits.md",
    "09-utility-submetering.md",
    "10-tenant-ratings-reputation.md",
    "11-disputes-complaints-community.md",
    "12-general-manager-brand-ambassador.md",
    "13-security-and-privacy.md",
    "14-notifications-and-reminders.md",
    "15-reports-and-data-export.md",
    "16-payment-plans-and-vacating.md",
    "23-automatic-rent-collection.md",
    "06-getting-started.md",
    "18-troubleshooting.md",
    "19-support-channels.md",
    "20-staying-up-to-date.md",
    "22-status-page-and-reliability.md",
    "21-mobile-and-devices.md",
    "07-faq.md",
    "17-glossary.md",
]

# Same tokens as src/styles/tokens.css, kept in sync manually since this
# script runs outside the Vite/CSS pipeline. If tokens.css changes,
# update these to match.
CSS = """
@page { margin: 22mm 18mm; }
body {
  font-family: 'Helvetica Neue', Arial, sans-serif;
  color: #1B2421;
  line-height: 1.6;
  font-size: 13px;
}
h1, h2 { font-family: Georgia, serif; color: #0F3D3E; }
.cover {
  page-break-after: always;
  text-align: center;
  padding-top: 30%;
}
.cover h1 { font-size: 36px; margin-bottom: 8px; }
.cover p { color: #5C6663; font-size: 14px; }
.section { page-break-before: always; }
.section:first-of-type { page-break-before: avoid; }
img {
  max-width: 100%;
  border: 1px solid #DCD5C8;
  border-radius: 8px;
  margin: 10px 0;
}
em { color: #5C6663; font-size: 11px; }
blockquote {
  border-left: 3px solid #C1622D;
  background: #FFF4E5;
  padding: 10px 16px;
  border-radius: 6px;
}
footer.pagefoot {
  color: #B0A996;
  font-size: 10px;
}
"""


def build_html():
    today = datetime.date.today().strftime("%d %B %Y")
    body_parts = []
    for i, filename in enumerate(SECTION_FILES):
        path = GUIDE_DIR / filename
        md_text = path.read_text(encoding="utf-8")
        html = markdown.markdown(md_text, extensions=["extra"])
        # Resolve relative ./images/... paths (including ./images/real/...)
        # to absolute file:// paths so wkhtmltopdf, run outside the app's
        # dev server, can load them.
        images_root = (GUIDE_DIR / "images").resolve()
        html = html.replace('src="./images/', f'src="file://{images_root}/')
        body_parts.append(f'<div class="section">{html}</div>')

    body = "\n".join(body_parts)
    return f"""<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>{CSS}</style>
</head>
<body>
  <div class="cover">
    <h1>RentaPay</h1>
    <p>A guide for landlords, property managers &amp; caretakers, and tenants</p>
    <p>Generated {today}</p>
  </div>
  {body}
</body>
</html>"""


def main():
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    html_path = ROOT / "scripts" / "_guide_build.html"
    html_path.write_text(build_html(), encoding="utf-8")

    subprocess.run(
        [
            "wkhtmltopdf",
            "--enable-local-file-access",
            "--footer-right", "Page [page] of [topage]",
            "--footer-font-size", "8",
            "--footer-spacing", "5",
            str(html_path),
            str(OUT_PDF),
        ],
        check=True,
    )
    html_path.unlink(missing_ok=True)
    print(f"Wrote {OUT_PDF}")


if __name__ == "__main__":
    main()
