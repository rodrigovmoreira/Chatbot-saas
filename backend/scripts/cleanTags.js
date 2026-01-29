require('dotenv').config(); // Carrega suas variáveis de ambiente (.env)
const mongoose = require('mongoose');

// --- CONFIGURAÇÃO ---
const MONGO_URI = process.env.MONGO_URI || process.env.DATABASE_URL; // Tenta pegar a URI padrão
const GARBAGE_CHAR = ''; // O caractere corrompido
const BAD_WORDS = ['TESTE', 'null', 'undefined']; // Palavras extras para limpar se quiser

// --- SCHEMA MÍNIMO ---
// Usamos strict: false para não causar erros de validação em campos que não conhecemos
const ContactSchema = new mongoose.Schema({
  name: String,
  tags: [String]
}, { strict: false });

const Contact = mongoose.model('Contact', ContactSchema);

async function cleanDatabase() {
  console.log('🧹 Iniciando faxina nas Tags...');

  if (!MONGO_URI) {
    console.error('❌ Erro: Nenhuma string de conexão encontrada no .env');
    process.exit(1);
  }

  try {
    await mongoose.connect(MONGO_URI);
    console.log('✅ Conectado ao MongoDB.');

    // Busca apenas contatos que têm alguma tag
    const contacts = await Contact.find({ tags: { $exists: true, $not: { $size: 0 } } });
    console.log(`🔍 Analisando ${contacts.length} contatos com tags...`);

    let fixedCount = 0;

    for (const contact of contacts) {
      const originalTags = contact.tags || [];
      
      // FILTRO: Remove tags que contêm o caractere corrompido ou estão na lista de proibidas
      const cleanTags = originalTags.filter(tag => {
        if (!tag) return false; // Remove nulos/vazios
        
        // Verifica se tem o caractere estranho
        if (tag.includes(GARBAGE_CHAR)) return false;

        // Opcional: Remove tags exatas da lista de BAD_WORDS (case insensitive)
        if (BAD_WORDS.includes(tag.toUpperCase())) return false;

        return true;
      });

      // Se o tamanho mudou, significa que limpamos algo
      if (cleanTags.length !== originalTags.length) {
        const removed = originalTags.filter(x => !cleanTags.includes(x));
        console.log(`🛠️  Corrigindo: ${contact.name || 'Sem Nome'}`);
        console.log(`   🔴 Removeu: ${removed.join(', ')}`);
        
        contact.tags = cleanTags;
        await contact.save();
        fixedCount++;
      }
    }

    console.log('---');
    console.log(`🏁 Faxina concluída!`);
    console.log(`✨ Total de contatos corrigidos: ${fixedCount}`);

  } catch (error) {
    console.error('❌ Erro fatal:', error);
  } finally {
    await mongoose.connection.close();
    process.exit(0);
  }
}

cleanDatabase();