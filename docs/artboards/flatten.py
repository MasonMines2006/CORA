#!/usr/bin/env python3
"""Turn the canvas-format artboards in source/ into plain HTML in view/.

The .dc.html files in source/ are written for the Claude design-canvas runtime:
they load a `support.js` we do not have, wrap the page in <x-dc>/<helmet>, and
(in Concept.dc.html only) use {{ bindings }} and <sc-if> for the mode tabs.
None of that renders in a normal browser, so this script rewrites it into
static HTML you can just open with a file:// URL.

Run:  python3 docs/artboards/flatten.py
"""

import pathlib
import re

HERE = pathlib.Path(__file__).parent
SRC = HERE / "source"
OUT = HERE / "view"

# The two tab styles Concept.dc.html's DCLogic class computed at runtime.
TAB_BASE = (
    "border: none; border-radius: 9px 9px 0 0; padding: 11px 19px; "
    "font-size: 14px; cursor: pointer; font-family: inherit; "
)
TAB_ACTIVE = TAB_BASE + (
    "background: #f8f7f6; color: #0f172a; font-weight: 700; "
    "border-bottom: 2px solid #dc2626;"
)
TAB_IDLE = TAB_BASE + (
    "background: transparent; color: #64748b; font-weight: 500; "
    "border-bottom: 2px solid transparent;"
)

# Vanilla replacement for the runtime's setState-driven tab switching.
MODE_SCRIPT = """
<script>
  // Stand-in for the canvas runtime's state handling: show one mode panel at a
  // time and restyle the tab buttons, the same way the DCLogic class did.
  var TAB_ACTIVE = %r;
  var TAB_IDLE = %r;
  function setMode(mode) {
    document.querySelectorAll('[data-mode-panel]').forEach(function (panel) {
      panel.style.display = panel.dataset.modePanel === mode ? 'flex' : 'none';
    });
    document.querySelectorAll('[data-mode-tab]').forEach(function (tab) {
      tab.setAttribute('style', tab.dataset.modeTab === mode ? TAB_ACTIVE : TAB_IDLE);
    });
  }
  // Open a specific mode directly with a hash, e.g. Concept.html#graph
  var VALID = ['learn', 'practice', 'cards', 'graph', 'sources'];
  var requested = window.location.hash.replace('#', '');
  setMode(VALID.indexOf(requested) === -1 ? 'learn' : requested);
  window.addEventListener('hashchange', function () {
    var next = window.location.hash.replace('#', '');
    if (VALID.indexOf(next) !== -1) setMode(next);
  });
</script>
""" % (TAB_ACTIVE, TAB_IDLE)


def strip_runtime(html: str) -> str:
    """Remove everything that only the canvas runtime understands."""
    html = html.replace('<script src="./support.js"></script>\n', "")
    # Hoist the <helmet> block's contents (fonts + base CSS) into <head>.
    helmet = re.search(r"<helmet>(.*?)</helmet>", html, re.S)
    if helmet:
        html = html.replace(helmet.group(0), "")
        html = html.replace("</head>", helmet.group(1).rstrip() + "\n</head>")
    html = html.replace("<x-dc>\n", "").replace("</x-dc>\n", "")
    # Drop the trailing DCLogic component definition.
    html = re.sub(
        r'<script type="text/x-dc".*?</script>\n', "", html, flags=re.S
    )
    return html


def resolve_concept_bindings(html: str) -> str:
    """Replace Concept.dc.html's {{ bindings }} and <sc-if> with plain markup."""
    for mode in ("learn", "practice", "cards", "graph", "sources"):
        name = mode.capitalize()
        html = html.replace(
            'onClick="{{ pick%s }}" style="{{ tab%s }}"' % (name, name),
            'data-mode-tab="%s" onclick="setMode(\'%s\')" style="%s"'
            % (mode, mode, TAB_IDLE),
        )
        # <sc-if> wrapped each mode panel; a plain div carries the mode instead.
        html = re.sub(
            r'<sc-if value="\{\{ is%s \}\}"[^>]*>' % name,
            '<div data-mode-panel="%s" style="display: none; flex-grow: 1; '
            'min-height: 0; flex-direction: column;">' % mode,
            html,
        )
    html = html.replace("</sc-if>", "</div>")
    # Any remaining pick* handler (e.g. the Learn panel's "Skip to quick check"
    # button) keeps its own inline style and only needs the click wired up.
    html = re.sub(
        r'onClick="\{\{ pick(\w+) \}\}"',
        lambda m: "onclick=\"setMode('%s')\"" % m.group(1).lower(),
        html,
    )
    return html.replace("</body>", MODE_SCRIPT + "</body>")


def main() -> None:
    OUT.mkdir(exist_ok=True)
    for src in sorted(SRC.glob("*.dc.html")):
        html = strip_runtime(src.read_text())
        if src.name == "Concept.dc.html":
            html = resolve_concept_bindings(html)
        dest = OUT / src.name.replace(".dc.html", ".html")
        dest.write_text(html)
        print("wrote %s (%d bytes)" % (dest.relative_to(HERE.parent.parent), len(html)))


if __name__ == "__main__":
    main()
