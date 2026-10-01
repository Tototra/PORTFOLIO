"""Exporte le graphe de co-publications du LRE (projet MLG), anonymisé.

Aucun nom n'est conservé : chaque nœud devient [x, y, membre_LRE, équipe,
communauté_Louvain, année_arrivée], dans un ordre mélangé. La disposition est
précalculée avec ForceAtlas2 pour que la page n'ait rien à calculer.

Lancer depuis la racine du projet, avec le venv du projet MLG (networkx >= 3.4) :
  ../MLG/.venv/bin/python3 scripts/export-lre-graph.py
"""
import json, csv, random
import networkx as nx
base = "/Users/toto/Documents/scia/ING2/MLG/fil rouge/mlg-projet-lre"
G = nx.read_graphml(f"{base}/data/graphs/auteur_auteur.graphml")
comm = {}
with open(f"{base}/STEP_4/data/communautes_all.csv", encoding="utf-8") as f:
    for r in csv.DictReader(f):
        comm[r["noeud"]] = int(r["communaute"])
print(nx.__version__, G.number_of_nodes(), G.number_of_edges(), len(set(comm.values())))
nodes = list(G.nodes())
random.seed(7); random.shuffle(nodes)          # l'ordre ne trahit pas l'ordre alphabétique
idx = {n: i for i, n in enumerate(nodes)}
try:
    pos = nx.forceatlas2_layout(G, max_iter=400, scaling_ratio=2.0, gravity=1.0, seed=7, strong_gravity=True)
except Exception as e:
    print("fa2 failed", e); pos = nx.spring_layout(G, seed=7, iterations=200)
xs = [p[0] for p in pos.values()]; ys = [p[1] for p in pos.values()]
mnx, mxx, mny, mxy = min(xs), max(xs), min(ys), max(ys)
sc = max(mxx - mnx, mxy - mny)
teams = sorted({G.nodes[n].get("team", "") for n in G if G.nodes[n].get("type") == "LRE"} - {""})
out_nodes = []
for n in nodes:
    d = G.nodes[n]
    x = (pos[n][0] - (mnx + mxx) / 2) / sc; y = (pos[n][1] - (mny + mxy) / 2) / sc
    lre = d.get("type") == "LRE"
    out_nodes.append([round(float(x), 4), round(float(y), 4), 1 if lre else 0,
                      teams.index(d["team"]) if lre and d.get("team") in teams else -1,
                      comm.get(n, -1), int(d.get("arrival_year", 0) or 0)])
edges = []
for u, v, d in G.edges(data=True):
    edges.append([idx[u], idx[v], int(d.get("first_collab_year", 0) or 0)])
json.dump({"teams": teams, "nodes": out_nodes, "edges": edges,
           "fields": {"node": ["x", "y", "isLRE", "team", "community", "arrivalYear"], "edge": ["a", "b", "firstYear"]}},
          open("src/data/lre-graph.json", "w"), separators=(",", ":"))
yrs = [e[2] for e in edges]; print("years", min(yrs), max(yrs), "teams", teams)
