"""Census state outlines for display navigation only; no vote/geography allocation."""
import hashlib,json,math,xml.etree.ElementTree as E,zipfile
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1];root=ROOT/'data/display_geometry_sources';raw=(root/'2024-census-state-20m-kml.zip').read_bytes()
if hashlib.sha256(raw).hexdigest()!='37337db59415f010c594fba96a48aa6e950e633dc0e555cc7b1ce8edd794c673':raise ValueError('Census geometry pin')
with zipfile.ZipFile(root/'2024-census-state-20m-kml.zip') as z:tree=E.fromstring(z.read('cb_2024_us_state_20m.kml'))
ns={'k':'http://www.opengis.net/kml/2.2'};features={}
codes=set('AL AK AZ AR CA CO CT DE FL GA HI ID IL IN IA KS KY LA ME MD MA MI MN MS MO MT NE NV NH NJ NM NY NC ND OH OK OR PA RI SC SD TN TX UT VT VA WA WV WI WY'.split())
for item in tree.findall('.//k:Placemark',ns):
 props={x.attrib['name']:x.text for x in item.findall('.//k:SimpleData',ns)};code=props['STUSPS']
 if code not in codes:continue
 if code in features or props['GEOID']!=props['STATEFP']:raise ValueError('Duplicate/mismatched state')
 rings=[]
 for ring in item.findall('.//k:Polygon//k:LinearRing/k:coordinates',ns):
  points=[tuple(map(float,p.split(',')[:2])) for p in ring.text.split()]
  if len(points)<4 or any(not(-180<=x<=180 and -90<=y<=90) for x,y in points):raise ValueError('Invalid source coordinates')
  if code=='HI' and sum(x for x,y in points)/len(points)<-162:continue # Explicitly documented distant-island display omission.
  rings.append(points)
 features[code]={'name':props['NAME'],'fips':props['STATEFP'],'rings':rings}
if set(features)!=codes or len(features)!=50:raise ValueError('Expected50voting states')
p1,p2,p0,l0=map(math.radians,[29.5,45.5,37.5,-96]);n=(math.sin(p1)+math.sin(p2))/2;c=math.cos(p1)**2+2*n*math.sin(p1);rho0=math.sqrt(c-2*n*math.sin(p0))/n
def project(lon,lat,code):
 if code=='AK':return ((lon-360 if lon>0 else lon)*math.cos(math.radians(62)),-lat)
 if code=='HI':return (lon*math.cos(math.radians(21)),-lat)
 phi,lam=math.radians(lat),math.radians(lon);rho=math.sqrt(c-2*n*math.sin(phi))/n;theta=n*(lam-l0)
 return rho*math.sin(theta),-(rho0-rho*math.cos(theta))
projected={code:[[project(x,y,code) for x,y in ring] for ring in feature['rings']] for code,feature in features.items()}
def fit(codes,box):
 points=[p for code in codes for ring in projected[code] for p in ring];xs=[p[0] for p in points];ys=[p[1] for p in points];loX,hiX,loY,hiY=min(xs),max(xs),min(ys),max(ys);x,y,w,h=box;scale=min(w/(hiX-loX),h/(hiY-loY));dx=x+(w-(hiX-loX)*scale)/2;dy=y+(h-(hiY-loY)*scale)/2
 for code in codes:projected[code]=[[(dx+(a-loX)*scale,dy+(b-loY)*scale) for a,b in ring] for ring in projected[code]]
fit(codes-{'AK','HI'},(65,15,805,480));fit({'AK'},(45,465,240,145));fit({'HI'},(330,525,135,70))
def centroid(ring):
 pairs=list(zip(ring,ring[1:]+ring[:1]));area=sum(x*v-u*y for (x,y),(u,v) in pairs)
 if abs(area)<1e-8:return (ring[0][0],ring[0][1],0)
 return (sum((x+u)*(x*v-u*y) for (x,y),(u,v) in pairs)/(3*area),sum((y+v)*(x*v-u*y) for (x,y),(u,v) in pairs)/(3*area),abs(area))
callouts={code:(940,105+i*31) for i,code in enumerate(['VT','NH','MA','RI','CT','NJ','DE','MD'])};states={}
for code in sorted(codes):
 rings=projected[code];cx,cy,area=max((centroid(r) for r in rings),key=lambda v:v[2]);label=callouts.get(code,(cx,cy))
 path=' '.join('M'+'L'.join(f'{x:.2f},{y:.2f}' for x,y in ring)+'Z' for ring in rings)
 states[code]={'name':features[code]['name'],'fips':features[code]['fips'],'path':path,'label':[round(v,2) for v in label]}
 if code in callouts:states[code]['leader']=[round(cx,2),round(cy,2)]
data={'schema':'census-state-display-geometry-v1','viewBox':'0 0 1000 640','source_sha256':hashlib.sha256(raw).hexdigest(),'states':states,'scope':'Display navigation only, not district or vote-allocation boundaries','adjustments':['Spherical Albers CONUS','Alaska/Hawaii insets are not at the same scale','Hawaii distant islands west of162W omitted for display','Small northeastern state labels use callouts']}

(ROOT/'scripts/us_state_display_geometry.js').write_text('(function(root){root.USStateDisplayGeometry='+json.dumps(data,separators=(',',':'))+';})(typeof window!=="undefined"?window:globalThis);\n',encoding='utf-8')
print('50 Census-matched state outlines generated; display-only; bytes',len(json.dumps(data)))

