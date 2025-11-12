# 🤖 Chatbot WhatsApp - Rodrigo Moreira

[![Node.js](https://img.shields.io/badge/Node.js-18%2B-green?logo=node.js)](https://nodejs.org/)
[![whatsapp-web.js](https://img.shields.io/badge/whatsapp--web.js-1.31-blue)](https://wwebjs.dev/)
[![License](https://img.shields.io/badge/License-MIT-yellow)](https://opensource.org/licenses/MIT)

Um chatbot inteligente para WhatsApp desenvolvido em Node.js, com integração de IA generativa para respostas contextualizadas e armazenamento de histórico de conversas.
## ✨ Funcionalidades Principais

- **Respostas Inteligentes** 🧠 - Integração com API de IA (DeepSeek) para respostas naturais e contextualizadas
- **Histórico de Conversas** 💾 - Armazenamento de mensagens no MongoDB para manter contexto
- **Controle de Sessão** 🧩 - Gerenciamento de estado por usuário
- **UX Aprimorada** ✍️ - Efeitos de digitação simulada para melhor experiência
- **Segurança** 🔒 - Validação de mensagens e tratamento de erros robusto

## 🛠️ Tecnologias Utilizadas

- **Backend**: Node.js
- **WhatsApp**: whatsapp-web.js (v1.31)
- **Banco de Dados**: MongoDB (via Mongoose)
- **IA**: DeepSeek API
- **Outras Libs**:
  - Axios - Requisições HTTP
  - dotenv - Gerenciamento de variáveis de ambiente
  - qrcode-terminal - Autenticação via QR Code

## 📦 Instalação

1. Clone o repositório:
```bash
git clone https://github.com/rodrigovmoreira/Chatbot-saas.git
cd chatbot-whatsapp
```
2. Instale as dependências:
```bash
npm install
```

3. Configure o ambiente:

- Crie um arquivo .env baseado no .env.example
- Adicione suas credenciais:
```bash
MONGO_URI=sua_string_de_conexao_mongodb
JWT_SECRET=coloque-uma-senha-forte-aqui-para-ter-maior-proteção-de-dados
DEEPSEEK_API_KEY=sua_chave_api
DEEPSEEK_API_URL=https://api.deepseek.com/v1
DEEPSEEK_MODEL=deepseek-chat
```

4. Inicie o bot:
```bash
npm start
```

5. Escaneie o QR Code com seu WhatsApp

## 🌟 Destaques Técnicos
- Contexto de Conversa: Armazena as últimas 5 mensagens para respostas contextualizadas
- Tipagem de Mensagens: Separa mensagens de usuário e bot no banco de dados
- Tratamento de Erros: Respostas alternativas quando a IA não está disponível
- Performance: Monitoramento do tempo de resposta da IA

📌 Roadmap
- ✅ Conexão básica com WhatsApp
- ✅ Integração com IA (DeepSeek)
- ✅ Armazenamento com MongoDB

## 🤝 Como Contribuir
- Faça um fork do projeto
- Crie sua branch (git checkout -b feature/nova-feature)
- Commit suas mudanças (git commit -m 'Adiciona nova feature')
- Push para a branch (git push origin feature/nova-feature)
- Abra um Pull Request

## 
Desenvolvido com ❤️ por Rodrigo Vasconcelos Moreira