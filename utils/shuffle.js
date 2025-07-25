// utils/shuffle.js

function shuffleArray(array) {
  return array.sort(() => Math.random() - 0.5);
}

function chunkArray(array, size) {
  const result = [];
  for (let i = 0; i < array.length; i += size) {
    result.push(array.slice(i, i + size));
  }
  return result;
}

function generateAllPairs(array) {
  const pairs = [];
  for (let i = 0; i < array.length; i++) {
    for (let j = i + 1; j < array.length; j++) {
      pairs.push([array[i], array[j]]);
    }
  }
  return pairs;
}

export {
  shuffleArray,
  chunkArray,
  generateAllPairs
};