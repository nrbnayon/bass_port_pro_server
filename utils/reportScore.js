const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

const WEATHER_POINTS = {
  Sunny: 8,
  Clear: 8,
  "Partly Cloudy": 7,
  Overcast: 6,
  Rainy: 5,
  Windy: 4,
  Stormy: 2,
};

const CLARITY_POINTS = {
  Clear: 10,
  Stained: 7,
  Muddy: 3,
};

const WATER_LEVEL_POINTS = {
  Normal: 6,
  Rising: 5,
  Falling: 5,
  High: 4,
  Low: 4,
};

const PRESSURE_POINTS = {
  Stable: 6,
  Rising: 5,
  Falling: 4,
};

const getTextQualityPoints = (text = "") => {
  const length = text.trim().length;
  if (!length) return 0;
  if (length >= 180) return 7;
  if (length >= 120) return 5;
  if (length >= 60) return 3;
  return 1;
};

const calculateReportScore = (payload = {}) => {
  const catchCount = Math.max(0, Number(payload.catchCount) || 0);
  const biggestCatch = Math.max(0, Number(payload.biggestCatch) || 0);
  const tagsCount = Array.isArray(payload.tags) ? payload.tags.filter(Boolean).length : 0;
  const conditions = payload.conditions || {};

  const catchPoints = clamp((Math.min(catchCount, 20) / 20) * 35, 0, 35);
  const biggestCatchPoints = clamp((Math.min(biggestCatch, 10) / 10) * 25, 0, 25);

  const weatherPoints = WEATHER_POINTS[conditions.weather] || 0;
  const clarityPoints = CLARITY_POINTS[conditions.clarity] || 0;
  const waterLevelPoints = WATER_LEVEL_POINTS[conditions.waterLevel] || 0;
  const pressurePoints = PRESSURE_POINTS[conditions.pressure] || 0;
  const conditionPoints = clamp(
    weatherPoints + clarityPoints + waterLevelPoints + pressurePoints,
    0,
    30,
  );

  const detailPoints = clamp(
    getTextQualityPoints(payload.text) + Math.min(tagsCount, 3),
    0,
    10,
  );

  return Math.round(clamp(catchPoints + biggestCatchPoints + conditionPoints + detailPoints, 0, 100));
};

module.exports = {
  calculateReportScore,
};
