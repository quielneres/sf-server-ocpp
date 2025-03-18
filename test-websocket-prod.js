const { RPCClient } = require('ocpp-rpc');

const client = new RPCClient({
    endpoint: 'wss://e2n.online/ocpp',
    identity: 'charger-01',
    protocols: ['ocpp1.6'],
});

client.on('open', () => {
    console.log('Conectado ao servidor OCPP');
    client.call('BootNotification', {
        chargePointVendor: 'VendorX',
        chargePointModel: 'ModelY',
    }).then(console.log).catch(console.error);
});

client.on('error', (err) => {
    console.error('Erro na conexão:', err);
});