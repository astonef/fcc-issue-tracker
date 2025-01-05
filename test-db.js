require('dotenv').config();
const { MongoClient } = require('mongodb');

const DB_URI = process.env.DB_URI;


console.log('DB_URI in test:', process.env.DB_URI);


(async () => {
  if (!DB_URI) {
    console.error('Error: DB_URI is undefined.');
    process.exit(1);
  }

  try {
    console.log('Connecting to the database...');
    const client = new MongoClient(DB_URI);
    await client.connect();
    console.log('Connected successfully!');
    await client.close();
  } catch (error) {
    console.error('Connection failed:', error);
  }
})();
