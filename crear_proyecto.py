import os  
import json  
  
os.chdir(\"NAVEGADOR\")  
   
archivos = {}  
archivos[\"public/index.html\"] = \"test\"  
  
for f in archivos:  
    d = os.path.dirname(f)  
    if d and not os.path.exists(d): os.makedirs(d)  
    with open(f, \"w\") as fp: fp.write(archivos[f])  
    print(\"Creado:\", f)  
