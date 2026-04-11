/**
 * Utility for managing bounded arrays in MongoDB documents
 * Prevents memory leaks from unbounded array growth (likedBy, flaggedBy, helpfulBy, etc.)
 */

// Maximum size for social interaction arrays
const MAX_LIKES = 10000;
const MAX_FLAGS = 1000;
const MAX_HELPFUL = 5000;

/**
 * Slices an array to keep only the most recent N items
 * MongoDB keeps insertion order, so this keeps the most recent additions
 */
const sliceArray = (array, maxSize) => {
  if (!array || array.length <= maxSize) return array;
  return array.slice(-maxSize);
};

/**
 * Add to a bounded array with automatic slicing
 */
const addToBoundedArray = (array, item, maxSize) => {
  if (!array) array = [];
  array.push(item);
  return sliceArray(array, maxSize);
};

/**
 * Remove from a bounded array
 */
const removeFromBoundedArray = (array, item) => {
  if (!array) return [];
  return array.filter(id => id.toString() !== item.toString());
};

/**
 * Prepare update operation for toggling array membership with size limit
 * Returns MongoDB update object that can be used with findByIdAndUpdate
 */
const getToggleArrayUpdate = (arrayFieldName, itemId, isAdding, maxSize) => {
  if (isAdding) {
    // Use $push with $slice to add while capping array size
    return {
      $push: {
        [arrayFieldName]: {
          $each: [itemId],
          $slice: -maxSize // Keep only last maxSize items
        }
      }
    };
  } else {
    // Use $pull to remove
    return {
      $pull: {
        [arrayFieldName]: itemId
      }
    };
  }
};

module.exports = {
  MAX_LIKES,
  MAX_FLAGS,
  MAX_HELPFUL,
  sliceArray,
  addToBoundedArray,
  removeFromBoundedArray,
  getToggleArrayUpdate,
};
