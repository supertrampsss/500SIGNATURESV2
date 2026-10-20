"""Optional asset regeneration: python -m pip install fonttools brotli.

Derive static weights from the repository's licensed Source Sans 3 variable font.
Rename the derivative because 'Source' is a reserved font name under its OFL.
No build-time or runtime dependency is added to the site.
"""
from pathlib import Path

from fontTools import subset
from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont

root = Path(__file__).resolve().parents[2] / "site/public/mandats/fonts"
for weight, style in [(400, "Regular"), (700, "Bold")]:
    font = instantiateVariableFont(
        TTFont(root / "source-sans-3-variable.woff2"), {"wght": weight}, inplace=True
    )
    names = {
        1: "Budget Flux Sans", 2: style, 3: f"BudgetFluxSans-{style}",
        4: f"Budget Flux Sans {style}", 6: f"BudgetFluxSans-{style}",
        16: "Budget Flux Sans", 17: style,
    }
    font["name"].names = [name for name in font["name"].names if name.nameID != 25]
    for name_id, value in names.items():
        for platform, encoding, language in [(3, 1, 1033), (1, 0, 0)]:
            font["name"].setName(value, name_id, platform, encoding, language)
    options = subset.Options()
    options.name_IDs = [0, 1, 2, 3, 4, 5, 6, 13, 14, 16, 17]
    sub = subset.Subsetter(options=options)
    sub.populate(unicodes=[*range(0x250), *range(0x1E00, 0x1F00),
                           *range(0x2000, 0x2070), *range(0x20A0, 0x20D0), 0x2248])
    sub.subset(font)
    font.save(root / f"budget-flux-sans-{weight}.woff2")
