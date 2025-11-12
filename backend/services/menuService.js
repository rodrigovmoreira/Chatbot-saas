// services/menuService.js
const mongoose = require('mongoose');

const menuItemSchema = new mongoose.Schema({
  optionNumber: { type: String, required: true, unique: true },
  title: { type: String, required: true },
  description: { type: String, required: true },
  subOptions: [{
    number: String,
    text: String,
    handler: String // 'text', 'function', 'redirect'
  }],
  isActive: { type: Boolean, default: true }
});

const MenuItem = mongoose.model('MenuItem', menuItemSchema);

class MenuService {
  constructor() {
    this.initializeDefaultMenus();
  }

  async initializeDefaultMenus() {
    const defaultMenus = [
      {
        optionNumber: '1',
        title: 'Falar com atendente',
        description: 'Conexão com atendente humano',
        subOptions: [
          { number: '1', text: 'Voltar ao menu principal', handler: 'text' },
          { number: '2', text: 'Deixar número para retorno', handler: 'function' }
        ]
      },
      // ... outros menus padrão
    ];

    for (const menu of defaultMenus) {
      await MenuItem.updateOne(
        { optionNumber: menu.optionNumber },
        { $set: menu },
        { upsert: true }
      );
    }
  }

  async getMainMenu() {
    const activeMenus = await MenuItem.find({ isActive: true }).sort('optionNumber');
    let menuText = "🤖 *Atendimento Moreira Bot* 🤖\n\n";
    menuText += "Por favor, escolha uma opção:\n";
    
    activeMenus.forEach(menu => {
      menuText += `${menu.optionNumber}️⃣ - ${menu.title}\n`;
    });
    
    menuText += "\nDigite apenas o *número* da opção desejada.";
    return menuText;
  }

  async getMenuForOption(optionNumber) {
    const menu = await MenuItem.findOne({ optionNumber });
    if (!menu) return this.getMainMenu();

    let menuText = `📌 *${menu.title}*:\n\n`;
    menuText += `${menu.description}\n\n`;

    menu.subOptions.forEach(opt => {
      menuText += `${opt.number} - ${opt.text}\n`;
    });

    return menuText;
  }

  async addNewMenuOption(menuData) {
    const newMenu = new MenuItem(menuData);
    return await newMenu.save();
  }
}

module.exports = new MenuService();