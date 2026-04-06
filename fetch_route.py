import urllib.request
import json

url = 'http://router.project-osrm.org/route/v1/driving/75.8458,22.7712;75.7952,23.1601?geometries=geojson&overview=full'
req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
with urllib.request.urlopen(req) as res:
    data = json.loads(res.read())
    coords = data['routes'][0]['geometry']['coordinates']
    with open('route.json', 'w') as f:
        json.dump(coords, f)
print(f"Downloaded {len(coords)} coordinates.")
