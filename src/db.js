import mongoose from 'mongoose';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/pos';

export async function conectarMongo() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('Conectado a MongoDB:', mongoose.connection.name);
  } catch (err) {
    console.error('Error al conectar a MongoDB:', err.message);
    throw err;
  }
}

export async function getNextId(Model) {
  const last = await Model.findOne().sort({ id: -1 }).select('id').lean();
  return (last?.id ?? 0) + 1;
}
