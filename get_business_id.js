const mongoose = require('mongoose');
require('dotenv').config({ path: '.env' });
const BusinessConfig = require('./backend/models/BusinessConfig');

async function run() {
  await mongoose.connect(process.env.MONGO_URI);
  const config = await BusinessConfig.findOne();
  if (config) {
    console.log('BUSINESS_ID=' + config._id);
  } else {
    console.log('NO_BUSINESS_FOUND');
  }
  await mongoose.disconnect();
}
run();
