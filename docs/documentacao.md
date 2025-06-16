
# 📘 Documentação de Configurações e Credenciais

## 🔑 Credenciais de APIs e Serviços

### 🔹 Google Maps API
- **Chave**: `AIzaSyDc4ay3vaMwWsRsR_NqvsOj6SptUFmgd2E`

---

### 🔹 Growatt

#### 🌐 Portal de Servidor
- **URL**: [https://server.growatt.com/index](https://server.growatt.com/index)
    - **Usuário**: `quielneres`
    - **Senha**: `asd@458261`

#### 🌐 Portal OSS
- **URL**: [https://oss.growatt.com/login?lang=en](https://oss.growatt.com/login?lang=en)
    - **Usuários**:
        - `EEBKT8`
        - `EEBKT8001`
    - **Senha**: `asd@458261`

---

### 🔹 Pagar.me
- **Código de Recuperação**: `caa069ec-26be-4e17-82cf-366eb20e0d2a`
- **API Key (Modo Teste)**: `sk_test_f47318ced13b44b1a987f089ea10ee63`

---

### 🔹 MongoDB Atlas
- **Usuário**: `quielneres`
- **Senha**: `0SLzWjlvBNZntQsC`
- **String de Conexão**:
  ```
  mongodb+srv://quielneres:asd458261@solfort.nr2nl.mongodb.net/solfort-db?retryWrites=true&w=majority&appName=solfort
    ```
  SolFort mongoDB Atlas Connection String
   ``` 
  mongodb+srv://solfortplugcharger:o3VornaYz6cj98cG@sol-fort.9r3yn09.mongodb.net/solfort-db?retryWrites=true&w=majority&appName=sol-fort
  ```

---

## 🔌 Informações de Hardware (Carregadores EV)

### 🔸 Modelo 1
- **S/N**: `NBK0000324020022`
- **P/N**: `CS00.0004501`

### 🔸 Modelo 2
- **S/N**: `NBK0000324020035`
- **P/N**: `CS00.0004501`
- **Check Code**: `B5846`

---

## 📜 Configuração de Certificado SSL

### 🛠️ Gerar Keystore
```bash
keytool -genkey -v -keystore keystore.jks -keyalg RSA -keysize 2048 -validity 10000 -alias meu-alias
```

#### 🔐 Detalhes
- **Senha**: `458261`

#### 📇 Dados do Certificado
- **Nome**: Ezequiel Neres Nascimento
- **Unidade Organizacional**: e2n
- **Empresa**: e2n
- **Localidade**: Brasília
- **Estado**: Guará
- **País**: BR

### 📦 Gerar APK Universal
```bash
./gradlew clean
./gradlew bundleRelease

bundletool build-apks   --bundle=app/build/outputs/bundle/release/app-release.aab   --output=tmp/APKS/app.apks   --mode=universal   --ks=app/keystore.jks   --ks-key-alias=meu-alias   --ks-pass=pass:458261   --key-pass=pass:458261
```

---

## ⚡ OCPP (Open Charge Point Protocol)

- **Endpoints**:
    - `wss://evcharge.growatt.com:443/ocpp/ws`
    - `cs.prod.use-move.com/ocpp`

- **Documentação**: [ShowDoc OCPP](https://www.showdoc.com.cn/2590408859077035/11521004223050041)

### 🧾 Exemplo de Payload - Criar Carregador
```json
{
  "name": "Sol Fort Plug Charger - Supremo (DC 40kW)",
  "serialNumber": "NBK000032402002C",
  "vendor": "EVCharger",
  "model": "EV-30KW",
  "status": "Disconnected",
  "lastHeartbeat": "2025-02-02T19:49:50.011Z",
  "isOnline": true,
  "latitude": -18.92087,
  "longitude": -48.198021,
  "description": "piste",
  "address": "Aristides Fernandes Moraes",
  "is24Hours": true,
  "openingHours": "00:00-23:59",
  "isOpenNow": true,
  "connectorType": "CCS Type 2",
  "powerKw": 30,
  "pricePerKw": 1.49
}
```

---

## ☁️ Google Cloud (GCP)

### 💻 Acesso ao Servidor
```bash
gcloud auth list
gcloud compute ssh --zone "us-east1-b" "sf-server" --project "eco-diode-454100-t5"

```

---

## ⚙️ Variáveis de Ambiente (.env)

```env
OCPP_URL=https://e2n.online
OCPP_PORT=3000
API_PORT=4000
WS_PORT=9000
MONGO_URI=mongodb+srv://quielneres:asd458261@solfort.nr2nl.mongodb.net/solfort-db?retryWrites=true&w=majority&appName=solfort
RABBITMQ_URL=amqp://rabbitmq
API_BASE_URL=https://api.pagar.me/core/v5
PAGARME_API_KEY=sk_test_f47318ced13b44b1a987f089ea10ee63
```

---

## 🔒 Credenciais Google para Testes
- **E-mail**: `solfortplugcharger@gmail.com`
- **Senha**: `charger2025`

---

## 🚫 Lista Negra (IDs Banidos)

```
683f9d7c6eba8352ee2dbdb9
683f8bb86eba8352ee2dbbfe
6840f028eceb0f4efb6d2bc1
```

---

## 🛠️ Correções Pendentes (To-Do)

- [ ] Revisar fluxo de cadastro do cartão de crédito
- [ ] Revisar fluxo de cadastro geral
- [ ] Corrigir carregamento contínuo na interface
- [ ] Implementar carteira digital
- [ ] Mostrar tempo de carregamento para outros usuários
- [ ] Corrigir informações exibidas do carregador
- [ ] Adicionar avatar de usuário
- [ ] Ajustar transações de recarga
- [ ] Atualizar status dos carregadores em tempo real  
