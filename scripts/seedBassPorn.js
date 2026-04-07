require('dotenv').config();
const connectDB = require('../config/db');
const User = require('../models/User');
const Lake = require('../models/Lake');
const BassPorn = require('../models/BassPorn');

const sampleCatches = [
  {
    species: 'Largemouth Bass',
    weight: 6.2,
    weightUnit: 'lbs',
    length: 22,
    technique: 'Flipping Grass Mats',
    bait: 'Texas-rigged creature bait',
    depth: '6ft',
    description: 'Early morning bite around dense hydrilla edges.',
    caughtAt: '2026-03-18T09:10:00.000Z',
    weatherSnapshot: { temp: '71F', weather: 'Sunny', wind: '5 mph' },
    image:
      'https://images.unsplash.com/photo-1516655855035-d5215bcb5604?auto=format&fit=crop&w=1200&q=80',
    status: 'active',
    featured: true,
  },
  {
    species: 'Smallmouth Bass',
    weight: 4.1,
    weightUnit: 'lbs',
    length: 19,
    technique: 'Drop Shot',
    bait: 'Shad worm',
    depth: '18ft',
    description: 'Suspended fish over rocky points.',
    caughtAt: '2026-03-20T14:30:00.000Z',
    weatherSnapshot: { temp: '64F', weather: 'Cloudy', wind: '11 mph' },
    image:
      'https://images.unsplash.com/photo-1524704796725-9fc3044a58b2?auto=format&fit=crop&w=1200&q=80',
    status: 'active',
    featured: false,
  },
  {
    species: 'Spotted Bass',
    weight: 3.3,
    weightUnit: 'lbs',
    length: 17,
    technique: 'Underspin',
    bait: 'Paddle tail swimbait',
    depth: '12ft',
    description: 'Schooling fish near creek channel swings.',
    caughtAt: '2026-03-22T11:45:00.000Z',
    weatherSnapshot: { temp: '66F', weather: 'Windy', wind: '16 mph' },
    image:
      'https://images.unsplash.com/photo-1498654896293-37aacf113fd9?auto=format&fit=crop&w=1200&q=80',
    status: 'pending',
    featured: false,
  },
  {
    species: 'Largemouth Bass',
    weight: 7.4,
    weightUnit: 'lbs',
    length: 24,
    technique: 'Topwater Walking Bait',
    bait: 'Pencil popper',
    depth: '4ft',
    description: 'Big fish exploded on top near shallow wood.',
    caughtAt: '2026-03-25T06:55:00.000Z',
    weatherSnapshot: { temp: '69F', weather: 'Partly Cloudy', wind: '4 mph' },
    image:
      'https://images.unsplash.com/photo-1544551763-46a013bb70d5?auto=format&fit=crop&w=1200&q=80',
    status: 'active',
    featured: true,
  },
  {
    species: 'Largemouth Bass',
    weight: 5.0,
    weightUnit: 'lbs',
    length: 21,
    technique: 'Football Jig',
    bait: 'Green pumpkin jig',
    depth: '20ft',
    description: 'Slow drag on hard bottom produced quality fish.',
    caughtAt: '2026-03-27T16:15:00.000Z',
    weatherSnapshot: { temp: '73F', weather: 'Clear', wind: '8 mph' },
    image:
      'https://images.unsplash.com/photo-1473116763249-2faaef81ccda?auto=format&fit=crop&w=1200&q=80',
    status: 'rejected',
    featured: false,
  },
  {
    species: 'Smallmouth Bass',
    weight: 4.8,
    weightUnit: 'lbs',
    length: 20,
    technique: 'Ned Rig',
    bait: 'TRD stick bait',
    depth: '10ft',
    description: 'Consistent bites around gravel transition zones.',
    caughtAt: '2026-03-29T12:05:00.000Z',
    weatherSnapshot: { temp: '62F', weather: 'Overcast', wind: '7 mph' },
    image:
      'https://images.unsplash.com/photo-1526778548025-fa2f459cd5ce?auto=format&fit=crop&w=1200&q=80',
    status: 'active',
    featured: false,
  },
];

const seedBassPorn = async () => {
  await connectDB();

  try {
    const users = await User.find({ role: { $ne: 'admin' } }).select('_id name');
    if (!users.length) {
      console.log('No non-admin users found. Run seedUsers.js first.');
      process.exit(1);
    }

    const lakes = await Lake.find({}).select('_id name');
    if (!lakes.length) {
      console.log('No lakes found. Run lake seed first or create a lake.');
      process.exit(1);
    }

    console.log('Clearing existing catches...');
    await BassPorn.deleteMany({});

    const docs = sampleCatches.map((catchItem, i) => {
      const user = users[i % users.length];
      const lake = lakes[i % lakes.length];

      return {
        ...catchItem,
        user: user._id,
        lake: lake._id,
        lakeName: lake.name,
      };
    });

    await BassPorn.insertMany(docs);

    // Rebuild lake catchCount from active catches.
    await Lake.updateMany({}, { $set: { catchCount: 0 } });
    const activeCounts = await BassPorn.aggregate([
      { $match: { status: 'active', lake: { $ne: null } } },
      { $group: { _id: '$lake', count: { $sum: 1 } } },
    ]);

    await Promise.all(
      activeCounts.map((entry) =>
        Lake.findByIdAndUpdate(entry._id, { $set: { catchCount: entry.count } }),
      ),
    );

    console.log(`Seeded ${docs.length} bass catches successfully.`);
    process.exit(0);
  } catch (error) {
    console.error('seedBassPorn error:', error);
    process.exit(1);
  }
};

seedBassPorn();
