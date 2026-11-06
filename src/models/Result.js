const mongoose = require('mongoose');

const resultSchema = new mongoose.Schema(
  {
    roomCode: String,
    playerX: String,
    playerO: String,
    winner: { type: String, enum: ['X', 'O', 'draw'] },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Result', resultSchema);
