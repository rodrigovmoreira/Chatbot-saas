# 🤖 Chatbot SaaS (MVP) - Twilio Version

[![Node.js](https://img.shields.io/badge/Node.js-18%2B-green?logo=node.js)](https://nodejs.org/)
[![Twilio](https://img.shields.io/badge/Twilio-API-red?logo=twilio)](https://www.twilio.com/)
[![MongoDB](https://img.shields.io/badge/MongoDB-Atlas-green?logo=mongodb)](https://www.mongodb.com/)
[![DeepSeek](https://img.shields.io/badge/AI-DeepSeek-blue)](https://deepseek.com/)

Um SaaS de atendimento automatizado para WhatsApp focado no nicho de Tatuagem (MVP). Utiliza a API oficial do Twilio para comunicação e IA Generativa (DeepSeek) para atuar como um "Vendedor Especialista", realizando triagem e tirando dúvidas de clientes.

---

## 🏗️ Arquitetura do Projeto

O projeto funciona em arquitetura **Monorepo** (Frontend e Backend na mesma pasta raiz):

- **Backend (Porta 3001):** Node.js + Express. Gerencia o Webhook do Twilio, conecta com a IA e Banco de Dados.
- **Frontend (Porta 3000):** React + Chakra UI. Painel administrativo (Dashboard) para visualização de status.
- **Túnel (Ngrok):** Expõe o backend local para a nuvem do Twilio.

---

## ✅ Pré-requisitos (Checklist de Setup)

Antes de rodar, você precisa ter:

1.  **Node.js** instalado.
2.  **Conta no MongoDB Atlas:** Cluster criado e string de conexão (`mongodb+srv://...`).
3.  **Conta no Twilio:**
    - Account SID e Auth Token.
    - Número da Sandbox configurado (Ex: `whatsapp:+14155238886`).
4.  **Chave de API DeepSeek:** Para o cérebro da IA.
5.  **Ngrok:** Instalado para criar o túnel de conexão.

---

## 🚀 Instalação e Configuração

### 1. Instalar Dependências
Na pasta raiz do projeto, execute o comando que instala tudo (Backend e Frontend):
```bash
npm run install:all
``` 

## .env - Pasta backend
```bash
MONGO_URI=sua_string_conexao_mongo
JWT_SECRET=sua_senha_secreta_jwt

# Inteligência Artificial
DEEPSEEK_API_KEY=sua_chave_deepseek
DEEPSEEK_API_URL=[https://api.deepseek.com/chat/completions](https://api.deepseek.com/chat/completions)
DEEPSEEK_MODEL=deepseek-chat

# Twilio (WhatsApp)
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=xxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_WHATSAPP_NUMBER=whatsapp:+14155238886
``` 

## .env - Pasta frontend
```bash
REACT_APP_API_URL=http://localhotst:3000
REACT_APP_WS_URL=http://localhost:3000
``` 

## 🤝 Como Contribuir
- Faça um fork do projeto
- Crie sua branch (git checkout -b feature/nova-feature)
- Commit suas mudanças (git commit -m 'Adiciona nova feature')
- Push para a branch (git push origin feature/nova-feature)
- Abra um Pull Request

## 
Desenvolvido com ❤️ por Rodrigo Vasconcelos Moreira