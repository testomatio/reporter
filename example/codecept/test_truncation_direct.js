Feature('Argument Truncation Test @truncation');

function createLargeObject() {
  return {
    data: 'x'.repeat(50000),
    description: 'y'.repeat(30000),
    metadata: {
      field1: 'a'.repeat(10000),
      field2: 'b'.repeat(10000),
      field3: 'c'.repeat(10000),
    },
  };
}

function createSmallObject() {
  return { id: 1, name: 'test' };
}

function createLargeArray() {
  return Array(2000).fill('large string value with extra content to reach 100k chars');
}

function testTruncation(arg, expectedLength = 1000) {
  const stringified = JSON.stringify(arg);
  if (stringified.length > expectedLength) {
    return stringified.substring(0, expectedLength) + '...';
  }
  return stringified;
}

Before(({ I }) => {
  const largeObj = createLargeObject();
  const objSize = JSON.stringify(largeObj).length;
  console.log('Before hook - Large object size:', objSize);

  // This step with large object should trigger truncation in hook steps
  I.expectTrue(objSize > 100000);
  I.expectEqual(typeof largeObj, 'object');
});

Scenario('Unit test for argument truncation logic', ({ I }) => {
  const smallObj = createSmallObject();
  const smallResult = testTruncation(smallObj);
  I.expectTrue(smallResult.length < 100);
  I.expectFalse(smallResult.endsWith('...'));

  const largeObj = createLargeObject();
  const largeObjSize = JSON.stringify(largeObj).length;
  console.log('Large object size:', largeObjSize);
  const largeResult = testTruncation(largeObj);
  I.expectTrue(largeObjSize > 100000);
  I.expectTrue(largeResult.length === 1003);
  I.expectTrue(largeResult.endsWith('...'));

  const largeArray = createLargeArray();
  const largeArraySize = JSON.stringify(largeArray).length;
  console.log('Large array size:', largeArraySize);
  const arrayResult = testTruncation(largeArray);
  I.expectTrue(largeArraySize > 100000);
  I.expectTrue(arrayResult.length === 1003);
  I.expectTrue(arrayResult.endsWith('...'));

  const longString = 'a'.repeat(150000);
  const stringResult = testTruncation(longString);
  console.log('Long string size:', longString.length);
  I.expectTrue(longString.length > 100000);
  I.expectTrue(stringResult.length === 1003);
  I.expectTrue(stringResult.endsWith('...'));
});
