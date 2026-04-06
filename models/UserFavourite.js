const mongoose = require('mongoose');

/**
 * UserFavourite — tracks which users have favourited which lakes/catches
 * Separate collection keeps User and Lake models clean.
 * FK: user → User._id
 * FK: lake / catch → respective models (sparse, one must be set)
 */
const userFavouriteSchema = new mongoose.Schema({
  user:        { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  targetType:  { type: String, enum: ['lake', 'catch'], required: true },
  lake:        { type: mongoose.Schema.Types.ObjectId, ref: 'Lake',     default: null },
  catch:       { type: mongoose.Schema.Types.ObjectId, ref: 'BassPorn', default: null },
}, { timestamps: true });

// Unique pair per user + target
userFavouriteSchema.index({ user: 1, targetType: 1, lake: 1 },  { unique: true, sparse: true });
userFavouriteSchema.index({ user: 1, targetType: 1, catch: 1 }, { unique: true, sparse: true });
userFavouriteSchema.index({ lake: 1 });
userFavouriteSchema.index({ catch: 1 });

module.exports = mongoose.model('UserFavourite', userFavouriteSchema);
