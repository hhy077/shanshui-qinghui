"""Subset the OFL-licensed Ma Shan Zheng font to the project's visible text."""
from pathlib import Path
from fontTools import subset
root = Path(__file__).resolve().parent.parent
text = ''.join(p.read_text('utf-8-sig') for p in [root/'index.html', *list((root/'src').glob('*.js'))])
options = subset.Options()
options.flavor = 'woff2'
font = subset.load_font(str(root/'assets/calligraphy.ttf'), options)
subsetter = subset.Subsetter(options=options)
subsetter.populate(text=text)
subsetter.subset(font)
subset.save_font(font, str(root/'assets/ink-kai.woff2'), options)
print('Saved', root/'assets/ink-kai.woff2')
