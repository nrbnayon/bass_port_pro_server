const mongoose = require("mongoose");

const seasonalPatternSchema = new mongoose.Schema(
  {
    season: {
      type: String,
      enum: ["Spring", "Summer", "Fall", "Winter"],
      required: true,
    },
    techniques: [{ type: String }],
    bestTimes: { type: String },
    depthRange: { type: String },
    notes: { type: String },
  },
  { _id: false },
);

const lakeSchema = new mongoose.Schema(
  {
    // ── Identity ──────────────────────────────────────────────────────────────
    name: { type: String, required: true, trim: true },
    slug: { type: String, unique: true, lowercase: true, trim: true },
    state: { type: String, required: true, trim: true },
    description: { type: String, default: "" },

    // ── Physical Attributes ───────────────────────────────────────────────────
    size: { type: Number, default: 0 }, // in acres
    elevation: { type: Number, default: 0 }, // feet above sea level
    maxDepth: { type: Number, default: 0 }, // feet
    avgDepth: { type: Number, default: 0 }, // feet

    // ── Location ──────────────────────────────────────────────────────────────
    coordinates: {
      lat: { type: Number },
      lng: { type: Number },
    },
    nearestCity: { type: String, default: "" },

    // ── Species & Stats ──────────────────────────────────────────────────────
    species: [{ type: String }],
    bestSeason: { type: String, default: "" }, // e.g. "Spring, Fall"
    topTechniques: [{ type: String }],

    // ── Current Conditions (updated periodically) ──────────────────────────
    conditions: {
      temp: { type: String, default: "" }, // e.g. "72F"
      weather: { type: String, default: "" }, // e.g. "Clear"
      wind: { type: String, default: "" }, // e.g. "4.2 mph"
      clarity: {
        type: String,
        enum: ["Clear", "Stained", "Muddy", ""],
        default: "",
      },
      waterLevel: {
        type: String,
        enum: ["Normal", "High", "Low", "Rising", "Falling", ""],
        default: "",
      },
      pressure: {
        type: String,
        enum: ["Stable", "Rising", "Falling", ""],
        default: "",
      },
      condition: {
        type: String,
        enum: ["Excellent", "Good", "Fair", "Poor", ""],
        default: "",
      },
    },

    // ── Stats ─────────────────────────────────────────────────────────────────
    catchRate: { type: Number, default: 0 }, // fish per hour
    recordBass: { type: Number, default: 0 }, // in lbs

    // ── Rating (aggregated) ───────────────────────────────────────────────────
    rating: { type: Number, default: 0, min: 0, max: 5 },
    ratingCount: { type: Number, default: 0 },

    // ── Media ─────────────────────────────────────────────────────────────────
    image: { type: String, default: "" }, // primary image URL
    images: [{ type: String }], // gallery images
    color: { type: String, default: "from-cyan-700/80 to-sky-900/80" }, // CSS gradient

    // ── Seasonal Patterns ─────────────────────────────────────────────────────
    seasonalPatterns: [seasonalPatternSchema],

    // ── Boat/Facility Information ─────────────────────────────────────────────
    facilities: {
      boatRamp: { type: Boolean, default: false },
      marina: { type: Boolean, default: false },
      camping: { type: Boolean, default: false },
      fishingPier: { type: Boolean, default: false },
      baitShop: { type: Boolean, default: false },
    },

    // ── Status & Admin ────────────────────────────────────────────────────────
    status: {
      type: String,
      enum: ["active", "pending", "rejected", "closed"],
      default: "pending",
    },
    submittedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    approvedAt: { type: Date },
    featured: { type: Boolean, default: false },
    isFeatured: { type: Boolean, default: false },

    // ── Counters (denormalized for speed) ────────────────────────────────────
    reportCount: { type: Number, default: 0 },
    catchCount: { type: Number, default: 0 },
    reviewCount: { type: Number, default: 0 },
    favouriteCount: { type: Number, default: 0 },
  },
  { timestamps: true },
);

// Auto-generate slug from name before save
lakeSchema.pre("save", async function () {
  if ((this.isModified("name") || this.isNew) && !this.slug) {
    this.slug = this.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  }
});

// Text index for search
lakeSchema.index({ name: "text", state: "text", description: "text" });
lakeSchema.index({ status: 1, featured: -1, rating: -1 });
lakeSchema.index({ state: 1 });

module.exports = mongoose.model("Lake", lakeSchema);
