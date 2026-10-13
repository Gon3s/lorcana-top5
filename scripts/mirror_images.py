"""Prepare same-origin thumbnails for canvas PNG exports; the grid keeps official URLs."""
import concurrent.futures
import hashlib
import json
import shutil
import time
from pathlib import Path
from urllib.request import Request, urlopen

def main():
    catalog = json.loads(Path('dist/data/catalog.json').read_text())
    cache = Path('.cache/export-images')
    destination = Path('dist/export-images')
    cache.mkdir(parents=True, exist_ok=True)
    destination.mkdir(parents=True, exist_ok=True)

    def mirror(card):
        image_url = card.get('thumbnail') or card['image']
        digest = hashlib.sha256(image_url.encode()).hexdigest()[:16]
        cached = cache / f"{card['id']}-{digest}.jpg"
        if not cached.exists():
            for attempt in range(2):
                try:
                    request = Request(image_url, headers={'User-Agent': 'lorcana-top5/1.0'})
                    with urlopen(request, timeout=20) as response:
                        content = response.read()
                    if not content.startswith(b'\xff\xd8'):
                        raise ValueError('Expected JPEG image')
                    temporary = cached.with_suffix('.tmp')
                    temporary.write_bytes(content)
                    temporary.replace(cached)
                    break
                except Exception:
                    if attempt == 0:
                        time.sleep(0.3)
            else:
                return card['id']
        shutil.copyfile(cached, destination / f"{card['id']}.jpg")
        return None

    with concurrent.futures.ThreadPoolExecutor(max_workers=8) as workers:
        missing = [identifier for identifier in workers.map(mirror, catalog['cards']) if identifier]
    print(f"Export images: {len(catalog['cards']) - len(missing)}/{len(catalog['cards'])} available")
    if missing:
        print('::warning::PNG image download unavailable for cards: ' + ', '.join(missing))

if __name__ == '__main__':
    main()
