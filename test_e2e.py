import requests
import time
import sys

# ==========================================
# CONFIGURAÇÕES DO TESTE
# ==========================================
# Substitua pela URL da sua rota e pelo ID do seu negócio
BASE_URL = "http://localhost:3001/api/business/test/webhook" 
BUSINESS_ID = "698d22858f8e4151bddc90ce" 

# Um número falso (se quiser testar um novo contato toda vez, mude um dígito aqui)
NUMERO_TESTE = "5511999999001"

def chat(texto, descricao=""):
    """Envia a mensagem para o Node.js e imprime a resposta do Bot"""
    print(f"\n{'-'*50}")
    print(f"📍 ETAPA: {descricao.upper()}")
    print(f"👤 Você: {texto}")
    
    payload = {
        "from": NUMERO_TESTE,
        "body": texto,
        "businessId": BUSINESS_ID
    }
    
    print("⏳ Aguardando IA processar (Buffer Node + DeepSeek)...")
    
    try:
        # Aumentei o timeout para dar tempo da IA pensar com calma
        res = requests.post(BASE_URL, json=payload, timeout=90)
        
        if res.status_code == 200:
            resposta_bot = res.json().get('reply', '[Bot retornou mensagem vazia]')
            print(f"🤖 Bot : {resposta_bot}")
        else:
            print(f"❌ Erro do Servidor: {res.status_code} - {res.text}")
    except requests.exceptions.Timeout:
         print("❌ Erro: Tempo limite esgotado. A IA demorou muito.")
    except Exception as e:
        print(f"❌ Erro de Conexão: {e}")
        
    # O SEGREDO DO RITMO: Espera 8 segundos antes de iniciar o próximo passo do funil
    print("⏳ (Aguardando para simular tempo de digitação humana...)")
    time.sleep(8)

# ==========================================
# EXECUÇÃO DO ROTEIRO
# ==========================================
print("🚀 INICIANDO TESTE DE ESTRESSE E FUNIL (E2E) 🚀")

# 1. O Início (Novo Cliente)
chat("Oi, tudo bem?", "Quebra-Gelo e Identificação")

# 2. Salvar o Nome
chat("Me chamo Carlos Testador", "Forçando a Tool de Salvar Nome")

# 3. Pesquisa de Catálogo (Uso de Tool)
chat("Eu queria saber quais serviços vocês oferecem e quanto custa o mais barato.", "Pesquisa de Produto")

# 4. PROBLEMA SIMULADO A: Cliente não diz a data
chat("Legal, gostei. Quero agendar esse serviço mais barato.", "Erro A: Tentativa de agendamento sem data")

# 5. Fluxo Feliz: Agendamento Relativo
chat("Pode ser para amanhã às 14h então.", "Agendamento (Cálculo de Data/Hora e Duração)")

# 6. PROBLEMA SIMULADO B: Conflito de Horário (Double Booking)
# Como acabamos de agendar amanhã às 14h, a IA deve negar essa próxima mensagem.
chat("Opa, meu amigo também quer ir. Consegue agendar ele junto comigo amanhã às 14h?", "Erro B: Conflito de Agenda")

# 7. PROBLEMA SIMULADO C: Objeção de Preço
chat("Deixa quieto, vi aqui e tá muito caro pra mim. Vou fazer em outro lugar.", "Erro C: Objeção e Tentativa de Retenção")

print("\n✅ Teste E2E Finalizado com Sucesso!")