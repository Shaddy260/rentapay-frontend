# Guide PDF build

`build_guide_pdf.py` regenerates `public/downloads/rentapay-guide.pdf` from
the same markdown files the `/resources` page renders
(`src/content/guide/*.md`). Run it any time guide content changes:

```
pip install markdown --break-system-packages   # one-time
python3 scripts/build_guide_pdf.py
```

Requires the `wkhtmltopdf` binary on the machine running the build (already
present in this environment; install via your OS package manager elsewhere,
e.g. `apt install wkhtmltopdf`).

Wire this into your deploy pipeline (e.g. a step before `vite build`) so the
PDF is always regenerated from current content rather than edited by hand.
