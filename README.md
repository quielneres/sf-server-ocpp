Pegar IP local

ifconfig | grep "inet " | grep -v 127.0.0.1

ws://192.168.0.176:3000

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

