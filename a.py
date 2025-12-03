import requests
import random

endpoint = "https://web2xd.onrender.com/createcard"

adjectives = ["Tarjeta", "Promo", "Recurso", "Ficha", "Entrada"]
nouns = ["A1", "B2", "C3", "Q4", "X9"]
descriptions = [
    "Prueba automatizada",
    "Notas opcionales",
    "Data de prueba",
    "Demo de API",
    "Prueba de integración"
]

def rand_name():
    return f"{random.choice(adjectives)} {random.choice(nouns)}"

def rand_link():
    links = ["https://img.wattpad.com/9800ffe727d1c5e7f37d37a0d587363dfb51a964/68747470733a2f2f73332e616d617a6f6e6177732e636f6d2f776174747061642d6d656469612d736572766963652f53746f7279496d6167652f4d5f4f56356750554a41774957773d3d2d3133312e313662643039663533646664393732663636383938383737303231352e6a7067?s=fit&w=720&h=720",
             "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRT6Uuzm9ZTZdhnZAlXWQAztPR3_AjxPH9XvEgtW9AC_yV1TBd757lOX9g2XF734kLV5fo&usqp=CAU",
             "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSktehytol-k8BCyPtAIYT9hE9BfTOTzOlSBdgvFQPaYDQEToIG75D4IQAUHndDbmebyWE&usqp=CAU",
             "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTe-8UYxtYu36Eg_U5HnBoUD7ivTxfkxLn1gn51G2fwoxk6lSOd7_rqVtSR3ymEkPhPI-8&usqp=CAU",
             "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRZ-uLsEMxlhZU2l66REt0Es3UGo-iIk6uBQs2Zc3jcC9NzqH3aZhSHs6bWsDVYDRwNXus&usqp=CAU",
             "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSRjqYIHwjPYGtSkxidy69UsygLGxc3J7utkQ&s"]
    return random.choice(links)

def rand_desc():
    return random.choice(descriptions)

def create_random_card():
    payload = {
        "name": rand_name(),
        "link": rand_link(),
        "description": rand_desc(),
        "like": False
    }
    response = requests.post(endpoint, json=payload)
    if response.status_code == 201:
        print(f"Tarjeta creada: {payload['name']}")
    else:
        print(f"Error {response.status_code}: {response.text}")

if __name__ == "__main__":
    # Crear 10 tarjetas aleatorias
    for _ in range(10):
        create_random_card()
