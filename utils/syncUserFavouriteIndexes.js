const UserFavourite = require('../models/UserFavourite');

const syncUserFavouriteIndexes = async () => {
  const collection = UserFavourite.collection;

  const existingIndexes = await collection.indexes();
  const existingNames = new Set(existingIndexes.map((idx) => idx.name));

  const legacyIndexes = [
    'user_1_targetType_1_lake_1',
    'user_1_targetType_1_catch_1',
  ];

  for (const name of legacyIndexes) {
    if (existingNames.has(name)) {
      await collection.dropIndex(name);
      console.log(`[IndexSync] Dropped legacy index: ${name}`);
    }
  }

  await collection.createIndex(
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

  await collection.createIndex(
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

  console.log('[IndexSync] UserFavourite indexes are up to date');
};

module.exports = {
  syncUserFavouriteIndexes,
};
