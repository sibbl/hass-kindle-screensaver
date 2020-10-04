const moment = require("moment");

const getNearestTimestampIndex = (target, arr, idx1, idx2) => {
  if (Math.abs(target - arr[idx1].time) < Math.abs(target - arr[idx2].time)) {
    return idx1;
  } else {
    return idx2;
  }
};

module.exports = (timeseriesArr, startTime, endTime) => {
  const startIndex = Math.max(
    timeseriesArr.findIndex(({ time }) => time >= startTime),
    0
  );

  const reversedTimeseriesArr = [...timeseriesArr];
  reversedTimeseriesArr.reverse();

  const endIndex = Math.max(
    timeseriesArr.length -
      1 -
      reversedTimeseriesArr.findIndex(({ time }) => time <= endTime),
    0
  );

  const realStartIndex = getNearestTimestampIndex(
    startTime,
    timeseriesArr,
    Math.max(0, startIndex - 1),
    startIndex
  );
  const realEndIndex = getNearestTimestampIndex(
    startTime,
    timeseriesArr,
    endIndex,
    Math.min(timeseriesArr.length - 1, endIndex)
  );

  const result = timeseriesArr.slice(startIndex, endIndex);

  result.unshift({
    time: moment(startTime),
    value: timeseriesArr[realStartIndex].value,
  });
  result.push({
    time: moment(endTime),
    value: timeseriesArr[realEndIndex].value,
  });
  return result;
};
