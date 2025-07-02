Pegar IP local

ifconfig | grep "inet " | grep -v 127.0.0.1


Testar websocket local
ws://192.168.0.176:3000
idUser = 684b9f61d6219815a0f08b65
idCharger = NBK0000324020039   -  linda60

subir com o Docker

    docker-compose build ou docker-compose build --no-cache
    docker-compose up

parar

    docker-compose down

matar cache

    docker-compose build --no-cacheocker-compose down --rmi all --volumes --remove-orphans
    docker builder prune -a -f
    docker image prune -a -f

Testar websocket

     wscat -c ws://192.168.0.176:3000/charger-01

References
    https://www.ampcontrol.io/ocpp-guide/how-to-start-an-ocpp-charging-session-with-starttransaction

Carregador:

{ 
    "name": "Sol Fort Plug Charger - Posto Ipiranga (DC 60kW)",
    "serialNumber": "linda60",
    "vendor": "string",
    "model": "string",
    "status": "Disconnected",
    "isOnline": true,
    "lastHeartbeat": "2025-06-26T03:55:57.756Z",
    "latitude": -15.75522714,
    "longitude": -48.25771619,
    "description": "Sol Fort Plug Charger - Posto Ipiranga (DC 60kW)",
    "address": "Quadra 12 - Águas Lindas de Goiás",
    "is24Hours": true,
    "openingHours": "00:00-23:59",
    "pricePerKw": 1.49,
    "connectors": [
        {
            "connectorId": 1,
            "status": "Disconnected",
            "type": "CCS Type 2",
            "powerKw": 30,
            "currentTransactionId": 0,
            "lastStatusTimestamp": "2025-06-26T03:55:57.756Z"
        },
        {
            "connectorId": 2,
            "status": "Disconnected",
            "type": "CCS Type 2",
            "powerKw": 30,
            "currentTransactionId": 0,
            "lastStatusTimestamp": "2025-06-26T03:55:57.756Z"
        }
    ]
}

