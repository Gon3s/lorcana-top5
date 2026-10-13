"""Download the same official FR catalogue as the Coconut importer. No embedded credentials."""
import argparse
import json
import os
from pathlib import Path
from urllib.request import Request, urlopen
from urllib.parse import urlencode

URL = 'https://api.lorcana.ravensburger.com/v3/catalog/fr'

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--input', type=Path, help='Official catalogue JSON downloaded manually')
    parser.add_argument('--out', type=Path, default=Path('.cache/catalog-fr.json'))
    args = parser.parse_args()
    if args.input:
        data = json.loads(args.input.read_text(encoding='utf-8-sig'))
    else:
        headers = {'Accept': 'application/json', 'User-Agent': 'lorcana-top5/1.0'}
        token = os.environ.get('LORCANA_BEARER_TOKEN', '').strip()
        basic_auth = os.environ.get('LORCANA_BASIC_AUTH', '').strip()
        if not token and basic_auth:
            try:
                auth = basic_auth if basic_auth.startswith('Basic ') else f'Basic {basic_auth}'
                request = Request('https://sso.ravensburger.de/token',
                                  data=urlencode({'grant_type': 'client_credentials'}).encode(),
                                  headers={'Authorization': auth, 'Content-Type': 'application/x-www-form-urlencoded'})
                with urlopen(request, timeout=30) as response:
                    token = json.load(response)['access_token']
            except Exception:
                raise SystemExit('Authentification du catalogue impossible. Vérifier les secrets GitHub ou fournir un JSON officiel.')
        if token:
            headers['Authorization'] = f'Bearer {token}'
        try:
            with urlopen(Request(URL, headers=headers), timeout=45) as response:
                data = json.load(response)
        except Exception:
            raise SystemExit('Catalogue inaccessible. Fournir data/catalog-source.json ou configurer le secret LORCANA_BEARER_TOKEN. Aucun catalogue existant n’a été remplacé.')
    if not isinstance(data, dict) or not isinstance(data.get('cards'), (dict, list)):
        raise SystemExit('Invalid official catalogue: missing cards')
    args.out.parent.mkdir(parents=True, exist_ok=True)
    temporary = args.out.with_suffix('.tmp')
    temporary.write_text(json.dumps(data, ensure_ascii=False), encoding='utf-8')
    temporary.replace(args.out)
    print(f'Catalogue downloaded: {args.out}')
    cards = data['cards'] if isinstance(data['cards'], list) else [c for category in data['cards'].values() for c in category]
    colors = sorted({str(ink) for c in cards for ink in c.get('magic_ink_colors', [])})
    print(f'Official ink values: {colors}')
    for c in cards:
        if str(c.get('culture_invariant_id')) == '3292':
            print('Card 3292 import diagnostic:', json.dumps({k: c.get(k) for k in ('culture_invariant_id', 'card_identifier', 'name', 'magic_ink_colors', 'variants')}, ensure_ascii=False))

if __name__ == '__main__':
    main()
