"""빌드된 사이트(dist)의 내부 링크와 앵커를 검사한다. 사용: python3 scripts/check_links.py dist"""
import os, re, sys, html
from urllib.parse import urljoin, urlparse, unquote
root = sys.argv[1]; base = '/all-about-pqc/'
pages = {}
for d, _, fs in os.walk(root):
    for f in fs:
        if f.endswith('.html'):
            p = os.path.join(d, f); rel = '/' + os.path.relpath(p, root).replace(os.sep, '/')
            url = base.rstrip('/') + (rel[:-len('index.html')] if rel.endswith('index.html') else rel)
            pages[url] = open(p, encoding='utf-8').read()
ids = {u: set(re.findall(r'\sid="([^"]+)"', s)) for u, s in pages.items()}
bad = []
for u, s in pages.items():
    if u.endswith('404.html'): continue
    main = s
    for href in re.findall(r'<a\s[^>]*href="([^"]+)"', main):
        href = html.unescape(href)
        if href.startswith(('http', 'mailto:', 'javascript:')): continue
        full = urljoin('http://x' + u, href); pr = urlparse(full)
        path = unquote(pr.path); frag = unquote(pr.fragment)
        if not path.startswith(base): bad.append((u, href, 'outside base')); continue
        if any(path.endswith(e) for e in ('.css', '.js', '.svg', '.png', '.ico', '.xml', '.txt', '.py')):
            if not os.path.exists(os.path.join(root, path[len(base):])): bad.append((u, href, 'asset missing'))
            continue
        tgt = path if path.endswith('/') or path.endswith('.html') else path + '/'
        if tgt not in pages: bad.append((u, href, 'page missing')); continue
        if frag and frag not in ids[tgt]: bad.append((u, href, 'anchor missing'))
for b in sorted(set(bad)): print(*b, sep=' | ')
print('pages', len(pages), 'bad', len(set(bad)))
sys.exit(1 if bad else 0)
