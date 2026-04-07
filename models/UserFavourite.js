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
  lake:        { type: mongoose.Schema.Types.ObjectId, ref: 'Lake' },
  catch:       { type: mongoose.Schema.Types.ObjectId, ref: 'BassPorn' },
}, { timestamps: true });

// Unique pair per user + target
userFavouriteSchema.index(
  { user: 1, targetType: 1, lake: 1 },
  {
    name: 'uniq_user_lake_favourite',
    unique: true,
    partialFilterExpression: {
      targetType: 'lake',
      lake: { $exists: true },
    },
  },
);
userFavouriteSchema.index(
  { user: 1, targetType: 1, catch: 1 },
  {
    name: 'uniq_user_catch_favourite',
    unique: true,
    partialFilterExpression: {
      targetType: 'catch',
      catch: { $exists: true },
    },
  },
);
userFavouriteSchema.index({ lake: 1 });
userFavouriteSchema.index({ catch: 1 });

module.exports = mongoose.model('UserFavourite', userFavouriteSchema);
