/*! @lekoala/calendar v0.1.0 - https://github.com/lekoala/calendar */
(() => {
  // node_modules/temporal-polyfill/chunks/root.js
  var NativeTemporal = globalThis.Temporal;

  // node_modules/temporal-utils/dist/errorMessages.js
  var expectedPositive = (entityName, num) => `Non-positive ${entityName}: ${num}`;
  var expectedFinite = (entityName, num) => `Non-finite ${entityName}: ${num}`;
  var forbiddenBigIntToNumber = (entityName) => `Cannot convert bigint to ${entityName}`;
  var invalidObject = "Invalid object";
  var numberOutOfRange = (entityName, val, min, max) => invalidEntity(entityName, val) + `; must be between ${min}-${max}`;
  var invalidEntity = (fieldName, val) => `Invalid ${fieldName}: ${val}`;

  // node_modules/temporal-utils/dist/utils.js
  var nanoInMicro = 1000;
  var nanoInMilli = 1e6;
  var nanoInSec = 1e9;
  var nanoInMinute = 60000000000;
  var nanoInHour = 3600000000000;
  function normalizeOptions(options) {
    if (options === undefined) {
      return Object.create(null);
    }
    return requireObjectLike(options);
  }
  function toFiniteNumber(arg, entityName = "number") {
    if (typeof arg === "bigint") {
      throw new TypeError(forbiddenBigIntToNumber(entityName));
    }
    arg = Number(arg);
    if (!Number.isFinite(arg)) {
      throw new RangeError(expectedFinite(entityName, arg));
    }
    return arg;
  }
  function toIntegerWithTrunc(arg, entityName) {
    return Math.trunc(toFiniteNumber(arg, entityName)) || 0;
  }
  function toPositiveIntegerWithTruncation(arg, entityName) {
    return requireNumberIsPositive(toIntegerWithTrunc(arg, entityName), entityName);
  }
  function requireNumberIsPositive(num, entityName = "number") {
    if (num <= 0) {
      throw new RangeError(expectedPositive(entityName, num));
    }
    return num;
  }
  function constrainToRange(num, min, max) {
    return Math.min(Math.max(num, min), max);
  }
  function isObjectLike(arg) {
    return arg !== null && (typeof arg === "object" || typeof arg === "function");
  }
  function requireObjectLike(arg) {
    if (!isObjectLike(arg)) {
      throw new TypeError(invalidObject);
    }
    return arg;
  }
  // node_modules/temporal-polyfill/chunks/internal.js
  var invalidEntity2 = invalidEntity;
  var missingField = (fieldName) => `Missing ${fieldName}`;
  var noValidFields = (validFields) => "No valid fields: " + validFields.join();
  var invalidBag = "Invalid bag";
  var invalidChoice = (fieldName, val, choiceMap) => invalidEntity(fieldName, val) + "; must be " + Object.keys(choiceMap).join();
  var forbiddenValueOf = "Cannot use valueOf";
  var invalidCallingContext = "Invalid calling context";
  var missingYear = (allowEra) => "Missing year" + (allowEra ? "/era/eraYear" : "");
  var invalidLeapMonth = "Invalid leap month";
  var invalidCalendar = (calendarId) => invalidEntity("Calendar", calendarId);
  var exoticCalendarRequired = (calendarId, remedy) => `Unknown calendar ${calendarId}; might need ${remedy}`;
  var invalidTimeZone = (calendarId) => invalidEntity("TimeZone", calendarId);
  var outOfBoundsDate = "Out-of-bounds date";
  var failedParse = (s) => `Cannot parse: ${s}`;
  var invalidSubstring = (substring) => `Invalid substring: ${substring}`;
  var constrainToRange2 = constrainToRange;
  var isObjectLike2 = isObjectLike;
  function throwRangeError(message) {
    throw new RangeError(message);
  }
  function throwTypeError(message) {
    throw new TypeError(message);
  }
  function clampProp(props, propName, min, max, overflow) {
    return clampEntity(propName, ((props, propName) => {
      const propVal = props[propName];
      return propVal === undefined && throwTypeError(missingField(propName)), propVal;
    })(props, propName), min, max, overflow);
  }
  function clampEntity(entityName, num, min, max, overflow, choices) {
    const clamped = constrainToRange2(num, min, max);
    return overflow && num !== clamped && throwRangeError(((entityName, val, min, max, choices) => choices ? numberOutOfRange(entityName, choices[val], choices[min], choices[max]) : numberOutOfRange(entityName, val, min, max))(entityName, num, min, max, choices)), clamped;
  }
  function memoize(generator, MapClass = Map) {
    const map = new MapClass;
    return (key, ...otherArgs) => {
      if (map.has(key)) {
        return map.get(key);
      }
      const val = generator(key, ...otherArgs);
      return map.set(key, val), val;
    };
  }
  var createNameDescriptors = (name) => createPropDescriptors({
    name
  }, 1);
  var createPropDescriptors = (propVals, readonly) => mapProps((value) => ({
    value,
    configurable: 1,
    writable: !readonly
  }), propVals);
  var createStringTagDescriptors = (value) => ({
    [Symbol.toStringTag]: {
      value,
      configurable: 1
    }
  });
  function mapProps(transformer, props) {
    const res = {};
    for (const propName in props) {
      res[propName] = transformer(props[propName], propName);
    }
    return res;
  }
  function zipPropsConst(propNames, propVal) {
    const res = {};
    for (const propName of propNames) {
      res[propName] = propVal;
    }
    return res;
  }
  function createPropGetters(propNames) {
    const getters = {};
    for (const propName of propNames) {
      getters[propName] = (slots) => slots[propName];
    }
    return getters;
  }
  function pluckProps(propNames, props, dest = Object.create(null)) {
    for (const propName of propNames) {
      dest[propName] = props[propName];
    }
    return dest;
  }
  function allPropsEqual(propNames, props0, props1) {
    for (const propName of propNames) {
      if (props0[propName] !== props1[propName]) {
        return 0;
      }
    }
    return 1;
  }
  function zeroOutProps(propNames, clearUntilI, props) {
    const copy = {
      ...props
    };
    for (let i = 0;i < clearUntilI; i++) {
      copy[propNames[i]] = 0;
    }
    return copy;
  }
  function bindArgs(f, ...boundArgs) {
    return (...dynamicArgs) => f(...boundArgs, ...dynamicArgs);
  }
  function noop() {}
  function capitalize(s) {
    return s[0].toUpperCase() + s.substring(1);
  }
  function sortStrings(...strss) {
    return [].concat(...strss).sort();
  }
  function createRegExp(meat) {
    return new RegExp(`^${meat}$`, "i");
  }
  function parseSubsecNano(fracStr) {
    return parseInt(fracStr.padEnd(9, "0"));
  }
  function parseSign(s) {
    return s && s !== "+" ? -1 : 1;
  }
  function parseInt0(s) {
    return s === undefined ? 0 : parseInt(s);
  }
  function padNumber(digits, num) {
    return String(num).padStart(digits, "0");
  }
  var padNumber2 = /* @__PURE__ */ bindArgs(padNumber, 2);
  function compareNumbers(a, b) {
    return Math.sign(a - b);
  }
  function compareBigInts(a, b) {
    return a < b ? -1 : a > b ? 1 : 0;
  }
  function divFloorBigInt(num, denom) {
    const whole = num / denom;
    return num % denom < 0n ? whole - 1n : whole;
  }
  function divModFloorBigInt(num, divisor) {
    const quotient = divFloorBigInt(num, divisor);
    return [quotient, num - quotient * divisor];
  }
  function divModFloor(num, divisor) {
    return [Math.floor(num / divisor), modFloor(num, divisor)];
  }
  function modFloor(num, divisor) {
    return (num % divisor + divisor) % divisor;
  }
  function divTrunc(num, divisor) {
    return Math.trunc(num / divisor) || 0;
  }
  function modTrunc(num, divisor) {
    return num % divisor || 0;
  }
  function fabricateNearHalfFraction(halfCompare, sign = 1) {
    return sign * (0.5 + halfCompare / 5);
  }
  function hasHalf(num) {
    return Math.abs(num % 1) === 0.5;
  }
  var isoCalendarId = "iso8601";
  var gregoryCalendarId = "gregory";
  var gregoryEraOrigins = {
    bce: -1,
    ce: 0
  };
  function normalizeEraName(era) {
    const normalized = era.normalize("NFD").toLowerCase().replace(/[^a-z0-9]/g, "");
    return normalized === "bc" || normalized === "b" ? "bce" : normalized === "ad" || normalized === "a" ? "ce" : normalized;
  }
  var isoCalendarImpl = undefined;
  var gregoryCalendarImpl = 0;
  function getCalendarSlotId(calendar) {
    return calendar === isoCalendarImpl ? "iso8601" : calendar === 0 ? "gregory" : calendar.id;
  }
  var monthCodeRegExp = /^M(\d{2})(L?)$/;
  function parseMonthCode(monthCode) {
    const m = monthCodeRegExp.exec(monthCode);
    return m || throwRangeError(((monthCode) => `Invalid monthCode: ${monthCode}`)(monthCode)), [parseInt(m[1]), Boolean(m[2])];
  }
  function formatMonthCode(monthCodeNumber, isLeapMonth) {
    return "M" + padNumber2(monthCodeNumber) + (isLeapMonth ? "L" : "");
  }
  function monthCodeNumberToMonth(monthCodeNumber, isLeapMonth, leapMonth) {
    return monthCodeNumber + (isLeapMonth || leapMonth && monthCodeNumber >= leapMonth ? 1 : 0);
  }
  var unitNameMap = {
    nanosecond: 0,
    microsecond: 1,
    millisecond: 2,
    second: 3,
    minute: 4,
    hour: 5,
    day: 6,
    week: 7,
    month: 8,
    year: 9
  };
  var unitNamesAsc = /* @__PURE__ */ Object.keys(unitNameMap);
  var nanoInMicro2 = nanoInMicro;
  var nanoInMilli2 = nanoInMilli;
  var nanoInSec2 = nanoInSec;
  var nanoInMinute2 = nanoInMinute;
  var nanoInHour2 = nanoInHour;
  var nanoInUtcDay = 86400000000000;
  var unitNanoMap = [1, nanoInMicro2, nanoInMilli2, nanoInSec2, nanoInMinute2, nanoInHour2, nanoInUtcDay];
  var bigNanoInMicro = /* @__PURE__ */ BigInt(nanoInMicro2);
  var bigNanoInMilli = /* @__PURE__ */ BigInt(nanoInMilli2);
  var bigNanoInSec = /* @__PURE__ */ BigInt(nanoInSec2);
  var bigNanoInMinute = /* @__PURE__ */ BigInt(nanoInMinute2);
  var bigNanoInHour = /* @__PURE__ */ BigInt(nanoInHour2);
  var bigNanoInUtcDay = /* @__PURE__ */ BigInt(nanoInUtcDay);
  function divideBigNanoToExactNumber(bigNano, divisorNano) {
    const days = Number(bigNano / bigNanoInUtcDay);
    const timeNano = Number(bigNano % bigNanoInUtcDay);
    return days * (nanoInUtcDay / divisorNano) + (Math.trunc(timeNano / divisorNano) + timeNano % divisorNano / divisorNano);
  }
  var timeFieldNamesAsc = /* @__PURE__ */ unitNamesAsc.slice(0, 6);
  var timeGetters = /* @__PURE__ */ createPropGetters(timeFieldNamesAsc);
  var yearFieldNamesAsc = ["year"];
  var dayFieldNamesAsc = ["day"];
  var calendarDateFieldNamesAsc = ["day", "month", "year"];
  var offsetFieldNames = ["offset"];
  var timeZoneFieldNames = ["timeZone"];
  var eraYearFieldNames = ["era", "eraYear"];
  var allYearFieldNames = ["era", "eraYear", "year"];
  var monthFieldNames = ["month", "monthCode"];
  var monthDayFieldNames = ["day", "month", "monthCode"];
  var timeFieldNamesAlpha = /* @__PURE__ */ sortStrings(timeFieldNamesAsc);
  var yearFieldNamesWithEraAlpha = /* @__PURE__ */ sortStrings(eraYearFieldNames, yearFieldNamesAsc);
  var yearMonthFieldNamesAlpha = /* @__PURE__ */ sortStrings(monthFieldNames, yearFieldNamesAsc);
  var yearMonthFieldNamesWithEraAlpha = /* @__PURE__ */ sortStrings(eraYearFieldNames, yearMonthFieldNamesAlpha);
  var yearMonthCodeFieldNamesAlpha = /* @__PURE__ */ sortStrings(["monthCode"], yearFieldNamesAsc);
  var yearMonthCodeFieldNamesWithEraAlpha = /* @__PURE__ */ sortStrings(eraYearFieldNames, yearMonthCodeFieldNamesAlpha);
  var monthCodeDayFieldNamesAlpha = /* @__PURE__ */ sortStrings(dayFieldNamesAsc, ["monthCode"]);
  var dateFieldNamesAlpha = /* @__PURE__ */ sortStrings(dayFieldNamesAsc, yearMonthFieldNamesAlpha);
  var dateFieldNamesWithEraAlpha = /* @__PURE__ */ sortStrings(dayFieldNamesAsc, eraYearFieldNames, yearMonthFieldNamesAlpha);
  var dateTimeFieldNamesAlpha = /* @__PURE__ */ sortStrings(dateFieldNamesAlpha, timeFieldNamesAsc);
  var dateTimeFieldNamesWithEraAlpha = /* @__PURE__ */ sortStrings(dateFieldNamesWithEraAlpha, timeFieldNamesAsc);
  var dateTimeAndOffsetFieldNamesAlpha = /* @__PURE__ */ sortStrings(dateFieldNamesAlpha, timeFieldNamesAsc, offsetFieldNames);
  var dateTimeAndOffsetFieldNamesWithEraAlpha = /* @__PURE__ */ sortStrings(dateFieldNamesWithEraAlpha, timeFieldNamesAsc, offsetFieldNames);
  var dateTimeAndZoneFieldNamesAlpha = /* @__PURE__ */ sortStrings(dateFieldNamesAlpha, timeFieldNamesAsc, offsetFieldNames, timeZoneFieldNames);
  var dateTimeAndZoneFieldNamesWithEraAlpha = /* @__PURE__ */ sortStrings(dateFieldNamesWithEraAlpha, timeFieldNamesAsc, offsetFieldNames, timeZoneFieldNames);
  var yearMonthCodeDayFieldNamesAlpha = /* @__PURE__ */ sortStrings(dayFieldNamesAsc, yearMonthCodeFieldNamesAlpha);
  var yearMonthCodeDayFieldNamesWithEraAlpha = /* @__PURE__ */ sortStrings(dayFieldNamesAsc, eraYearFieldNames, yearMonthCodeFieldNamesAlpha);
  var timeFieldDefaults = /* @__PURE__ */ zipPropsConst(timeFieldNamesAsc, 0);
  function validateTimeFields(timeFields) {
    return constrainTimeFields(timeFields, 1), timeFields;
  }
  var maxValues = {
    hour: 23,
    minute: 59,
    second: 59
  };
  function constrainTimeFields(timeFields, overflow) {
    const constrainedFields = {};
    for (const fieldName of timeFieldNamesAsc) {
      constrainedFields[fieldName] = clampEntity(fieldName, timeFields[fieldName], 0, maxValues[fieldName] || 999, overflow);
    }
    return constrainedFields;
  }
  function timeFieldsToNano(timeFields) {
    return timeFieldsToSec(timeFields) * nanoInSec2 + timeFieldsToSubsecNano(timeFields);
  }
  function timeFieldsToMilli(timeFields) {
    return 1000 * timeFieldsToSec(timeFields) + timeFields.millisecond;
  }
  function timeFieldsToSec(timeFields) {
    return 3600 * timeFields.hour + 60 * timeFields.minute + timeFields.second;
  }
  function timeFieldsToSubsecNano(timeFields) {
    return timeFields.millisecond * nanoInMilli2 + timeFields.microsecond * nanoInMicro2 + timeFields.nanosecond;
  }
  function nanoToTimeAndDay(nano) {
    const [dayDelta, timeNano] = divModFloor(nano, nanoInUtcDay);
    return [nanoToTimeFields(timeNano), dayDelta];
  }
  function nanoToTimeFields(timeNano) {
    const [timeMilli, nanoAfterMilli] = divModFloor(timeNano, nanoInMilli2);
    const [microsecond, nanosecond] = divModFloor(nanoAfterMilli, nanoInMicro2);
    return milliToTimeFields(timeMilli, microsecond, nanosecond);
  }
  function milliToTimeFields(timeMilli, microsecond = 0, nanosecond = 0) {
    const [hour, milliAfterHour] = divModFloor(timeMilli, 3600000);
    const [minute, milliAfterMinute] = divModFloor(milliAfterHour, 60000);
    const [second, millisecond] = divModFloor(milliAfterMinute, 1000);
    return {
      hour,
      minute,
      second,
      millisecond,
      microsecond,
      nanosecond
    };
  }
  function epochNanoToSecMod(epochNano) {
    const [epochSec, nano] = divModFloorBigInt(epochNano, bigNanoInSec);
    return [Number(epochSec), Number(nano)];
  }
  function isoDateTimeToEpochNano(isoDateTime) {
    return isoDateToEpochNano(isoDateTime) + BigInt(timeFieldsToNano(isoDateTime));
  }
  function isoDateTimeToEpochMilli(isoDateTime) {
    return isoDateToEpochMilli(isoDateTime) + timeFieldsToMilli(isoDateTime);
  }
  function isoDateToEpochNano(isoDate) {
    return BigInt(isoDateToEpochDays(isoDate)) * bigNanoInUtcDay;
  }
  function isoDateToEpochMilli(isoDate) {
    return 86400000 * isoDateToEpochDays(isoDate);
  }
  function isoDateToEpochDays(isoDate) {
    return isoArgsToEpochDays(isoDate.year, isoDate.month, isoDate.day);
  }
  function isoArgsToEpochDays(isoYear, isoMonth = 1, isoDay = 1) {
    const monthIndex = isoMonth - 1;
    return isoYear += Math.floor(monthIndex / 12), isoMonth = modFloor(monthIndex, 12), Date.UTC(isoYear % 400 - 400, isoMonth, 0) / 86400000 + 146097 * (divTrunc(isoYear, 400) + 1) + isoDay;
  }
  function epochNanoToIsoDateTime(epochNano) {
    const [epochDays, nanoAfterDay] = divModFloorBigInt(epochNano, bigNanoInUtcDay);
    return {
      ...epochDaysToIsoDate(Number(epochDays)),
      ...nanoToTimeFields(Number(nanoAfterDay))
    };
  }
  function epochDaysToIsoDate(epochDays) {
    const legacyDate = new Date(86400000 * modFloor(epochDays, 146097));
    return {
      year: legacyDate.getUTCFullYear() + 400 * Math.floor(epochDays / 146097),
      month: legacyDate.getUTCMonth() + 1,
      day: legacyDate.getUTCDate()
    };
  }
  var isoEpochFirstLeapYear = 1972;
  function computeIsoMonthCodeParts(month) {
    return [month, 0];
  }
  function computeIsoYearMonthFieldsForMonthDay(monthCodeNumber, isLeapMonth) {
    if (!isLeapMonth) {
      return {
        year: 1972,
        month: monthCodeNumber
      };
    }
  }
  function computeIsoFieldsFromParts(year, month, day) {
    return {
      year,
      month,
      day
    };
  }
  function computeIsoDaysInMonth(year, month) {
    switch (month) {
      case 2:
        return computeIsoInLeapYear(year) ? 29 : 28;
      case 4:
      case 6:
      case 9:
      case 11:
        return 30;
    }
    return 31;
  }
  function computeIsoDaysInYear(year) {
    return computeIsoInLeapYear(year) ? 366 : 365;
  }
  function computeIsoInLeapYear(year) {
    return year % 4 == 0 && (year % 100 != 0 || year % 400 == 0);
  }
  function addIsoMonths(year, month, monthDelta) {
    return year += divTrunc(monthDelta, 12), (month += modTrunc(monthDelta, 12)) < 1 ? (year--, month += 12) : month > 12 && (year++, month -= 12), {
      year,
      month
    };
  }
  function diffIsoMonthSlots(year0, month0, year1, month1) {
    return 12 * (year1 - year0) + month1 - month0;
  }
  function computeIsoDayOfWeek(isoDateFields) {
    return modFloor(isoArgsToEpochDays(isoDateFields.year, isoDateFields.month, isoDateFields.day) + 4, 7) || 7;
  }
  function computeIsoDayOfYear(isoDateFields) {
    return isoArgsToEpochDays(isoDateFields.year, isoDateFields.month, isoDateFields.day) - isoArgsToEpochDays(isoDateFields.year) + 1;
  }
  function computeIsoWeekFields(isoDateFields) {
    let yearOfWeek = isoDateFields.year;
    let weekOfYear = Math.floor((computeIsoDayOfYear(isoDateFields) - computeIsoDayOfWeek(isoDateFields) + 10) / 7);
    let weeksInYear = computeIsoWeeksInYear(yearOfWeek);
    return weekOfYear < 1 ? weekOfYear = weeksInYear = computeIsoWeeksInYear(--yearOfWeek) : weekOfYear > weeksInYear && (weekOfYear = 1, weeksInYear = computeIsoWeeksInYear(++yearOfWeek)), {
      weekOfYear,
      yearOfWeek,
      Be: weeksInYear
    };
  }
  function computeIsoWeeksInYear(year) {
    const y0DayOfWeek = computeIsoDayOfWeek({
      year,
      month: 1,
      day: 1
    });
    return y0DayOfWeek === 4 || y0DayOfWeek === 3 && computeIsoInLeapYear(year) ? 53 : 52;
  }
  function computeGregoryEraFields({ year }) {
    return year < 1 ? {
      era: "bce",
      eraYear: 1 - year
    } : {
      era: "ce",
      eraYear: year
    };
  }
  function validateIsoDateTimeFields(isoDateTime) {
    return validateIsoDateFields(isoDateTime), validateTimeFields(isoDateTime);
  }
  function validateIsoDateFields(isoInternals) {
    return constrainIsoDateFields(isoInternals, 1), isoInternals;
  }
  function isIsoDateFieldsValid(isoDate) {
    return allPropsEqual(calendarDateFieldNamesAsc, isoDate, constrainIsoDateFields(isoDate));
  }
  function constrainIsoDateFields(isoDate, overflow) {
    const { year } = isoDate;
    const month = clampProp(isoDate, "month", 1, 12, overflow);
    return {
      year,
      month,
      day: clampProp(isoDate, "day", 1, computeIsoDaysInMonth(year, month), overflow)
    };
  }
  function computeCalendarDateFields(calendar, isoDate) {
    return calendar ? calendar.ae(isoDate) : isoDate;
  }
  function computeCalendarMonthCodeParts(calendar, year, month) {
    return calendar ? calendar.L(year, month) : computeIsoMonthCodeParts(month);
  }
  function computeCalendarEraFields(calendar, isoDate) {
    return calendar === 0 ? computeGregoryEraFields(isoDate) : calendar && calendar.h?.(isoDate) || {};
  }
  function computeCalendarIsoFieldsFromParts(calendar, year, month, day) {
    return calendar ? calendar.de(year, month, day) : computeIsoFieldsFromParts(year, month, day);
  }
  function computeCalendarMonthsInYearForYear(calendar, year) {
    return calendar ? calendar.j(year) : 12;
  }
  function computeCalendarDaysInMonthForYearMonth(calendar, year, month) {
    return calendar ? calendar.o(year, month) : computeIsoDaysInMonth(year, month);
  }
  function computeCalendarMonthCode(calendar, isoDate) {
    const { year, month } = computeCalendarDateFields(calendar, isoDate);
    const [monthCodeNumber, isLeapMonth] = computeCalendarMonthCodeParts(calendar, year, month);
    return formatMonthCode(monthCodeNumber, isLeapMonth);
  }
  function computeCalendarInLeapYear(calendar, isoDate) {
    const { year } = computeCalendarDateFields(calendar, isoDate);
    return calendar ? calendar.q(year) : computeIsoInLeapYear(year);
  }
  function computeCalendarMonthsInYear(calendar, isoDate) {
    const { year } = computeCalendarDateFields(calendar, isoDate);
    return computeCalendarMonthsInYearForYear(calendar, year);
  }
  function computeCalendarDaysInMonth(calendar, isoDate) {
    const { year, month } = computeCalendarDateFields(calendar, isoDate);
    return computeCalendarDaysInMonthForYearMonth(calendar, year, month);
  }
  function computeCalendarDaysInYear(calendar, isoDate) {
    const { year } = computeCalendarDateFields(calendar, isoDate);
    return calendar ? calendar.i(year) : computeIsoDaysInYear(year);
  }
  function computeCalendarDayOfYear(calendar, isoDate) {
    if (!calendar) {
      return computeIsoDayOfYear(isoDate);
    }
    const { year } = computeCalendarDateFields(calendar, isoDate);
    const yearStartIsoDate = computeCalendarIsoFieldsFromParts(calendar, year, 1, 1);
    return isoDateToEpochDays(isoDate) - isoDateToEpochDays(yearStartIsoDate) + 1;
  }
  function computeCalendarWeekOfYear(calendar, isoDate) {
    return calendar === isoCalendarImpl ? computeIsoWeekFields(isoDate).weekOfYear : undefined;
  }
  function computeCalendarYearOfWeek(calendar, isoDate) {
    return calendar === isoCalendarImpl ? computeIsoWeekFields(isoDate).yearOfWeek : undefined;
  }
  var durationFieldNamesAsc = /* @__PURE__ */ unitNamesAsc.map((unitName) => unitName + "s");
  var durationGetters = /* @__PURE__ */ createPropGetters(durationFieldNamesAsc);
  var durationFieldNamesAlpha = /* @__PURE__ */ sortStrings(durationFieldNamesAsc);
  var durationTimeFieldNamesAsc = /* @__PURE__ */ durationFieldNamesAsc.slice(0, 6);
  var durationDateFieldNamesAsc = /* @__PURE__ */ durationFieldNamesAsc.slice(6);
  var durationCalendarFieldNamesAsc = /* @__PURE__ */ durationDateFieldNamesAsc.slice(1);
  var durationFieldDefaults = /* @__PURE__ */ zipPropsConst(durationFieldNamesAsc, 0);
  var durationTimeFieldDefaults = /* @__PURE__ */ zipPropsConst(durationTimeFieldNamesAsc, 0);
  var clearDurationFields = /* @__PURE__ */ bindArgs(zeroOutProps, durationFieldNamesAsc);
  function requirePropDefined(optionName, optionVal) {
    return optionVal == null && throwRangeError(missingField(optionName)), optionVal;
  }
  var requireString = /* @__PURE__ */ bindArgs(requireType, "string");
  function requireType(typeName, arg, entityName = typeName) {
    return typeof arg !== typeName && throwTypeError(invalidEntity2(entityName, arg)), arg;
  }
  function requireNumberIsInteger(num, entityName = "number") {
    return Number.isInteger(num) || throwRangeError(((entityName, num) => `Non-integer ${entityName}: ${num}`)(entityName, num)), num || 0;
  }
  function toString(arg) {
    return typeof arg == "symbol" && throwTypeError("Cannot convert Symbol to string"), String(arg);
  }
  function toStringViaPrimitive(arg, entityName) {
    return isObjectLike(arg) ? String(arg) : requireString(arg, entityName);
  }
  function toBigInt(bi) {
    return typeof bi == "boolean" ? BigInt(bi ? 1 : 0) : typeof bi == "string" ? BigInt(bi) : (typeof bi != "bigint" && throwTypeError(`Invalid bigint: ${bi}`), bi);
  }
  function toStrictInteger(arg, entityName) {
    return requireNumberIsInteger(toFiniteNumber(arg, entityName), entityName);
  }
  function normalizeOptionsOrString(options, optionName) {
    return typeof options == "string" ? ((optionName, optionVal) => {
      const res = Object.create(null);
      return res[optionName] = optionVal, res;
    })(optionName, options) : requireObjectLike(options);
  }
  var smallestUnitStr = "smallestUnit";
  var overflowMap = {
    constrain: 0,
    reject: 1
  };
  var epochDisambigMap = {
    compatible: 0,
    reject: 1,
    earlier: 2,
    later: 3
  };
  var offsetDisambigMap = {
    reject: 0,
    use: 1,
    prefer: 2,
    ignore: 3
  };
  var calendarDisplayMap = {
    auto: 0,
    never: 1,
    critical: 2,
    always: 3
  };
  var timeZoneDisplayMap = {
    auto: 0,
    never: 1,
    critical: 2
  };
  var offsetDisplayMap = {
    auto: 0,
    never: 1
  };
  var roundingModeMap = {
    floor: 0,
    halfFloor: 1,
    ceil: 2,
    halfCeil: 3,
    trunc: 4,
    halfTrunc: 5,
    expand: 6,
    halfExpand: 7,
    halfEven: 8
  };
  var roundingModeFuncs = [Math.floor, (num) => hasHalf(num) ? Math.floor(num) : Math.round(num), Math.ceil, (num) => hasHalf(num) ? Math.ceil(num) : Math.round(num), Math.trunc, (num) => hasHalf(num) ? Math.trunc(num) || 0 : Math.round(num), (num) => num < 0 ? Math.floor(num) : Math.ceil(num), (num) => Math.sign(num) * Math.round(Math.abs(num)) || 0, (num) => hasHalf(num) ? (num = Math.trunc(num) || 0) + num % 2 : Math.round(num)];
  var directionMap = {
    previous: -1,
    next: 1
  };
  function coerceRoundingIncInteger(options) {
    const roundingInc = options.roundingIncrement;
    return roundingInc === undefined ? 1 : toIntegerWithTrunc(roundingInc, "roundingIncrement");
  }
  function coerceFractionalSecondDigits(options) {
    let subsecDigits = options.fractionalSecondDigits;
    if (subsecDigits !== undefined) {
      if (typeof subsecDigits != "number") {
        if (toString(subsecDigits) === "auto") {
          return;
        }
        throwRangeError(invalidEntity2("fractionalSecondDigits", subsecDigits));
      }
      subsecDigits = clampEntity("fractionalSecondDigits", Math.floor(subsecDigits), 0, 9, 1);
    }
    return subsecDigits;
  }
  function coerceUnitOption(optionName, options, minUnit = 0, ensureDefined) {
    let unitStr = options[optionName];
    if (unitStr === undefined) {
      return ensureDefined ? minUnit : undefined;
    }
    if (unitStr = toString(unitStr), unitStr === "auto") {
      return ensureDefined ? minUnit : null;
    }
    let unit = unitNameMap[unitStr];
    return unit === undefined && (unit = durationFieldNamesAsc.indexOf(unitStr)), unit < 0 && throwRangeError(invalidChoice(optionName, unitStr, unitNameMap)), unit;
  }
  function coerceChoiceOption(optionName, enumNameMap, options, defaultChoice = 0) {
    const enumArg = options[optionName];
    if (enumArg === undefined) {
      return defaultChoice;
    }
    const enumStr = toString(enumArg);
    const enumNum = enumNameMap[enumStr];
    return enumNum === undefined && throwRangeError(invalidChoice(optionName, enumStr, enumNameMap)), enumNum;
  }
  var coerceSmallestUnit = /* @__PURE__ */ bindArgs(coerceUnitOption, smallestUnitStr);
  var coerceLargestUnit = /* @__PURE__ */ bindArgs(coerceUnitOption, "largestUnit");
  var coerceTotalUnit = /* @__PURE__ */ bindArgs(coerceUnitOption, "unit");
  var coerceOverflow = /* @__PURE__ */ bindArgs(coerceChoiceOption, "overflow", overflowMap);
  var coerceEpochDisambig = /* @__PURE__ */ bindArgs(coerceChoiceOption, "disambiguation", epochDisambigMap);
  var coerceOffsetDisambig = /* @__PURE__ */ bindArgs(coerceChoiceOption, "offset", offsetDisambigMap);
  var coerceCalendarDisplay = /* @__PURE__ */ bindArgs(coerceChoiceOption, "calendarName", calendarDisplayMap);
  var coerceTimeZoneDisplay = /* @__PURE__ */ bindArgs(coerceChoiceOption, "timeZoneName", timeZoneDisplayMap);
  var coerceOffsetDisplay = /* @__PURE__ */ bindArgs(coerceChoiceOption, "offset", offsetDisplayMap);
  var coerceRoundingMode = /* @__PURE__ */ bindArgs(coerceChoiceOption, "roundingMode", roundingModeMap);
  var coerceDirection = /* @__PURE__ */ bindArgs(coerceChoiceOption, "direction", directionMap);
  function validateRoundingInc(roundingInc, smallestUnit, allowManyLargeUnits, solarMode) {
    const upUnitNano = solarMode ? nanoInUtcDay : unitNanoMap[smallestUnit + 1];
    if (upUnitNano) {
      const unitNano = unitNanoMap[smallestUnit];
      upUnitNano % ((roundingInc = clampEntity("roundingIncrement", roundingInc, 1, upUnitNano / unitNano - (solarMode ? 0 : 1), 1)) * unitNano) && throwRangeError(invalidEntity2("roundingIncrement", roundingInc));
    } else {
      roundingInc = clampEntity("roundingIncrement", roundingInc, 1, allowManyLargeUnits ? 10 ** 9 : 1, 1);
    }
    return roundingInc;
  }
  function validateUnitRange(optionName, unit, minUnit, maxUnit) {
    return unit != null && clampEntity(optionName, unit, minUnit, maxUnit, 1, unitNamesAsc), unit;
  }
  function checkLargestSmallestUnit(largestUnit, smallestUnit) {
    smallestUnit > largestUnit && throwRangeError("smallestUnit > largestUnit");
  }
  function refineDiffOptions(roundingModeInvert, options, defaultLargestUnit, maxUnit = 9, minUnit = 0, defaultRoundingMode = 4) {
    options = normalizeOptions(options);
    let largestUnit = coerceLargestUnit(options, minUnit);
    let roundingInc = coerceRoundingIncInteger(options);
    let roundingMode = coerceRoundingMode(options, defaultRoundingMode);
    let smallestUnit = coerceSmallestUnit(options, minUnit, 1);
    return largestUnit = validateUnitRange("largestUnit", largestUnit, minUnit, maxUnit), smallestUnit = validateUnitRange(smallestUnitStr, smallestUnit, minUnit, maxUnit), largestUnit == null ? largestUnit = Math.max(defaultLargestUnit, smallestUnit) : checkLargestSmallestUnit(largestUnit, smallestUnit), roundingInc = validateRoundingInc(roundingInc, smallestUnit, 1), roundingModeInvert && (roundingMode = ((roundingMode) => roundingMode < 4 ? (roundingMode + 2) % 4 : roundingMode)(roundingMode)), [largestUnit, smallestUnit, roundingInc, roundingMode];
  }
  function refineRoundingOptions(options, maxUnit = 6, solarMode) {
    let roundingInc = coerceRoundingIncInteger(options = normalizeOptionsOrString(options, smallestUnitStr));
    const roundingMode = coerceRoundingMode(options, 7);
    let smallestUnit = coerceSmallestUnit(options);
    return smallestUnit = requirePropDefined(smallestUnitStr, smallestUnit), smallestUnit = validateUnitRange(smallestUnitStr, smallestUnit, 0, maxUnit), roundingInc = validateRoundingInc(roundingInc, smallestUnit, undefined, solarMode), [smallestUnit, roundingInc, roundingMode];
  }
  function combineDateAndTime(isoDate, time) {
    return pluckProps(calendarDateFieldNamesAsc, isoDate, pluckProps(timeFieldNamesAsc, time));
  }
  function refineOverflowOptions(options) {
    return options === undefined ? 0 : coerceOverflow(requireObjectLike(options));
  }
  function refineZonedFieldOptions(options, defaultOffsetDisambig = 0) {
    options = normalizeOptions(options);
    const epochDisambig = coerceEpochDisambig(options);
    const offsetDisambig = coerceOffsetDisambig(options, defaultOffsetDisambig);
    return [coerceOverflow(options), offsetDisambig, epochDisambig];
  }
  var epochNanoMax = /* @__PURE__ */ BigInt(1e8) * bigNanoInUtcDay;
  var epochNanoMin = /* @__PURE__ */ BigInt(-1e8) * bigNanoInUtcDay;
  var plainDateEpochNanoMin = epochNanoMin - bigNanoInUtcDay;
  var isoYearMonthIndexMin = -3261848;
  function checkIsoYearMonthInBounds(isoDate) {
    const isoYearMonthIndex = 12 * isoDate.year + isoDate.month;
    return (isoYearMonthIndex < isoYearMonthIndexMin || isoYearMonthIndex > 3309129) && throwRangeError(outOfBoundsDate), isoDate;
  }
  function checkIsoDateInBounds(isoDate, allowPlainDateLowerEdge = 1) {
    return checkIsoDateEpochNanoInBounds(isoDateToEpochNano(isoDate), allowPlainDateLowerEdge), isoDate;
  }
  function checkIsoDateTimeInBounds(isoDateTime) {
    const epochNano = isoDateToEpochNano(isoDateTime);
    return checkIsoDateEpochNanoInBounds(epochNano), epochNano !== plainDateEpochNanoMin || timeFieldsToNano(isoDateTime) || throwRangeError(outOfBoundsDate), isoDateTime;
  }
  function checkIsoDateEpochNanoInBounds(epochNano, allowPlainDateLowerEdge = 1) {
    (epochNano < (allowPlainDateLowerEdge ? plainDateEpochNanoMin : epochNanoMin) || epochNano > epochNanoMax) && throwRangeError(outOfBoundsDate);
  }
  function checkEpochNanoInBounds(epochNano) {
    return (epochNano < epochNanoMin || epochNano > epochNanoMax) && throwRangeError(outOfBoundsDate), epochNano;
  }
  function isoDateTimeAndOffsetToEpochNano(isoDateTime, offsetNano) {
    return checkEpochNanoInBounds(isoDateToEpochNano(isoDateTime) + BigInt(timeFieldsToNano(isoDateTime) - offsetNano));
  }
  function createEpochNanoSlots(epochNano) {
    return {
      epochNanoseconds: epochNano
    };
  }
  function createZonedEpochNanoSlots(epochNano, timeZone, calendar) {
    return {
      calendar,
      timeZone,
      epochNanoseconds: epochNano
    };
  }
  function createDateTimeSlots(isoDateTime, calendar) {
    return pluckProps(timeFieldNamesAsc, isoDateTime, createDateSlots(isoDateTime, calendar));
  }
  function createDateSlots(isoDate, calendar) {
    return pluckProps(calendarDateFieldNamesAsc, isoDate, {
      calendar
    });
  }
  function createTimeSlots(time) {
    return pluckProps(timeFieldNamesAsc, time);
  }
  function createDurationSlots(durationFields) {
    return pluckProps(durationFieldNamesAsc, durationFields, {
      sign: computeDurationSign(durationFields)
    });
  }
  function getEpochMilli(slots) {
    return epochNano = slots.epochNanoseconds, Number(divFloorBigInt(epochNano, bigNanoInMilli));
    var epochNano;
  }
  function getEpochNano(slots) {
    return slots.epochNanoseconds;
  }
  function totalDuration(refineRelativeTo, slots, options) {
    const maxDurationUnit = getMaxDurationUnit(slots);
    const [totalUnit, relativeToSlots] = ((options, refineRelativeTo) => {
      const relativeToInternals = refineRelativeTo((options = normalizeOptionsOrString(options, "unit")).relativeTo);
      let totalUnit = coerceTotalUnit(options);
      return totalUnit = requirePropDefined("unit", totalUnit), [totalUnit, relativeToInternals];
    })(options, refineRelativeTo);
    const maxUnit = Math.max(totalUnit, maxDurationUnit);
    const isZoned = relativeToSlots && isZonedEpochSlots(relativeToSlots);
    if (!relativeToSlots && isUniformUnit(maxUnit, isZoned)) {
      return totalDayTimeDuration(slots, totalUnit);
    }
    if (relativeToSlots || throwRangeError("Missing relativeTo"), !slots.sign && isUniformUnit(totalUnit, isZoned)) {
      return 0;
    }
    const [balancedDuration, endEpochNano, relativeOps] = spanRelativeDuration(relativeToSlots, slots, totalUnit);
    return isUniformUnit(totalUnit, isZoned) ? totalDayTimeDuration(balancedDuration, totalUnit) : totalRelativeDuration(balancedDuration, endEpochNano, totalUnit, relativeOps);
  }
  function totalRelativeDuration(durationFields, endEpochNano, totalUnit, relativeOps) {
    const sign = computeDurationSign(durationFields) || 1;
    const nudgeWindow = clampRelativeDuration(clearDurationFields(totalUnit, durationFields), totalUnit, sign, relativeOps, endEpochNano);
    const epochNano0 = nudgeWindow.ee;
    const epochNano1 = nudgeWindow.te;
    const denom = Number(epochNano1 - epochNano0);
    const numerator = Number(endEpochNano - epochNano0);
    return nudgeWindow.pe[durationFieldNamesAsc[totalUnit]] + numerator / denom * sign;
  }
  function totalDayTimeDuration(durationFields, totalUnit) {
    return divideBigNanoToExactNumber(durationDayTimeToBigNano(durationFields), unitNanoMap[totalUnit]);
  }
  function clampRelativeDuration(durationFields, clampUnit, clampDistance, relativeOps, epochNanoProgress) {
    const unitName = durationFieldNamesAsc[clampUnit];
    let startDurationFields = durationFields;
    let shifted = 0;
    let window2 = computeRelativeDurationWindow(startDurationFields, unitName, clampDistance, relativeOps);
    return epochNanoProgress && !((epochNanoProgress, epochNano0, epochNano1, sign) => sign > 0 ? compareBigInts(epochNano0, epochNanoProgress) <= 0 && compareBigInts(epochNanoProgress, epochNano1) <= 0 : compareBigInts(epochNano1, epochNanoProgress) <= 0 && compareBigInts(epochNanoProgress, epochNano0) <= 0)(epochNanoProgress, window2.ee, window2.te, Math.sign(clampDistance)) && (startDurationFields = {
      ...durationFields,
      [unitName]: durationFields[unitName] + clampDistance
    }, shifted = 1, window2 = computeRelativeDurationWindow(startDurationFields, unitName, clampDistance, relativeOps)), {
      ...window2,
      pe: startDurationFields,
      Ae: shifted
    };
  }
  function computeRelativeDurationWindow(startDurationFields, unitName, clampDistance, relativeOps) {
    const endDurationFields = {
      ...startDurationFields,
      [unitName]: startDurationFields[unitName] + clampDistance
    };
    return {
      ee: moveRelativeToEpochNano(relativeOps, startDurationFields),
      te: moveRelativeToEpochNano(relativeOps, endDurationFields),
      se: endDurationFields
    };
  }
  function computeEpochNanoFrac(epochNanoProgress, epochNano0, epochNano1) {
    const denomBig = epochNano1 - epochNano0;
    const numeratorBig = epochNanoProgress - epochNano0;
    if (!numeratorBig) {
      return 0;
    }
    const absNumerator = numeratorBig < 0n ? -numeratorBig : numeratorBig;
    const absDenom = denomBig < 0n ? -denomBig : denomBig;
    const fracSign = compareBigInts(numeratorBig, 0n) === compareBigInts(denomBig, 0n) ? 1 : -1;
    return compareBigInts(absNumerator, absDenom) <= 0 ? absNumerator === absDenom ? fracSign : fabricateNearHalfFraction(compareBigInts(2n * absNumerator, absDenom), fracSign) : Number(numeratorBig) / Number(denomBig);
  }
  function roundZonedEpochSlotsToUnit(slots, smallestUnit, roundingInc, roundingMode) {
    let { epochNanoseconds } = slots;
    const { timeZone, calendar } = slots;
    if (smallestUnit === 0 && roundingInc === 1) {
      return {
        epochNanoseconds,
        timeZone,
        calendar
      };
    }
    if (smallestUnit === 6) {
      const isoFields0 = combineDateAndTime(zonedEpochSlotsToIso(slots), timeFieldDefaults);
      const isoFields1 = combineDateAndTime(moveByDays(isoFields0, 1), timeFieldDefaults);
      const epochNano0 = getStartOfDayInstantFor(timeZone, isoFields0);
      const epochNano1 = getStartOfDayInstantFor(timeZone, isoFields1);
      epochNanoseconds = roundWithMode(computeZonedDayRoundFrac(epochNanoseconds, epochNano0, epochNano1), roundingMode) ? epochNano1 : epochNano0;
    } else {
      const isoDateTime = zonedEpochSlotsToIso(slots);
      const offsetNano = isoDateTime.offsetNanoseconds;
      epochNanoseconds = getMatchingInstantFor(timeZone, roundDateTimeToNano(isoDateTime, computeNanoInc(smallestUnit, roundingInc), roundingMode), offsetNano, 2, 0, 1);
    }
    return {
      epochNanoseconds,
      timeZone,
      calendar
    };
  }
  function computeZonedHoursInDay(slots) {
    const { timeZone } = slots;
    const isoFields0 = combineDateAndTime(zonedEpochSlotsToIso(slots), timeFieldDefaults);
    const isoFields1 = combineDateAndTime(moveByDays(isoFields0, 1), timeFieldDefaults);
    const epochNano0 = getStartOfDayInstantFor(timeZone, isoFields0);
    return divideBigNanoToExactNumber(getStartOfDayInstantFor(timeZone, isoFields1) - epochNano0, nanoInHour2);
  }
  function computeZonedStartOfDay(slots) {
    const { timeZone, calendar } = slots;
    return createZonedEpochNanoSlots(getStartOfDayInstantFor(timeZone, combineDateAndTime(zonedEpochSlotsToIso(slots), timeFieldDefaults)), timeZone, calendar);
  }
  function computeZonedDayRoundFrac(epochNano, epochNano0, epochNano1) {
    return computeEpochNanoFrac(epochNano < epochNano1 ? epochNano : epochNano1 - 1n, epochNano0, epochNano1);
  }
  function roundDateTimeToNano(isoDateTime, nanoInc, roundingMode) {
    const [roundedTimeFields, dayDelta] = roundTimeToNano(isoDateTime, nanoInc, roundingMode);
    const roundedIsoDateTime = combineDateAndTime(moveByDays(isoDateTime, dayDelta), roundedTimeFields);
    return checkIsoDateTimeInBounds(roundedIsoDateTime), roundedIsoDateTime;
  }
  function roundTimeToNano(timeFields, nanoInc, roundingMode) {
    return nanoToTimeAndDay(roundNumberToInc(timeFieldsToNano(timeFields), nanoInc, roundingMode));
  }
  function roundToMinute(offsetNano) {
    return roundNumberToInc(offsetNano, nanoInMinute2, 7);
  }
  function computeNanoInc(smallestUnit, roundingInc) {
    return unitNanoMap[smallestUnit] * roundingInc;
  }
  function computeBigNanoInc(smallestUnit, roundingInc) {
    return BigInt(unitNanoMap[smallestUnit]) * BigInt(roundingInc);
  }
  function roundDayTimeDurationByInc(durationFields, nanoInc, roundingMode) {
    const maxUnit = Math.min(getMaxDurationUnit(durationFields), 6);
    return nanoToDurationDayTimeFields(roundBigNanoToInc(durationDayTimeToBigNano(durationFields), BigInt(nanoInc), roundingMode), maxUnit);
  }
  function roundRelativeDuration(durationFields, endEpochNano, largestUnit, smallestUnit, roundingInc, roundingMode, relativeOps, isZoned) {
    if (smallestUnit === 0 && roundingInc === 1) {
      return durationFields;
    }
    const sign = computeDurationSign(durationFields) || 1;
    const nudgeFunc = isUniformUnit(smallestUnit, isZoned) ? isZoned && smallestUnit < 6 && largestUnit >= 6 ? nudgeZonedTimeDuration : nudgeDayTimeDuration : nudgeRelativeDuration;
    let [roundedDurationFields, roundedEpochNano, grewBigUnit] = nudgeFunc(sign, durationFields, endEpochNano, largestUnit, smallestUnit, roundingInc, roundingMode, relativeOps);
    return grewBigUnit && smallestUnit !== 7 && (roundedDurationFields = ((durationFields, endEpochNano, largestUnit, smallestUnit, sign, relativeOps) => {
      for (let currentUnit = smallestUnit + 1;currentUnit <= largestUnit; currentUnit++) {
        if (currentUnit === 7 && largestUnit !== 7) {
          continue;
        }
        const baseDurationFields = clearDurationFields(currentUnit, durationFields);
        baseDurationFields[durationFieldNamesAsc[currentUnit]] += sign;
        const thresholdCompare = compareBigInts(endEpochNano, moveRelativeToEpochNano(relativeOps, baseDurationFields));
        if (thresholdCompare && thresholdCompare !== sign) {
          break;
        }
        durationFields = baseDurationFields;
      }
      return durationFields;
    })(roundedDurationFields, roundedEpochNano, largestUnit, Math.max(6, smallestUnit), sign, relativeOps)), roundedDurationFields;
  }
  function roundBigNanoToInc(bigNano, bigNanoInc, roundingMode) {
    return roundBigNanoToIncWithTail(bigNano, bigNanoInc, roundingMode, bigNano / bigNanoInc % 2n);
  }
  function roundBigNanoToDayOriginInc(bigNano, bigNanoInc, roundingMode) {
    const [day, timeNano] = divModFloorBigInt(bigNano, bigNanoInUtcDay);
    const dayOriginNano = day * bigNanoInUtcDay;
    return dayOriginNano + roundBigNanoToIncWithTail(timeNano, bigNanoInc, roundingMode, (dayOriginNano / bigNanoInc + timeNano / bigNanoInc) % 2n);
  }
  function roundBigNanoToIncWithTail(bigNano, bigNanoInc, roundingMode, quotientTail) {
    const quotient = bigNano / bigNanoInc;
    const remainder = bigNano % bigNanoInc;
    let fraction = 0;
    remainder && (fraction = fabricateNearHalfFraction(compareBigInts(2n * (remainder < 0n ? -remainder : remainder), bigNanoInc), Math.sign(Number(remainder))));
    const roundedTail = roundWithMode(Number(quotientTail) + fraction, roundingMode);
    return (quotient - quotientTail + BigInt(roundedTail)) * bigNanoInc;
  }
  function roundNumberToInc(num, roundingInc, roundingMode) {
    return roundWithMode(num / roundingInc, roundingMode) * roundingInc;
  }
  function roundWithMode(num, roundingMode) {
    return roundingModeFuncs[roundingMode](num);
  }
  function nudgeDayTimeDuration(sign, durationFields, endEpochNano, largestUnit, smallestUnit, roundingInc, roundingMode) {
    const bigNano = durationDayTimeToBigNano(durationFields);
    const roundedBigNano = roundBigNanoToInc(bigNano, computeBigNanoInc(smallestUnit, roundingInc), roundingMode);
    const nanoDiff = roundedBigNano - bigNano;
    const expandedBigUnit = Math.sign(Number(roundedBigNano / bigNanoInUtcDay) - Number(bigNano / bigNanoInUtcDay)) === sign;
    const roundedDayTimeFields = nanoToDurationDayTimeFields(roundedBigNano, Math.min(largestUnit, 6));
    return [{
      ...durationFields,
      ...roundedDayTimeFields
    }, endEpochNano + nanoDiff, expandedBigUnit];
  }
  function nudgeZonedTimeDuration(sign, durationFields, endEpochNano, _largestUnit, smallestUnit, roundingInc, roundingMode, relativeOps) {
    const timeNano = Number(durationTimeToBigNano(durationFields));
    const nanoInc = computeNanoInc(smallestUnit, roundingInc);
    let roundedTimeNano = roundNumberToInc(timeNano, nanoInc, roundingMode);
    const dayWindow = clampRelativeDuration({
      ...durationFields,
      ...durationTimeFieldDefaults
    }, 6, sign, relativeOps, endEpochNano);
    const dayEpochNano0 = dayWindow.ee;
    const dayEpochNano1 = dayWindow.te;
    const beyondDayNano = roundedTimeNano - Number(dayEpochNano1 - dayEpochNano0);
    let dayDelta = 0;
    beyondDayNano && Math.sign(beyondDayNano) !== sign ? endEpochNano = dayEpochNano0 + BigInt(roundedTimeNano) : (dayDelta += sign, roundedTimeNano = roundNumberToInc(beyondDayNano, nanoInc, roundingMode), endEpochNano = dayEpochNano1 + BigInt(roundedTimeNano));
    const durationTimeFields = nanoToDurationTimeFields(roundedTimeNano);
    return [{
      ...durationFields,
      ...durationTimeFields,
      days: durationFields.days + dayDelta
    }, endEpochNano, Boolean(dayDelta)];
  }
  function nudgeRelativeDuration(sign, durationFields, endEpochNano, _largestUnit, smallestUnit, roundingInc, roundingMode, relativeOps) {
    const smallestUnitFieldName = durationFieldNamesAsc[smallestUnit];
    const baseDurationFields = clearDurationFields(smallestUnit, durationFields);
    smallestUnit === 7 && (durationFields = {
      ...durationFields,
      weeks: durationFields.weeks + Math.trunc(durationFields.days / 7)
    });
    const truncedVal = divTrunc(durationFields[smallestUnitFieldName], roundingInc) * roundingInc;
    baseDurationFields[smallestUnitFieldName] = truncedVal;
    const nudgeWindow = clampRelativeDuration(baseDurationFields, smallestUnit, roundingInc * sign, relativeOps, endEpochNano);
    const epochNano0 = nudgeWindow.ee;
    const epochNano1 = nudgeWindow.te;
    const frac = computeEpochNanoFrac(endEpochNano, epochNano0, epochNano1);
    const windowStartVal = nudgeWindow.pe[smallestUnitFieldName];
    const windowEndVal = nudgeWindow.se[smallestUnitFieldName];
    const roundedVal = roundNumberToInc(windowStartVal + frac * sign * roundingInc, roundingInc, roundingMode);
    const roundedToEnd = roundedVal === windowEndVal;
    return baseDurationFields[smallestUnitFieldName] = roundedVal, [baseDurationFields, roundedToEnd ? epochNano1 : epochNano0, nudgeWindow.Ae || roundedToEnd];
  }
  function getTimeZoneTransitionEpochNanoseconds(slots, options) {
    return slots.timeZone.O(slots.epochNanoseconds, ((options) => {
      const normalizedOptions = normalizeOptionsOrString(options, "direction");
      const res = coerceDirection(normalizedOptions, 0);
      return res || throwRangeError(invalidEntity2("direction", res)), res;
    })(options));
  }
  var zonedEpochSlotsToIso = /* @__PURE__ */ memoize(_zonedEpochSlotsToIso, WeakMap);
  function _zonedEpochSlotsToIso(slots) {
    const { epochNanoseconds, timeZone } = slots;
    const offsetNanoseconds = timeZone.B(epochNanoseconds);
    return {
      ...epochNanoToIsoDateTime(epochNanoseconds + BigInt(offsetNanoseconds)),
      offsetNanoseconds
    };
  }
  function getMatchingInstantFor(timeZone, isoDateTime, offsetNano, offsetDisambig = 0, epochDisambig = 0, epochFuzzy, hasZ) {
    if (offsetNano !== undefined && offsetDisambig === 1 && (offsetDisambig === 1 || hasZ)) {
      return isoDateTimeAndOffsetToEpochNano(isoDateTime, offsetNano);
    }
    offsetDisambig !== 2 && offsetDisambig !== 0 || checkIsoDateInBounds(isoDateTime, 0);
    const possibleEpochNanos = timeZone.N(isoDateTime);
    if (offsetNano !== undefined && offsetDisambig !== 3) {
      const matchingEpochNano = ((possibleEpochNanos, isoDateTime, offsetNano, fuzzy) => {
        const zonedEpochNano = isoDateTimeToEpochNano(isoDateTime);
        fuzzy && (offsetNano = roundToMinute(offsetNano));
        for (const possibleEpochNano of possibleEpochNanos) {
          let possibleOffsetNano = Number(zonedEpochNano - possibleEpochNano);
          if (fuzzy && (possibleOffsetNano = roundToMinute(possibleOffsetNano)), possibleOffsetNano === offsetNano) {
            return possibleEpochNano;
          }
        }
      })(possibleEpochNanos, isoDateTime, offsetNano, epochFuzzy);
      if (matchingEpochNano !== undefined) {
        return matchingEpochNano;
      }
      offsetDisambig === 0 && throwRangeError("Invalid TimeZone offset");
    }
    return hasZ ? isoDateTimeToEpochNano(isoDateTime) : getSingleInstantFor(timeZone, isoDateTime, epochDisambig, possibleEpochNanos);
  }
  function getSingleInstantFor(timeZone, isoDateTime, disambig = 0, possibleEpochNanos = timeZone.N(isoDateTime)) {
    if (possibleEpochNanos.length === 1) {
      return possibleEpochNanos[0];
    }
    if (disambig === 1 && throwRangeError("Ambiguous offset"), possibleEpochNanos.length) {
      return possibleEpochNanos[disambig === 3 ? 1 : 0];
    }
    const zonedEpochNano = isoDateTimeToEpochNano(isoDateTime);
    const gapNano = ((timeZone, zonedEpochNano) => {
      const startOffsetNano = timeZone.B(zonedEpochNano - bigNanoInUtcDay);
      return ((gapNano) => (gapNano > nanoInUtcDay && throwRangeError("Out-of-bounds TimeZone gap"), gapNano))(timeZone.B(zonedEpochNano + bigNanoInUtcDay) - startOffsetNano);
    })(timeZone, zonedEpochNano);
    const shiftedIsoDateTime = epochNanoToIsoDateTime(zonedEpochNano + BigInt(gapNano * (disambig === 2 ? -1 : 1)));
    return (possibleEpochNanos = timeZone.N(shiftedIsoDateTime))[disambig === 2 ? 0 : possibleEpochNanos.length - 1];
  }
  function getStartOfDayInstantFor(timeZone, isoDateTime) {
    const possibleEpochNanos = timeZone.N(isoDateTime);
    if (possibleEpochNanos.length) {
      return possibleEpochNanos[0];
    }
    const zonedEpochNanoDayBefore = isoDateTimeToEpochNano(isoDateTime) - bigNanoInUtcDay;
    return timeZone.O(zonedEpochNanoDayBefore, 1);
  }
  function moveYearMonth(doSubtract, calendar, isoDateFields, durationSlots, options) {
    const overflow = refineOverflowOptions(options);
    durationSlots.sign && getMaxDurationUnit(durationSlots) < 8 && throwRangeError("Cannot use small units");
    const startOfMonthFields = checkIsoDateInBounds(moveToStartOfMonth(calendar, isoDateFields));
    return moveToStartOfMonth(calendar, dateAddWithOverflow(calendar, startOfMonthFields, doSubtract ? negateDurationFields(durationSlots) : durationSlots, overflow));
  }
  function moveEpochNano(epochNano, durationFields) {
    return checkEpochNanoInBounds(epochNano + (durationHasDateParts(fields = durationFields) && throwRangeError("Cannot use large units"), durationTimeToBigNano(fields)));
    var fields;
  }
  function moveZonedEpochSlots(slots, durationFields, options) {
    const { calendar, epochNanoseconds: epochNano, timeZone } = slots;
    const timeOnlyNano = durationTimeToBigNano(durationFields);
    let movedEpochNano = epochNano;
    if (durationHasDateParts(durationFields)) {
      const isoDateTime = zonedEpochSlotsToIso(slots);
      movedEpochNano = getSingleInstantFor(timeZone, combineDateAndTime(moveDate(calendar, isoDateTime, {
        ...durationFields,
        ...durationTimeFieldDefaults
      }, options), isoDateTime)) + timeOnlyNano;
    } else {
      movedEpochNano += timeOnlyNano, refineOverflowOptions(options);
    }
    return {
      ...slots,
      epochNanoseconds: checkEpochNanoInBounds(movedEpochNano)
    };
  }
  function moveDateTime(calendar, isoDateTimeFields, durationFields, options) {
    const [movedTimeFields, dayDelta] = moveTime(isoDateTimeFields, durationFields);
    return checkIsoDateTimeInBounds(combineDateAndTime(moveDate(calendar, isoDateTimeFields, {
      ...durationFields,
      ...durationTimeFieldDefaults,
      days: durationFields.days + dayDelta
    }, options), movedTimeFields));
  }
  function moveDate(calendar, isoDateFields, durationFields, options) {
    if (durationFields.years || durationFields.months || durationFields.weeks) {
      return dateAddWithOverflow(calendar, isoDateFields, durationFields, refineOverflowOptions(options));
    }
    refineOverflowOptions(options);
    const days = durationFields.days + Number(durationTimeToBigNano(durationFields) / bigNanoInUtcDay);
    return days ? checkIsoDateInBounds(moveByDays(isoDateFields, days)) : isoDateFields;
  }
  function moveToStartOfMonth(calendar, isoDateFields) {
    return moveByDays(isoDateFields, 1 - computeCalendarDateFields(calendar, isoDateFields).day);
  }
  function moveTime(timeFields, durationFields) {
    const durationBigNano = durationTimeToBigNano(durationFields);
    const durDays = Number(durationBigNano / bigNanoInUtcDay);
    const durTimeNano = Number(durationBigNano % bigNanoInUtcDay);
    const [newTimeFields, overflowDays] = nanoToTimeAndDay(timeFieldsToNano(timeFields) + durTimeNano);
    return [newTimeFields, durDays + overflowDays];
  }
  function moveByDays(isoDate, days) {
    return days ? epochDaysToIsoDate(isoDateToEpochDays(isoDate) + days) : isoDate;
  }
  function dateAddWithOverflow(calendar, isoDateFields, durationFields, overflow) {
    let { years, months, weeks, days } = durationFields;
    let isoDate;
    if (days += Number(durationTimeToBigNano(durationFields) / bigNanoInUtcDay), years || months) {
      isoDate = addDateMonths(calendar, isoDateFields, years, months, overflow);
    } else {
      if (!weeks && !days) {
        return isoDateFields;
      }
      isoDate = isoDateFields;
    }
    return (weeks || days) && (isoDate = moveByDays(isoDate, 7 * weeks + days)), checkIsoDateInBounds(isoDate);
  }
  function addDateMonths(calendar, isoDateFields, years, months, overflow) {
    const dateParts = computeCalendarDateFields(calendar, isoDateFields);
    let { year, month, day } = dateParts;
    if (years) {
      const [monthCodeNumber, isLeapMonth] = computeCalendarMonthCodeParts(calendar, year, month);
      year += years, month = computeYearMovedMonth(calendar, monthCodeNumber, isLeapMonth, calendar ? calendar.p(year) : undefined, overflow), month = clampEntity("month", month, 1, computeCalendarMonthsInYearForYear(calendar, year), overflow);
    }
    if (months) {
      const yearMonthParts = calendar ? calendar.K(year, month, months) : addIsoMonths(year, month, months);
      ({ year, month } = yearMonthParts);
    }
    return day = clampEntity("day", day, 1, computeCalendarDaysInMonthForYearMonth(calendar, year, month), overflow), computeCalendarIsoFieldsFromParts(calendar, year, month, day);
  }
  function computeYearMovedMonth(calendar, monthCodeNumber, isLeapMonth, targetLeapMonth, overflow) {
    if (isLeapMonth) {
      const leapMonthMeta = calendar ? calendar.l : undefined;
      return targetLeapMonth !== undefined && (leapMonthMeta < 0 || targetLeapMonth === monthCodeNumber + 1) ? targetLeapMonth : (overflow === 1 && throwRangeError(invalidLeapMonth), leapMonthMeta < 0 ? -leapMonthMeta : monthCodeNumber);
    }
    return monthCodeNumberToMonth(monthCodeNumber, 0, targetLeapMonth);
  }
  function getCommonCalendar(a, b) {
    return getCalendarSlotId(a) !== getCalendarSlotId(b) && throwRangeError("Mismatching Calendars"), a;
  }
  function getCommonTimeZone(a, b) {
    return a.m !== b.m && throwRangeError("Mismatching TimeZones"), a;
  }
  function getZonedTimeZoneId(slots) {
    return slots.timeZone.id;
  }
  function diffInstants(invert, instantSlots0, instantSlots1, options) {
    const [largestUnit, smallestUnit, roundingInc, roundingMode] = refineDiffOptions(invert, options, 3, 5);
    const durationFields = diffEpochNanos(instantSlots0.epochNanoseconds, instantSlots1.epochNanoseconds, largestUnit, smallestUnit, roundingInc, roundingMode);
    return createDurationSlots(invert ? negateDurationFields(durationFields) : durationFields);
  }
  function diffZonedDateTimes(invert, calendar, slots0, slots1, options) {
    const [largestUnit, smallestUnit, roundingInc, roundingMode] = refineDiffOptions(invert, options, 5);
    const epochNano0 = slots0.epochNanoseconds;
    const epochNano1 = slots1.epochNanoseconds;
    let durationFields;
    if (compareBigInts(epochNano1, epochNano0)) {
      if (largestUnit < 6) {
        durationFields = diffEpochNanos(epochNano0, epochNano1, largestUnit, smallestUnit, roundingInc, roundingMode);
      } else {
        const timeZone = getCommonTimeZone(slots0.timeZone, slots1.timeZone);
        durationFields = diffZonedEpochsExact(timeZone, calendar, slots0, slots1, largestUnit), durationFields = roundRelativeDuration(durationFields, epochNano1, largestUnit, smallestUnit, roundingInc, roundingMode, createZonedRelativeOps(calendar, timeZone, slots0), 1);
      }
    } else {
      durationFields = durationFieldDefaults;
    }
    return createDurationSlots(invert ? negateDurationFields(durationFields) : durationFields);
  }
  function diffPlainDateTimes(invert, calendar, plainDateTimeSlots0, plainDateTimeSlots1, options) {
    const [largestUnit, smallestUnit, roundingInc, roundingMode] = refineDiffOptions(invert, options, 6);
    const startEpochNano = isoDateTimeToEpochNano(plainDateTimeSlots0);
    const endEpochNano = isoDateTimeToEpochNano(plainDateTimeSlots1);
    const sign = compareBigInts(endEpochNano, startEpochNano);
    let durationFields;
    return sign ? largestUnit <= 6 ? durationFields = diffEpochNanos(startEpochNano, endEpochNano, largestUnit, smallestUnit, roundingInc, roundingMode) : (durationFields = diffDateTimesBig(calendar, plainDateTimeSlots0, plainDateTimeSlots1, sign, largestUnit), durationFields = roundRelativeDuration(durationFields, endEpochNano, largestUnit, smallestUnit, roundingInc, roundingMode, createDateTimeRelativeOps(calendar, plainDateTimeSlots0))) : durationFields = durationFieldDefaults, createDurationSlots(invert ? negateDurationFields(durationFields) : durationFields);
  }
  function diffPlainDates(invert, calendar, plainDateSlots0, plainDateSlots1, options) {
    const [largestUnit, smallestUnit, roundingInc, roundingMode] = refineDiffOptions(invert, options, 6, 9, 6);
    return diffDateLike(invert, calendar, plainDateSlots0, plainDateSlots1, largestUnit, smallestUnit, roundingInc, roundingMode);
  }
  function diffPlainYearMonth(invert, calendar, plainYearMonthSlots0, plainYearMonthSlots1, options) {
    const [largestUnit, smallestUnit, roundingInc, roundingMode] = refineDiffOptions(invert, options, 9, 9, 8);
    const firstOfMonth0 = moveToStartOfMonth(calendar, plainYearMonthSlots0);
    const firstOfMonth1 = moveToStartOfMonth(calendar, plainYearMonthSlots1);
    return compareIsoDate(firstOfMonth0, firstOfMonth1) ? diffDateLike(invert, calendar, checkIsoDateInBounds(firstOfMonth0), checkIsoDateInBounds(firstOfMonth1), largestUnit, smallestUnit, roundingInc, roundingMode, 8) : createDurationSlots(durationFieldDefaults);
  }
  function diffDateLike(invert, calendar, startIsoDate, endIsoDate, largestUnit, smallestUnit, roundingInc, roundingMode, smallestPrecision = 6) {
    const startEpochNano = isoDateToEpochNano(startIsoDate);
    const endEpochNano = isoDateToEpochNano(endIsoDate);
    let durationFields;
    return compareBigInts(endEpochNano, startEpochNano) ? largestUnit === 6 ? durationFields = diffEpochNanos(startEpochNano, endEpochNano, largestUnit, smallestUnit, roundingInc, roundingMode) : (durationFields = diffCalendarDates(calendar, startIsoDate, endIsoDate, largestUnit), smallestUnit === smallestPrecision && roundingInc === 1 || (durationFields = roundRelativeDuration(durationFields, endEpochNano, largestUnit, smallestUnit, roundingInc, roundingMode, createDateRelativeOps(calendar, startIsoDate)))) : durationFields = durationFieldDefaults, createDurationSlots(invert ? negateDurationFields(durationFields) : durationFields);
  }
  function diffPlainTimes(invert, plainTimeSlots0, plainTimeSlots1, options) {
    const [largestUnit, smallestUnit, roundingInc, roundingMode] = refineDiffOptions(invert, options, 5, 5);
    const timeDiffNano = roundNumberToInc(timeFieldsToNano(plainTimeSlots1) - timeFieldsToNano(plainTimeSlots0), computeNanoInc(smallestUnit, roundingInc), roundingMode);
    const durationFields = {
      ...durationFieldDefaults,
      ...nanoToDurationTimeFields(timeDiffNano, largestUnit)
    };
    return createDurationSlots(invert ? negateDurationFields(durationFields) : durationFields);
  }
  function diffZonedEpochsExact(timeZone, calendar, slots0, slots1, largestUnit) {
    const sign = compareBigInts(slots1.epochNanoseconds, slots0.epochNanoseconds);
    if (!sign) {
      return durationFieldDefaults;
    }
    if (largestUnit < 6) {
      return {
        ...durationFieldDefaults,
        ...nanoToDurationDayTimeFields(slots1.epochNanoseconds - slots0.epochNanoseconds, largestUnit)
      };
    }
    if (!compareIsoDate(zonedEpochSlotsToIso(slots0), zonedEpochSlotsToIso(slots1))) {
      return {
        ...durationFieldDefaults,
        ...nanoToDurationDayTimeFields(slots1.epochNanoseconds - slots0.epochNanoseconds, 5)
      };
    }
    const [isoFields0, isoFields1, remainderNano] = prepareZonedEpochDiff(timeZone, slots0, slots1, sign);
    return {
      ...largestUnit === 6 ? {
        ...durationFieldDefaults,
        days: diffDays(isoFields0, isoFields1)
      } : diffCalendarDates(calendar, isoFields0, isoFields1, largestUnit),
      ...nanoToDurationTimeFields(remainderNano)
    };
  }
  function diffDateTimesExact(calendar, startIsoDateTime, endIsoDateTime, largestUnit) {
    const startEpochNano = isoDateTimeToEpochNano(startIsoDateTime);
    const endEpochNano = isoDateTimeToEpochNano(endIsoDateTime);
    const sign = compareBigInts(endEpochNano, startEpochNano);
    return sign ? largestUnit <= 6 ? {
      ...durationFieldDefaults,
      ...nanoToDurationDayTimeFields(endEpochNano - startEpochNano, largestUnit)
    } : diffDateTimesBig(calendar, startIsoDateTime, endIsoDateTime, sign, largestUnit) : durationFieldDefaults;
  }
  function diffDateTimesBig(calendar, startIsoDateTime, endIsoDateTime, sign, largestUnit) {
    let diffEndDate = endIsoDateTime;
    let timeNano = timeFieldsToNano(endIsoDateTime) - timeFieldsToNano(startIsoDateTime);
    return Math.sign(timeNano) === -sign && (diffEndDate = moveByDays(endIsoDateTime, -sign), timeNano += nanoInUtcDay * sign), {
      ...diffCalendarDates(calendar, startIsoDateTime, diffEndDate, largestUnit),
      ...nanoToDurationTimeFields(timeNano)
    };
  }
  function diffCalendarDates(calendar, startIsoDate, endIsoDate, largestUnit) {
    if (largestUnit <= 7) {
      const days = diffDays(startIsoDate, endIsoDate);
      return largestUnit === 7 ? {
        ...durationFieldDefaults,
        weeks: divTrunc(days, 7),
        days: modTrunc(days, 7)
      } : {
        ...durationFieldDefaults,
        days
      };
    }
    const yearMonthDayStart = computeCalendarDateFields(calendar, startIsoDate);
    const yearMonthDayEnd = computeCalendarDateFields(calendar, endIsoDate);
    if (largestUnit === 8) {
      const { year: year0, month: month0, day: day0 } = yearMonthDayStart;
      const { year: year1, month: month1, day: day1 } = yearMonthDayEnd;
      const sign = Math.sign(compareNumbers(year1, year0) || compareNumbers(month1, month0) || diffDays(startIsoDate, endIsoDate));
      let months = 0;
      let days = 0;
      if (sign) {
        months = calendar ? calendar._(year0, month0, year1, month1) : diffIsoMonthSlots(year0, month0, year1, month1);
        let anchorIsoDate = addDateMonths(calendar, startIsoDate, 0, months, 0);
        sign * compareNumbers(day0, day1) > 0 && (months -= sign, anchorIsoDate = addDateMonths(calendar, startIsoDate, 0, months, 0)), days = diffDays(anchorIsoDate, endIsoDate);
      }
      return {
        ...durationFieldDefaults,
        months,
        days
      };
    }
    const { year: year0, month: month0, day: day0 } = yearMonthDayStart;
    let { year: year1, month: month1, day: day1 } = yearMonthDayEnd;
    let yearDiff = year1 - year0;
    let monthDiff = month1 - month0;
    let dayDiff = day1 - day0;
    if (yearDiff || monthDiff) {
      const sign = Math.sign(yearDiff || monthDiff);
      let daysInMonth1 = computeCalendarDaysInMonthForYearMonth(calendar, year1, month1);
      let dayCorrect = 0;
      if (Math.sign(day1 - day0) === -sign) {
        const origDaysInMonth1 = daysInMonth1;
        const yearMonthParts = calendar ? calendar.K(year1, month1, -sign) : addIsoMonths(year1, month1, -sign);
        ({ year: year1, month: month1 } = yearMonthParts), yearDiff = year1 - year0, monthDiff = month1 - month0, daysInMonth1 = computeCalendarDaysInMonthForYearMonth(calendar, year1, month1), dayCorrect = sign < 0 ? -origDaysInMonth1 : daysInMonth1;
      }
      if (dayDiff = day1 - Math.min(day0, daysInMonth1) + dayCorrect, yearDiff) {
        const [monthCodeNumber0, isLeapMonth0] = computeCalendarMonthCodeParts(calendar, year0, month0);
        const [monthCodeNumber1, isLeapMonth1] = computeCalendarMonthCodeParts(calendar, year1, month1);
        const leapMonthMeta = calendar ? calendar.l : undefined;
        if (monthDiff = leapMonthMeta !== undefined && isLeapMonth0 && !isLeapMonth1 && (leapMonthMeta < 0 ? sign > 0 && monthCodeNumber1 === -leapMonthMeta : sign < 0 && monthCodeNumber1 === monthCodeNumber0) ? 0 : monthCodeNumber1 - monthCodeNumber0 || Number(isLeapMonth1) - Number(isLeapMonth0), Math.sign(monthDiff) === -sign) {
          const monthCorrect = sign < 0 && -computeCalendarMonthsInYearForYear(calendar, year1);
          year1 -= sign, yearDiff = year1 - year0, monthDiff = month1 - computeYearMovedMonth(calendar, monthCodeNumber0, isLeapMonth0, calendar ? calendar.p(year1) : undefined, 0) + (monthCorrect || computeCalendarMonthsInYearForYear(calendar, year1));
        } else if (calendar) {
          const month0Projected = computeYearMovedMonth(calendar, monthCodeNumber0, isLeapMonth0, calendar.p(year1), 0);
          monthDiff = calendar._(year1, month0Projected, year1, month1);
        }
      }
    }
    return {
      ...durationFieldDefaults,
      years: yearDiff,
      months: monthDiff,
      days: dayDiff
    };
  }
  function compareIsoDate(isoDate0, isoDate1) {
    return compareNumbers(isoDate0.year, isoDate1.year) || compareNumbers(isoDate0.month, isoDate1.month) || compareNumbers(isoDate0.day, isoDate1.day);
  }
  function prepareZonedEpochDiff(timeZone, slots0, slots1, sign) {
    const startIsoDate = zonedEpochSlotsToIso(slots0);
    const endIsoDate = zonedEpochSlotsToIso(slots1);
    const endEpochNano = slots1.epochNanoseconds;
    let dayCorrection = 0;
    const timeDiffNano = timeFieldsToNano(endIsoDate) - timeFieldsToNano(startIsoDate);
    Math.sign(timeDiffNano) === -sign && dayCorrection++;
    const maxDayCorrection = dayCorrection + (sign > 0 ? 1 : 0);
    for (;dayCorrection <= maxDayCorrection; dayCorrection++) {
      const midIsoDate = moveByDays(endIsoDate, dayCorrection * -sign);
      const midEpochNano = getSingleInstantFor(timeZone, combineDateAndTime(midIsoDate, startIsoDate));
      if (compareBigInts(endEpochNano, midEpochNano) !== -sign) {
        return [startIsoDate, midIsoDate, Number(endEpochNano - midEpochNano)];
      }
    }
  }
  function diffEpochNanos(startEpochNano, endEpochNano, largestUnit, smallestUnit, roundingInc, roundingMode) {
    return {
      ...durationFieldDefaults,
      ...nanoToDurationDayTimeFields(roundBigNanoToInc(endEpochNano - startEpochNano, computeBigNanoInc(smallestUnit, roundingInc), roundingMode), largestUnit)
    };
  }
  function diffDays(startIsoDate, endIsoDate) {
    return isoDateToEpochDays(endIsoDate) - isoDateToEpochDays(startIsoDate);
  }
  function createDateRelativeOps(calendar, origin) {
    return {
      origin,
      ie: isoDateToEpochNano(origin),
      calendar,
      he: isoDateToEpochNano
    };
  }
  function createDateTimeRelativeOps(calendar, origin) {
    return {
      origin,
      ie: isoDateTimeToEpochNano(origin),
      calendar,
      he: (movedIsoDate) => isoDateTimeToEpochNano(combineDateAndTime(movedIsoDate, origin))
    };
  }
  function createZonedRelativeOps(calendar, timeZone, slots) {
    const origin = zonedEpochSlotsToIso(slots);
    return {
      origin,
      ie: slots.epochNanoseconds,
      calendar,
      he: (movedIsoDate) => getSingleInstantFor(timeZone, combineDateAndTime(movedIsoDate, origin))
    };
  }
  function moveRelativeToEpochNano(relativeOps, dateDuration) {
    return durationHasDateParts(dateDuration) ? relativeOps.he(moveDate(relativeOps.calendar, relativeOps.origin, dateDuration)) : relativeOps.ie;
  }
  function spanRelativeDuration(relativeToSlots, durationFields, largestUnit) {
    const { calendar } = relativeToSlots;
    if (isZonedEpochSlots(relativeToSlots)) {
      const { timeZone } = relativeToSlots;
      const endSlots = moveZonedEpochSlots(relativeToSlots, durationFields);
      return [diffZonedEpochsExact(timeZone, calendar, relativeToSlots, endSlots, largestUnit), endSlots.epochNanoseconds, createZonedRelativeOps(calendar, timeZone, relativeToSlots)];
    }
    const origin = checkIsoDateTimeInBounds(combineDateAndTime(relativeToSlots, timeFieldDefaults));
    const end = moveDateTime(calendar, origin, durationFields);
    return [diffDateTimesExact(calendar, origin, end, largestUnit), isoDateTimeToEpochNano(end), createDateRelativeOps(calendar, relativeToSlots)];
  }
  function moveRelativeEndpointToEpochNano(relativeToSlots, durationFields) {
    return isZonedEpochSlots(relativeToSlots) ? moveZonedEpochSlots(relativeToSlots, durationFields).epochNanoseconds : isoDateTimeToEpochNano(moveDateTime(relativeToSlots.calendar, combineDateAndTime(relativeToSlots, timeFieldDefaults), durationFields));
  }
  function isZonedEpochSlots(slots) {
    return "timeZone" in slots;
  }
  function isUniformUnit(unit, isZoned) {
    return unit <= 6 - (isZoned ? 1 : 0);
  }
  function nanoToGivenFields(nano, largestUnit, fieldNames) {
    const fields = {};
    for (let unit = largestUnit;unit >= 0; unit--) {
      const divisor = unitNanoMap[unit];
      fields[fieldNames[unit]] = divTrunc(nano, divisor), nano = modTrunc(nano, divisor);
    }
    return fields;
  }
  var maxDurationSeconds = 2 ** 53;
  function addDurations(refineRelativeTo, doSubtract, slots, otherSlots, options) {
    const relativeToSlots = refineRelativeTo(normalizeOptions(options).relativeTo);
    const maxUnit = Math.max(getMaxDurationUnit(slots), getMaxDurationUnit(otherSlots));
    return isUniformUnit(maxUnit, relativeToSlots && isZonedEpochSlots(relativeToSlots)) ? addDayTimeDurationsChecked(doSubtract, slots, otherSlots, maxUnit) : (relativeToSlots || throwRangeError("Missing relativeTo"), doSubtract && (otherSlots = negateDurationFields(otherSlots)), createDurationSlots(((relativeToSlots, durationFields0, durationFields1, largestUnit) => {
      const { calendar } = relativeToSlots;
      if (isZonedEpochSlots(relativeToSlots)) {
        const { timeZone } = relativeToSlots;
        const midSlots = moveZonedEpochSlots(relativeToSlots, durationFields0);
        return diffZonedEpochsExact(timeZone, calendar, relativeToSlots, moveZonedEpochSlots(midSlots, durationFields1), largestUnit);
      }
      const origin = combineDateAndTime(relativeToSlots, timeFieldDefaults);
      const mid = moveDateTime(calendar, origin, durationFields0);
      return diffDateTimesExact(calendar, origin, moveDateTime(calendar, mid, durationFields1), largestUnit);
    })(relativeToSlots, slots, otherSlots, maxUnit)));
  }
  function addDayTimeDurationsChecked(doSubtract, slots, otherSlots, maxUnit) {
    return createDurationSlots(validateDurationFields(((a, b, largestUnit, doSubtract) => {
      const combined = durationDayTimeToBigNano(a) + durationDayTimeToBigNano(b) * BigInt(doSubtract ? -1 : 1);
      return Number.isFinite(Number(combined / bigNanoInUtcDay)) || throwRangeError(outOfBoundsDate), {
        ...durationFieldDefaults,
        ...nanoToDurationDayTimeFields(combined, largestUnit)
      };
    })(slots, otherSlots, maxUnit, doSubtract)));
  }
  function roundDuration(refineRelativeTo, slots, options) {
    const durationLargestUnit = getMaxDurationUnit(slots);
    const [largestUnit, smallestUnit, roundingInc, roundingMode, relativeToSlots] = ((options, defaultLargestUnit, refineRelativeTo) => {
      options = normalizeOptionsOrString(options, smallestUnitStr);
      let largestUnit = coerceLargestUnit(options);
      const relativeToInternals = refineRelativeTo(options.relativeTo);
      let roundingInc = coerceRoundingIncInteger(options);
      const roundingMode = coerceRoundingMode(options, 7);
      let smallestUnit = coerceSmallestUnit(options);
      return largestUnit === undefined && smallestUnit === undefined && throwRangeError("Required smallestUnit or largestUnit"), smallestUnit == null && (smallestUnit = 0), largestUnit == null && (largestUnit = Math.max(smallestUnit, defaultLargestUnit)), checkLargestSmallestUnit(largestUnit, smallestUnit), roundingInc = validateRoundingInc(roundingInc, smallestUnit, 1), roundingInc > 1 && smallestUnit > 5 && largestUnit !== smallestUnit && throwRangeError("For calendar units with roundingIncrement > 1, use largestUnit = smallestUnit"), [largestUnit, smallestUnit, roundingInc, roundingMode, relativeToInternals];
    })(options, durationLargestUnit, refineRelativeTo);
    if (!relativeToSlots && Math.max(durationLargestUnit, largestUnit) <= 6) {
      return createDurationSlots(validateDurationFields(((durationFields, largestUnit, smallestUnit, roundingInc, roundingMode) => {
        const roundedBigNano = roundBigNanoToInc(durationDayTimeToBigNano(durationFields), computeBigNanoInc(smallestUnit, roundingInc), roundingMode);
        return {
          ...durationFieldDefaults,
          ...nanoToDurationDayTimeFields(roundedBigNano, largestUnit)
        };
      })(slots, largestUnit, smallestUnit, roundingInc, roundingMode)));
    }
    const isZoned = relativeToSlots && isZonedEpochSlots(relativeToSlots);
    const needsZonedDayLength = isZoned && largestUnit >= 6 && smallestUnit < 6;
    if (!slots.sign && !needsZonedDayLength) {
      return slots;
    }
    relativeToSlots || throwRangeError("Missing relativeTo");
    const [balancedDuration, endEpochNano, relativeOps] = spanRelativeDuration(relativeToSlots, slots, largestUnit);
    return createDurationSlots(roundRelativeDuration(balancedDuration, endEpochNano, largestUnit, smallestUnit, roundingInc, roundingMode, relativeOps, isZoned));
  }
  function absDuration(slots) {
    return slots.sign === -1 ? negateDuration(slots) : slots;
  }
  function negateDuration(slots) {
    return createDurationSlots(negateDurationFields(slots));
  }
  function negateDurationFields(fields) {
    const res = {};
    for (const fieldName of durationFieldNamesAsc) {
      res[fieldName] = -1 * fields[fieldName] || 0;
    }
    return res;
  }
  function computeDurationSign(fields, fieldNames = durationFieldNamesAsc) {
    let sign = 0;
    for (const fieldName of fieldNames) {
      const fieldSign = Math.sign(fields[fieldName]);
      fieldSign && (sign && sign !== fieldSign && throwRangeError("Cannot mix duration signs"), sign = fieldSign);
    }
    return sign;
  }
  function validateDurationFields(fields) {
    for (const calendarUnit of durationCalendarFieldNamesAsc) {
      clampEntity(calendarUnit, fields[calendarUnit], -4294967295, 4294967295, 1);
    }
    const bigNano = durationDayTimeToBigNano(fields);
    return validateDurationTimeUnit(Number(bigNano / bigNanoInSec)), fields;
  }
  function validateDurationTimeUnit(n) {
    Number.isSafeInteger(n) || throwRangeError("Out-of-bounds duration");
  }
  function durationDayTimeToBigNano(fields) {
    return BigInt(fields.days) * bigNanoInUtcDay + durationTimeToBigNano(fields);
  }
  function durationTimeToBigNano(fields) {
    return BigInt(fields.hours) * bigNanoInHour + BigInt(fields.minutes) * bigNanoInMinute + durationSubMinuteToBigNano(fields);
  }
  function durationSubMinuteToBigNano(fields) {
    return BigInt(fields.seconds) * bigNanoInSec + BigInt(fields.milliseconds) * bigNanoInMilli + BigInt(fields.microseconds) * bigNanoInMicro + BigInt(fields.nanoseconds);
  }
  function nanoToDurationDayTimeFields(bigNano, largestUnit = 6) {
    const days = Number(bigNano / bigNanoInUtcDay);
    const timeNano = Number(bigNano % bigNanoInUtcDay);
    const unitNano = unitNanoMap[largestUnit];
    const largestUnitVal = largestUnit <= 3 ? Number(bigNano / BigInt(unitNano)) : days * (nanoInUtcDay / unitNano) + divTrunc(timeNano, unitNano);
    Number.isFinite(largestUnitVal) || throwRangeError(outOfBoundsDate), largestUnit <= 3 && Math.abs(largestUnitVal) / (nanoInSec2 / unitNanoMap[largestUnit]) >= maxDurationSeconds && throwRangeError(outOfBoundsDate);
    const dayTimeFields = nanoToGivenFields(timeNano, largestUnit, durationFieldNamesAsc);
    return dayTimeFields[durationFieldNamesAsc[largestUnit]] = largestUnitVal, dayTimeFields;
  }
  function nanoToDurationTimeFields(nano, largestUnit = 5) {
    return nanoToGivenFields(nano, largestUnit, durationFieldNamesAsc);
  }
  function durationHasDateParts(fields) {
    return Boolean(computeDurationSign(fields, durationDateFieldNamesAsc));
  }
  function getMaxDurationUnit(fields) {
    let unit = 9;
    for (;unit > 0 && !fields[durationFieldNamesAsc[unit]]; unit--) {}
    return unit;
  }
  function compareZonedEpochSlots(zonedEpochSlots0, zonedEpochSlots1) {
    return compareBigInts(zonedEpochSlots0.epochNanoseconds, zonedEpochSlots1.epochNanoseconds);
  }
  function compareDurations(refineRelativeTo, durationSlots0, durationSlots1, options) {
    const relativeToSlots = refineRelativeTo(normalizeOptions(options).relativeTo);
    const maxUnit = Math.max(getMaxDurationUnit(durationSlots0), getMaxDurationUnit(durationSlots1));
    return allPropsEqual(durationFieldNamesAsc, durationSlots0, durationSlots1) ? 0 : isUniformUnit(maxUnit, relativeToSlots && isZonedEpochSlots(relativeToSlots)) ? compareBigInts(durationDayTimeToBigNano(durationSlots0), durationDayTimeToBigNano(durationSlots1)) : (relativeToSlots || throwRangeError("Missing relativeTo"), compareBigInts(moveRelativeEndpointToEpochNano(relativeToSlots, durationSlots0), moveRelativeEndpointToEpochNano(relativeToSlots, durationSlots1)));
  }
  function compareIsoDateTimeFields(isoDateTime0, isoDateTime1) {
    return compareIsoDateFields(isoDateTime0, isoDateTime1) || compareTimeFields(isoDateTime0, isoDateTime1);
  }
  function compareIsoDateFields(isoFields0, isoFields1) {
    return compareNumbers(isoDateToEpochDays(isoFields0), isoDateToEpochDays(isoFields1));
  }
  function compareTimeFields(isoFields0, isoFields1) {
    return compareNumbers(timeFieldsToNano(isoFields0), timeFieldsToNano(isoFields1));
  }
  function instantsEqual(instantSlots0, instantSlots1) {
    return !compareZonedEpochSlots(instantSlots0, instantSlots1);
  }
  function zonedDateTimesEqual(zonedDateTimeSlots0, zonedDateTimeSlots1) {
    return !compareZonedEpochSlots(zonedDateTimeSlots0, zonedDateTimeSlots1) && zonedDateTimeSlots0.timeZone.m === zonedDateTimeSlots1.timeZone.m && zonedDateTimeSlots0.calendar === zonedDateTimeSlots1.calendar;
  }
  function plainDateTimesEqual(plainDateTimeSlots0, plainDateTimeSlots1) {
    return !compareIsoDateTimeFields(plainDateTimeSlots0, plainDateTimeSlots1) && plainDateTimeSlots0.calendar === plainDateTimeSlots1.calendar;
  }
  function plainDatesEqual(plainDateSlots0, plainDateSlots1) {
    return !compareIsoDateFields(plainDateSlots0, plainDateSlots1) && plainDateSlots0.calendar === plainDateSlots1.calendar;
  }
  function plainYearMonthsEqual(plainYearMonthSlots0, plainYearMonthSlots1) {
    return !compareIsoDateFields(plainYearMonthSlots0, plainYearMonthSlots1) && plainYearMonthSlots0.calendar === plainYearMonthSlots1.calendar;
  }
  function plainMonthDaysEqual(plainMonthDaySlots0, plainMonthDaySlots1) {
    return !compareIsoDateFields(plainMonthDaySlots0, plainMonthDaySlots1) && plainMonthDaySlots0.calendar === plainMonthDaySlots1.calendar;
  }
  function plainTimesEqual(plainTimeSlots0, plainTimeSlots1) {
    return !compareTimeFields(plainTimeSlots0, plainTimeSlots1);
  }
  function getCalendarEraOrigins(calendar) {
    return calendar === 0 ? gregoryEraOrigins : calendar ? calendar.k : undefined;
  }
  function getCalendarFieldNames(calendar, fieldNames, fieldNamesWithEra = fieldNames) {
    return getCalendarEraOrigins(calendar) ? fieldNamesWithEra : fieldNames;
  }
  function resolveCalendarYear(calendar, fields) {
    const exoticCalendar = calendar || undefined;
    const eraOrigins = getCalendarEraOrigins(calendar);
    let { era, eraYear, year } = fields;
    if (year !== undefined && (year = toIntegerWithTrunc(year, "year")), eraYear !== undefined && (eraYear = toIntegerWithTrunc(eraYear, "eraYear")), era !== undefined || eraYear !== undefined) {
      era !== undefined && eraYear !== undefined || throwTypeError("Mismatching era/eraYear"), eraOrigins || throwRangeError("Forbidden era/eraYear");
      const normalizedEra = normalizeEraName(era);
      const eraOrigin = eraOrigins[normalizedEra];
      eraOrigin === undefined && throwRangeError(((era) => `Invalid era: ${era}`)(era));
      const yearByEra = exoticCalendar?.$ ? exoticCalendar.$(eraYear, normalizedEra, eraOrigin) : eraYearToYear(eraYear, eraOrigin);
      year !== undefined && year !== yearByEra && throwRangeError("Mismatching year/eraYear"), year = yearByEra;
    } else {
      year === undefined && throwTypeError(missingYear(eraOrigins));
    }
    return year;
  }
  function resolveCalendarMonth(calendar, fields, year, overflow, monthCodeParts) {
    let { month, monthCode } = fields;
    if (monthCode !== undefined) {
      const monthByCode = ((calendar, monthCode, year, overflow, monthCodeParts = parseMonthCode(monthCode)) => {
        const leapMonth = calendar ? calendar.p(year) : undefined;
        const [monthCodeNumber, wantsLeapMonth] = monthCodeParts;
        let month = monthCodeNumberToMonth(monthCodeNumber, wantsLeapMonth, leapMonth);
        if (wantsLeapMonth) {
          const leapMonthMeta = calendar ? calendar.l : undefined;
          leapMonthMeta === undefined && throwRangeError(invalidLeapMonth), leapMonthMeta > 0 ? (month > leapMonthMeta && throwRangeError(invalidLeapMonth), leapMonth !== month && (overflow === 1 && throwRangeError(invalidLeapMonth), month = monthCodeNumberToMonth(monthCodeNumber, 0, leapMonth))) : (month !== -leapMonthMeta && throwRangeError(invalidLeapMonth), leapMonth === undefined && overflow === 1 && throwRangeError(invalidLeapMonth));
        }
        return month;
      })(calendar, monthCode, year, overflow, monthCodeParts);
      month !== undefined && month !== monthByCode && throwRangeError("Mismatching month/monthCode"), month = monthByCode, overflow = 1;
    } else {
      month === undefined && throwTypeError("Missing month/monthCode");
    }
    return clampEntity("month", month, 1, computeCalendarMonthsInYearForYear(calendar, year), overflow);
  }
  function resolveCalendarDay(calendar, fields, month, year, overflow) {
    return clampProp(fields, "day", 1, computeCalendarDaysInMonthForYearMonth(calendar, year, month), overflow);
  }
  function eraYearToYear(eraYear, eraOrigin) {
    return (eraOrigin + eraYear) * (Math.sign(eraOrigin) || 1) || 0;
  }
  function resolveTimeFields(fields, overflow) {
    return constrainTimeFields(pluckProps(timeFieldNamesAsc, {
      ...timeFieldDefaults,
      ...fields
    }), overflow);
  }
  var offsetRegExp = /* @__PURE__ */ createRegExp("([+-])(\\d{2})(?::?(\\d{2})(?::?(\\d{2})(?:[.,](\\d{1,9}))?)?)?");
  function parseOffsetNano(s) {
    const offsetNano = parseOffsetNanoMaybe(s);
    return offsetNano === undefined && throwRangeError(failedParse(s)), offsetNano;
  }
  function parseOffsetNanoMaybe(s, onlyHourMinute) {
    const parts = offsetRegExp.exec(s);
    if (parts && ((s) => ((s) => {
      s[0] !== "T" && s[0] !== "t" || (s = s.slice(1));
      const fractionIndex = s.search(/[.,]/);
      const main = fractionIndex < 0 ? s : s.slice(0, fractionIndex);
      const parts = main.split(":");
      return parts.length === 1 ? /^(?:\d{2}|\d{4}|\d{6})$/i.test(main) : (parts.length === 2 || parts.length === 3) && parts.every((part) => part.length === 2 && /^\d{2}$/i.test(part));
    })(s.slice(1)))(parts[0])) {
      return ((parts, onlyHourMinute) => {
        const firstSubMinutePart = parts[4] || parts[5];
        onlyHourMinute && firstSubMinutePart && throwRangeError(invalidSubstring(firstSubMinutePart));
        const offsetNanoPos = parseInt0(parts[2]) * nanoInHour2 + parseInt0(parts[3]) * nanoInMinute2 + parseInt0(parts[4]) * nanoInSec2 + parseSubsecNano(parts[5] || "");
        return offsetNano = offsetNanoPos * parseSign(parts[1]), Math.abs(offsetNano) >= nanoInUtcDay && throwRangeError("Out-of-bounds offset"), offsetNano;
        var offsetNano;
      })(parts, onlyHourMinute);
    }
  }
  var dateFieldRefiners = {
    era: toStringViaPrimitive,
    month: toPositiveIntegerWithTruncation,
    monthCode(monthCode, entityName) {
      if (typeof monthCode == "string") {
        return monthCode;
      }
      if (monthCode && typeof monthCode == "object") {
        const monthCodeToString = monthCode.toString;
        if (typeof monthCodeToString == "function") {
          return requireString(monthCodeToString.call(monthCode), entityName);
        }
      }
      return requireString(monthCode, entityName);
    },
    day: toPositiveIntegerWithTruncation
  };
  var timeFieldRefiners = /* @__PURE__ */ zipPropsConst(timeFieldNamesAsc, toIntegerWithTrunc);
  var durationFieldRefiners = /* @__PURE__ */ zipPropsConst(durationFieldNamesAsc, toStrictInteger);
  var dateTimeFieldRefiners = /* @__PURE__ */ Object.assign({}, dateFieldRefiners, timeFieldRefiners);
  var zonedDateTimeFieldRefiners = {
    offset(offsetString) {
      return parseOffsetNano(toStringViaPrimitive(offsetString));
    },
    ...dateTimeFieldRefiners
  };
  function readAndRefineBagFields(bag, validFieldNames, fieldRefiners, requiredFieldNames, disallowEmpty = !requiredFieldNames) {
    const res = {};
    let anyMatching = 0;
    for (const fieldName of validFieldNames) {
      let fieldVal = bag[fieldName];
      if (fieldVal !== undefined) {
        anyMatching = 1;
        const refiner = fieldRefiners[fieldName];
        refiner && (fieldVal = refiner(fieldVal, fieldName)), res[fieldName] = fieldVal;
      } else {
        requiredFieldNames && requiredFieldNames.includes(fieldName) && throwTypeError(missingField(fieldName));
      }
    }
    return disallowEmpty && !anyMatching && throwTypeError(noValidFields(validFieldNames)), res;
  }
  function createPlainDateTimeFromRefinedFields(isoDate, time = timeFieldDefaults, calendar) {
    const isoDateTime = combineDateAndTime(isoDate, time);
    return checkIsoDateTimeInBounds(isoDateTime), createDateTimeSlots(isoDateTime, calendar);
  }
  function createPlainDateFromFields(calendar, fields, options) {
    return createPlainDateFromPreparedFields(calendar, fields, prepareDateFields(calendar, fields), refineOverflowOptions(options));
  }
  function createPlainDateFromFieldsWithOptionsRefiner(calendar, fields, refineOptions) {
    const prepared = prepareDateFields(calendar, fields);
    const refinedOptions = refineOptions();
    return [createPlainDateFromPreparedFields(calendar, fields, prepared, refinedOptions[0]), ...refinedOptions];
  }
  function createPlainDateFromPreparedFields(calendar, fields, prepared, overflow) {
    const year = prepared[1];
    const month = resolveCalendarMonth(calendar, fields, year, overflow, prepared[0]);
    return createDateSlots(checkIsoDateInBounds(computeCalendarIsoFieldsFromParts(calendar, year, month, resolveCalendarDay(calendar, fields, month, year, overflow))), calendar);
  }
  function parseMonthCodeField(fields) {
    if (fields.monthCode !== undefined) {
      return parseMonthCode(fields.monthCode);
    }
  }
  function prepareDateFields(calendar, fields) {
    const eraOrigins = getCalendarEraOrigins(calendar);
    return fields.year !== undefined || fields.era !== undefined && fields.eraYear !== undefined || throwTypeError(missingYear(eraOrigins)), fields.monthCode === undefined && fields.month === undefined && throwTypeError("Missing month/monthCode"), fields.day === undefined && throwTypeError(missingField("day")), [parseMonthCodeField(fields), resolveCalendarYear(calendar, fields)];
  }
  function createPlainYearMonthFromFields(calendar, fields, options) {
    const eraOrigins = getCalendarEraOrigins(calendar);
    fields.year !== undefined || fields.era !== undefined && fields.eraYear !== undefined || throwTypeError(missingYear(eraOrigins)), fields.monthCode === undefined && fields.month === undefined && throwTypeError("Missing month/monthCode");
    const monthCodeParts = parseMonthCodeField(fields);
    const year = resolveCalendarYear(calendar, fields);
    return createDateSlots(checkIsoYearMonthInBounds(computeCalendarIsoFieldsFromParts(calendar, year, resolveCalendarMonth(calendar, fields, year, refineOverflowOptions(options), monthCodeParts), 1)), calendar);
  }
  function createPlainMonthDayFromFields(calendar, fields, options) {
    const isIso = calendar === isoCalendarImpl;
    const eraOrigins = getCalendarEraOrigins(calendar);
    fields.day === undefined && throwTypeError(missingField("day")), isIso || fields.month === undefined || fields.year !== undefined || fields.era !== undefined && fields.eraYear !== undefined || throwTypeError(missingYear(eraOrigins));
    const monthCodeParts = parseMonthCodeField(fields);
    let yearMaybe = fields.eraYear !== undefined || fields.year !== undefined ? resolveCalendarYear(calendar, fields) : undefined;
    const overflow = refineOverflowOptions(options);
    let day;
    let monthCodeNumber;
    let isLeapMonth;
    if (yearMaybe === undefined && isIso && (yearMaybe = 1972), yearMaybe !== undefined) {
      isIso || checkIsoDateInBounds(computeCalendarIsoFieldsFromParts(calendar, yearMaybe, 1, 1));
      const month = resolveCalendarMonth(calendar, fields, yearMaybe, overflow, monthCodeParts);
      day = resolveCalendarDay(calendar, fields, month, yearMaybe, overflow), [monthCodeNumber, isLeapMonth] = computeCalendarMonthCodeParts(calendar, yearMaybe, month);
    } else {
      fields.monthCode === undefined && throwTypeError("Missing month/monthCode"), [monthCodeNumber, isLeapMonth] = monthCodeParts;
      const referenceYear = calendar ? calendar.ne : 1972;
      if (referenceYear !== undefined) {
        day = resolveCalendarDay(calendar, fields, resolveCalendarMonth(calendar, fields, referenceYear, overflow, monthCodeParts), referenceYear, overflow);
      } else {
        const constrainedDay = overflow === 0 && calendar ? calendar.fe?.(monthCodeNumber, isLeapMonth, fields.day) : undefined;
        day = constrainedDay !== undefined ? constrainedDay : fields.day;
      }
    }
    isLeapMonth && ((calendar && calendar.U?.[monthCodeNumber]) ?? 1 / 0) < fields.day && (overflow === 1 && throwRangeError(invalidLeapMonth), isLeapMonth = 0, day = constrainToRange2(fields.day, 1, (calendar && calendar.R) ?? 1 / 0));
    let res = calendar ? calendar.u(monthCodeNumber, Boolean(isLeapMonth), day) : computeIsoYearMonthFieldsForMonthDay(monthCodeNumber, Boolean(isLeapMonth));
    for (;!res && overflow === 0 && day > 1; ) {
      day--, res = calendar ? calendar.u(monthCodeNumber, Boolean(isLeapMonth), day) : computeIsoYearMonthFieldsForMonthDay(monthCodeNumber, Boolean(isLeapMonth));
    }
    res || throwRangeError("Cannot guess year");
    const { year: finalYear, month: finalMonth } = res;
    return createDateSlots(checkIsoDateInBounds(computeCalendarIsoFieldsFromParts(calendar, finalYear, finalMonth, day)), calendar);
  }
  var RawDateTimeFormat = Intl.DateTimeFormat;
  function formatEpochMilliToPartsRecord(intlFormat, epochMilli) {
    epochMilli < -8640000000000000 && throwRangeError(outOfBoundsDate);
    const parts = intlFormat.formatToParts(epochMilli);
    const hash = {};
    for (const part of parts) {
      hash[part.type] = part.value;
    }
    return hash;
  }
  var timeZonePeriodDaysByName = {
    El_Aaiun: 17,
    Tucuman: 12,
    Tirane: 11,
    Riga: 10,
    Simferopol: 9,
    Vienna: 9,
    Tunis: 8,
    Boa_Vista: 6,
    Fortaleza: 6,
    Maceio: 6,
    Noronha: 6,
    Recife: 6,
    Gaza: 6,
    Hebron: 6,
    DeNoronha: 6
  };
  var minPossibleTransitionSec = -3881520000;
  function refineTimeDisplayTuple(options, maxSmallestUnit = 4) {
    const subsecDigits = coerceFractionalSecondDigits(options);
    const roundingMode = coerceRoundingMode(options, 4);
    const smallestUnit = coerceSmallestUnit(options);
    return [roundingMode, ...resolveSmallestUnitAndSubsecDigits(validateUnitRange(smallestUnitStr, smallestUnit, 0, maxSmallestUnit), subsecDigits)];
  }
  function refineDateDisplayOptions(options) {
    return coerceCalendarDisplay(normalizeOptions(options));
  }
  function refineTimeDisplayOptions(options, maxSmallestUnit) {
    return refineTimeDisplayTuple(normalizeOptions(options), maxSmallestUnit);
  }
  function resolveSmallestUnitAndSubsecDigits(smallestUnit, subsecDigits) {
    return smallestUnit != null ? [unitNanoMap[smallestUnit], smallestUnit < 4 ? 9 - 3 * smallestUnit : -1] : [subsecDigits === undefined ? 1 : 10 ** (9 - subsecDigits), subsecDigits];
  }
  function formatInstantIso(refineTimeZoneString, instantSlots, options) {
    const [timeZoneArg, roundingMode, nanoInc, subsecDigits] = ((options) => {
      const subsecDigits = coerceFractionalSecondDigits(options = normalizeOptions(options));
      const roundingMode = coerceRoundingMode(options, 4);
      const smallestUnit = coerceSmallestUnit(options);
      return [options.timeZone, roundingMode, ...resolveSmallestUnitAndSubsecDigits(validateUnitRange(smallestUnitStr, smallestUnit, 0, 4), subsecDigits)];
    })(options);
    const providedTimeZone = timeZoneArg !== undefined;
    return ((providedTimeZone, timeZone, epochNano, roundingMode, nanoInc, subsecDigits) => {
      epochNano = roundBigNanoToDayOriginInc(epochNano, BigInt(nanoInc), roundingMode);
      const offsetNano = timeZone.B(epochNano);
      return formatIsoDateTimeFields(epochNanoToIsoDateTime(epochNano + BigInt(offsetNano)), subsecDigits) + (providedTimeZone ? formatOffsetNano(roundToMinute(offsetNano)) : "Z");
    })(providedTimeZone, queryTimeZone(providedTimeZone ? refineTimeZoneString(timeZoneArg) : "UTC"), instantSlots.epochNanoseconds, roundingMode, nanoInc, subsecDigits);
  }
  function formatZonedDateTimeIso(zonedDateTimeSlots0, options) {
    const displayOptions = ((options) => {
      options = normalizeOptions(options);
      const calendarDisplay = coerceCalendarDisplay(options);
      const subsecDigits = coerceFractionalSecondDigits(options);
      const offsetDisplay = coerceOffsetDisplay(options);
      const roundingMode = coerceRoundingMode(options, 4);
      const smallestUnit = coerceSmallestUnit(options);
      return [calendarDisplay, coerceTimeZoneDisplay(options), offsetDisplay, roundingMode, ...resolveSmallestUnitAndSubsecDigits(validateUnitRange(smallestUnitStr, smallestUnit, 0, 4), subsecDigits)];
    })(options);
    return ((calendar, timeZoneId, timeZone, epochNano, calendarDisplay, timeZoneDisplay, offsetDisplay, roundingMode, nanoInc, subsecDigits) => {
      epochNano = roundBigNanoToDayOriginInc(epochNano, BigInt(nanoInc), roundingMode);
      const offsetNano = timeZone.B(epochNano);
      return formatIsoDateTimeFields(epochNanoToIsoDateTime(epochNano + BigInt(offsetNano)), subsecDigits) + formatOffsetNano(roundToMinute(offsetNano), offsetDisplay) + formatTimeZone(timeZoneId, timeZoneDisplay) + formatCalendar(calendar, calendarDisplay);
    })(zonedDateTimeSlots0.calendar, zonedDateTimeSlots0.timeZone.id, zonedDateTimeSlots0.timeZone, zonedDateTimeSlots0.epochNanoseconds, ...displayOptions);
  }
  function formatPlainDateTimeIso(plainDateTimeSlots0, options) {
    const displayOptions = ((options) => (options = normalizeOptions(options), [coerceCalendarDisplay(options), ...refineTimeDisplayTuple(options)]))(options);
    return ((calendar, isoDateTime, calendarDisplay, roundingMode, nanoInc, subsecDigits) => formatIsoDateTimeFields(roundDateTimeToNano(isoDateTime, nanoInc, roundingMode), subsecDigits) + formatCalendar(calendar, calendarDisplay))(plainDateTimeSlots0.calendar, plainDateTimeSlots0, ...displayOptions);
  }
  function formatPlainDateIso(plainDateSlots, options) {
    return calendar = plainDateSlots.calendar, isoDate = plainDateSlots, calendarDisplay = refineDateDisplayOptions(options), formatIsoDateFields(isoDate) + formatCalendar(calendar, calendarDisplay);
    var calendar, isoDate, calendarDisplay;
  }
  function formatPlainYearMonthIso(plainYearMonthSlots, options) {
    return formatDateLikeIso(plainYearMonthSlots.calendar, formatIsoYearMonthFields, plainYearMonthSlots, refineDateDisplayOptions(options));
  }
  function formatPlainMonthDayIso(plainMonthDaySlots, options) {
    return formatDateLikeIso(plainMonthDaySlots.calendar, formatIsoMonthDayFields, plainMonthDaySlots, refineDateDisplayOptions(options));
  }
  function formatDateLikeIso(calendar, formatSimple, isoDate, calendarDisplay) {
    const showCalendar = calendarDisplay > 1 || calendarDisplay === 0 && calendar !== isoCalendarImpl;
    return calendarDisplay === 1 ? calendar === isoCalendarImpl ? formatSimple(isoDate) : formatIsoDateFields(isoDate) : showCalendar ? formatIsoDateFields(isoDate) + formatCalendarId(getCalendarSlotId(calendar), calendarDisplay === 2) : formatSimple(isoDate);
  }
  function formatPlainTimeIso(slots, options) {
    return ((fields, roundingMode, nanoInc, subsecDigits) => formatTimeFields(roundTimeToNano(fields, nanoInc, roundingMode)[0], subsecDigits))(slots, ...refineTimeDisplayOptions(options));
  }
  function formatDurationIso(slots, options) {
    const [roundingMode, nanoInc, subsecDigits] = refineTimeDisplayOptions(options, 3);
    return nanoInc > 1 && validateDurationFields(slots = {
      ...slots,
      ...roundDayTimeDurationByInc(slots, nanoInc, roundingMode)
    }), formatDurationSlots(slots, subsecDigits);
  }
  function formatDurationSlots(durationSlots, subsecDigits) {
    const { sign } = durationSlots;
    const abs = sign === -1 ? negateDurationFields(durationSlots) : durationSlots;
    const { hours, minutes } = abs;
    const bigNano = durationSubMinuteToBigNano(abs);
    const wholeSec = Number(bigNano / bigNanoInSec);
    const subsecNano = Number(bigNano % bigNanoInSec);
    validateDurationTimeUnit(wholeSec);
    const subsecNanoString = formatSubsecNano(subsecNano, subsecDigits);
    const forceSec = subsecDigits >= 0 || !sign || subsecNanoString;
    return (sign < 0 ? "-" : "") + "P" + formatDurationFragments({
      Y: formatDurationNumber(abs.years),
      M: formatDurationNumber(abs.months),
      W: formatDurationNumber(abs.weeks),
      D: formatDurationNumber(abs.days)
    }) + (hours || minutes || wholeSec || forceSec ? "T" + formatDurationFragments({
      H: formatDurationNumber(hours),
      M: formatDurationNumber(minutes),
      S: formatDurationNumber(wholeSec, forceSec) + subsecNanoString
    }) : "");
  }
  function formatDurationFragments(fragObj) {
    const parts = [];
    for (const fragName in fragObj) {
      const fragVal = fragObj[fragName];
      fragVal && parts.push(fragVal, fragName);
    }
    return parts.join("");
  }
  function formatDurationNumber(n, force) {
    if (!n && !force) {
      return "";
    }
    const options = Object.create(null);
    return options.useGrouping = 0, n.toLocaleString("fullwide", options);
  }
  function formatIsoDateTimeFields(isoDateTime, subsecDigits) {
    return formatIsoDateFields(isoDateTime) + "T" + formatTimeFields(isoDateTime, subsecDigits);
  }
  function formatIsoDateFields(isoDateFields) {
    return formatIsoYearMonthFields(isoDateFields) + "-" + padNumber2(isoDateFields.day);
  }
  function formatIsoYearMonthFields(isoDateFields) {
    const { year } = isoDateFields;
    return (year < 0 || year > 9999 ? getSignStr(year) + padNumber(6, Math.abs(year)) : padNumber(4, year)) + "-" + padNumber2(isoDateFields.month);
  }
  function formatIsoMonthDayFields(isoDateFields) {
    return padNumber2(isoDateFields.month) + "-" + padNumber2(isoDateFields.day);
  }
  function formatTimeFields(timeFields, subsecDigits) {
    const parts = [padNumber2(timeFields.hour), padNumber2(timeFields.minute)];
    return subsecDigits !== -1 && parts.push(padNumber2(timeFields.second) + ((millisecond, microsecond, nanosecond, subsecDigits) => formatSubsecNano(millisecond * nanoInMilli2 + microsecond * nanoInMicro2 + nanosecond, subsecDigits))(timeFields.millisecond, timeFields.microsecond, timeFields.nanosecond, subsecDigits)), parts.join(":");
  }
  function formatOffsetNano(offsetNano, offsetDisplay = 0) {
    if (offsetDisplay === 1) {
      return "";
    }
    const [hour, nanoRemainder0] = divModFloor(Math.abs(offsetNano), nanoInHour2);
    const [minute, nanoRemainder1] = divModFloor(nanoRemainder0, nanoInMinute2);
    const [second, nanoRemainder2] = divModFloor(nanoRemainder1, nanoInSec2);
    return getSignStr(offsetNano) + padNumber2(hour) + ":" + padNumber2(minute) + (second || nanoRemainder2 ? ":" + padNumber2(second) + formatSubsecNano(nanoRemainder2) : "");
  }
  function formatTimeZone(timeZoneId, timeZoneDisplay) {
    return timeZoneDisplay !== 1 ? "[" + (timeZoneDisplay === 2 ? "!" : "") + timeZoneId + "]" : "";
  }
  function formatCalendar(calendar, calendarDisplay) {
    return calendarDisplay > 1 || calendarDisplay === 0 && calendar !== isoCalendarImpl ? formatCalendarId(getCalendarSlotId(calendar), calendarDisplay === 2) : "";
  }
  function formatCalendarId(calendarId, isCritical) {
    return "[" + (isCritical ? "!" : "") + "u-ca=" + calendarId + "]";
  }
  var trailingZerosRE = /0+$/;
  function formatSubsecNano(totalNano, subsecDigits) {
    let s = padNumber(9, totalNano);
    return s = subsecDigits === undefined ? s.replace(trailingZerosRE, "") : s.slice(0, subsecDigits), s ? "." + s : "";
  }
  function getSignStr(num) {
    return num < 0 ? "-" : "+";
  }
  var icuRegExp = /^(AC|AE|AG|AR|AS|BE|BS|CA|CN|CS|CT|EA|EC|IE|IS|JS|MI|NE|NS|PL|PN|PR|PS|SS|VS)T$/;
  var badCharactersRegExp = /[^\w\/:+-]+/;
  function refineTimeZoneId(rawId) {
    return resolveTimeZoneId(requireString(rawId));
  }
  function resolveTimeZoneId(rawId) {
    return resolveTimeZoneRecord(rawId).id;
  }
  function resolveTimeZoneRecord(rawId) {
    const upperRawId = rawId.toUpperCase();
    const offsetRecord = ((upperRawId) => {
      const offsetNano = parseOffsetNanoMaybe(upperRawId, 1);
      if (offsetNano !== undefined) {
        return {
          id: formatOffsetNano(offsetNano),
          X: offsetNano,
          m: offsetNano
        };
      }
    })(upperRawId);
    if (offsetRecord) {
      return {
        kind: "fixed",
        ...offsetRecord
      };
    }
    const normId = upperRawId === "UTC" ? "UTC" : ((rawId) => (badCharactersRegExp.test(rawId) && throwRangeError(invalidTimeZone(rawId)), icuRegExp.test(rawId) && throwRangeError("Forbidden ICU TimeZone"), rawId.toLowerCase().split("/").map((part, partI) => (part.length <= 3 || /\d/.test(part)) && !/etc|yap/.test(part) ? part.toUpperCase() : part.replace(/baja|dumont|[a-z]+/g, (a, i) => a.length <= 2 && !partI || a === "in" || a === "chat" ? a.toUpperCase() : a.length > 2 || !i ? capitalize(a).replace(/island|noronha|murdo|rivadavia|urville/, capitalize) : a)).join("/")))(rawId);
    return queryNamedTimeZoneRecord(normId);
  }
  var queryNamedTimeZoneRecord = /* @__PURE__ */ memoize((normId) => {
    if (normId === "UTC") {
      return {
        kind: "utc",
        id: normId,
        m: normId
      };
    }
    const upperNormId = normId.toUpperCase();
    const format = queryTimeZoneIntlFormat(upperNormId);
    return {
      kind: "named",
      id: normId,
      format,
      m: format.resolvedOptions().timeZone
    };
  });
  var queryTimeZoneIntlFormat = /* @__PURE__ */ memoize((upperNormId) => new RawDateTimeFormat("en-u-hc-h23", {
    calendar: "iso8601",
    timeZone: upperNormId,
    era: "short",
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
    second: "numeric"
  }));
  function queryTimeZone(rawTimeZoneId) {
    const record = resolveTimeZoneRecord(rawTimeZoneId);
    return queryTimeZoneRecord(record.id, record);
  }
  var queryTimeZoneRecord = /* @__PURE__ */ memoize((normTimeZoneId, record) => record.kind === "named" ? new IntlTimeZone(normTimeZoneId, record.m, record.format) : new FixedTimeZone(normTimeZoneId, record.m, record.kind === "fixed" ? record.X : 0));

  class FixedTimeZone {
    constructor(id, compareKey, offsetNano) {
      this.id = id, this.m = compareKey, this.X = offsetNano;
    }
    B() {
      return this.X;
    }
    N(isoDateTime) {
      return [isoDateTimeAndOffsetToEpochNano(isoDateTime, this.X)];
    }
    O() {}
  }

  class IntlTimeZone {
    constructor(id, compareKey, format) {
      this.id = id, this.m = compareKey, this.ke = ((computeOffsetSec, periodDays) => {
        const getSample = memoize(computeOffsetSec);
        const getSplit = memoize(createSplitTuple);
        const periodSec = 86400 * periodDays;
        function getOffsetSec(epochSec) {
          const [startEpochSec, endEpochSec] = computePeriod(epochSec, periodSec);
          const clampedStartEpochSec = clampIntlSampleEpochSec(startEpochSec);
          const clampedEndEpochSec = clampIntlSampleEpochSec(endEpochSec);
          const startOffsetSec = getSample(clampedStartEpochSec);
          const endOffsetSec = getSample(clampedEndEpochSec);
          return startOffsetSec === endOffsetSec ? startOffsetSec : pinch(getSplit(clampedStartEpochSec, clampedEndEpochSec), startOffsetSec, endOffsetSec, epochSec);
        }
        function pinch(split, startOffsetSec, endOffsetSec, forEpochSec) {
          let offsetSec;
          let splitDurSec;
          for (;(forEpochSec === undefined || (offsetSec = forEpochSec < split[0] ? startOffsetSec : forEpochSec >= split[1] ? endOffsetSec : undefined) === undefined) && (splitDurSec = split[1] - split[0]); ) {
            const middleEpochSec = split[0] + Math.floor(splitDurSec / 2);
            computeOffsetSec(middleEpochSec) === endOffsetSec ? split[1] = middleEpochSec : split[0] = middleEpochSec + 1;
          }
          return offsetSec;
        }
        return {
          xe(zonedEpochSec) {
            const wideOffsetSec0 = getOffsetSec(zonedEpochSec - 86400);
            const wideOffsetSec1 = getOffsetSec(zonedEpochSec + 86400);
            const wideUtcEpochSec0 = zonedEpochSec - wideOffsetSec0;
            const wideUtcEpochSec1 = zonedEpochSec - wideOffsetSec1;
            if (wideOffsetSec0 === wideOffsetSec1) {
              return [wideUtcEpochSec0];
            }
            const narrowOffsetSec0 = getOffsetSec(wideUtcEpochSec0);
            return narrowOffsetSec0 === getOffsetSec(wideUtcEpochSec1) ? [zonedEpochSec - narrowOffsetSec0] : wideOffsetSec0 > wideOffsetSec1 ? [wideUtcEpochSec0, wideUtcEpochSec1] : [];
          },
          we: getOffsetSec,
          O: function getTransition(epochSec, direction) {
            if (direction > 0 && epochSec >= 8640000000000) {
              return;
            }
            if (direction < 0) {
              if (epochSec <= minPossibleTransitionSec) {
                return;
              }
              const lookaheadEpochSec = getCurrentEpochSec() + 94867200;
              if (epochSec > lookaheadEpochSec) {
                return getTransition(lookaheadEpochSec, -1);
              }
            }
            const searchEpochSec = direction > 0 ? Math.max(epochSec, minPossibleTransitionSec) : epochSec;
            let [startEpochSec, endEpochSec] = computePeriod(searchEpochSec, periodSec);
            const inc = periodSec * direction;
            const searchLimit = direction > 0 ? Math.max(epochSec, getCurrentEpochSec()) + 94867200 : minPossibleTransitionSec;
            const inBounds = () => direction < 0 ? endEpochSec > searchLimit : startEpochSec < searchLimit;
            for (;inBounds(); ) {
              const clampedStartEpochSec = clampIntlSampleEpochSec(startEpochSec);
              const clampedEndEpochSec = clampIntlSampleEpochSec(endEpochSec);
              const startOffsetSec = getSample(clampedStartEpochSec);
              const endOffsetSec = getSample(clampedEndEpochSec);
              if (startOffsetSec !== endOffsetSec) {
                const split = getSplit(clampedStartEpochSec, clampedEndEpochSec);
                pinch(split, startOffsetSec, endOffsetSec);
                const transitionEpochSec = split[0];
                if ((compareNumbers(transitionEpochSec, epochSec) || 1) === direction) {
                  return transitionEpochSec;
                }
              }
              startEpochSec += inc, endEpochSec += inc;
            }
          }
        };
      })(((format) => (epochSec) => {
        const intlParts = formatEpochMilliToPartsRecord(format, 1000 * epochSec);
        return 86400 * isoArgsToEpochDays(((intlParts) => {
          const relatedYear = intlParts.relatedYear;
          if (relatedYear !== undefined) {
            return parseInt(relatedYear);
          }
          const year = parseInt(intlParts.year);
          return intlParts.era !== undefined && normalizeEraName(intlParts.era) === "bce" ? 1 - year : year;
        })(intlParts), parseInt(intlParts.month), parseInt(intlParts.day)) + 3600 * parseInt(intlParts.hour) + 60 * parseInt(intlParts.minute) + parseInt(intlParts.second) - epochSec;
      })(format), ((timeZoneId) => {
        const timeZoneName = timeZoneId.split("/").pop();
        return timeZonePeriodDaysByName[timeZoneName] || 60;
      })(id));
    }
    B(epochNano) {
      return this.ke.we(((epochNano) => epochNanoToSecMod(epochNano)[0])(epochNano)) * nanoInSec2;
    }
    N(isoDateTime) {
      const zonedEpochSec = 86400 * isoDateToEpochDays(isoDateTime) + timeFieldsToSec(isoDateTime);
      const subsecNano = timeFieldsToSubsecNano(isoDateTime);
      return this.ke.xe(zonedEpochSec).map((epochSec) => checkEpochNanoInBounds(BigInt(epochSec) * bigNanoInSec + BigInt(subsecNano)));
    }
    O(epochNano, direction) {
      const [epochSec, subsecNano] = epochNanoToSecMod(epochNano);
      const resEpochSec = this.ke.O(epochSec + (direction > 0 || subsecNano ? 1 : 0), direction);
      if (resEpochSec !== undefined) {
        return BigInt(resEpochSec) * bigNanoInSec;
      }
    }
  }
  function getCurrentEpochSec() {
    return Math.floor(Date.now() / 1000);
  }
  function createSplitTuple(startEpochSec, endEpochSec) {
    return [startEpochSec, endEpochSec];
  }
  function computePeriod(epochSec, periodSec) {
    const startEpochSec = Math.floor(epochSec / periodSec) * periodSec;
    return [startEpochSec, startEpochSec + periodSec];
  }
  function clampIntlSampleEpochSec(epochSec) {
    return constrainToRange2(epochSec, -10000000000, 8640000000000);
  }
  function refineMaybeZonedDateTimeObjectLike(refineTimeZoneString, calendar, bag) {
    const fields = readAndRefineBagFields(bag, getCalendarFieldNames(calendar, dateTimeAndZoneFieldNamesAlpha, dateTimeAndZoneFieldNamesWithEraAlpha), zonedDateTimeFieldRefiners, [], 0);
    if (fields.timeZone !== undefined) {
      const isoDateFields = createPlainDateFromFields(calendar, fields);
      const timeFields = resolveTimeFields(fields);
      const timeZone = queryTimeZone(refineTimeZoneString(fields.timeZone));
      return {
        epochNanoseconds: getMatchingInstantFor(timeZone, combineDateAndTime(isoDateFields, timeFields), fields.offset),
        timeZone,
        calendar
      };
    }
    return createPlainDateFromFields(calendar, fields);
  }
  function refineZonedDateTimeObjectLike(refineTimeZoneString, calendar, bag, options) {
    const fields = readAndRefineBagFields(bag, getCalendarFieldNames(calendar, dateTimeAndZoneFieldNamesAlpha, dateTimeAndZoneFieldNamesWithEraAlpha), zonedDateTimeFieldRefiners, timeZoneFieldNames, 0);
    const timeZoneId = refineTimeZoneString(fields.timeZone);
    const [isoDateFields, overflow, offsetDisambig, epochDisambig] = createPlainDateFromFieldsWithOptionsRefiner(calendar, fields, () => refineZonedFieldOptions(options));
    const timeFields = resolveTimeFields(fields, overflow);
    const timeZone = queryTimeZone(timeZoneId);
    return createZonedEpochNanoSlots(getMatchingInstantFor(timeZone, combineDateAndTime(isoDateFields, timeFields), fields.offset, offsetDisambig, epochDisambig), timeZone, calendar);
  }
  function refinePlainDateTimeObjectLike(calendar, bag, options) {
    const fields = readAndRefineBagFields(bag, getCalendarFieldNames(calendar, dateTimeFieldNamesAlpha, dateTimeFieldNamesWithEraAlpha), dateTimeFieldRefiners, [], 0);
    const [isoDateInternals, overflow] = createPlainDateFromFieldsWithOptionsRefiner(calendar, fields, () => [refineOverflowOptions(options)]);
    return createPlainDateTimeFromRefinedFields(isoDateInternals, resolveTimeFields(fields, overflow), calendar);
  }
  function refinePlainDateObjectLike(calendar, bag, options, requireFields = []) {
    return createPlainDateFromFields(calendar, readAndRefineBagFields(bag, getCalendarFieldNames(calendar, dateFieldNamesAlpha, dateFieldNamesWithEraAlpha), dateFieldRefiners, requireFields), options);
  }
  function refinePlainYearMonthObjectLike(calendar, bag, options, requireFields) {
    return createPlainYearMonthFromFields(calendar, readAndRefineBagFields(bag, getCalendarFieldNames(calendar, yearMonthFieldNamesAlpha, yearMonthFieldNamesWithEraAlpha), dateFieldRefiners, requireFields), options);
  }
  function refinePlainMonthDayObjectLike(calendar, calendarAbsent, bag, options) {
    const fields = readAndRefineBagFields(bag, getCalendarFieldNames(calendar, dateFieldNamesAlpha, dateFieldNamesWithEraAlpha), dateFieldRefiners, dayFieldNamesAsc, 0);
    return calendarAbsent && fields.month !== undefined && fields.monthCode === undefined && fields.year === undefined && (fields.year = 1972), createPlainMonthDayFromFields(calendar, fields, options);
  }
  function refinePlainTimeObjectLike(bag, options) {
    return resolveTimeFields(readAndRefineBagFields(bag, timeFieldNamesAlpha, timeFieldRefiners, [], 1), refineOverflowOptions(options));
  }
  function refineDurationObjectLike(bag) {
    const durationFields = readAndRefineBagFields(bag, durationFieldNamesAlpha, durationFieldRefiners);
    return createDurationSlots(validateDurationFields({
      ...durationFieldDefaults,
      ...durationFields
    }));
  }
  function throwFailedParse(s) {
    throwRangeError(failedParse(s));
  }
  function parseInstant(s) {
    const organized = parseDateTimeLike(s = toStringViaPrimitive(s));
    let offsetNano;
    return organized || throwFailedParse(s), organized.C ? offsetNano = 0 : organized.offset ? offsetNano = parseOffsetNano(organized.offset) : throwFailedParse(s), organized.timeZoneId && parseOffsetNanoMaybe(organized.timeZoneId, 1), validateIsoDateTimeFields(organized), createEpochNanoSlots(isoDateTimeAndOffsetToEpochNano(organized, offsetNano));
  }
  function parseRelativeToSlots(s, resolveCalendar) {
    const organized = parseDateTimeLike(requireString(s));
    return organized || throwFailedParse(s), organized.timeZoneId ? finalizeZonedDateTime(organized, resolveCalendar, undefined) : (organized.C && throwFailedParse(s), finalizeDate(organized, resolveCalendar));
  }
  function parseZonedDateTime(s, resolveCalendar, options) {
    const organized = parseDateTimeLike(requireString(s));
    return organized && organized.timeZoneId || throwFailedParse(s), finalizeZonedDateTime(organized, resolveCalendar, options);
  }
  function parsePlainDateTime(s, resolveCalendar) {
    const organized = parseDateTimeLike(requireString(s));
    return organized && !organized.C || throwFailedParse(s), finalizeDateTime(organized, resolveCalendar);
  }
  function parsePlainDate(s, resolveCalendar) {
    const slots = finalizeDateLike(parsePlainDateLike(requireString(s)), undefined, resolveCalendar);
    return createDateSlots(slots, slots.calendar);
  }
  function parsePlainYearMonth(s, resolveCalendar) {
    const organized = parseYearMonthOnly(requireString(s));
    if (organized) {
      return requireIsoCalendar(organized), createDateSlots(checkIsoYearMonthInBounds(validateIsoDateFields(organized)), resolveCalendar(organized.calendarId));
    }
    const dateSlots = finalizeDateLike(parsePlainDateLike(s), projectIsoYearMonthDate, resolveCalendar);
    const { calendar } = dateSlots;
    return createDateSlots(moveToStartOfMonth(calendar, dateSlots), calendar);
  }
  function requireIsoCalendar(organized) {
    organized.calendarId !== "iso8601" && throwRangeError(invalidSubstring(organized.calendarId));
  }
  function parsePlainMonthDay(s, resolveCalendar) {
    const organized = parseMonthDayOnly(requireString(s));
    if (organized) {
      return requireIsoCalendar(organized), createDateSlots(validateIsoDateFields(organized), resolveCalendar(organized.calendarId));
    }
    const dateSlots = finalizeDateLike(parsePlainDateLike(s), projectIsoMonthDayDate, resolveCalendar);
    const { calendar } = dateSlots;
    const { year: origYear, month: origMonth, day } = computeCalendarDateFields(calendar, dateSlots);
    const [monthCodeNumber, isLeapMonth] = computeCalendarMonthCodeParts(calendar, origYear, origMonth);
    const { year, month } = ((calendar, monthCodeNumber, isLeapMonth, day) => {
      const yearMonthFields = calendar ? calendar.u(monthCodeNumber, isLeapMonth, day) : computeIsoYearMonthFieldsForMonthDay(monthCodeNumber, isLeapMonth);
      return yearMonthFields || throwRangeError("Cannot guess year"), yearMonthFields;
    })(calendar, monthCodeNumber, isLeapMonth, day);
    return createDateSlots(checkIsoDateInBounds(computeCalendarIsoFieldsFromParts(calendar, year, month, day)), calendar);
  }
  function parsePlainTime(s) {
    let organized = ((s) => {
      const parts = parseTimeOnlyParts(s);
      return parts ? (organizeAnnotationParts(parts[13]), organizeTimeParts(parts, 1)) : undefined;
    })(s = requireString(s));
    if (!organized) {
      const dateTime = parseDateTimeLike(s);
      dateTime && dateTime.re || throwFailedParse(s), dateTime.C && throwRangeError(invalidSubstring("Z")), requireIsoCalendar(dateTime), organized = dateTime;
    }
    let altParsed;
    return (altParsed = parseYearMonthOnly(s)) && isIsoDateFieldsValid(altParsed) && throwFailedParse(s), (altParsed = parseMonthDayOnly(s)) && isIsoDateFieldsValid(altParsed) && throwFailedParse(s), createTimeSlots(validateTimeFields(organized));
  }
  function parseDuration(s) {
    const parts = durationRegExp.exec(requireString(s));
    return parts || throwFailedParse(s), createDurationSlots(validateDurationFields(((parts) => {
      let hasAny = 0;
      let hasAnyFrac = 0;
      let leftoverNano = 0;
      let durationFields = {
        years: parseUnit(parts[2]),
        months: parseUnit(parts[3]),
        weeks: parseUnit(parts[4]),
        days: parseUnit(parts[5]),
        hours: parseUnit(parts[6], parts[7], 5),
        minutes: parseUnit(parts[8], parts[9], 4),
        seconds: parseUnit(parts[10], parts[11], 3),
        ...nanoToGivenFields(leftoverNano, 2, durationFieldNamesAsc)
      };
      return hasAny || throwRangeError(noValidFields(durationFieldNamesAsc)), parseSign(parts[1]) < 0 && (durationFields = negateDurationFields(durationFields)), durationFields;
      function parseUnit(wholeStr, fracStr, timeUnit) {
        let leftoverUnits = 0;
        let wholeUnits = 0;
        return timeUnit && ([leftoverUnits, leftoverNano] = divModFloor(leftoverNano, unitNanoMap[timeUnit])), wholeStr !== undefined && (hasAnyFrac && throwRangeError(invalidSubstring(wholeStr)), wholeUnits = ((s) => {
          const n = parseInt(s);
          return Number.isFinite(n) || throwRangeError(invalidSubstring(s)), n;
        })(wholeStr), hasAny = 1, fracStr && (leftoverNano = parseSubsecNano(fracStr) * (unitNanoMap[timeUnit] / nanoInSec2), hasAnyFrac = 1)), leftoverUnits + wholeUnits;
      }
    })(parts)));
  }
  function parseCalendarId(s) {
    const res = parseDateTimeLike(s) || parseYearMonthOnly(s) || parseMonthDayOnly(s);
    if (res) {
      return res.calendarId;
    }
    const timeParts = parseTimeOnlyParts(s);
    return timeParts ? organizeAnnotationParts(timeParts[13]).calendarId : s;
  }
  function parseTimeZoneId(s) {
    const parsed = parseDateTimeLike(s);
    return parsed && (parsed.timeZoneId || parsed.C && "UTC" || parsed.offset) || s;
  }
  function parsePlainDateLike(s) {
    const organized = parseDateTimeLike(s);
    return organized && !organized.C || throwFailedParse(s), organized;
  }
  function finalizeDateLike(organized, isoDateProjector, resolveCalendar) {
    return isoDateProjector && organized.calendarId === "iso8601" ? (validateIsoDateFields(organized), organized.re && validateTimeFields(organized), finalizeDate(isoDateProjector(organized), resolveCalendar)) : organized.re ? finalizeDateTime(organized, resolveCalendar) : finalizeDate(organized, resolveCalendar);
  }
  function projectIsoYearMonthDate(organized) {
    const day = 12 * organized.year + organized.month === isoYearMonthIndexMin ? 20 : 1;
    return {
      ...organized,
      day
    };
  }
  function projectIsoMonthDayDate(organized) {
    return {
      ...organized,
      year: 1972
    };
  }
  function finalizeZonedDateTime(organized, resolveCalendar, options) {
    const timeZone = queryTimeZone(resolveTimeZoneId(organized.timeZoneId));
    let epochNano;
    if (validateIsoDateTimeFields(organized), organized.re) {
      const offsetNano = organized.offset ? parseOffsetNano(organized.offset) : undefined;
      const [, offsetDisambig, epochDisambig] = refineZonedFieldOptions(options);
      epochNano = getMatchingInstantFor(timeZone, organized, offsetNano, offsetDisambig, epochDisambig, !(timeZone.X || organized.offset === undefined || (offset = organized.offset, offset.replace(/\D/g, "").length > 4)), organized.C);
    } else {
      refineZonedFieldOptions(options), epochNano = getStartOfDayInstantFor(timeZone, organized);
    }
    var offset;
    return checkEpochNanoInBounds(epochNano), createZonedEpochNanoSlots(epochNano, timeZone, resolveCalendar(organized.calendarId));
  }
  function finalizeDateTime(organized, resolveCalendar) {
    return validateIsoDateTimeFields(organized), checkIsoDateTimeInBounds(organized), {
      ...combineDateAndTime(organized, organized),
      calendar: resolveCalendar(organized.calendarId)
    };
  }
  function finalizeDate(organized, resolveCalendar) {
    return validateIsoDateFields(organized), checkIsoDateInBounds(organized), {
      calendar: resolveCalendar(organized.calendarId),
      year: organized.year,
      month: organized.month,
      day: organized.day
    };
  }
  function timeRegExpStr(separatorIndex) {
    return `(\\d{2})(?:(:?)(\\d{2})(?:\\${separatorIndex}(\\d{2})(?:[.,](\\d{1,9}))?)?)?`;
  }
  var dateTimeRegExpStr = "(?:(?:([+-])(\\d{6}))|(\\d{4}))(-?)(\\d{2})\\4(\\d{2})(?:[T ]" + timeRegExpStr(8) + "(Z|([+-])" + timeRegExpStr(15) + ")?)?";
  var yearMonthRegExp = /* @__PURE__ */ createRegExp("(?:(?:([+-])(\\d{6}))|(\\d{4}))-?(\\d{2})((?:\\[(!?)([^\\]]*)\\]){0,9})");
  var monthDayRegExp = /* @__PURE__ */ createRegExp("(?:--)?(\\d{2})-?(\\d{2})((?:\\[(!?)([^\\]]*)\\]){0,9})");
  var dateTimeRegExp = /* @__PURE__ */ createRegExp(dateTimeRegExpStr + "((?:\\[(!?)([^\\]]*)\\]){0,9})");
  var timeRegExp = /* @__PURE__ */ createRegExp("T?" + timeRegExpStr(2) + `(([+-])${timeRegExpStr(9)})?((?:\\[(!?)([^\\]]*)\\]){0,9})`);
  var annotationRegExp = /* @__PURE__ */ new RegExp("\\[(!?)([^\\]]*)\\]", "g");
  var durationRegExp = /* @__PURE__ */ createRegExp("([+-])?P(\\d+Y)?(\\d+M)?(\\d+W)?(\\d+D)?(?:T(?!$)(?:(\\d+)(?:[.,](\\d{1,9}))?H)?(?:(\\d+)(?:[.,](\\d{1,9}))?M)?(?:(\\d+)(?:[.,](\\d{1,9}))?S)?)?");
  function parseDateTimeLike(s) {
    const parts = dateTimeRegExp.exec(s);
    return parts ? ((parts) => {
      const zOrOffset = parts[12];
      const hasZ = (zOrOffset || "").toUpperCase() === "Z";
      return {
        year: organizeIsoYearParts(parts),
        month: parseInt(parts[5]),
        day: parseInt(parts[6]),
        ...organizeTimeParts(parts, 7),
        ...organizeAnnotationParts(parts[19]),
        re: Boolean(parts[7]),
        C: hasZ,
        offset: hasZ ? undefined : zOrOffset
      };
    })(parts) : undefined;
  }
  function parseYearMonthOnly(s) {
    const parts = yearMonthRegExp.exec(s);
    if (parts) {
      return ((parts) => ({
        year: organizeIsoYearParts(parts),
        month: parseInt(parts[4]),
        day: 1,
        ...organizeAnnotationParts(parts[5])
      }))(parts);
    }
  }
  function parseMonthDayOnly(s) {
    const parts = monthDayRegExp.exec(s);
    return parts ? ((parts) => ({
      year: 1972,
      month: parseInt(parts[1]),
      day: parseInt(parts[2]),
      ...organizeAnnotationParts(parts[3])
    }))(parts) : undefined;
  }
  function parseTimeOnlyParts(s) {
    const parts = timeRegExp.exec(s);
    if (parts) {
      return parts[6] && parseOffsetNano(parts[6]), parts;
    }
  }
  function organizeTimeParts(parts, hourIndex) {
    const second = parseInt0(parts[hourIndex + 3]);
    return {
      ...nanoToTimeAndDay(parseSubsecNano(parts[hourIndex + 4] || ""))[0],
      hour: parseInt0(parts[hourIndex]),
      minute: parseInt0(parts[hourIndex + 2]),
      second: second === 60 ? 59 : second
    };
  }
  function organizeIsoYearParts(parts) {
    const yearSign = parseSign(parts[1]);
    const year = parseInt(parts[2] || parts[3]);
    return yearSign < 0 && !year && throwRangeError(invalidSubstring(-0)), yearSign * year;
  }
  function organizeAnnotationParts(s) {
    let calendarIsCritical;
    let timeZoneId;
    const calendarIds = [];
    return s.replace(annotationRegExp, (whole, criticalStr, mainStr) => {
      const isCritical = Boolean(criticalStr);
      const [val, name] = mainStr.split("=").reverse();
      return name ? name === "u-ca" ? (calendarIds.push(val.toLowerCase()), calendarIsCritical || (calendarIsCritical = isCritical)) : (isCritical || /[A-Z]/.test(name)) && throwRangeError(invalidSubstring(whole)) : (timeZoneId && throwRangeError(invalidSubstring(whole)), timeZoneId = val), "";
    }), calendarIds.length > 1 && calendarIsCritical && throwRangeError(invalidSubstring(s)), {
      timeZoneId,
      calendarId: calendarIds[0] || "iso8601"
    };
  }
  function mergeCalendarFields(calendar, baseFields, additionalFields) {
    const merged = Object.assign(Object.create(null), baseFields);
    return spliceFields(merged, additionalFields, monthFieldNames), getCalendarEraOrigins(calendar) && (spliceFields(merged, additionalFields, allYearFieldNames), calendar && calendar.ge && spliceFields(merged, additionalFields, monthDayFieldNames, eraYearFieldNames)), merged;
  }
  function spliceFields(dest, additional, allPropNames, deletablePropNames) {
    let anyMatching = 0;
    const nonMatchingPropNames = [];
    for (const propName of allPropNames) {
      additional[propName] !== undefined ? anyMatching = 1 : nonMatchingPropNames.push(propName);
    }
    if (Object.assign(dest, additional), anyMatching) {
      for (const deletablePropName of deletablePropNames || nonMatchingPropNames) {
        delete dest[deletablePropName];
      }
    }
  }
  function mergeZonedDateTimeFields(zonedDateTimeSlots, modFields, options) {
    const { calendar, timeZone } = zonedDateTimeSlots;
    const validFieldNames = getCalendarFieldNames(calendar, dateTimeAndOffsetFieldNamesAlpha, dateTimeAndOffsetFieldNamesWithEraAlpha);
    const zonedSlots = zonedEpochSlotsToIso(zonedDateTimeSlots);
    const { year, month, day } = computeCalendarDateFields(calendar, zonedSlots);
    const origFields = {
      year,
      monthCode: computeMonthCode(calendar, year, month),
      day,
      hour: zonedSlots.hour,
      minute: zonedSlots.minute,
      second: zonedSlots.second,
      millisecond: zonedSlots.millisecond,
      microsecond: zonedSlots.microsecond,
      nanosecond: zonedSlots.nanosecond,
      offset: zonedSlots.offsetNanoseconds
    };
    const partialFields = readAndRefineBagFields(modFields, validFieldNames, zonedDateTimeFieldRefiners);
    const mergedCalendarFields = mergeCalendarFields(calendar, origFields, partialFields);
    const mergedAllFields = {
      ...origFields,
      ...partialFields
    };
    const [isoDateFields, overflow, offsetDisambig, epochDisambig] = createPlainDateFromFieldsWithOptionsRefiner(calendar, mergedCalendarFields, () => refineZonedFieldOptions(options, 2));
    return createZonedEpochNanoSlots(getMatchingInstantFor(timeZone, combineDateAndTime(isoDateFields, constrainTimeFields(mergedAllFields, overflow)), mergedAllFields.offset, offsetDisambig, epochDisambig), timeZone, calendar);
  }
  function mergePlainDateTimeFields(plainDateTimeSlots, modFields, options) {
    const { calendar } = plainDateTimeSlots;
    const validFieldNames = getCalendarFieldNames(calendar, dateTimeFieldNamesAlpha, dateTimeFieldNamesWithEraAlpha);
    const { year, month, day } = computeCalendarDateFields(calendar, plainDateTimeSlots);
    const origFields = {
      year,
      monthCode: computeMonthCode(calendar, year, month),
      day,
      hour: plainDateTimeSlots.hour,
      minute: plainDateTimeSlots.minute,
      second: plainDateTimeSlots.second,
      millisecond: plainDateTimeSlots.millisecond,
      microsecond: plainDateTimeSlots.microsecond,
      nanosecond: plainDateTimeSlots.nanosecond
    };
    const partialFields = readAndRefineBagFields(modFields, validFieldNames, dateTimeFieldRefiners);
    const mergedCalendarFields = mergeCalendarFields(calendar, origFields, partialFields);
    const mergedAllFields = {
      ...origFields,
      ...partialFields
    };
    const [plainDateSlots, overflow] = createPlainDateFromFieldsWithOptionsRefiner(calendar, mergedCalendarFields, () => [refineOverflowOptions(options)]);
    return createPlainDateTimeFromRefinedFields(plainDateSlots, constrainTimeFields(mergedAllFields, overflow), calendar);
  }
  function mergePlainDateFields(plainDateSlots, modFields, options) {
    const { calendar } = plainDateSlots;
    const validFieldNames = getCalendarFieldNames(calendar, dateFieldNamesAlpha, dateFieldNamesWithEraAlpha);
    const { year, month, day } = computeCalendarDateFields(calendar, plainDateSlots);
    return createPlainDateFromFields(calendar, mergeCalendarFields(calendar, {
      year,
      monthCode: computeMonthCode(calendar, year, month),
      day
    }, readAndRefineBagFields(modFields, validFieldNames, dateFieldRefiners)), options);
  }
  function mergePlainYearMonthFields(plainYearMonthSlots, modFields, options) {
    const { calendar } = plainYearMonthSlots;
    const validFieldNames = getCalendarFieldNames(calendar, yearMonthFieldNamesAlpha, yearMonthFieldNamesWithEraAlpha);
    const { year, month } = computeCalendarDateFields(calendar, plainYearMonthSlots);
    return createPlainYearMonthFromFields(calendar, mergeCalendarFields(calendar, {
      year,
      monthCode: computeMonthCode(calendar, year, month)
    }, readAndRefineBagFields(modFields, validFieldNames, dateFieldRefiners)), options);
  }
  function mergePlainMonthDayFields(plainMonthDaySlots, modFields, options) {
    const { calendar } = plainMonthDaySlots;
    const validFieldNames = getCalendarFieldNames(calendar, dateFieldNamesAlpha, dateFieldNamesWithEraAlpha);
    const { year, month, day } = computeCalendarDateFields(calendar, plainMonthDaySlots);
    return createPlainMonthDayFromFields(calendar, mergeCalendarFields(calendar, {
      monthCode: computeMonthCode(calendar, year, month),
      day
    }, readAndRefineBagFields(modFields, validFieldNames, dateFieldRefiners)), options);
  }
  function mergePlainTimeFields(initialFields, mod, options) {
    return ((initialFields, modFields, options) => resolveTimeFields({
      ...pluckProps(timeFieldNamesAlpha, initialFields),
      ...readAndRefineBagFields(modFields, timeFieldNamesAlpha, timeFieldRefiners)
    }, refineOverflowOptions(options)))(initialFields, mod, options);
  }
  function mergeDurationFields(slots, fields) {
    return createDurationSlots((initialFields = slots, modFields = fields, validateDurationFields({
      ...initialFields,
      ...readAndRefineBagFields(modFields, durationFieldNamesAlpha, durationFieldRefiners)
    })));
    var initialFields, modFields;
  }
  function computeMonthCode(calendar, year, month) {
    const [monthCodeNumber, isLeapMonth] = computeCalendarMonthCodeParts(calendar, year, month);
    return formatMonthCode(monthCodeNumber, isLeapMonth);
  }
  function instantToZonedDateTime(instantSlots, timeZone, calendar) {
    return createZonedEpochNanoSlots(instantSlots.epochNanoseconds, timeZone, calendar);
  }
  function zonedDateTimeToInstant(zonedDateTimeSlots0) {
    return createEpochNanoSlots(zonedDateTimeSlots0.epochNanoseconds);
  }
  function zonedDateTimeToPlainDateTime(zonedDateTimeSlots0) {
    return createDateTimeSlots(zonedEpochSlotsToIso(zonedDateTimeSlots0), zonedDateTimeSlots0.calendar);
  }
  function zonedDateTimeToPlainDate(zonedDateTimeSlots0) {
    return createDateSlots(zonedEpochSlotsToIso(zonedDateTimeSlots0), zonedDateTimeSlots0.calendar);
  }
  function zonedDateTimeToPlainTime(zonedDateTimeSlots0) {
    return createTimeSlots(zonedEpochSlotsToIso(zonedDateTimeSlots0));
  }
  function plainDateTimeToZonedDateTime(plainDateTimeSlots, timeZone, options) {
    const epochNano = getSingleInstantFor(timeZone, plainDateTimeSlots, ((options) => coerceEpochDisambig(normalizeOptions(options)))(options));
    return createZonedEpochNanoSlots(checkEpochNanoInBounds(epochNano), timeZone, plainDateTimeSlots.calendar);
  }
  function plainDateToZonedDateTime(refineTimeZoneString, refinePlainTimeArg, plainDateSlots, options) {
    const timeZoneId = refineTimeZoneString(options.timeZone);
    const plainTimeArg = options.plainTime;
    const timeFields = plainTimeArg !== undefined ? refinePlainTimeArg(plainTimeArg) : undefined;
    const timeZone = queryTimeZone(timeZoneId);
    let epochNano;
    return epochNano = timeFields ? getSingleInstantFor(timeZone, combineDateAndTime(plainDateSlots, timeFields)) : getStartOfDayInstantFor(timeZone, combineDateAndTime(plainDateSlots, timeFieldDefaults)), createZonedEpochNanoSlots(epochNano, timeZone, plainDateSlots.calendar);
  }
  function convertPlainYearMonthToDate(calendar, input, bag) {
    return createPlainDateFromMergedFields(calendar, pluckProps(getCalendarFieldNames(calendar, yearMonthCodeFieldNamesAlpha, yearMonthCodeFieldNamesWithEraAlpha), input), readAndRefineBagFields(requireObjectLike(bag), dayFieldNamesAsc, dateFieldRefiners, []));
  }
  function convertPlainMonthDayToDate(calendar, input, bag) {
    const extraFieldNames = getCalendarFieldNames(calendar, yearFieldNamesAsc, yearFieldNamesWithEraAlpha);
    return createPlainDateFromMergedFields(calendar, pluckProps(monthCodeDayFieldNamesAlpha, input), readAndRefineBagFields(requireObjectLike(bag), extraFieldNames, dateFieldRefiners, []));
  }
  function convertToPlainMonthDay(calendar, input) {
    return createPlainMonthDayFromFields(calendar, readAndRefineBagFields(input, monthCodeDayFieldNamesAlpha, dateFieldRefiners));
  }
  function convertToPlainYearMonth(calendar, input, options) {
    return createPlainYearMonthFromFields(calendar, readAndRefineBagFields(input, getCalendarFieldNames(calendar, yearMonthCodeFieldNamesAlpha, yearMonthCodeFieldNamesWithEraAlpha), dateFieldRefiners), options);
  }
  function createPlainDateFromMergedFields(calendar, inputFields, extraFields) {
    const mergedFieldNames = getCalendarFieldNames(calendar, yearMonthCodeDayFieldNamesAlpha, yearMonthCodeDayFieldNamesWithEraAlpha);
    let mergedFields = mergeCalendarFields(calendar, inputFields, extraFields);
    return mergedFields = readAndRefineBagFields(mergedFields, mergedFieldNames, dateFieldRefiners, []), createPlainDateFromFields(calendar, mergedFields);
  }
  function epochMilliToInstant(epochMilli) {
    return createEpochNanoSlots(checkEpochNanoInBounds(BigInt(toStrictInteger(epochMilli)) * bigNanoInMilli));
  }
  function epochNanoToInstant(epochNano) {
    return createEpochNanoSlots(checkEpochNanoInBounds(toBigInt(epochNano)));
  }
  function applyPlainFormatTimeZone(options) {
    return options.timeZone = "UTC", ["full", "long"].includes(options.timeStyle) && (options.timeStyle = "medium"), options;
  }
  function applyZonedFormatTimeZone(options, timeZoneId) {
    return options.timeZone !== undefined && throwTypeError("Cannot specify TimeZone"), options.timeZone = timeZoneId, options;
  }
  function checkResolvedCalendarCompatible(format, slots, strictCalendarCheck) {
    const resolvedCalendarId = format.resolvedOptions().calendar;
    !strictCalendarCheck && slots.calendar === isoCalendarImpl || getCalendarSlotId(slots.calendar) === resolvedCalendarId || throwRangeError("Mismatching Calendars");
  }
  function createOptionsTransformer(shapeFieldNames, invalidShapeFieldNames, ignoredFieldNames, defaultShapeFields, dateStyleReplacementFields) {
    const shapeFieldNameSet = new Set(shapeFieldNames);
    const invalidShapeFieldNameSet = new Set(invalidShapeFieldNames);
    const ignoredFieldNameSet = new Set(ignoredFieldNames);
    return (options, allowPartialOverlap) => {
      let dateStyle;
      let timeStyle;
      const granularShapeFields = {};
      const modifierFields = {};
      const otherFields = {};
      let hasInvalidGranularShapeFields = 0;
      let hasInvalidStyleFields = 0;
      for (const name of Object.keys(options)) {
        const value = options[name];
        value === undefined || ignoredFieldNameSet.has(name) || (shapeFieldNameSet.has(name) ? name === "dateStyle" ? dateStyle = value : name === "timeStyle" ? timeStyle = value : granularShapeFields[name] = value : name === "era" ? modifierFields[name] = value : invalidShapeFieldNameSet.has(name) ? name === "dateStyle" || name === "timeStyle" ? hasInvalidStyleFields = 1 : hasInvalidGranularShapeFields = 1 : otherFields[name] = value);
      }
      const hasDateStyle = dateStyle !== undefined;
      const hasTimeStyle = timeStyle !== undefined;
      const hasAnyStyle = hasDateStyle || hasTimeStyle;
      const hasGranularShapeFields = Object.keys(granularShapeFields).length > 0;
      const hasInvalids = hasInvalidGranularShapeFields || hasInvalidStyleFields;
      const hasShapeFields = hasGranularShapeFields || hasDateStyle || hasTimeStyle;
      const hasModifierFields = Object.keys(modifierFields).length > 0;
      (!allowPartialOverlap && hasInvalids || allowPartialOverlap && hasInvalids && !hasShapeFields || hasAnyStyle && (hasGranularShapeFields || hasModifierFields || hasInvalidGranularShapeFields)) && throwTypeError("Invalid formatting options");
      const transformedOptions = {};
      return hasAnyStyle || hasShapeFields || Object.assign(transformedOptions, defaultShapeFields), Object.assign(transformedOptions, granularShapeFields, modifierFields, otherFields), hasDateStyle && (dateStyleReplacementFields ? Object.assign(transformedOptions, dateStyleReplacementFields[dateStyle]) : transformedOptions.dateStyle = dateStyle), hasTimeStyle && (transformedOptions.timeStyle = timeStyle), transformedOptions;
    };
  }
  var dateDefaultShapeFields = {
    year: "numeric",
    month: "numeric",
    day: "numeric"
  };
  var timeDefaultShapeFields = {
    hour: "numeric",
    minute: "numeric",
    second: "numeric"
  };
  var dateTimeDefaultShapeFields = /* @__PURE__ */ Object.assign({}, dateDefaultShapeFields, timeDefaultShapeFields);
  var dateShapeFieldNames = ["weekday", "year", "month", "day", "dateStyle"];
  var timeShapeFieldNames = ["dayPeriod", "hour", "minute", "second", "fractionalSecondDigits", "timeStyle"];
  var dateTimeShapeFieldNames = /* @__PURE__ */ dateShapeFieldNames.concat(timeShapeFieldNames);
  var yearMonthIgnoredFieldNames = /* @__PURE__ */ ["weekday", "day"].concat(timeShapeFieldNames);
  var monthDayIgnoredFieldNames = /* @__PURE__ */ ["weekday", "year"].concat(timeShapeFieldNames);
  var transformInstantOptions = /* @__PURE__ */ createOptionsTransformer(dateTimeShapeFieldNames, [], [], dateTimeDefaultShapeFields);
  var transformZonedOptions = /* @__PURE__ */ createOptionsTransformer(dateTimeShapeFieldNames, [], [], {
    ...dateTimeDefaultShapeFields,
    timeZoneName: "short"
  });
  var transformDateTimeOptions = /* @__PURE__ */ createOptionsTransformer(dateTimeShapeFieldNames, [], ["timeZoneName"], dateTimeDefaultShapeFields);
  var transformDateOptions = /* @__PURE__ */ createOptionsTransformer(dateShapeFieldNames, timeShapeFieldNames, ["timeZoneName"], dateDefaultShapeFields);
  var transformTimeOptions = /* @__PURE__ */ createOptionsTransformer(timeShapeFieldNames, dateShapeFieldNames, ["timeZoneName", "era"], timeDefaultShapeFields);
  var transformYearMonthOptions = /* @__PURE__ */ createOptionsTransformer(["year", "month", "dateStyle"], yearMonthIgnoredFieldNames, ["timeZoneName"], {
    year: "numeric",
    month: "numeric"
  }, {
    full: {
      year: "numeric",
      month: "long"
    },
    long: {
      year: "numeric",
      month: "long"
    },
    medium: {
      year: "numeric",
      month: "short"
    },
    short: {
      year: "2-digit",
      month: "numeric"
    }
  });
  var transformMonthDayOptions = /* @__PURE__ */ createOptionsTransformer(["month", "day", "dateStyle"], monthDayIgnoredFieldNames, ["timeZoneName", "era"], {
    month: "numeric",
    day: "numeric"
  }, {
    full: {
      month: "long",
      day: "numeric"
    },
    long: {
      month: "long",
      day: "numeric"
    },
    medium: {
      month: "short",
      day: "numeric"
    },
    short: {
      month: "numeric",
      day: "numeric"
    }
  });
  function zonedDateTimeWithPlainTime(zonedDateTimeSlots, plainTimeFields) {
    const { timeZone } = zonedDateTimeSlots;
    const isoDateTime = zonedEpochSlotsToIso(zonedDateTimeSlots);
    const { offsetNanoseconds } = isoDateTime;
    const time = plainTimeFields || timeFieldDefaults;
    let epochNano;
    return epochNano = plainTimeFields ? getMatchingInstantFor(timeZone, combineDateAndTime(isoDateTime, time), offsetNanoseconds, 2) : getStartOfDayInstantFor(timeZone, combineDateAndTime(isoDateTime, time)), createZonedEpochNanoSlots(epochNano, timeZone, zonedDateTimeSlots.calendar);
  }
  function getCurrentIsoDateTime(timeZone) {
    const epochNano = getCurrentEpochNano();
    const offsetNano = timeZone.B(epochNano);
    return epochNanoToIsoDateTime(epochNano + BigInt(offsetNano));
  }
  function getCurrentEpochNano() {
    return BigInt(Date.now()) * bigNanoInMilli;
  }
  function getCurrentTimeZoneId() {
    return new RawDateTimeFormat().resolvedOptions().timeZone;
  }

  // node_modules/temporal-polyfill/chunks/apiHelpers.js
  var PlainYearMonthBranding = "PlainYearMonth";
  var PlainMonthDayBranding = "PlainMonthDay";
  var PlainDateBranding = "PlainDate";
  var PlainDateTimeBranding = "PlainDateTime";
  var PlainTimeBranding = "PlainTime";
  var ZonedDateTimeBranding = "ZonedDateTime";
  var InstantBranding = "Instant";
  var DurationBranding = "Duration";
  function defineTemporalClass(branding, cls, getSlots, ...getterMaps) {
    return Object.defineProperties(cls, createNameDescriptors(branding)), Object.defineProperties(cls.prototype, createStringTagDescriptors("Temporal." + branding)), Object.defineProperties(cls.prototype, mapProps((getter) => ({
      get() {
        return getter(getSlots(this));
      },
      configurable: 1
    }), Object.assign({}, ...getterMaps))), cls;
  }
  var attachDebugString = noop.name === "noop" ? (instance) => {
    Object.defineProperty(instance, "_str_", {
      value: instance.toJSON()
    });
  } : noop;
  function invalidRecordType() {
    throwTypeError(invalidCallingContext);
  }
  function forbiddenValueOf2() {
    throwTypeError(forbiddenValueOf);
  }
  var yearMonthFieldGetters$1 = {
    era(slots) {
      return computeCalendarEraFields(slots.calendar, slots).era;
    },
    eraYear(slots) {
      return computeCalendarEraFields(slots.calendar, slots).eraYear;
    },
    year(slots) {
      return computeCalendarDateFields(slots.calendar, slots).year;
    },
    month(slots) {
      return computeCalendarDateFields(slots.calendar, slots).month;
    },
    monthCode(slots) {
      return computeCalendarMonthCode(slots.calendar, slots);
    }
  };
  var dateFieldGetters$1 = {
    era(slots) {
      return computeCalendarEraFields(slots.calendar, slots).era;
    },
    eraYear(slots) {
      return computeCalendarEraFields(slots.calendar, slots).eraYear;
    },
    year(slots) {
      return computeCalendarDateFields(slots.calendar, slots).year;
    },
    month(slots) {
      return computeCalendarDateFields(slots.calendar, slots).month;
    },
    monthCode(slots) {
      return computeCalendarMonthCode(slots.calendar, slots);
    },
    day(slots) {
      return computeCalendarDateFields(slots.calendar, slots).day;
    }
  };
  var monthDayFieldGetters$1 = {
    monthCode(slots) {
      return computeCalendarMonthCode(slots.calendar, slots);
    },
    day(slots) {
      return computeCalendarDateFields(slots.calendar, slots).day;
    }
  };
  var yearMonthDerivedGetters = {
    daysInMonth(slots) {
      return computeCalendarDaysInMonth(slots.calendar, slots);
    },
    daysInYear(slots) {
      return computeCalendarDaysInYear(slots.calendar, slots);
    },
    monthsInYear(slots) {
      return computeCalendarMonthsInYear(slots.calendar, slots);
    },
    inLeapYear(slots) {
      return computeCalendarInLeapYear(slots.calendar, slots);
    }
  };
  var dateDerivedGetters = {
    dayOfWeek(slots) {
      return computeIsoDayOfWeek(slots);
    },
    dayOfYear(slots) {
      return computeCalendarDayOfYear(slots.calendar, slots);
    },
    weekOfYear(slots) {
      return computeCalendarWeekOfYear(slots.calendar, slots);
    },
    yearOfWeek(slots) {
      return computeCalendarYearOfWeek(slots.calendar, slots);
    },
    daysInWeek() {
      return 7;
    },
    daysInMonth(slots) {
      return computeCalendarDaysInMonth(slots.calendar, slots);
    },
    daysInYear(slots) {
      return computeCalendarDaysInYear(slots.calendar, slots);
    },
    monthsInYear(slots) {
      return computeCalendarMonthsInYear(slots.calendar, slots);
    },
    inLeapYear(slots) {
      return computeCalendarInLeapYear(slots.calendar, slots);
    }
  };
  function createNativeGetters(shimGetters) {
    return createPropGetters(Object.keys(shimGetters));
  }
  createNativeGetters(yearMonthDerivedGetters), createNativeGetters(dateDerivedGetters);

  // node_modules/temporal-polyfill/chunks/classApi-basic.js
  function resolveBasicCalendarId(rawCalendarId) {
    const lowerRawCalendarId = requireString(rawCalendarId).toLowerCase();
    return lowerRawCalendarId === isoCalendarId ? isoCalendarImpl : lowerRawCalendarId === gregoryCalendarId ? gregoryCalendarImpl : void throwRangeError(exoticCalendarRequired(rawCalendarId, "temporal-polyfill/full"));
  }
  function resolveBasicCalendarArg(rawCalendarId = isoCalendarId) {
    return resolveBasicCalendarId(rawCalendarId);
  }
  var zonedDateTimeSlotsMap = /* @__PURE__ */ new WeakMap;
  var ZonedDateTime = /* @__PURE__ */ defineTemporalClass(ZonedDateTimeBranding, class {
    constructor(epochNanoseconds, timeZoneId, calendar = undefined) {
      const epochNano = checkEpochNanoInBounds(toBigInt(epochNanoseconds));
      const timeZone = queryTimeZone(refineTimeZoneId(timeZoneId));
      const calendarImpl = resolveBasicCalendarArg(calendar);
      initZonedDateTime(this, createZonedEpochNanoSlots(epochNano, timeZone, calendarImpl));
    }
    static from(arg, options = undefined) {
      return createZonedDateTime(toZonedDateTimeSlots(arg, options));
    }
    static compare(arg0, arg1) {
      return compareZonedEpochSlots(toZonedDateTimeSlots(arg0), toZonedDateTimeSlots(arg1));
    }
    get calendarId() {
      return getCalendarSlotId(getZonedDateTimeSlots(this).calendar);
    }
    get timeZoneId() {
      return getZonedDateTimeSlots(this).timeZone.id;
    }
    get epochMilliseconds() {
      return getEpochMilli(getZonedDateTimeSlots(this));
    }
    get epochNanoseconds() {
      return getEpochNano(getZonedDateTimeSlots(this));
    }
    get offset() {
      return formatOffsetNano(zonedEpochSlotsToIso(getZonedDateTimeSlots(this)).offsetNanoseconds);
    }
    get offsetNanoseconds() {
      return zonedEpochSlotsToIso(getZonedDateTimeSlots(this)).offsetNanoseconds;
    }
    get hoursInDay() {
      return computeZonedHoursInDay(getZonedDateTimeSlots(this));
    }
    with(mod, options = undefined) {
      return createZonedDateTime(mergeZonedDateTimeFields(getZonedDateTimeSlots(this), validateBag(mod), options));
    }
    withCalendar(calendarArg) {
      return createZonedDateTime({
        ...getZonedDateTimeSlots(this),
        calendar: refineCalendarArg(calendarArg)
      });
    }
    withTimeZone(timeZoneArg) {
      return createZonedDateTime({
        ...getZonedDateTimeSlots(this),
        timeZone: queryTimeZone(refineTimeZoneArg(timeZoneArg))
      });
    }
    withPlainTime(plainTimeArg = undefined) {
      return createZonedDateTime(zonedDateTimeWithPlainTime(getZonedDateTimeSlots(this), optionalToPlainTimeFields(plainTimeArg)));
    }
    add(durationArg, options = undefined) {
      const slots = getZonedDateTimeSlots(this);
      return createZonedDateTime(moveZonedEpochSlots(slots, toDurationSlots(durationArg), options));
    }
    subtract(durationArg, options = undefined) {
      const slots = getZonedDateTimeSlots(this);
      return createZonedDateTime(moveZonedEpochSlots(slots, negateDurationFields(toDurationSlots(durationArg)), options));
    }
    until(otherArg, options = undefined) {
      const slots = getZonedDateTimeSlots(this);
      const other = toZonedDateTimeSlots(otherArg);
      const calendar = getCommonCalendar(slots.calendar, other.calendar);
      return createDuration(createDurationSlots(diffZonedDateTimes(0, calendar, slots, other, options)));
    }
    since(otherArg, options = undefined) {
      const slots = getZonedDateTimeSlots(this);
      const other = toZonedDateTimeSlots(otherArg);
      const calendar = getCommonCalendar(slots.calendar, other.calendar);
      return createDuration(createDurationSlots(diffZonedDateTimes(1, calendar, slots, other, options)));
    }
    round(options) {
      const slots = getZonedDateTimeSlots(this);
      const [smallestUnit, roundingInc, roundingMode] = refineRoundingOptions(options);
      return createZonedDateTime(roundZonedEpochSlotsToUnit(slots, smallestUnit, roundingInc, roundingMode));
    }
    startOfDay() {
      return createZonedDateTime(computeZonedStartOfDay(getZonedDateTimeSlots(this)));
    }
    equals(otherArg) {
      return zonedDateTimesEqual(getZonedDateTimeSlots(this), toZonedDateTimeSlots(otherArg));
    }
    toInstant() {
      return createInstant(zonedDateTimeToInstant(getZonedDateTimeSlots(this)));
    }
    toPlainDateTime() {
      return createPlainDateTime(zonedDateTimeToPlainDateTime(getZonedDateTimeSlots(this)));
    }
    toPlainDate() {
      return createPlainDate(zonedDateTimeToPlainDate(getZonedDateTimeSlots(this)));
    }
    toPlainTime() {
      return createPlainTime(zonedDateTimeToPlainTime(getZonedDateTimeSlots(this)));
    }
    toLocaleString(locales = undefined, options = {}) {
      const slots = getZonedDateTimeSlots(this);
      const format = new RawDateTimeFormat(locales, applyZonedFormatTimeZone(transformZonedOptions(options), getZonedTimeZoneId(slots)));
      return checkResolvedCalendarCompatible(format, slots), format.format(getEpochMilli(slots));
    }
    toString(options = undefined) {
      return formatZonedDateTimeIso(getZonedDateTimeSlots(this), options);
    }
    toJSON() {
      return formatZonedDateTimeIso(getZonedDateTimeSlots(this));
    }
    getTimeZoneTransition(options) {
      const slots = getZonedDateTimeSlots(this);
      const newEpochNano = getTimeZoneTransitionEpochNanoseconds(slots, options);
      return newEpochNano ? createZonedDateTime({
        ...slots,
        epochNanoseconds: newEpochNano
      }) : null;
    }
    valueOf() {
      return forbiddenValueOf2();
    }
  }, getZonedDateTimeIsoSlots, dateFieldGetters$1, dateDerivedGetters, timeGetters);
  function createZonedDateTime(slots) {
    return initZonedDateTime(Object.create(ZonedDateTime.prototype), slots);
  }
  function getZonedDateTimeSlots(obj) {
    return getZonedDateTimeSlotsIfPresent(obj) || invalidRecordType();
  }
  function getZonedDateTimeIsoSlots(obj) {
    const slots = getZonedDateTimeSlots(obj);
    return {
      ...zonedEpochSlotsToIso(slots),
      calendar: slots.calendar
    };
  }
  function getZonedDateTimeSlotsIfPresent(obj) {
    return zonedDateTimeSlotsMap.get(obj);
  }
  function toZonedDateTimeSlots(arg, options) {
    if (isObjectLike2(arg)) {
      const ownSlots = getZonedDateTimeSlotsIfPresent(arg);
      if (ownSlots) {
        return refineZonedFieldOptions(options), ownSlots;
      }
      const calendar = getCalendarFromBag(arg);
      return refineZonedDateTimeObjectLike(refineTimeZoneArg, calendar, arg, options);
    }
    return parseZonedDateTime(arg, resolveBasicCalendarId, options);
  }
  function initZonedDateTime(instance, slots) {
    return zonedDateTimeSlotsMap.set(instance, slots), attachDebugString(instance), instance;
  }
  function refineTimeZoneArg(arg) {
    if (isObjectLike2(arg)) {
      const slots = getZonedDateTimeSlotsIfPresent(arg);
      return slots || throwTypeError(invalidTimeZone(arg)), slots.timeZone.id;
    }
    return ((arg) => resolveTimeZoneId(parseTimeZoneId(requireString(arg))))(arg);
  }
  var instantSlotsMap = /* @__PURE__ */ new WeakMap;
  var Instant = /* @__PURE__ */ defineTemporalClass(InstantBranding, class {
    constructor(epochNanoseconds) {
      const epochNano = checkEpochNanoInBounds(toBigInt(epochNanoseconds));
      initInstant(this, createEpochNanoSlots(epochNano));
    }
    static from(arg) {
      return createInstant(toInstantSlots(arg));
    }
    static fromEpochMilliseconds(epochMilli) {
      return createInstant(epochMilliToInstant(epochMilli));
    }
    static fromEpochNanoseconds(epochNano) {
      return createInstant(epochNanoToInstant(epochNano));
    }
    static compare(a, b) {
      return compareZonedEpochSlots(toInstantSlots(a), toInstantSlots(b));
    }
    get epochMilliseconds() {
      return getEpochMilli(getInstantSlots(this));
    }
    get epochNanoseconds() {
      return getEpochNano(getInstantSlots(this));
    }
    add(durationArg) {
      const slots = getInstantSlots(this);
      return createInstant(createEpochNanoSlots(moveEpochNano(slots.epochNanoseconds, toDurationSlots(durationArg))));
    }
    subtract(durationArg) {
      const slots = getInstantSlots(this);
      return createInstant(createEpochNanoSlots(moveEpochNano(slots.epochNanoseconds, negateDurationFields(toDurationSlots(durationArg)))));
    }
    until(otherArg, options = undefined) {
      return createDuration(diffInstants(0, getInstantSlots(this), toInstantSlots(otherArg), options));
    }
    since(otherArg, options = undefined) {
      return createDuration(diffInstants(1, getInstantSlots(this), toInstantSlots(otherArg), options));
    }
    round(options) {
      const slots = getInstantSlots(this);
      const [smallestUnit, roundingInc, roundingMode] = refineRoundingOptions(options, 5, 1);
      return createInstant(createEpochNanoSlots(roundBigNanoToDayOriginInc(slots.epochNanoseconds, computeBigNanoInc(smallestUnit, roundingInc), roundingMode)));
    }
    equals(otherArg) {
      return instantsEqual(getInstantSlots(this), toInstantSlots(otherArg));
    }
    toZonedDateTimeISO(timeZoneArg) {
      return createZonedDateTime(instantToZonedDateTime(getInstantSlots(this), queryTimeZone(refineTimeZoneArg(timeZoneArg))));
    }
    toLocaleString(locales = undefined, options = {}) {
      const slots = getInstantSlots(this);
      return new RawDateTimeFormat(locales, transformInstantOptions(options)).format(getEpochMilli(slots));
    }
    toString(options = undefined) {
      return formatInstantIso(refineTimeZoneArg, getInstantSlots(this), options);
    }
    toJSON() {
      return formatInstantIso(refineTimeZoneArg, getInstantSlots(this));
    }
    valueOf() {
      return forbiddenValueOf2();
    }
  });
  function createInstant(slots) {
    return initInstant(Object.create(Instant.prototype), slots);
  }
  function getInstantSlots(obj) {
    return getInstantSlotsIfPresent(obj) || invalidRecordType();
  }
  function getInstantSlotsIfPresent(obj) {
    return instantSlotsMap.get(obj);
  }
  function toInstantSlots(arg) {
    if (isObjectLike2(arg)) {
      const ownSlots = getInstantSlotsIfPresent(arg);
      if (ownSlots) {
        return ownSlots;
      }
      const zonedDateTimeSlots = getZonedDateTimeSlotsIfPresent(arg);
      if (zonedDateTimeSlots) {
        return createEpochNanoSlots(zonedDateTimeSlots.epochNanoseconds);
      }
    }
    return parseInstant(arg);
  }
  var { toTemporalInstant } = {
    toTemporalInstant() {
      const epochMilli = Date.prototype.valueOf.call(this);
      return createInstant(createEpochNanoSlots(BigInt(requireNumberIsInteger(epochMilli)) * bigNanoInMilli));
    }
  };
  function initInstant(instance, slots) {
    return instantSlotsMap.set(instance, slots), attachDebugString(instance), instance;
  }
  var plainMonthDaySlotsMap = /* @__PURE__ */ new WeakMap;
  var PlainMonthDay = /* @__PURE__ */ defineTemporalClass(PlainMonthDayBranding, class {
    constructor(isoMonth, isoDay, calendar = undefined, referenceIsoYear) {
      const isoMonthInt = toIntegerWithTrunc(isoMonth);
      const isoDayInt = toIntegerWithTrunc(isoDay);
      const calendarImpl = resolveBasicCalendarArg(calendar);
      const isoYearInt = toIntegerWithTrunc(referenceIsoYear ?? isoEpochFirstLeapYear);
      const fields = checkIsoDateInBounds(validateIsoDateFields({
        year: isoYearInt,
        month: isoMonthInt,
        day: isoDayInt
      }));
      initPlainMonthDay(this, createDateSlots(fields, calendarImpl));
    }
    static from(arg, options = undefined) {
      return createPlainMonthDay(toPlainMonthDaySlots(arg, options));
    }
    get calendarId() {
      return getCalendarSlotId(getPlainMonthDaySlots(this).calendar);
    }
    with(mod, options = undefined) {
      return createPlainMonthDay(mergePlainMonthDayFields(getPlainMonthDaySlots(this), validateBag(mod), options));
    }
    equals(otherArg) {
      return plainMonthDaysEqual(getPlainMonthDaySlots(this), toPlainMonthDaySlots(otherArg));
    }
    toPlainDate(bag) {
      const slots = getPlainMonthDaySlots(this);
      return createPlainDate(convertPlainMonthDayToDate(slots.calendar, this, bag));
    }
    toLocaleString(locales = undefined, options = {}) {
      const slots = getPlainMonthDaySlots(this);
      const format = new RawDateTimeFormat(locales, applyPlainFormatTimeZone(transformMonthDayOptions(options)));
      return checkResolvedCalendarCompatible(format, slots, 1), format.format(isoDateToEpochMilli(slots));
    }
    toString(options = undefined) {
      return formatPlainMonthDayIso(getPlainMonthDaySlots(this), options);
    }
    toJSON() {
      return formatPlainMonthDayIso(getPlainMonthDaySlots(this));
    }
    valueOf() {
      return forbiddenValueOf2();
    }
  }, getPlainMonthDaySlots, monthDayFieldGetters$1);
  function createPlainMonthDay(slots) {
    return initPlainMonthDay(Object.create(PlainMonthDay.prototype), slots);
  }
  function getPlainMonthDaySlots(obj) {
    return getPlainMonthDaySlotsIfPresent(obj) || invalidRecordType();
  }
  function getPlainMonthDaySlotsIfPresent(obj) {
    return plainMonthDaySlotsMap.get(obj);
  }
  function toPlainMonthDaySlots(arg, options) {
    if (isObjectLike2(arg)) {
      const ownSlots = getPlainMonthDaySlotsIfPresent(arg);
      if (ownSlots) {
        return refineOverflowOptions(options), ownSlots;
      }
      const calendarMaybe = extractCalendarFromBag(arg);
      return refinePlainMonthDayObjectLike(calendarMaybe === undefined ? isoCalendarImpl : calendarMaybe, calendarMaybe === undefined, arg, options);
    }
    const res = parsePlainMonthDay(arg, resolveBasicCalendarId);
    return refineOverflowOptions(options), res;
  }
  function initPlainMonthDay(instance, slots) {
    return plainMonthDaySlotsMap.set(instance, slots), attachDebugString(instance), instance;
  }
  var plainYearMonthSlotsMap = /* @__PURE__ */ new WeakMap;
  var PlainYearMonth = /* @__PURE__ */ defineTemporalClass(PlainYearMonthBranding, class {
    constructor(isoYear, isoMonth, calendar = undefined, referenceIsoDay) {
      const isoYearInt = toIntegerWithTrunc(isoYear);
      const isoMonthInt = toIntegerWithTrunc(isoMonth);
      const calendarImpl = resolveBasicCalendarArg(calendar);
      const isoDayInt = toIntegerWithTrunc(referenceIsoDay ?? 1);
      const fields = checkIsoYearMonthInBounds(validateIsoDateFields({
        year: isoYearInt,
        month: isoMonthInt,
        day: isoDayInt
      }));
      initPlainYearMonth(this, createDateSlots(fields, calendarImpl));
    }
    static from(arg, options = undefined) {
      return createPlainYearMonth(toPlainYearMonthSlots(arg, options));
    }
    static compare(arg0, arg1) {
      return compareIsoDateFields(toPlainYearMonthSlots(arg0), toPlainYearMonthSlots(arg1));
    }
    get calendarId() {
      return getCalendarSlotId(getPlainYearMonthSlots(this).calendar);
    }
    with(mod, options = undefined) {
      return createPlainYearMonth(mergePlainYearMonthFields(getPlainYearMonthSlots(this), validateBag(mod), options));
    }
    add(durationArg, options = undefined) {
      const slots = getPlainYearMonthSlots(this);
      return createPlainYearMonth(createDateSlots(moveYearMonth(0, slots.calendar, slots, toDurationSlots(durationArg), options), slots.calendar));
    }
    subtract(durationArg, options = undefined) {
      const slots = getPlainYearMonthSlots(this);
      return createPlainYearMonth(createDateSlots(moveYearMonth(1, slots.calendar, slots, toDurationSlots(durationArg), options), slots.calendar));
    }
    until(otherArg, options = undefined) {
      const slots = getPlainYearMonthSlots(this);
      const other = toPlainYearMonthSlots(otherArg);
      const calendar = getCommonCalendar(slots.calendar, other.calendar);
      return createDuration(diffPlainYearMonth(0, calendar, slots, other, options));
    }
    since(otherArg, options = undefined) {
      const slots = getPlainYearMonthSlots(this);
      const other = toPlainYearMonthSlots(otherArg);
      const calendar = getCommonCalendar(slots.calendar, other.calendar);
      return createDuration(diffPlainYearMonth(1, calendar, slots, other, options));
    }
    equals(otherArg) {
      return plainYearMonthsEqual(getPlainYearMonthSlots(this), toPlainYearMonthSlots(otherArg));
    }
    toPlainDate(bag) {
      const slots = getPlainYearMonthSlots(this);
      return createPlainDate(convertPlainYearMonthToDate(slots.calendar, this, bag));
    }
    toLocaleString(locales = undefined, options = {}) {
      const slots = getPlainYearMonthSlots(this);
      const format = new RawDateTimeFormat(locales, applyPlainFormatTimeZone(transformYearMonthOptions(options)));
      return checkResolvedCalendarCompatible(format, slots, 1), format.format(isoDateToEpochMilli(slots));
    }
    toString(options = undefined) {
      return formatPlainYearMonthIso(getPlainYearMonthSlots(this), options);
    }
    toJSON() {
      return formatPlainYearMonthIso(getPlainYearMonthSlots(this));
    }
    valueOf() {
      return forbiddenValueOf2();
    }
  }, getPlainYearMonthSlots, yearMonthFieldGetters$1, yearMonthDerivedGetters);
  function createPlainYearMonth(slots) {
    return initPlainYearMonth(Object.create(PlainYearMonth.prototype), slots);
  }
  function getPlainYearMonthSlots(obj) {
    return getPlainYearMonthSlotsIfPresent(obj) || invalidRecordType();
  }
  function getPlainYearMonthSlotsIfPresent(obj) {
    return plainYearMonthSlotsMap.get(obj);
  }
  function toPlainYearMonthSlots(arg, options) {
    if (isObjectLike2(arg)) {
      const ownSlots = getPlainYearMonthSlotsIfPresent(arg);
      if (ownSlots) {
        return refineOverflowOptions(options), ownSlots;
      }
      const calendar = getCalendarFromBag(arg);
      return refinePlainYearMonthObjectLike(calendar, arg, options);
    }
    const res = parsePlainYearMonth(arg, resolveBasicCalendarId);
    return refineOverflowOptions(options), res;
  }
  function initPlainYearMonth(instance, slots) {
    return plainYearMonthSlotsMap.set(instance, slots), attachDebugString(instance), instance;
  }
  function getTemporalBrandingAndSlots(obj) {
    if (!isObjectLike2(obj)) {
      return;
    }
    let slots = getInstantSlotsIfPresent(obj);
    return slots ? [InstantBranding, slots] : (slots = getZonedDateTimeSlotsIfPresent(obj), slots ? [ZonedDateTimeBranding, slots] : (slots = getPlainDateTimeSlotsIfPresent(obj), slots ? [PlainDateTimeBranding, slots] : (slots = getPlainDateSlotsIfPresent(obj), slots ? [PlainDateBranding, slots] : (slots = getPlainTimeSlotsIfPresent(obj), slots ? [PlainTimeBranding, slots] : (slots = getPlainYearMonthSlotsIfPresent(obj), slots ? [PlainYearMonthBranding, slots] : (slots = getPlainMonthDaySlotsIfPresent(obj), slots ? [PlainMonthDayBranding, slots] : (slots = getDurationSlotsIfPresent(obj), slots ? [DurationBranding, slots] : undefined)))))));
  }
  function validateBag(bag) {
    return (getTemporalBrandingAndSlots(bag) || bag.calendar !== undefined || bag.timeZone !== undefined) && throwTypeError(invalidBag), bag;
  }
  var plainTimeSlotsMap = /* @__PURE__ */ new WeakMap;
  var PlainTime = /* @__PURE__ */ defineTemporalClass(PlainTimeBranding, class {
    constructor(hour = 0, minute = 0, second = 0, millisecond = 0, microsecond = 0, nanosecond = 0) {
      const fields = validateTimeFields(mapProps(toIntegerWithTrunc, {
        hour,
        minute,
        second,
        millisecond,
        microsecond,
        nanosecond
      }));
      initPlainTime(this, createTimeSlots(fields));
    }
    static from(arg, options = undefined) {
      return createPlainTime(toPlainTimeSlots(arg, options));
    }
    static compare(arg0, arg1) {
      return compareTimeFields(toPlainTimeSlots(arg0), toPlainTimeSlots(arg1));
    }
    with(mod, options = undefined) {
      return createPlainTime(mergePlainTimeFields(getPlainTimeSlots(this), validateBag(mod), options));
    }
    add(durationArg) {
      const slots = getPlainTimeSlots(this);
      return createPlainTime(moveTime(slots, toDurationSlots(durationArg))[0]);
    }
    subtract(durationArg) {
      const slots = getPlainTimeSlots(this);
      return createPlainTime(moveTime(slots, negateDurationFields(toDurationSlots(durationArg)))[0]);
    }
    until(otherArg, options = undefined) {
      return createDuration(diffPlainTimes(0, getPlainTimeSlots(this), toPlainTimeSlots(otherArg), options));
    }
    since(otherArg, options = undefined) {
      return createDuration(diffPlainTimes(1, getPlainTimeSlots(this), toPlainTimeSlots(otherArg), options));
    }
    round(options) {
      const slots = getPlainTimeSlots(this);
      const [smallestUnit, roundingInc, roundingMode] = refineRoundingOptions(options, 5);
      return createPlainTime(roundTimeToNano(slots, computeNanoInc(smallestUnit, roundingInc), roundingMode)[0]);
    }
    equals(other) {
      return plainTimesEqual(getPlainTimeSlots(this), toPlainTimeSlots(other));
    }
    toLocaleString(locales = undefined, options = {}) {
      const slots = getPlainTimeSlots(this);
      return new RawDateTimeFormat(locales, applyPlainFormatTimeZone(transformTimeOptions(options))).format(timeFieldsToMilli(slots));
    }
    toString(options = undefined) {
      return formatPlainTimeIso(getPlainTimeSlots(this), options);
    }
    toJSON() {
      return formatPlainTimeIso(getPlainTimeSlots(this));
    }
    valueOf() {
      return forbiddenValueOf2();
    }
  }, getPlainTimeSlots, timeGetters);
  function createPlainTime(slots) {
    return initPlainTime(Object.create(PlainTime.prototype), slots);
  }
  function getPlainTimeSlots(obj) {
    return getPlainTimeSlotsIfPresent(obj) || invalidRecordType();
  }
  function getPlainTimeSlotsIfPresent(obj) {
    return plainTimeSlotsMap.get(obj);
  }
  function toPlainTimeSlots(arg, options) {
    if (isObjectLike2(arg)) {
      const ownSlots = getPlainTimeSlotsIfPresent(arg);
      if (ownSlots) {
        return refineOverflowOptions(options), ownSlots;
      }
      const dateTimeSlots = getPlainDateTimeSlotsIfPresent(arg);
      if (dateTimeSlots) {
        return refineOverflowOptions(options), createTimeSlots(dateTimeSlots);
      }
      const zonedDateTimeSlots = getZonedDateTimeSlotsIfPresent(arg);
      return zonedDateTimeSlots ? (refineOverflowOptions(options), zonedDateTimeToPlainTime(zonedDateTimeSlots)) : refinePlainTimeObjectLike(arg, options);
    }
    const timeSlots = parsePlainTime(arg);
    return refineOverflowOptions(options), timeSlots;
  }
  function optionalToPlainTimeFields(timeArg) {
    return timeArg === undefined ? undefined : toPlainTimeSlots(timeArg);
  }
  function initPlainTime(instance, slots) {
    return plainTimeSlotsMap.set(instance, slots), attachDebugString(instance), instance;
  }
  var plainDateTimeSlotsMap = /* @__PURE__ */ new WeakMap;
  var PlainDateTime = /* @__PURE__ */ defineTemporalClass(PlainDateTimeBranding, class {
    constructor(isoYear, isoMonth, isoDay, hour = 0, minute = 0, second = 0, millisecond = 0, microsecond = 0, nanosecond = 0, calendar = undefined) {
      const fields = checkIsoDateTimeInBounds(validateIsoDateTimeFields(mapProps(toIntegerWithTrunc, {
        year: isoYear,
        month: isoMonth,
        day: isoDay,
        hour,
        minute,
        second,
        millisecond,
        microsecond,
        nanosecond
      })));
      const calendarImpl = resolveBasicCalendarArg(calendar);
      initPlainDateTime(this, createDateTimeSlots(fields, calendarImpl));
    }
    static from(arg, options = undefined) {
      return createPlainDateTime(toPlainDateTimeSlots(arg, options));
    }
    static compare(arg0, arg1) {
      const slots0 = toPlainDateTimeSlots(arg0);
      const slots1 = toPlainDateTimeSlots(arg1);
      return compareIsoDateTimeFields(slots0, slots1);
    }
    get calendarId() {
      return getCalendarSlotId(getPlainDateTimeSlots(this).calendar);
    }
    with(mod, options = undefined) {
      return createPlainDateTime(mergePlainDateTimeFields(getPlainDateTimeSlots(this), validateBag(mod), options));
    }
    withCalendar(calendarArg) {
      const slots = getPlainDateTimeSlots(this);
      return createPlainDateTime(createDateTimeSlots(slots, refineCalendarArg(calendarArg)));
    }
    withPlainTime(plainTimeArg = undefined) {
      const slots = getPlainDateTimeSlots(this);
      return createPlainDateTime(createPlainDateTimeFromRefinedFields(slots, optionalToPlainTimeFields(plainTimeArg), slots.calendar));
    }
    add(durationArg, options = undefined) {
      const slots = getPlainDateTimeSlots(this);
      return createPlainDateTime(createDateTimeSlots(moveDateTime(slots.calendar, slots, toDurationSlots(durationArg), options), slots.calendar));
    }
    subtract(durationArg, options = undefined) {
      const slots = getPlainDateTimeSlots(this);
      return createPlainDateTime(createDateTimeSlots(moveDateTime(slots.calendar, slots, negateDurationFields(toDurationSlots(durationArg)), options), slots.calendar));
    }
    until(otherArg, options = undefined) {
      const slots = getPlainDateTimeSlots(this);
      const other = toPlainDateTimeSlots(otherArg);
      const calendar = getCommonCalendar(slots.calendar, other.calendar);
      return createDuration(diffPlainDateTimes(0, calendar, slots, other, options));
    }
    since(otherArg, options = undefined) {
      const slots = getPlainDateTimeSlots(this);
      const other = toPlainDateTimeSlots(otherArg);
      const calendar = getCommonCalendar(slots.calendar, other.calendar);
      return createDuration(diffPlainDateTimes(1, calendar, slots, other, options));
    }
    round(options) {
      const slots = getPlainDateTimeSlots(this);
      const [smallestUnit, roundingInc, roundingMode] = refineRoundingOptions(options);
      return createPlainDateTime(createDateTimeSlots(roundDateTimeToNano(slots, computeNanoInc(smallestUnit, roundingInc), roundingMode), slots.calendar));
    }
    equals(otherArg) {
      return plainDateTimesEqual(getPlainDateTimeSlots(this), toPlainDateTimeSlots(otherArg));
    }
    toZonedDateTime(timeZoneArg, options = undefined) {
      return createZonedDateTime(plainDateTimeToZonedDateTime(getPlainDateTimeSlots(this), queryTimeZone(refineTimeZoneArg(timeZoneArg)), options));
    }
    toPlainDate() {
      const slots = getPlainDateTimeSlots(this);
      return createPlainDate(createDateSlots(slots, slots.calendar));
    }
    toPlainTime() {
      return createPlainTime(createTimeSlots(getPlainDateTimeSlots(this)));
    }
    toLocaleString(locales = undefined, options = {}) {
      const slots = getPlainDateTimeSlots(this);
      const format = new RawDateTimeFormat(locales, applyPlainFormatTimeZone(transformDateTimeOptions(options)));
      return checkResolvedCalendarCompatible(format, slots), format.format(isoDateTimeToEpochMilli(slots));
    }
    toString(options = undefined) {
      return formatPlainDateTimeIso(getPlainDateTimeSlots(this), options);
    }
    toJSON() {
      return formatPlainDateTimeIso(getPlainDateTimeSlots(this));
    }
    valueOf() {
      return forbiddenValueOf2();
    }
  }, getPlainDateTimeSlots, dateFieldGetters$1, dateDerivedGetters, timeGetters);
  function createPlainDateTime(slots) {
    return initPlainDateTime(Object.create(PlainDateTime.prototype), slots);
  }
  function getPlainDateTimeSlots(obj) {
    return getPlainDateTimeSlotsIfPresent(obj) || invalidRecordType();
  }
  function getPlainDateTimeSlotsIfPresent(obj) {
    return plainDateTimeSlotsMap.get(obj);
  }
  function toPlainDateTimeSlots(arg, options) {
    if (isObjectLike2(arg)) {
      const ownSlots = getPlainDateTimeSlotsIfPresent(arg);
      if (ownSlots) {
        return refineOverflowOptions(options), ownSlots;
      }
      const dateSlots = getPlainDateSlotsIfPresent(arg);
      if (dateSlots) {
        return refineOverflowOptions(options), createDateTimeSlots(combineDateAndTime(dateSlots, timeFieldDefaults), dateSlots.calendar);
      }
      const zonedDateTimeSlots = getZonedDateTimeSlotsIfPresent(arg);
      if (zonedDateTimeSlots) {
        return refineOverflowOptions(options), zonedDateTimeToPlainDateTime(zonedDateTimeSlots);
      }
      const calendar = getCalendarFromBag(arg);
      return refinePlainDateTimeObjectLike(calendar, arg, options);
    }
    const res = parsePlainDateTime(arg, resolveBasicCalendarId);
    return refineOverflowOptions(options), res;
  }
  function initPlainDateTime(instance, slots) {
    return plainDateTimeSlotsMap.set(instance, slots), attachDebugString(instance), instance;
  }
  var plainDateSlotsMap = /* @__PURE__ */ new WeakMap;
  var PlainDate = /* @__PURE__ */ defineTemporalClass(PlainDateBranding, class {
    constructor(isoYear, isoMonth, isoDay, calendar = undefined) {
      const fields = checkIsoDateInBounds(validateIsoDateFields(mapProps(toIntegerWithTrunc, {
        year: isoYear,
        month: isoMonth,
        day: isoDay
      })));
      const calendarImpl = resolveBasicCalendarArg(calendar);
      initPlainDate(this, createDateSlots(fields, calendarImpl));
    }
    static from(arg, options = undefined) {
      return createPlainDate(toPlainDateSlots(arg, options));
    }
    static compare(arg0, arg1) {
      return compareIsoDateFields(toPlainDateSlots(arg0), toPlainDateSlots(arg1));
    }
    get calendarId() {
      return getCalendarSlotId(getPlainDateSlots(this).calendar);
    }
    with(mod, options = undefined) {
      const slots = getPlainDateSlots(this);
      return createPlainDate(mergePlainDateFields(slots, validateBag(mod), options));
    }
    withCalendar(calendarArg) {
      const slots = getPlainDateSlots(this);
      return createPlainDate(createDateSlots(slots, refineCalendarArg(calendarArg)));
    }
    add(durationArg, options = undefined) {
      const slots = getPlainDateSlots(this);
      return createPlainDate(createDateSlots(moveDate(slots.calendar, slots, toDurationSlots(durationArg), options), slots.calendar));
    }
    subtract(durationArg, options = undefined) {
      const slots = getPlainDateSlots(this);
      return createPlainDate(createDateSlots(moveDate(slots.calendar, slots, negateDurationFields(toDurationSlots(durationArg)), options), slots.calendar));
    }
    until(otherArg, options = undefined) {
      const slots = getPlainDateSlots(this);
      const other = toPlainDateSlots(otherArg);
      const calendar = getCommonCalendar(slots.calendar, other.calendar);
      return createDuration(diffPlainDates(0, calendar, slots, other, options));
    }
    since(otherArg, options = undefined) {
      const slots = getPlainDateSlots(this);
      const other = toPlainDateSlots(otherArg);
      const calendar = getCommonCalendar(slots.calendar, other.calendar);
      return createDuration(diffPlainDates(1, calendar, slots, other, options));
    }
    equals(otherArg) {
      return plainDatesEqual(getPlainDateSlots(this), toPlainDateSlots(otherArg));
    }
    toZonedDateTime(options) {
      const optionsObj = isObjectLike2(options) ? {
        timeZone: options.timeZone,
        plainTime: options.plainTime
      } : {
        timeZone: options
      };
      return createZonedDateTime(plainDateToZonedDateTime(refineTimeZoneArg, toPlainTimeSlots, getPlainDateSlots(this), optionsObj));
    }
    toPlainDateTime(plainTimeArg = undefined) {
      const slots = getPlainDateSlots(this);
      return createPlainDateTime(createPlainDateTimeFromRefinedFields(slots, optionalToPlainTimeFields(plainTimeArg), slots.calendar));
    }
    toPlainYearMonth() {
      const slots = getPlainDateSlots(this);
      return createPlainYearMonth(convertToPlainYearMonth(slots.calendar, this));
    }
    toPlainMonthDay() {
      const slots = getPlainDateSlots(this);
      return createPlainMonthDay(convertToPlainMonthDay(slots.calendar, this));
    }
    toLocaleString(locales = undefined, options = {}) {
      const slots = getPlainDateSlots(this);
      const format = new RawDateTimeFormat(locales, applyPlainFormatTimeZone(transformDateOptions(options)));
      return checkResolvedCalendarCompatible(format, slots), format.format(isoDateToEpochMilli(slots));
    }
    toString(options = undefined) {
      return formatPlainDateIso(getPlainDateSlots(this), options);
    }
    toJSON() {
      return formatPlainDateIso(getPlainDateSlots(this));
    }
    valueOf() {
      return forbiddenValueOf2();
    }
  }, getPlainDateSlots, dateFieldGetters$1, dateDerivedGetters);
  function createPlainDate(slots) {
    return initPlainDate(Object.create(PlainDate.prototype), slots);
  }
  function getPlainDateSlots(obj) {
    return getPlainDateSlotsIfPresent(obj) || invalidRecordType();
  }
  function getPlainDateSlotsIfPresent(obj) {
    return plainDateSlotsMap.get(obj);
  }
  function toPlainDateSlots(arg, options) {
    if (isObjectLike2(arg)) {
      const ownSlots = getPlainDateSlotsIfPresent(arg);
      if (ownSlots) {
        return refineOverflowOptions(options), ownSlots;
      }
      const dateTimeSlots = getPlainDateTimeSlotsIfPresent(arg);
      if (dateTimeSlots) {
        return refineOverflowOptions(options), createDateSlots(dateTimeSlots, dateTimeSlots.calendar);
      }
      const zonedDateTimeSlots = getZonedDateTimeSlotsIfPresent(arg);
      if (zonedDateTimeSlots) {
        return refineOverflowOptions(options), zonedDateTimeToPlainDate(zonedDateTimeSlots);
      }
      const calendar = getCalendarFromBag(arg);
      return refinePlainDateObjectLike(calendar, arg, options);
    }
    const res = parsePlainDate(arg, resolveBasicCalendarId);
    return refineOverflowOptions(options), res;
  }
  function initPlainDate(instance, slots) {
    return plainDateSlotsMap.set(instance, slots), attachDebugString(instance), instance;
  }
  function getCalendarFromBag(bag) {
    const calendar = extractCalendarFromBag(bag);
    return calendar === undefined ? isoCalendarImpl : calendar;
  }
  function extractCalendarFromBag(bag) {
    const { calendar: calendarArg } = bag;
    if (calendarArg !== undefined) {
      return refineCalendarArg(calendarArg);
    }
  }
  function refineCalendarArg(arg) {
    if (isObjectLike2(arg)) {
      const slots = getPlainDateSlotsIfPresent(arg) || getPlainDateTimeSlotsIfPresent(arg) || getZonedDateTimeSlotsIfPresent(arg) || getPlainMonthDaySlotsIfPresent(arg) || getPlainYearMonthSlotsIfPresent(arg);
      return slots || throwTypeError(invalidCalendar(arg)), slots.calendar;
    }
    return ((arg) => resolveBasicCalendarId(parseCalendarId(requireString(arg))))(arg);
  }
  var durationSlotsMap = /* @__PURE__ */ new WeakMap;
  var Duration = /* @__PURE__ */ defineTemporalClass(DurationBranding, class {
    constructor(years = 0, months = 0, weeks = 0, days = 0, hours = 0, minutes = 0, seconds = 0, milliseconds = 0, microseconds = 0, nanoseconds = 0) {
      const fields = validateDurationFields(mapProps(toStrictInteger, {
        years,
        months,
        weeks,
        days,
        hours,
        minutes,
        seconds,
        milliseconds,
        microseconds,
        nanoseconds
      }));
      initDuration(this, createDurationSlots(fields));
    }
    static from(arg) {
      return createDuration(toDurationSlots(arg));
    }
    static compare(durationArg0, durationArg1, options = undefined) {
      return compareDurations(refinePublicRelativeTo, toDurationSlots(durationArg0), toDurationSlots(durationArg1), options);
    }
    get sign() {
      return getDurationSlots(this).sign;
    }
    get blank() {
      return !getDurationSlots(this).sign;
    }
    with(mod) {
      return createDuration(mergeDurationFields(getDurationSlots(this), mod));
    }
    negated() {
      return createDuration(negateDuration(getDurationSlots(this)));
    }
    abs() {
      return createDuration(absDuration(getDurationSlots(this)));
    }
    add(otherArg, options = undefined) {
      return createDuration(addDurations(refinePublicRelativeTo, 0, getDurationSlots(this), toDurationSlots(otherArg), options));
    }
    subtract(otherArg, options = undefined) {
      return createDuration(addDurations(refinePublicRelativeTo, 1, getDurationSlots(this), toDurationSlots(otherArg), options));
    }
    round(roundTo) {
      return createDuration(roundDuration(refinePublicRelativeTo, getDurationSlots(this), roundTo));
    }
    total(totalOf) {
      return totalDuration(refinePublicRelativeTo, getDurationSlots(this), totalOf);
    }
    toLocaleString(locales = undefined, options) {
      const slots = getDurationSlots(this);
      return Intl.DurationFormat ? new Intl.DurationFormat(locales, options).format(slots) : formatDurationIso(slots, options);
    }
    toString(options = undefined) {
      return formatDurationIso(getDurationSlots(this), options);
    }
    toJSON() {
      return formatDurationIso(getDurationSlots(this));
    }
    valueOf() {
      return forbiddenValueOf2();
    }
  }, getDurationSlots, durationGetters);
  function createDuration(slots) {
    return initDuration(Object.create(Duration.prototype), slots);
  }
  function getDurationSlots(obj) {
    return getDurationSlotsIfPresent(obj) || invalidRecordType();
  }
  function getDurationSlotsIfPresent(obj) {
    return durationSlotsMap.get(obj);
  }
  function toDurationSlots(arg) {
    if (isObjectLike2(arg)) {
      return getDurationSlotsIfPresent(arg) || refineDurationObjectLike(arg);
    }
    return parseDuration(arg);
  }
  function refinePublicRelativeTo(relativeTo) {
    if (relativeTo !== undefined) {
      if (isObjectLike2(relativeTo)) {
        const zonedDateTimeSlots = getZonedDateTimeSlotsIfPresent(relativeTo);
        if (zonedDateTimeSlots) {
          return zonedDateTimeSlots;
        }
        const dateSlots = getPlainDateSlotsIfPresent(relativeTo);
        if (dateSlots) {
          return dateSlots;
        }
        const dateTimeSlots = getPlainDateTimeSlotsIfPresent(relativeTo);
        if (dateTimeSlots) {
          return createDateSlots(dateTimeSlots, dateTimeSlots.calendar);
        }
        const calendar = getCalendarFromBag(relativeTo);
        return refineMaybeZonedDateTimeObjectLike(refineTimeZoneArg, calendar, relativeTo);
      }
      return parseRelativeToSlots(relativeTo, resolveBasicCalendarId);
    }
  }
  function initDuration(instance, slots) {
    return durationSlotsMap.set(instance, slots), attachDebugString(instance), instance;
  }
  var Now = /* @__PURE__ */ Object.defineProperties({}, {
    ...createStringTagDescriptors("Temporal.Now"),
    ...createPropDescriptors({
      timeZoneId() {
        return getCurrentTimeZoneId();
      },
      instant() {
        return createInstant(createEpochNanoSlots(getCurrentEpochNano()));
      },
      zonedDateTimeISO(timeZoneArg = getCurrentTimeZoneId()) {
        const timeZone = queryTimeZone(refineTimeZoneArg(timeZoneArg));
        return createZonedDateTime(createZonedEpochNanoSlots(getCurrentEpochNano(), timeZone));
      },
      plainDateTimeISO(timeZoneArg = getCurrentTimeZoneId()) {
        const isoDateTime = getCurrentIsoDateTime(queryTimeZone(refineTimeZoneArg(timeZoneArg)));
        return createPlainDateTime(createDateTimeSlots(isoDateTime));
      },
      plainDateISO(timeZoneArg = getCurrentTimeZoneId()) {
        const isoDateTime = getCurrentIsoDateTime(queryTimeZone(refineTimeZoneArg(timeZoneArg)));
        return createPlainDate(createDateSlots(isoDateTime));
      },
      plainTimeISO(timeZoneArg = getCurrentTimeZoneId()) {
        const isoDateTime = getCurrentIsoDateTime(queryTimeZone(refineTimeZoneArg(timeZoneArg)));
        return createPlainTime(createTimeSlots(isoDateTime));
      }
    })
  });
  var Temporal = /* @__PURE__ */ Object.defineProperties({}, {
    ...createStringTagDescriptors("Temporal"),
    ...createPropDescriptors({
      PlainYearMonth,
      PlainMonthDay,
      PlainDate,
      PlainTime,
      PlainDateTime,
      ZonedDateTime,
      Instant,
      Duration,
      Now
    })
  });

  // node_modules/temporal-polyfill/index.js
  var Temporal2 = NativeTemporal || Temporal;
  var toTemporalInstant2 = NativeTemporal ? Date.prototype.toTemporalInstant : toTemporalInstant;

  // src/core/dates.js
  var VIEW_DAYS = {
    day: 1,
    threeDays: 3,
    week: 7,
    resourceDay: 1,
    resourceThreeDays: 3,
    list: 7
  };
  var WEEK_ANCHORED_VIEWS = new Set(["week"]);
  function isoWeekday(value) {
    const day = Number(value);
    if (!Number.isInteger(day) || day < 0 || day > 7)
      return null;
    return day === 0 ? 7 : day;
  }
  function resolveDateOptions(options = {}) {
    const explicit = isoWeekday(options.firstDay);
    const locale = resolveLocale(options.locale);
    const firstDay = explicit ?? (locale ? firstDayFromLocale(locale) ?? 1 : 1);
    const hiddenDays = new Set;
    for (const value of options.hiddenDays ?? []) {
      const day = isoWeekday(value);
      if (day !== null)
        hiddenDays.add(day);
    }
    if (hiddenDays.size >= 7)
      hiddenDays.clear();
    return { firstDay, hiddenDays };
  }
  function toPlainDate(value) {
    return value instanceof Temporal2.PlainDate ? value : Temporal2.PlainDate.from(value);
  }
  function getViewDays(view) {
    return VIEW_DAYS[view] ?? 1;
  }
  function isWeekAnchoredView(view) {
    return WEEK_ANCHORED_VIEWS.has(view);
  }
  function startOfWeek(date, firstDay = 1) {
    const anchor = toPlainDate(date);
    const start = isoWeekday(firstDay) ?? 1;
    return anchor.subtract({ days: (anchor.dayOfWeek - start + 7) % 7 });
  }
  function getViewRange(date, view, options = {}) {
    if (isMonthView(view))
      return getMonthRange(date, options);
    const dates = getVisibleDates(date, view, options);
    if (dates.length === 0) {
      const start = toPlainDate(date);
      return { start, end: start };
    }
    return { start: dates[0], end: dates[dates.length - 1].add({ days: 1 }) };
  }
  function getVisibleDates(date, view, options = {}) {
    if (isMonthView(view))
      return getMonthWeeks(date, options).flat();
    const { firstDay, hiddenDays } = resolveDateOptions(options);
    const count = getViewDays(view);
    if (isWeekAnchoredView(view)) {
      const start = startOfWeek(date, firstDay);
      return Array.from({ length: count }, (_, index) => start.add({ days: index })).filter((day) => !hiddenDays.has(day.dayOfWeek));
    }
    const dates = [];
    let cursor = toPlainDate(date);
    while (dates.length < count) {
      if (!hiddenDays.has(cursor.dayOfWeek))
        dates.push(cursor);
      cursor = cursor.add({ days: 1 });
    }
    return dates;
  }
  function stepAnchor(date, view, direction, options = {}) {
    const anchor = toPlainDate(date);
    if (isMonthView(view))
      return anchor.add({ months: direction });
    if (isWeekAnchoredView(view))
      return anchor.add({ days: 7 * direction });
    if (direction > 0) {
      const after = getViewRange(anchor, view, options).end;
      return getVisibleDates(after, view, options)[0] ?? after;
    }
    const { hiddenDays } = resolveDateOptions(options);
    const count = getViewDays(view);
    const start = getVisibleDates(anchor, view, options)[0] ?? anchor;
    let cursor = start.subtract({ days: 1 });
    let earliest = cursor;
    let found = 0;
    while (found < count) {
      if (!hiddenDays.has(cursor.dayOfWeek)) {
        found += 1;
        earliest = cursor;
      }
      if (found < count)
        cursor = cursor.subtract({ days: 1 });
    }
    return earliest;
  }
  function isResourceView(view) {
    return view === "resourceDay" || view === "resourceThreeDays";
  }
  function isMonthView(view) {
    return view === "month";
  }
  function fullMonthWeeks(date, firstDay) {
    const anchor = toPlainDate(date);
    const monthStart = anchor.with({ day: 1 });
    const monthEnd = monthStart.add({ months: 1 }).subtract({ days: 1 });
    const weeks = [];
    let current = startOfWeek(monthStart, firstDay);
    for (;; ) {
      const week = Array.from({ length: 7 }, (_, index) => current.add({ days: index }));
      weeks.push(week);
      if (Temporal2.PlainDate.compare(week[6], monthEnd) >= 0)
        break;
      current = week[6].add({ days: 1 });
    }
    return weeks;
  }
  function getMonthWeeks(date, options = {}) {
    const { firstDay, hiddenDays } = resolveDateOptions(options);
    const weeks = fullMonthWeeks(date, firstDay);
    if (hiddenDays.size === 0)
      return weeks;
    return weeks.map((week) => week.filter((day) => !hiddenDays.has(day.dayOfWeek)));
  }
  function getMonthRange(date, options = {}) {
    const { firstDay } = resolveDateOptions(options);
    const weeks = fullMonthWeeks(date, firstDay);
    return { start: weeks[0][0], end: weeks[weeks.length - 1][6].add({ days: 1 }) };
  }
  function parseClock(value) {
    return Temporal2.PlainTime.from(value);
  }
  function minutesFromMidnight(value) {
    const time = value instanceof Temporal2.PlainTime ? value : parseClock(value);
    return time.hour * 60 + time.minute + time.second / 60;
  }
  function durationMinutes(duration) {
    const value = duration instanceof Temporal2.Duration ? duration : Temporal2.Duration.from(duration);
    return value.total({ unit: "minute" });
  }
  function zonedDateTimeAt(date, minutes, timeZone) {
    const day = toPlainDate(date);
    const time = Temporal2.PlainTime.from({ hour: Math.floor(minutes / 60), minute: Math.floor(minutes % 60) });
    return day.toPlainDateTime(time).toZonedDateTime(timeZone);
  }
  function formatClock(minutes) {
    const clamped = Math.max(0, minutes);
    return `${String(Math.floor(clamped / 60)).padStart(2, "0")}:${String(Math.floor(clamped % 60)).padStart(2, "0")}`;
  }
  function resolveLocale(value) {
    if (typeof value !== "string")
      return;
    const trimmed = value.trim();
    return trimmed === "" ? undefined : trimmed;
  }
  function firstDayFromLocale(locale) {
    const day = Number(readWeekInfoFirstDay(locale));
    if (!Number.isInteger(day) || day < 1 || day > 7)
      return null;
    return day;
  }
  function readWeekInfoFirstDay(locale) {
    try {
      const factory = localeWeekInfoReader();
      if (!factory)
        return null;
      const info = factory(locale);
      if (typeof info !== "object" || info === null)
        return null;
      return info.firstDay ?? null;
    } catch {
      return null;
    }
  }
  function localeWeekInfoReader() {
    const holder = Intl;
    if (typeof holder.Locale !== "function")
      return null;
    const Ctor = holder.Locale;
    return (tag) => {
      const instance = new Ctor(tag);
      return typeof instance.getWeekInfo === "function" ? instance.getWeekInfo() : null;
    };
  }
  function formatDayHeader(date, locale) {
    return toPlainDate(date).toLocaleString(locale, { weekday: "short", month: "numeric", day: "numeric" });
  }
  function formatSlotLabel(minutes, locale) {
    const total = Math.max(0, Math.floor(minutes));
    const hour = Math.floor(total / 60);
    if (hour > 23)
      return formatClock(minutes);
    const time = Temporal2.PlainTime.from({ hour, minute: total % 60 });
    return time.toLocaleString(locale, { hour: "numeric", minute: "2-digit" });
  }

  // src/core/labels.js
  var DEFAULT_LABELS = {
    noEvents: "No events",
    noResources: "No resources selected.",
    more: "+{hidden} more",
    calendarRegion: "Calendar",
    untitledEvent: "Event",
    allDaySlotLabel: "All day"
  };
  var LABEL_PLACEHOLDER_PATTERN = /\{(\w+)\}/g;
  function formatLabel(template, values) {
    return String(template ?? "").replace(LABEL_PLACEHOLDER_PATTERN, (_, key) => String(values[key] ?? ""));
  }
  function resolveLabels(input) {
    return { ...DEFAULT_LABELS, ...input };
  }

  // src/core/model.js
  function normalizeRangeBound(value, allDay) {
    if (allDay) {
      if (value instanceof Temporal2.PlainDate)
        return value;
      if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
        return Temporal2.PlainDate.from(value);
      }
      throw new TypeError("All-day boundaries must be Temporal.PlainDate or YYYY-MM-DD strings");
    }
    if (value instanceof Temporal2.ZonedDateTime)
      return value;
    if (typeof value === "string") {
      try {
        return Temporal2.ZonedDateTime.from(value);
      } catch {}
    }
    throw new TypeError("Timed boundaries must be Temporal.ZonedDateTime or ISO strings with a zone");
  }
  function normalizeEvent(event) {
    if (!event || event.id == null || event.start == null || event.end == null) {
      throw new TypeError("Event requires id, start and end");
    }
    const { classNames, extendedProps, start, end, allDay = false, ...rest } = event;
    return {
      ...rest,
      id: String(event.id),
      allDay,
      start: normalizeRangeBound(start, allDay),
      end: normalizeRangeBound(end, allDay),
      classNames: Array.from(classNames ?? []),
      extendedProps: { ...extendedProps ?? {} }
    };
  }
  function sameBound(a, b) {
    if (a === b)
      return true;
    if (a instanceof Temporal2.ZonedDateTime && b instanceof Temporal2.ZonedDateTime)
      return a.equals(b);
    if (a instanceof Temporal2.PlainDate && b instanceof Temporal2.PlainDate)
      return a.equals(b);
    return false;
  }
  function sameRange(a, b) {
    return sameBound(a.start, b.start) && sameBound(a.end, b.end) && (a.resourceId ?? null) === (b.resourceId ?? null);
  }
  function isMovable(event, calendarEditable) {
    return event.movable ?? event.editable ?? calendarEditable ?? true;
  }
  function isResizable(event, calendarEditable) {
    return event.resizable ?? event.editable ?? calendarEditable ?? true;
  }
  function normalizeResource(resource) {
    if (!resource || resource.id == null) {
      throw new TypeError("Resource requires id");
    }
    const { classNames, extendedProps, ...rest } = resource;
    return {
      title: String(resource.id),
      selectable: true,
      droppable: true,
      ...rest,
      id: String(resource.id),
      classNames: Array.from(classNames ?? []),
      extendedProps: { ...extendedProps ?? {} }
    };
  }
  function normalizeBackground(background) {
    if (!background || background.id == null || background.start == null || background.end == null) {
      throw new TypeError("Background requires id, start and end");
    }
    const { classNames, extendedProps, start, end, allDay = false, ...rest } = background;
    return {
      ...rest,
      id: String(background.id),
      allDay,
      start: normalizeRangeBound(start, allDay),
      end: normalizeRangeBound(end, allDay),
      classNames: Array.from(classNames ?? []),
      extendedProps: { ...extendedProps ?? {} }
    };
  }

  // src/core/slicing.js
  function toZonedDateTime(value, timeZone) {
    if (value instanceof Temporal2.ZonedDateTime) {
      return value.withTimeZone(timeZone);
    }
    if (typeof value === "string") {
      return Temporal2.ZonedDateTime.from(value).withTimeZone(timeZone);
    }
    throw new TypeError("Event boundaries must be Temporal.ZonedDateTime or ISO strings");
  }
  function instantRangeOf(start, end, timeZone) {
    const project = (value) => {
      if (value instanceof Temporal2.PlainDate) {
        return value.toZonedDateTime({ timeZone, plainTime: "00:00" });
      }
      if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
        return Temporal2.PlainDate.from(value).toZonedDateTime({ timeZone, plainTime: "00:00" });
      }
      return toZonedDateTime(value, timeZone);
    };
    return { start: project(start), end: project(end) };
  }
  function wallMinutes(zoned) {
    const time = zoned.toPlainTime();
    return time.hour * 60 + time.minute + time.second / 60 + time.millisecond / 60000;
  }
  function sliceRangeForDay({ start, end, date, timeZone, slotMin, slotMax }) {
    const day = toPlainDate(date);
    const startZoned = toZonedDateTime(start, timeZone);
    const endZoned = toZonedDateTime(end, timeZone);
    if (Temporal2.ZonedDateTime.compare(endZoned, startZoned) <= 0)
      return null;
    const startDay = startZoned.toPlainDate();
    const endDay = endZoned.toPlainDate();
    if (Temporal2.PlainDate.compare(day, startDay) < 0 || Temporal2.PlainDate.compare(day, endDay) > 0) {
      return null;
    }
    const startWall = Temporal2.PlainDate.compare(day, startDay) === 0 ? wallMinutes(startZoned) : slotMin;
    const endWall = Temporal2.PlainDate.compare(day, endDay) === 0 ? wallMinutes(endZoned) : slotMax;
    const clippedStart = Math.max(slotMin, startWall);
    const clippedEnd = Math.min(slotMax, endWall);
    if (clippedEnd <= clippedStart)
      return null;
    return { start: clippedStart, end: clippedEnd };
  }
  function sliceTimedEventForDay(event, date, options) {
    return sliceRangeForDay({
      start: event.start,
      end: event.end,
      date,
      timeZone: options.timeZone,
      slotMin: options.slotMin,
      slotMax: options.slotMax
    });
  }
  function describeEvent(event, timeZone, untitled = "Event") {
    const title = event.title ?? untitled;
    if (event.start instanceof Temporal2.PlainDate) {
      const endPlain = event.end;
      const span = endPlain.since(event.start).days;
      if (span <= 1)
        return `${title}, ${event.start.toString()}, all day`;
      return `${title}, ${event.start.toString()} to ${endPlain.subtract({ days: 1 }).toString()}, all day`;
    }
    const start = toZonedDateTime(event.start, timeZone);
    const end = toZonedDateTime(event.end, timeZone);
    const startDay = start.toPlainDate().toString();
    const endDay = end.toPlainDate().toString();
    const startText = `${startDay}, ${formatClock(wallMinutes(start))}`;
    const endText = startDay === endDay ? formatClock(wallMinutes(end)) : `${endDay}, ${formatClock(wallMinutes(end))}`;
    return `${title}, ${startText} to ${endText}`;
  }
  function eventOverlapsDate(range, date, timeZone) {
    const day = toPlainDate(date);
    if (range.start instanceof Temporal2.PlainDate) {
      const startDay = range.start;
      const endDay = range.end;
      if (Temporal2.PlainDate.compare(day, startDay) < 0)
        return false;
      if (Temporal2.PlainDate.compare(day, endDay) >= 0)
        return false;
      return true;
    }
    const startZoned = toZonedDateTime(range.start, timeZone);
    const endZoned = toZonedDateTime(range.end, timeZone);
    if (Temporal2.ZonedDateTime.compare(endZoned, startZoned) <= 0)
      return false;
    const startDay = startZoned.toPlainDate();
    const endDay = endZoned.toPlainDate();
    if (Temporal2.PlainDate.compare(day, startDay) < 0)
      return false;
    if (Temporal2.PlainDate.compare(day, endDay) > 0)
      return false;
    if (Temporal2.PlainDate.compare(day, endDay) === 0 && wallMinutes(endZoned) <= 0)
      return false;
    return true;
  }

  // src/core/overlaps.js
  function queryRangeContext({
    events = [],
    backgrounds = [],
    range,
    timeZone = "UTC",
    resourceId = null
  }) {
    if (!range || range.start == null || range.end == null) {
      throw new TypeError("getRangeContext requires { start, end }");
    }
    const { start: rangeStart, end: rangeEnd } = instantRangeOf(range.start, range.end, timeZone);
    const startMs = rangeStart.epochMilliseconds;
    const endMs = rangeEnd.epochMilliseconds;
    const context = { events: { overlapping: [] }, backgrounds: { overlapping: [], covering: [] } };
    if (!(endMs > startMs))
      return context;
    const scoped = resourceId == null ? null : String(resourceId);
    for (const event of events) {
      if (scoped !== null && (event.resourceId ?? null) !== scoped)
        continue;
      const { start: eventStart, end: eventEnd } = instantRangeOf(event.start, event.end, timeZone);
      if (!rangesOverlap(startMs, endMs, eventStart.epochMilliseconds, eventEnd.epochMilliseconds))
        continue;
      context.events.overlapping.push(event);
    }
    for (const background of backgrounds) {
      if (scoped !== null && background.resourceId != null && background.resourceId !== scoped)
        continue;
      const { start: backgroundStart, end: backgroundEnd } = instantRangeOf(background.start, background.end, timeZone);
      const backgroundStartMs = backgroundStart.epochMilliseconds;
      const backgroundEndMs = backgroundEnd.epochMilliseconds;
      if (!rangesOverlap(startMs, endMs, backgroundStartMs, backgroundEndMs))
        continue;
      context.backgrounds.overlapping.push(background);
      if (backgroundStartMs <= startMs && backgroundEndMs >= endMs) {
        context.backgrounds.covering.push(background);
      }
    }
    return context;
  }
  function rangesOverlap(aStartMs, aEndMs, bStartMs, bEndMs) {
    return aStartMs < bEndMs && bStartMs < aEndMs;
  }
  function queryOverlaps({
    events = [],
    backgrounds = [],
    range,
    timeZone = "UTC",
    resourceIds = [],
    includeBackgrounds = false,
    filter
  }) {
    if (!range || range.start == null || range.end == null) {
      throw new TypeError("getEventOverlaps requires { start, end }");
    }
    const { start: startInstant, end: endInstant } = instantRangeOf(range.start, range.end, timeZone);
    const startMs = startInstant.epochMilliseconds;
    const endMs = endInstant.epochMilliseconds;
    if (!(endMs > startMs))
      return [];
    const scoped = Array.from(resourceIds ?? []);
    const hits = [];
    for (const event of events) {
      if (scoped.length > 0 && !scoped.includes(event.resourceId))
        continue;
      const { start: eventStart, end: eventEnd } = instantRangeOf(event.start, event.end, timeZone);
      if (!rangesOverlap(startMs, endMs, eventStart.epochMilliseconds, eventEnd.epochMilliseconds))
        continue;
      const entry = { kind: "event", event };
      if (filter && !filter(entry))
        continue;
      hits.push(event);
    }
    if (includeBackgrounds) {
      for (const background of backgrounds) {
        if (scoped.length > 0 && background.resourceId != null && !scoped.includes(background.resourceId)) {
          continue;
        }
        const { start: backgroundStart, end: backgroundEnd } = instantRangeOf(background.start, background.end, timeZone);
        if (!rangesOverlap(startMs, endMs, backgroundStart.epochMilliseconds, backgroundEnd.epochMilliseconds)) {
          continue;
        }
        const entry = { kind: "background", background };
        if (filter && !filter(entry))
          continue;
        hits.push(background);
      }
    }
    return hits;
  }

  // src/core/policy.js
  function normalizePolicyDecision(result) {
    if (result === false)
      return { ok: false, reason: null };
    if (typeof result === "string")
      return { ok: false, reason: result || null };
    return { ok: true, reason: null };
  }

  // src/core/temporal.js
  function temporalState(start, end, now, timeZone = "UTC") {
    const { start: startInstant, end: endInstant } = instantRangeOf(start, end, timeZone);
    const nowMs = now.epochMilliseconds;
    if (endInstant.epochMilliseconds <= nowMs)
      return "past";
    if (startInstant.epochMilliseconds <= nowMs)
      return "current";
    return "future";
  }
  function nextStateChangeMs(events, nowMs, timeZone = "UTC", visibleRange = null) {
    let scope = null;
    if (visibleRange) {
      const projected = instantRangeOf(visibleRange.start, visibleRange.end, timeZone);
      scope = { startMs: projected.start.epochMilliseconds, endMs: projected.end.epochMilliseconds };
      if (!(scope.endMs > scope.startMs))
        return null;
    }
    let next = null;
    for (const event of events) {
      const { start, end } = instantRangeOf(event.start, event.end, timeZone);
      const startMs = start.epochMilliseconds;
      const endMs = end.epochMilliseconds;
      if (scope && (endMs <= scope.startMs || startMs >= scope.endMs))
        continue;
      if (startMs > nowMs && (next === null || startMs < next))
        next = startMs;
      if (endMs > nowMs && (next === null || endMs < next))
        next = endMs;
    }
    return next;
  }

  // src/render/list.js
  function renderList({ dates, events, options, now, eventContent, dayHeaderContent }) {
    const timeZone = options.timeZone ?? "UTC";
    const renderNow = now ?? Temporal2.Now.zonedDateTimeISO(timeZone);
    const locale = options.locale;
    const labels = options.labels ?? DEFAULT_LABELS;
    const fragment = document.createDocumentFragment();
    const root = document.createElement("div");
    root.className = "cv-list";
    const startEpoch = (event) => instantRangeOf(event.start, event.end, timeZone).start.epochMilliseconds;
    for (const date of dates) {
      const group = document.createElement("section");
      group.className = "cv-list-day";
      group.dataset.date = date.toString();
      const header = document.createElement("header");
      header.className = "cv-list-day-header";
      const headerContent = dayHeaderContent?.({ date, resource: null, element: header });
      if (headerContent instanceof Node)
        header.append(headerContent);
      else if (headerContent != null)
        header.textContent = String(headerContent);
      else
        header.textContent = formatDayHeader(date, locale);
      group.append(header);
      const dayEvents = events.filter((event) => eventOverlapsDate(event, date, timeZone)).sort((a, b) => startEpoch(a) - startEpoch(b));
      if (dayEvents.length === 0) {
        const empty = document.createElement("p");
        empty.className = "cv-list-empty";
        empty.textContent = labels.noEvents;
        group.append(empty);
      }
      for (const event of dayEvents) {
        const item = document.createElement("button");
        item.type = "button";
        item.className = ["cv-list-event", ...event.classNames ?? []].join(" ");
        item.dataset.eventId = event.id;
        const state = temporalState(event.start, event.end, renderNow, timeZone);
        item.dataset.temporalState = state;
        item.setAttribute("aria-label", describeEvent(event, timeZone, labels.untitledEvent));
        const content = eventContent?.({ event, date, resource: null, temporalState: state, element: item });
        if (content instanceof Node) {
          item.append(content);
        } else if (content != null) {
          item.textContent = String(content);
        } else if (event.start instanceof Temporal2.PlainDate) {
          item.textContent = event.title ?? labels.untitledEvent;
        } else {
          item.textContent = `${formatClock(wallMinutes(instantRangeOf(event.start, event.end, timeZone).start))} ${event.title ?? labels.untitledEvent}`;
        }
        item.addEventListener("click", (nativeEvent) => {
          item.dispatchEvent(new CustomEvent("calendar:eventclick", {
            bubbles: true,
            composed: true,
            cancelable: true,
            detail: { event, date, resource: null, nativeEvent }
          }));
        });
        group.append(item);
      }
      root.append(group);
    }
    fragment.append(root);
    return fragment;
  }

  // src/render/month-grid.js
  function renderMonthGrid({
    weeks,
    month,
    events,
    options,
    now,
    eventContent,
    moreLinkContent,
    getRangeContext
  }) {
    const timeZone = options.timeZone ?? "UTC";
    const renderNow = now ?? Temporal2.Now.zonedDateTimeISO(timeZone);
    const locale = options.locale;
    const labels = options.labels ?? DEFAULT_LABELS;
    const limit = Math.max(1, options.monthEventLimit ?? 3);
    const fragment = document.createDocumentFragment();
    const root = document.createElement("div");
    root.className = "cv-month";
    root.style.setProperty("--calendar-month-columns", String(Math.max(1, weeks[0]?.length ?? 7)));
    const head = document.createElement("div");
    head.className = "cv-month-weekdays";
    head.setAttribute("aria-hidden", "true");
    for (const day of weeks[0]) {
      const cell = document.createElement("span");
      cell.className = "cv-month-weekday";
      cell.textContent = day.toLocaleString(locale, { weekday: "short" });
      head.append(cell);
    }
    root.append(head);
    const startEpoch = (event) => instantRangeOf(event.start, event.end, timeZone).start.epochMilliseconds;
    for (const week of weeks) {
      const row = document.createElement("div");
      row.className = "cv-month-week";
      for (const date of week) {
        const cell = document.createElement("section");
        cell.className = "cv-month-day";
        cell.dataset.date = date.toString();
        if (date.month !== month)
          cell.dataset.outside = "true";
        const label = document.createElement("span");
        label.className = "cv-month-day-number";
        label.textContent = String(date.day);
        cell.append(label);
        const dayEvents = events.filter((event) => eventOverlapsDate(event, date, timeZone)).sort((a, b) => startEpoch(a) - startEpoch(b));
        for (const event of dayEvents.slice(0, limit)) {
          const chip = document.createElement("button");
          chip.type = "button";
          chip.className = ["cv-month-event", ...event.classNames ?? []].join(" ");
          chip.dataset.eventId = event.id;
          const state = temporalState(event.start, event.end, renderNow, timeZone);
          chip.dataset.temporalState = state;
          chip.setAttribute("aria-label", describeEvent(event, timeZone, labels.untitledEvent));
          const content = eventContent?.({ event, date, resource: null, temporalState: state, element: chip });
          if (content instanceof Node)
            chip.append(content);
          else
            chip.textContent = content == null ? event.title ?? labels.untitledEvent : String(content);
          chip.addEventListener("click", (nativeEvent) => {
            chip.dispatchEvent(new CustomEvent("calendar:eventclick", {
              bubbles: true,
              composed: true,
              cancelable: true,
              detail: { event, date, resource: null, nativeEvent }
            }));
          });
          cell.append(chip);
        }
        if (dayEvents.length > limit) {
          const hidden = dayEvents.length - limit;
          const more = document.createElement("button");
          more.type = "button";
          more.className = "cv-month-more";
          more.dataset.date = date.toString();
          const content = moreLinkContent?.({ date, events: dayEvents, hidden, element: more });
          if (content instanceof Node)
            more.append(content);
          else
            more.textContent = content == null ? formatLabel(labels.more, { hidden }) : String(content);
          more.addEventListener("click", (nativeEvent) => {
            more.dispatchEvent(new CustomEvent("calendar:moreclick", {
              bubbles: true,
              composed: true,
              cancelable: true,
              detail: { date, events: dayEvents, hidden, nativeEvent }
            }));
          });
          cell.append(more);
        }
        cell.addEventListener("click", (nativeEvent) => {
          if (nativeEvent.target instanceof Element && nativeEvent.target.closest(".cv-month-event, .cv-month-more")) {
            return;
          }
          const start = zonedDateTimeAt(date, 0, timeZone);
          const range = { start, end: start.add({ days: 1 }), resourceId: null };
          cell.dispatchEvent(new CustomEvent("calendar:select", {
            bubbles: true,
            composed: true,
            cancelable: true,
            detail: {
              start: range.start,
              end: range.end,
              resourceId: range.resourceId,
              context: getRangeContext?.(range) ?? null,
              nativeEvent
            }
          }));
        });
        row.append(cell);
      }
      root.append(row);
    }
    fragment.append(root);
    return fragment;
  }

  // src/core/geometry.js
  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }
  function snapMinutes(minutes, step, mode = "round") {
    if (!Number.isFinite(minutes) || !Number.isFinite(step) || step <= 0) {
      throw new TypeError("minutes and step must be finite; step must be > 0");
    }
    const epsilon = 0.000000001;
    const ratio = minutes / step;
    const snapped = mode === "floor" ? Math.floor(ratio + epsilon) : mode === "ceil" ? Math.ceil(ratio - epsilon) : Math.round(ratio);
    return snapped * step;
  }
  function defaultSnapThreshold(snapStep) {
    if (!Number.isFinite(snapStep) || snapStep <= 0) {
      throw new TypeError("snapStep must be > 0");
    }
    return Math.min(snapStep / 2, 5);
  }
  function findSnapTarget(minutes, edges, threshold) {
    if (!Number.isFinite(minutes) || !Number.isFinite(threshold) || threshold <= 0)
      return null;
    let best = null;
    let bestDistance = Infinity;
    for (const edge of edges) {
      if (!Number.isFinite(edge))
        continue;
      const distance = Math.abs(minutes - edge);
      if (distance <= threshold && distance < bestDistance) {
        best = edge;
        bestDistance = distance;
      }
    }
    return best;
  }
  function minutesToPixels(minutes, pxPerMinute) {
    return minutes * pxPerMinute;
  }
  function eventGeometry({ startMinutes, endMinutes, dayStartMinutes, pxPerMinute, gap = 2 }) {
    const top = minutesToPixels(startMinutes - dayStartMinutes, pxPerMinute);
    const rawHeight = minutesToPixels(endMinutes - startMinutes, pxPerMinute);
    return {
      top,
      height: Math.max(1, rawHeight - gap)
    };
  }

  // src/core/hit.js
  function hitTest({ x, y, columns, slotMin, slotMax, pxPerMinute }) {
    const column = columns.findIndex((entry) => x >= entry.rect.left && x < entry.rect.right && y >= entry.rect.top && y < entry.rect.bottom);
    if (column < 0)
      return null;
    const { date, resource, rect } = columns[column];
    const minutes = clamp(slotMin + (y - rect.top) / pxPerMinute, slotMin, slotMax);
    return { column, date, resource, minutes };
  }

  // src/core/layout.js
  function layoutEvents(items) {
    const sorted = items.map((item, index) => ({ ...item, index })).sort((a, b) => a.start - b.start || a.end - b.end || a.index - b.index);
    const groups = [];
    let current = null;
    for (const item of sorted) {
      if (!current || item.start >= current.end) {
        current = { end: item.end, items: [] };
        groups.push(current);
      } else if (item.end > current.end) {
        current.end = item.end;
      }
      current.items.push(item);
    }
    const placed = new Map;
    for (const group of groups) {
      const columns = [];
      for (const item of group.items) {
        let column = columns.findIndex((lastEnd) => lastEnd <= item.start);
        if (column < 0) {
          column = columns.length;
          columns.push(item.end);
        } else {
          columns[column] = item.end;
        }
        placed.set(item.index, { column, columns: 0 });
      }
      for (const item of group.items) {
        const placement = placed.get(item.index);
        placement.columns = columns.length;
      }
    }
    return items.map((item, index) => {
      const placement = placed.get(index);
      const { column, columns } = placement;
      return {
        event: item.event,
        start: item.start,
        end: item.end,
        column,
        columns,
        left: column / columns,
        width: 1 / columns
      };
    });
  }
  function layoutDaySegments(segments) {
    const sorted = segments.map((segment, index) => ({ ...segment, index })).sort((a, b) => a.startDay - b.startDay || b.endDay - a.endDay || a.index - b.index);
    const rows = [];
    const assigned = new Map;
    for (const segment of sorted) {
      let row = rows.findIndex((entries) => entries.every((entry) => entry.resourceId !== segment.resourceId || entry.end <= segment.startDay));
      if (row < 0) {
        row = rows.length;
        rows.push([]);
      }
      rows[row].push({ resourceId: segment.resourceId, end: segment.endDay });
      assigned.set(segment.index, row);
    }
    return segments.map((segment, index) => ({
      ...segment,
      row: assigned.get(index)
    }));
  }

  // src/core/resources.js
  function getTimeGridColumns(dates) {
    return dates.map((date) => ({ date, resource: null }));
  }
  function getResourceColumns(resources, dates) {
    return resources.flatMap((resource) => dates.map((date) => ({ date, resource })));
  }
  function eventBelongsToColumn(event, column) {
    if (!column.resource)
      return true;
    return event.resourceId === column.resource.id;
  }
  function backgroundAppliesToColumn(background, column) {
    if (!column.resource)
      return true;
    if (background.resourceId == null)
      return true;
    return background.resourceId === column.resource.id;
  }

  // src/render/autoscroll.js
  function createAutoscroller(scroller, { edge = 48, speed = 12 } = {}) {
    let delta = 0;
    let frame = 0;
    const cancel = () => {
      if (frame === 0)
        return;
      cancelAnimationFrame(frame);
      frame = 0;
    };
    const tick = () => {
      if (!scroller.isConnected) {
        delta = 0;
        frame = 0;
        return;
      }
      scroller.scrollTop += delta;
      frame = requestAnimationFrame(tick);
    };
    return {
      update(clientY) {
        const rect = scroller.getBoundingClientRect();
        const next = clientY < rect.top + edge ? -speed : clientY > rect.bottom - edge ? speed : 0;
        if (next === delta)
          return;
        delta = next;
        if (delta !== 0 && frame === 0 && scroller.isConnected)
          frame = requestAnimationFrame(tick);
        if (delta === 0)
          cancel();
      },
      stop() {
        delta = 0;
        cancel();
      }
    };
  }

  // src/render/time-grid.js
  function renderTimeGrid({
    dates,
    resources,
    view = "week",
    events,
    backgrounds,
    options,
    now,
    host,
    eventContent,
    dayHeaderContent,
    resourceHeaderContent,
    slotLabelContent
  }) {
    const fragment = document.createDocumentFragment();
    const locale = options.locale;
    const labels = options.labels ?? DEFAULT_LABELS;
    const resourceView = isResourceView(view);
    const columns = resourceView ? getResourceColumns(resources, dates) : getTimeGridColumns(dates);
    const gridTemplate = `3.5rem repeat(${Math.max(1, columns.length)}, minmax(var(--calendar-column-min), 1fr))`;
    if (resourceView) {
      const resourceRow = document.createElement("div");
      resourceRow.className = "cv-resource-row";
      resourceRow.style.gridTemplateColumns = gridTemplate;
      const corner = document.createElement("div");
      corner.className = "cv-resource-corner";
      corner.setAttribute("aria-hidden", "true");
      resourceRow.append(corner);
      for (const resource of resources) {
        const header = document.createElement("div");
        header.className = "cv-resource-header";
        header.dataset.resourceId = resource.id;
        header.style.gridColumn = `span ${Math.max(1, dates.length)}`;
        const custom = resourceHeaderContent?.({ resource, dates, element: header });
        if (custom instanceof Node)
          header.append(custom);
        else if (custom != null)
          header.textContent = String(custom);
        else
          header.textContent = resource.title ?? resource.id;
        resourceRow.append(header);
      }
      fragment.append(resourceRow);
    }
    const root = document.createElement("div");
    root.className = "cv-grid";
    const axis = document.createElement("div");
    axis.className = "cv-axis";
    root.append(axis);
    const startMinutes = minutesFromMidnight(options.slotMin);
    const endMinutes = minutesFromMidnight(options.slotMax);
    const pxPerMinute = options.pxPerMinute;
    const timeZone = options.timeZone ?? "UTC";
    const renderNow = now ?? Temporal2.Now.zonedDateTimeISO(timeZone);
    const stateOf = (event) => temporalState(event.start, event.end, renderNow, timeZone);
    const snapStep = durationMinutes(options.snapDuration ?? { minutes: 15 });
    const defaultDuration = durationMinutes(options.defaultTimedEventDuration ?? { minutes: 30 });
    const snapThreshold = defaultSnapThreshold(snapStep);
    const totalHeight = (endMinutes - startMinutes) * pxPerMinute;
    axis.style.height = `${totalHeight}px`;
    let selecting = null;
    let suppressClick = false;
    let longPressConsumed = false;
    const LONG_PRESS_MS = 550;
    const LONG_PRESS_PX = 12;
    function tryCapture(target, pointerId) {
      try {
        target.setPointerCapture(pointerId);
      } catch {}
    }
    function dispatchContextMenu(target, detail, nativeEvent) {
      const handled = !target.dispatchEvent(new CustomEvent("calendar:eventcontextmenu", {
        bubbles: true,
        composed: true,
        cancelable: true,
        detail: { ...detail, nativeEvent }
      }));
      if (handled)
        nativeEvent.preventDefault?.();
    }
    function watchLongPress(target, onFire, shouldIgnore) {
      let timer = 0;
      let pointerId = -1;
      let startX = 0;
      let startY = 0;
      const clear = () => {
        if (timer !== 0) {
          clearTimeout(timer);
          timer = 0;
        }
      };
      target.addEventListener("pointerdown", (nativeEvent) => {
        if (nativeEvent.pointerType === "mouse" || nativeEvent.button !== 0)
          return;
        if (shouldIgnore?.(nativeEvent))
          return;
        pointerId = nativeEvent.pointerId;
        startX = nativeEvent.clientX;
        startY = nativeEvent.clientY;
        clear();
        timer = window.setTimeout(() => {
          timer = 0;
          if (!host.isConnected())
            return;
          longPressConsumed = true;
          suppressClick = true;
          onFire(nativeEvent);
        }, LONG_PRESS_MS);
      });
      target.addEventListener("pointermove", (nativeEvent) => {
        if (timer === 0 || nativeEvent.pointerId !== pointerId)
          return;
        if (Math.hypot(nativeEvent.clientX - startX, nativeEvent.clientY - startY) > LONG_PRESS_PX) {
          clear();
        }
      });
      target.addEventListener("pointerup", clear);
      target.addEventListener("pointercancel", clear);
    }
    function focusableEvents(body) {
      const nodes = [...body.querySelectorAll(".cv-event")];
      return nodes.sort((a, b) => Number.parseFloat(a.style.top) - Number.parseFloat(b.style.top));
    }
    function columnHit(column, body, clientX, clientY) {
      return hitTest({
        x: clientX,
        y: clientY,
        columns: [{ date: column.date, resource: column.resource, rect: body.getBoundingClientRect() }],
        slotMin: startMinutes,
        slotMax: endMinutes,
        pxPerMinute
      });
    }
    function dispatchSelect(body, column, start, end, nativeEvent) {
      const range = {
        start: zonedDateTimeAt(column.date, start, timeZone),
        end: zonedDateTimeAt(column.date, end, timeZone),
        resourceId: column.resource?.id ?? null
      };
      body.dispatchEvent(new CustomEvent("calendar:select", {
        bubbles: true,
        composed: true,
        cancelable: true,
        detail: {
          start: range.start,
          end: range.end,
          resourceId: range.resourceId,
          context: host.getRangeContext(range),
          nativeEvent
        }
      }));
    }
    const labelInterval = Math.max(1, options.slotLabelInterval ?? 60);
    for (let minute = startMinutes;minute <= endMinutes; minute += labelInterval) {
      const label = document.createElement("div");
      label.className = "cv-axis-label";
      label.style.top = `${(minute - startMinutes) * pxPerMinute}px`;
      const content = slotLabelContent?.({
        time: Temporal2.PlainTime.from({
          hour: Math.floor(minute / 60),
          minute: Math.floor(minute % 60)
        }),
        minutes: minute,
        element: label
      });
      if (content instanceof Node)
        label.append(content);
      else
        label.textContent = content == null ? formatSlotLabel(minute, locale) : String(content);
      axis.append(label);
    }
    root.style.gridTemplateColumns = gridTemplate;
    if (columns.length === 0) {
      const empty = document.createElement("p");
      empty.className = "cv-empty";
      empty.textContent = labels.noResources;
      root.append(empty);
      fragment.append(root);
      return fragment;
    }
    const overVisibleDays = (range) => dates.some((date) => eventOverlapsDate(range, date, timeZone));
    const daySpan = (range) => {
      let start = -1;
      let end = -1;
      for (let index = 0;index < columns.length; index += 1) {
        const column = columns[index];
        const applies = "resourceId" in range ? eventBelongsToColumn(range, column) : backgroundAppliesToColumn(range, column);
        if (!applies || !eventOverlapsDate(range, column.date, timeZone))
          continue;
        if (start < 0)
          start = index;
        end = index;
      }
      if (start < 0)
        return null;
      return { startDay: start, endDay: end + 1 };
    };
    const allDaySegments = events.filter((event) => event.allDay === true && overVisibleDays(event)).map((event) => {
      const span = daySpan(event);
      return span === null ? null : { event, resourceId: event.resourceId ?? null, startDay: span.startDay, endDay: span.endDay };
    }).filter((segment) => segment !== null);
    const allDayBackgroundSegments = backgrounds.filter((background) => background.allDay === true && overVisibleDays(background)).map((background) => {
      const span = daySpan(background);
      return span === null ? null : { background, startDay: span.startDay, endDay: span.endDay };
    }).filter((segment) => segment !== null);
    const showAllDay = options.allDaySlot !== false && (allDaySegments.length > 0 || allDayBackgroundSegments.length > 0);
    const allDayBars = [];
    const columnAtX = (clientX) => {
      for (let index = 0;index < bodies.length; index += 1) {
        const rect = bodies[index].body.getBoundingClientRect();
        if (clientX >= rect.left && clientX < rect.right)
          return columns[index];
      }
      return columns[0];
    };
    const columnIndexAtX = (clientX) => {
      for (let index = 0;index < bodies.length; index += 1) {
        const rect = bodies[index].body.getBoundingClientRect();
        if (clientX >= rect.left && clientX < rect.right)
          return index;
      }
      return -1;
    };
    const commitAllDayMove = (evt, days, resourceId, nativeEvent) => {
      if (!(evt.start instanceof Temporal2.PlainDate))
        return null;
      const start = evt.start;
      const end = evt.end;
      return host.commitEventMove({
        event: evt,
        previous: { start: evt.start, end: evt.end, resourceId: evt.resourceId ?? null },
        current: { start: start.add({ days }), end: end.add({ days }), resourceId },
        nativeEvent
      });
    };
    function beginAllDayDrag(bar, event, startDay, endDay, nativeEvent) {
      if (nativeEvent.button !== 0)
        return;
      if (event.start instanceof Temporal2.PlainDate && event.end instanceof Temporal2.PlainDate) {
        const startGate = host.checkInteraction({
          action: "move",
          event,
          start: event.start,
          end: event.end,
          resourceId: event.resourceId ?? null,
          allDay: true
        });
        if (!startGate.ok)
          return;
      }
      tryCapture(bar, nativeEvent.pointerId);
      const downX = nativeEvent.clientX;
      const downY = nativeEvent.clientY;
      let moved = false;
      let mirror = null;
      let pending = null;
      let laneKey = startDay;
      let laneOk = true;
      const onMove = (moveEvent) => {
        if (longPressConsumed)
          return;
        if (Math.hypot(moveEvent.clientX - downX, moveEvent.clientY - downY) >= 4)
          moved = true;
        if (!moved)
          return;
        if (!mirror) {
          mirror = bar.cloneNode(true);
          mirror.classList.add("cv-drag-mirror");
          mirror.tabIndex = -1;
          mirror.setAttribute("aria-hidden", "true");
          bar.classList.add("cv-drag-source");
          lane.append(mirror);
        }
        const index = columnIndexAtX(moveEvent.clientX);
        if (index < 0)
          return;
        const droppable = columns[index].resource?.droppable !== false;
        pending = { index, droppable };
        mirror.style.gridColumn = `${index + 2} / ${Math.min(columns.length, index + (endDay - startDay)) + 2}`;
        mirror.style.gridRow = String(Number.parseFloat(bar.style.gridRow) || 1);
        if (index !== laneKey) {
          laneKey = index;
          const dayDelta = index - startDay;
          const resourceId = columns[index].resource?.id ?? null;
          let decision = { ok: true, reason: null };
          if (event.start instanceof Temporal2.PlainDate && event.end instanceof Temporal2.PlainDate) {
            decision = host.checkInteraction({
              action: "move",
              event,
              start: event.start.add({ days: dayDelta }),
              end: event.end.add({ days: dayDelta }),
              resourceId,
              allDay: true
            });
          }
          laneOk = decision.ok;
          if (decision.reason)
            mirror.dataset.reason = decision.reason;
          else
            delete mirror.dataset.reason;
        }
        mirror.classList.toggle("cv-invalid", !droppable || !laneOk);
      };
      const cleanup = () => {
        bar.removeEventListener("pointermove", onMove);
        bar.removeEventListener("pointerup", onUp);
        bar.removeEventListener("pointercancel", onCancel);
        mirror?.remove();
        bar.classList.remove("cv-drag-source");
      };
      const onUp = (upEvent) => {
        const wasMoved = moved;
        const range = pending;
        cleanup();
        if (longPressConsumed)
          return;
        if (!wasMoved || !range?.droppable)
          return;
        if (!laneOk) {
          suppressClick = true;
          return;
        }
        suppressClick = true;
        const dayDelta = range.index - startDay;
        const resourceId = columns[range.index].resource?.id ?? null;
        const next = commitAllDayMove(event, dayDelta, resourceId, upEvent);
        if (next) {
          host.announce(describeEvent(next, timeZone, labels.untitledEvent));
          host.refocusEvent(event.id);
        }
      };
      const onCancel = (_cancelEvent) => {
        cleanup();
        longPressConsumed = false;
        suppressClick = false;
      };
      bar.addEventListener("pointermove", onMove);
      bar.addEventListener("pointerup", onUp);
      bar.addEventListener("pointercancel", onCancel);
    }
    const lane = document.createElement("div");
    lane.className = "cv-allday";
    lane.style.gridTemplateColumns = gridTemplate;
    lane.style.gridColumn = "1 / -1";
    lane.style.gridRow = "2";
    if (showAllDay) {
      const corner = document.createElement("span");
      corner.className = "cv-allday-corner";
      corner.textContent = labels.allDaySlotLabel;
      corner.setAttribute("aria-hidden", "true");
      lane.append(corner);
      for (const tint of allDayBackgroundSegments) {
        const node = document.createElement("div");
        node.className = ["cv-allday-background", ...tint.background.classNames ?? []].join(" ");
        node.style.gridColumn = `${tint.startDay + 2} / ${tint.endDay + 2}`;
        node.style.gridRow = "1 / -1";
        lane.append(node);
      }
      for (const segment of layoutDaySegments(allDaySegments)) {
        const { event, startDay, endDay } = segment;
        const bar = document.createElement("button");
        bar.type = "button";
        bar.className = ["cv-allday-event", ...event.classNames ?? []].join(" ");
        bar.dataset.eventId = event.id;
        const barState = stateOf(event);
        bar.dataset.temporalState = barState;
        bar.setAttribute("aria-label", describeEvent(event, timeZone, labels.untitledEvent));
        bar.style.gridColumn = `${startDay + 2} / ${endDay + 2}`;
        bar.style.gridRow = String(segment.row + 1);
        const column = columns[startDay];
        const content = eventContent?.({
          event,
          date: column.date,
          resource: column.resource,
          temporalState: barState,
          element: bar
        });
        if (content instanceof Node)
          bar.append(content);
        else if (content != null)
          bar.textContent = String(content);
        else
          bar.textContent = event.title ?? labels.untitledEvent;
        lane.append(bar);
        allDayBars.push({ bar, event, startDay, endDay });
        bar.addEventListener("click", (nativeEvent) => {
          if (suppressClick) {
            suppressClick = false;
            longPressConsumed = false;
            nativeEvent.stopPropagation();
            nativeEvent.preventDefault();
            return;
          }
          const target = columnAtX(nativeEvent.clientX);
          bar.dispatchEvent(new CustomEvent("calendar:eventclick", {
            bubbles: true,
            composed: true,
            cancelable: true,
            detail: { event, date: target.date, resource: target.resource, nativeEvent }
          }));
        }, true);
        bar.addEventListener("contextmenu", (nativeEvent) => {
          const target = columnAtX(nativeEvent.clientX);
          dispatchContextMenu(bar, {
            event,
            date: target.date,
            resourceId: target.resource?.id ?? null,
            clientX: nativeEvent.clientX,
            clientY: nativeEvent.clientY
          }, nativeEvent);
        });
        watchLongPress(bar, (press) => {
          const target = columnAtX(press.clientX);
          dispatchContextMenu(bar, {
            event,
            date: target.date,
            resourceId: target.resource?.id ?? null,
            clientX: press.clientX,
            clientY: press.clientY
          }, press);
        });
        const movable = isMovable(event, host.editable);
        bar.addEventListener("keydown", (keyboardEvent) => {
          if (keyboardEvent.ctrlKey || keyboardEvent.metaKey || !keyboardEvent.shiftKey)
            return;
          const key = keyboardEvent.key;
          if (key !== "ArrowLeft" && key !== "ArrowRight")
            return;
          if (!movable)
            return;
          keyboardEvent.preventDefault();
          const days = key === "ArrowRight" ? 1 : -1;
          if (event.start instanceof Temporal2.PlainDate && event.end instanceof Temporal2.PlainDate) {
            const gate = host.checkInteraction({
              action: "move",
              event,
              start: event.start.add({ days }),
              end: event.end.add({ days }),
              resourceId: event.resourceId ?? null,
              allDay: true
            });
            if (!gate.ok) {
              if (gate.reason)
                host.announce(gate.reason);
              return;
            }
          }
          const next = commitAllDayMove(event, days, event.resourceId ?? null, keyboardEvent);
          if (next)
            host.announce(describeEvent(next, timeZone, labels.untitledEvent));
        });
        if (movable) {
          bar.addEventListener("pointerdown", (nativeEvent) => beginAllDayDrag(bar, event, startDay, endDay, nativeEvent));
        }
      }
    }
    let headerColumn = 2;
    for (const column of columns) {
      const header = document.createElement("header");
      header.className = "cv-day-header";
      header.style.gridColumn = String(headerColumn);
      header.style.gridRow = "1";
      headerColumn += 1;
      const content = dayHeaderContent?.({
        date: column.date,
        resource: column.resource,
        element: header
      });
      if (content instanceof Node)
        header.append(content);
      else if (content != null)
        header.textContent = String(content);
      else
        header.textContent = formatDayHeader(column.date, locale);
      root.append(header);
    }
    if (showAllDay)
      root.append(lane);
    axis.style.gridColumn = "1";
    axis.style.gridRow = showAllDay ? "3" : "2";
    const bodies = [];
    const columnSlices = [];
    function columnEdges(index, excludeId = null) {
      const slices = columnSlices[index];
      if (!slices)
        return [];
      const edges = [];
      for (const item of slices.events) {
        if (excludeId != null && item.event.id === excludeId)
          continue;
        edges.push(item.start, item.end);
      }
      for (const slice of slices.backgrounds)
        edges.push(slice.start, slice.end);
      return edges;
    }
    function magnetOrSnap(raw, mode, edges) {
      return findSnapTarget(raw, edges, snapThreshold) ?? snapMinutes(raw, snapStep, mode);
    }
    function gridHit(clientX, clientY) {
      return hitTest({
        x: clientX,
        y: clientY,
        columns: bodies.map(({ column, body }) => ({
          date: column.date,
          resource: column.resource,
          rect: body.getBoundingClientRect()
        })),
        slotMin: startMinutes,
        slotMax: endMinutes,
        pxPerMinute
      });
    }
    for (let columnIndex = 0;columnIndex < columns.length; columnIndex += 1) {
      const column = columns[columnIndex];
      const day = document.createElement("section");
      day.className = "cv-day";
      day.dataset.date = column.date.toString();
      day.style.gridColumn = String(columnIndex + 2);
      day.style.gridRow = showAllDay ? "3" : "2";
      if (column.resource)
        day.dataset.resourceId = column.resource.id;
      const body = document.createElement("div");
      body.className = "cv-day-body";
      body.style.height = `${totalHeight}px`;
      for (let minute = startMinutes;minute <= endMinutes; minute += 60) {
        const line = document.createElement("div");
        line.className = "cv-hour-line";
        line.style.top = `${(minute - startMinutes) * pxPerMinute}px`;
        body.append(line);
      }
      const sliceOptions = { timeZone, slotMin: startMinutes, slotMax: endMinutes };
      const backgroundSlices = [];
      for (const background of backgrounds) {
        if (background.allDay === true)
          continue;
        if (!backgroundAppliesToColumn(background, column))
          continue;
        const slice = sliceTimedEventForDay(background, column.date, sliceOptions);
        if (!slice)
          continue;
        backgroundSlices.push(slice);
        const geometry = eventGeometry({
          startMinutes: slice.start,
          endMinutes: slice.end,
          dayStartMinutes: startMinutes,
          pxPerMinute,
          gap: 0
        });
        const node = document.createElement("div");
        node.className = ["cv-background", ...background.classNames ?? []].join(" ");
        node.style.top = `${geometry.top}px`;
        node.style.height = `${geometry.height}px`;
        body.append(node);
      }
      const dayEvents = [];
      for (const event of events) {
        if (event.allDay === true)
          continue;
        if (!eventBelongsToColumn(event, column))
          continue;
        const slice = sliceTimedEventForDay(event, column.date, sliceOptions);
        if (!slice)
          continue;
        dayEvents.push({ event, start: slice.start, end: slice.end });
      }
      columnSlices.push({ events: dayEvents, backgrounds: backgroundSlices });
      for (const item of layoutEvents(dayEvents)) {
        let onEventKeyDown = function(keyboardEvent) {
          if (keyboardEvent.ctrlKey || keyboardEvent.metaKey)
            return;
          const key = keyboardEvent.key;
          const shift = keyboardEvent.shiftKey;
          const alt = keyboardEvent.altKey;
          if (!shift && !alt) {
            if (key === "ArrowUp" || key === "ArrowDown" || key === "ArrowLeft" || key === "ArrowRight" || key === "Home" || key === "End") {
              keyboardEvent.preventDefault();
              moveEventFocus(key);
            }
            return;
          }
          if (shift && !alt && key.startsWith("Arrow")) {
            if (!movable)
              return;
            keyboardEvent.preventDefault();
            keyboardMoveEvent(key, keyboardEvent);
            return;
          }
          if (alt && !shift && key.startsWith("Arrow")) {
            if (!resizable)
              return;
            keyboardEvent.preventDefault();
            keyboardResizeEvent(key, keyboardEvent);
          }
        }, moveEventFocus = function(key) {
          const currentBody = node.closest(".cv-day-body");
          if (!(currentBody instanceof HTMLDivElement))
            return;
          if (key === "ArrowUp" || key === "ArrowDown" || key === "Home" || key === "End") {
            const peers = focusableEvents(currentBody);
            const index = peers.indexOf(node);
            if (index < 0)
              return;
            const target = key === "Home" ? peers[0] : key === "End" ? peers[peers.length - 1] : peers[index + (key === "ArrowDown" ? 1 : -1)];
            target?.focus();
            return;
          }
          const bodyIndex = bodies.findIndex((entry) => entry.body === currentBody);
          const target = bodies[bodyIndex + (key === "ArrowRight" ? 1 : -1)];
          if (!target)
            return;
          const peers = focusableEvents(target.body);
          if (peers.length === 0)
            return;
          const top = Number.parseFloat(node.style.top);
          let best = peers[0];
          for (const peer of peers) {
            if (Math.abs(Number.parseFloat(peer.style.top) - top) < Math.abs(Number.parseFloat(best.style.top) - top)) {
              best = peer;
            }
          }
          best.focus();
        }, keyboardMoveEvent = function(key, nativeEvent) {
          const startZoned = toZonedDateTime(event.start, timeZone);
          const endZoned = toZonedDateTime(event.end, timeZone);
          const previous = { start: event.start, end: event.end, resourceId: event.resourceId ?? null };
          let current;
          if (key === "ArrowUp" || key === "ArrowDown") {
            const delta = key === "ArrowDown" ? snapStep : -snapStep;
            current = {
              start: startZoned.add({ minutes: delta }),
              end: endZoned.add({ minutes: delta }),
              resourceId: event.resourceId ?? null
            };
          } else {
            const targetDate = column.date.add({ days: key === "ArrowRight" ? 1 : -1 });
            const nextStart = zonedDateTimeAt(targetDate, wallMinutes(startZoned), timeZone);
            const duration = Temporal2.Duration.from({
              milliseconds: endZoned.epochMilliseconds - startZoned.epochMilliseconds
            });
            const nextEnd = nextStart.add(duration);
            current = { start: nextStart, end: nextEnd, resourceId: event.resourceId ?? null };
          }
          const moveGate = host.checkInteraction({
            action: "move",
            event,
            start: current.start,
            end: current.end,
            resourceId: current.resourceId ?? null,
            allDay: event.allDay === true
          });
          if (!moveGate.ok) {
            if (moveGate.reason)
              host.announce(moveGate.reason);
            return;
          }
          const result = host.commitEventMove({ event, previous, current, nativeEvent });
          if (!result)
            return;
          host.announce(describeEvent(result, timeZone, labels.untitledEvent));
          host.refocusEvent(event.id);
        }, keyboardResizeEvent = function(key, nativeEvent) {
          const startZoned = toZonedDateTime(event.start, timeZone);
          const endZoned = toZonedDateTime(event.end, timeZone);
          let nextStart = startZoned;
          let nextEnd = endZoned;
          if (key === "ArrowUp")
            nextStart = startZoned.subtract({ minutes: snapStep });
          else if (key === "ArrowDown")
            nextStart = startZoned.add({ minutes: snapStep });
          else if (key === "ArrowLeft")
            nextEnd = endZoned.subtract({ minutes: snapStep });
          else
            nextEnd = endZoned.add({ minutes: snapStep });
          if (nextEnd.epochMilliseconds - nextStart.epochMilliseconds < snapStep * 60 * 1000)
            return;
          const resizeGate = host.checkInteraction({
            action: "resize",
            event,
            start: nextStart,
            end: nextEnd,
            resourceId: event.resourceId ?? null,
            allDay: event.allDay === true
          });
          if (!resizeGate.ok) {
            if (resizeGate.reason)
              host.announce(resizeGate.reason);
            return;
          }
          const result = host.commitEventResize({
            event,
            previous: { start: event.start, end: event.end, resourceId: event.resourceId ?? null },
            current: { start: nextStart, end: nextEnd, resourceId: event.resourceId ?? null },
            nativeEvent
          });
          if (!result)
            return;
          host.announce(describeEvent(result, timeZone, labels.untitledEvent));
          host.refocusEvent(event.id);
        }, beginResize = function(nativeEvent, edge) {
          if (nativeEvent.button !== 0)
            return;
          const pressGate = host.checkInteraction({
            action: "resize",
            event,
            start: event.start,
            end: event.end,
            resourceId: event.resourceId ?? null,
            allDay: event.allDay === true
          });
          if (!pressGate.ok)
            return;
          nativeEvent.stopPropagation();
          nativeEvent.preventDefault();
          tryCapture(node, nativeEvent.pointerId);
          const savedTop = node.style.top;
          const savedHeight = node.style.height;
          const downX = nativeEvent.clientX;
          const downY = nativeEvent.clientY;
          let moved = false;
          let pending = null;
          let resizeKey = `${item.start}:${item.end}`;
          let resizeOk = true;
          const onMove = (moveEvent) => {
            if (longPressConsumed)
              return;
            if (Math.hypot(moveEvent.clientX - downX, moveEvent.clientY - downY) >= 4)
              moved = true;
            if (!moved)
              return;
            const hit = columnHit(column, body, moveEvent.clientX, moveEvent.clientY);
            if (!hit)
              return;
            const edges = columnEdges(columnIndex, event.id);
            let start = item.start;
            let end = item.end;
            if (edge === "end") {
              end = Math.max(magnetOrSnap(hit.minutes, "ceil", edges), start + snapStep);
            } else {
              start = Math.min(magnetOrSnap(hit.minutes, "floor", edges), end - snapStep);
            }
            pending = { start, end };
            node.style.top = `${(start - startMinutes) * pxPerMinute}px`;
            node.style.height = `${(end - start) * pxPerMinute}px`;
            const key = `${start}:${end}`;
            if (key !== resizeKey) {
              resizeKey = key;
              const decision = host.checkInteraction({
                action: "resize",
                event,
                start: zonedDateTimeAt(column.date, start, timeZone),
                end: zonedDateTimeAt(column.date, end, timeZone),
                resourceId: column.resource?.id ?? null
              });
              resizeOk = decision.ok;
              node.classList.toggle("cv-invalid", !decision.ok);
              if (decision.reason)
                node.dataset.reason = decision.reason;
              else
                delete node.dataset.reason;
            }
          };
          const onUp = (upEvent) => {
            node.removeEventListener("pointermove", onMove);
            node.removeEventListener("pointercancel", onCancel);
            if (longPressConsumed) {
              node.style.top = savedTop;
              node.style.height = savedHeight;
              return;
            }
            if (!moved || !pending)
              return;
            node.classList.remove("cv-invalid");
            delete node.dataset.reason;
            if (!resizeOk) {
              node.style.top = savedTop;
              node.style.height = savedHeight;
              suppressClick = true;
              return;
            }
            const startZoned = toZonedDateTime(event.start, timeZone);
            const endZoned = toZonedDateTime(event.end, timeZone);
            const isFirstDay = Temporal2.PlainDate.compare(column.date, startZoned.toPlainDate()) === 0;
            const isLastDay = Temporal2.PlainDate.compare(column.date, endZoned.toPlainDate()) === 0;
            if (edge === "start" && !isFirstDay || edge === "end" && !isLastDay) {
              node.style.top = savedTop;
              node.style.height = savedHeight;
              return;
            }
            suppressClick = true;
            const nextStart = edge === "start" ? zonedDateTimeAt(column.date, pending.start, timeZone) : startZoned;
            const nextEnd = edge === "end" ? zonedDateTimeAt(column.date, pending.end, timeZone) : endZoned;
            if (Temporal2.ZonedDateTime.compare(nextEnd, nextStart) <= 0) {
              node.style.top = savedTop;
              node.style.height = savedHeight;
              suppressClick = false;
              return;
            }
            const result = host.commitEventResize({
              event,
              previous: { start: event.start, end: event.end, resourceId: event.resourceId ?? null },
              current: {
                start: nextStart,
                end: nextEnd,
                resourceId: event.resourceId ?? null
              },
              nativeEvent: upEvent
            });
            if (!result) {
              node.style.top = savedTop;
              node.style.height = savedHeight;
            }
          };
          const onCancel = (_cancelEvent) => {
            node.removeEventListener("pointermove", onMove);
            node.removeEventListener("pointerup", onUp);
            node.style.top = savedTop;
            node.style.height = savedHeight;
            node.classList.remove("cv-invalid");
            delete node.dataset.reason;
            longPressConsumed = false;
            suppressClick = false;
          };
          node.addEventListener("pointermove", onMove);
          node.addEventListener("pointerup", onUp);
          node.addEventListener("pointercancel", onCancel);
        }, beginDrag = function(nativeEvent) {
          if (nativeEvent.button !== 0)
            return;
          if (nativeEvent.target instanceof Element && nativeEvent.target.closest(".cv-resize-handle")) {
            return;
          }
          const downHit = columnHit(column, body, nativeEvent.clientX, nativeEvent.clientY);
          if (!downHit)
            return;
          const startGate = host.checkInteraction({
            action: "move",
            event,
            start: event.start,
            end: event.end,
            resourceId: event.resourceId ?? null,
            allDay: event.allDay === true
          });
          if (!startGate.ok)
            return;
          tryCapture(node, nativeEvent.pointerId);
          const duration = item.end - item.start;
          const grabOffset = downHit.minutes - item.start;
          const downX = nativeEvent.clientX;
          const downY = nativeEvent.clientY;
          const scroller = body.closest(".cv-scroller");
          const autoscroll = scroller ? createAutoscroller(scroller) : null;
          let moved = false;
          let mirror = null;
          let pending = null;
          let dragKey = `${columnIndex}:${item.start}`;
          let dragOk = true;
          const onMove = (moveEvent) => {
            if (longPressConsumed)
              return;
            if (Math.hypot(moveEvent.clientX - downX, moveEvent.clientY - downY) >= 4)
              moved = true;
            if (!moved)
              return;
            if (!mirror) {
              mirror = node.cloneNode(true);
              mirror.classList.add("cv-drag-mirror");
              mirror.classList.remove("cv-drag-source");
              mirror.tabIndex = -1;
              mirror.setAttribute("aria-hidden", "true");
              node.classList.add("cv-drag-source");
            }
            autoscroll?.update(moveEvent.clientY);
            const hit = gridHit(moveEvent.clientX, moveEvent.clientY);
            if (hit)
              node.removeAttribute("data-dropout");
            else
              node.setAttribute("data-dropout", "true");
            if (!hit)
              return;
            const raw = hit.minutes - grabOffset;
            const target = bodies[hit.column];
            const start = Math.min(Math.max(magnetOrSnap(raw, "floor", columnEdges(hit.column, event.id)), startMinutes), endMinutes - duration);
            const droppable = target.column.resource?.droppable !== false;
            pending = { start, end: start + duration, column: target.column, droppable };
            if (mirror.parentNode !== target.body)
              target.body.append(mirror);
            mirror.style.top = `${(start - startMinutes) * pxPerMinute}px`;
            mirror.style.height = `${duration * pxPerMinute}px`;
            const key = `${hit.column}:${start}`;
            if (key !== dragKey) {
              dragKey = key;
              const decision = host.checkInteraction({
                action: "move",
                event,
                start: zonedDateTimeAt(target.column.date, start, timeZone),
                end: zonedDateTimeAt(target.column.date, start + duration, timeZone),
                resourceId: target.column.resource?.id ?? null
              });
              dragOk = decision.ok;
              if (decision.reason)
                mirror.dataset.reason = decision.reason;
              else
                delete mirror.dataset.reason;
            }
            mirror.classList.toggle("cv-invalid", !droppable || !dragOk);
          };
          const cleanup = () => {
            node.removeEventListener("pointermove", onMove);
            node.removeEventListener("pointerup", onUp);
            node.removeEventListener("pointercancel", onCancel);
            autoscroll?.stop();
            mirror?.remove();
            node.classList.remove("cv-drag-source");
            node.removeAttribute("data-dropout");
          };
          const onUp = (upEvent) => {
            const wasMoved = moved;
            const range = pending;
            cleanup();
            if (longPressConsumed)
              return;
            if (!wasMoved)
              return;
            if (!gridHit(upEvent.clientX, upEvent.clientY)) {
              suppressClick = true;
              root.dispatchEvent(new CustomEvent("calendar:eventdropout", {
                bubbles: true,
                composed: true,
                cancelable: true,
                detail: { event, eventId: event.id, nativeEvent: upEvent }
              }));
              return;
            }
            if (!range)
              return;
            if (!range.droppable)
              return;
            if (!dragOk) {
              suppressClick = true;
              return;
            }
            suppressClick = true;
            const dayDelta = range.column.date.since(column.date).days;
            const minuteDelta = range.start - item.start;
            const startZoned = toZonedDateTime(event.start, timeZone);
            const endZoned = toZonedDateTime(event.end, timeZone);
            host.commitEventMove({
              event,
              previous: { start: event.start, end: event.end, resourceId: event.resourceId ?? null },
              current: {
                start: startZoned.add({ days: dayDelta, minutes: minuteDelta }),
                end: endZoned.add({ days: dayDelta, minutes: minuteDelta }),
                resourceId: range.column.resource?.id ?? null
              },
              nativeEvent: upEvent
            });
          };
          const onCancel = (_cancelEvent) => {
            cleanup();
            longPressConsumed = false;
            suppressClick = false;
          };
          node.addEventListener("pointermove", onMove);
          node.addEventListener("pointerup", onUp);
          node.addEventListener("pointercancel", onCancel);
        };
        const { event } = item;
        const geometry = eventGeometry({
          startMinutes: item.start,
          endMinutes: item.end,
          dayStartMinutes: startMinutes,
          pxPerMinute
        });
        const node = document.createElement("button");
        node.type = "button";
        node.className = ["cv-event", ...event.classNames ?? []].join(" ");
        node.dataset.eventId = event.id;
        const nodeState = stateOf(event);
        node.dataset.temporalState = nodeState;
        node.style.top = `${geometry.top}px`;
        node.style.height = `${geometry.height}px`;
        node.style.insetInlineStart = `${item.left * 100}%`;
        node.style.width = `${item.width * 100}%`;
        node.setAttribute("aria-label", describeEvent(event, timeZone, labels.untitledEvent));
        const content = eventContent?.({
          event,
          date: column.date,
          resource: column.resource,
          temporalState: nodeState,
          element: node
        });
        if (content instanceof Node)
          node.append(content);
        else
          node.textContent = content == null ? event.title ?? labels.untitledEvent : String(content);
        node.addEventListener("click", (nativeEvent) => {
          if (suppressClick) {
            suppressClick = false;
            longPressConsumed = false;
            nativeEvent.stopPropagation();
            nativeEvent.preventDefault();
            return;
          }
          node.dispatchEvent(new CustomEvent("calendar:eventclick", {
            bubbles: true,
            composed: true,
            cancelable: true,
            detail: { event, date: column.date, resource: column.resource, nativeEvent }
          }));
        }, true);
        const movable = isMovable(event, host.editable);
        const resizable = isResizable(event, host.editable);
        node.addEventListener("contextmenu", (nativeEvent) => {
          dispatchContextMenu(node, {
            event,
            date: column.date,
            resourceId: column.resource?.id ?? null,
            clientX: nativeEvent.clientX,
            clientY: nativeEvent.clientY
          }, nativeEvent);
        });
        watchLongPress(node, (press) => {
          dispatchContextMenu(node, {
            event,
            date: column.date,
            resourceId: column.resource?.id ?? null,
            clientX: press.clientX,
            clientY: press.clientY
          }, press);
        });
        node.addEventListener("keydown", onEventKeyDown);
        const resizeAllowed = resizable && host.checkInteraction({
          action: "resize",
          event,
          start: event.start,
          end: event.end,
          resourceId: event.resourceId ?? null,
          allDay: event.allDay === true
        }).ok;
        if (resizeAllowed) {
          for (const edge of ["start", "end"]) {
            const handle = document.createElement("div");
            handle.className = `cv-resize-handle cv-resize-${edge === "start" ? "n" : "s"}`;
            node.append(handle);
            handle.addEventListener("pointerdown", (nativeEvent) => {
              beginResize(nativeEvent, edge);
            });
          }
        }
        if (movable) {
          node.addEventListener("pointerdown", beginDrag);
        }
        body.append(node);
      }
      const canSelect = column.resource?.selectable !== false;
      if (canSelect) {
        const hover = document.createElement("div");
        hover.className = "cv-hover";
        hover.setAttribute("aria-hidden", "true");
        hover.hidden = true;
        const hoverChip = document.createElement("span");
        hoverChip.className = "cv-hover-chip";
        hover.append(hoverChip);
        body.append(hover);
        let ghost = null;
        let ghostChip = null;
        let selectKey = null;
        let selectOk = true;
        const showHover = (nativeEvent) => {
          const target = nativeEvent.target;
          const overEvent = target instanceof Element && target.closest(".cv-event") !== null;
          if (selecting || nativeEvent.buttons !== 0 || overEvent) {
            hover.hidden = true;
            return;
          }
          const hit = columnHit(column, body, nativeEvent.clientX, nativeEvent.clientY);
          if (!hit) {
            hover.hidden = true;
            return;
          }
          const snapped = snapMinutes(hit.minutes, snapStep, "floor");
          hover.style.top = `${(snapped - startMinutes) * pxPerMinute}px`;
          hover.style.height = `${defaultDuration * pxPerMinute}px`;
          hoverChip.textContent = `+ ${formatClock(snapped)}`;
          hover.hidden = false;
        };
        body.addEventListener("pointermove", showHover);
        body.addEventListener("pointerleave", () => {
          hover.hidden = true;
        });
        body.addEventListener("pointerdown", (nativeEvent) => {
          if (nativeEvent.button !== 0)
            return;
          if (nativeEvent.target instanceof Element && nativeEvent.target.closest(".cv-event"))
            return;
          const hit = columnHit(column, body, nativeEvent.clientX, nativeEvent.clientY);
          if (!hit)
            return;
          const anchor = magnetOrSnap(hit.minutes, "floor", columnEdges(columnIndex));
          const anchorStart = zonedDateTimeAt(column.date, anchor, timeZone);
          const gate = host.checkInteraction({
            action: "select",
            event: null,
            start: anchorStart,
            end: anchorStart.add({ minutes: defaultDuration }),
            resourceId: column.resource?.id ?? null
          });
          if (!gate.ok)
            return;
          selectKey = `${anchor}:${anchor + defaultDuration}`;
          selectOk = true;
          hover.hidden = true;
          tryCapture(body, nativeEvent.pointerId);
          ghost = document.createElement("div");
          ghost.className = "cv-select-ghost";
          ghost.setAttribute("aria-hidden", "true");
          ghostChip = document.createElement("span");
          ghostChip.className = "cv-select-chip";
          ghost.append(ghostChip);
          body.append(ghost);
          selecting = {
            anchor,
            downX: nativeEvent.clientX,
            downY: nativeEvent.clientY,
            moved: false,
            start: anchor,
            end: anchor
          };
        });
        body.addEventListener("pointermove", (nativeEvent) => {
          if (!selecting || !ghost || !ghostChip)
            return;
          if (Math.hypot(nativeEvent.clientX - selecting.downX, nativeEvent.clientY - selecting.downY) >= 4) {
            selecting.moved = true;
          }
          if (!selecting.moved)
            return;
          const hit = columnHit(column, body, nativeEvent.clientX, nativeEvent.clientY);
          if (!hit)
            return;
          const edges = columnEdges(columnIndex);
          const start = magnetOrSnap(Math.min(selecting.anchor, hit.minutes), "floor", edges);
          const end = Math.max(magnetOrSnap(Math.max(selecting.anchor, hit.minutes), "ceil", edges), start + snapStep);
          selecting.start = start;
          selecting.end = end;
          ghost.style.top = `${(start - startMinutes) * pxPerMinute}px`;
          ghost.style.height = `${(end - start) * pxPerMinute}px`;
          ghostChip.textContent = `${formatClock(start)} - ${formatClock(end)}`;
          const key = `${start}:${end}`;
          if (key !== selectKey) {
            selectKey = key;
            const decision = host.checkInteraction({
              action: "select",
              event: null,
              start: zonedDateTimeAt(column.date, start, timeZone),
              end: zonedDateTimeAt(column.date, end, timeZone),
              resourceId: column.resource?.id ?? null
            });
            selectOk = decision.ok;
            ghost.classList.toggle("cv-invalid", !decision.ok);
            if (decision.reason)
              ghost.dataset.reason = decision.reason;
            else
              delete ghost.dataset.reason;
          }
        });
        const finishSelection = (nativeEvent, cancelled) => {
          const wasLongPress = longPressConsumed;
          longPressConsumed = false;
          if (!selecting)
            return;
          const { anchor, moved, start, end } = selecting;
          selecting = null;
          ghost?.remove();
          ghost = null;
          ghostChip = null;
          if (cancelled || wasLongPress)
            return;
          if (moved && !selectOk) {
            suppressClick = true;
            return;
          }
          if (moved) {
            suppressClick = true;
            dispatchSelect(body, column, start, end, nativeEvent);
          } else {
            dispatchSelect(body, column, anchor, Math.min(anchor + defaultDuration, endMinutes), nativeEvent);
          }
        };
        body.addEventListener("pointerup", (nativeEvent) => finishSelection(nativeEvent, false));
        body.addEventListener("pointercancel", (nativeEvent) => finishSelection(nativeEvent, true));
        body.addEventListener("click", (nativeEvent) => {
          if (!suppressClick)
            return;
          suppressClick = false;
          nativeEvent.stopPropagation();
          nativeEvent.preventDefault();
        });
        body.addEventListener("contextmenu", (nativeEvent) => {
          if (nativeEvent.target instanceof Element && nativeEvent.target.closest(".cv-event")) {
            return;
          }
          const hit = columnHit(column, body, nativeEvent.clientX, nativeEvent.clientY);
          if (!hit)
            return;
          const snapped = snapMinutes(hit.minutes, snapStep, "floor");
          dispatchContextMenu(body, {
            event: null,
            date: column.date,
            time: zonedDateTimeAt(column.date, snapped, timeZone),
            resourceId: column.resource?.id ?? null,
            clientX: nativeEvent.clientX,
            clientY: nativeEvent.clientY
          }, nativeEvent);
        });
        watchLongPress(body, (press) => {
          selecting = null;
          ghost?.remove();
          ghost = null;
          ghostChip = null;
          const hit = columnHit(column, body, press.clientX, press.clientY);
          if (!hit)
            return;
          const snapped = snapMinutes(hit.minutes, snapStep, "floor");
          dispatchContextMenu(body, {
            event: null,
            date: column.date,
            time: zonedDateTimeAt(column.date, snapped, timeZone),
            resourceId: column.resource?.id ?? null,
            clientX: press.clientX,
            clientY: press.clientY
          }, press);
        }, (press) => press.target instanceof Element && press.target.closest(".cv-event") !== null);
      }
      const now = renderNow;
      if (column.date.toString() === now.toPlainDate().toString()) {
        const nowMinutes = now.hour * 60 + now.minute + now.second / 60;
        if (nowMinutes >= startMinutes && nowMinutes <= endMinutes) {
          const indicator = document.createElement("div");
          indicator.className = "cv-now";
          indicator.style.top = `${(nowMinutes - startMinutes) * pxPerMinute}px`;
          indicator.setAttribute("aria-hidden", "true");
          body.append(indicator);
        }
      }
      day.append(body);
      bodies.push({ column, body });
      root.append(day);
    }
    let externalGhost = null;
    function removeExternalGhost() {
      externalGhost?.node.remove();
      externalGhost = null;
    }
    function externalTargetValidity(date, time, resourceId, allDay, droppable) {
      if (!droppable)
        return { ok: false, reason: null };
      const external = host.getExternalDrag();
      const result = external?.meta.validate?.({ date, time, resourceId, allDay });
      if (result === false)
        return { ok: false, reason: null };
      if (typeof result === "string")
        return { ok: false, reason: result };
      return { ok: true, reason: null };
    }
    function resolveExternal(clientX, clientY) {
      const external = host.getExternalDrag();
      if (!external)
        return null;
      const meta = external.meta;
      if (meta.allDay === true || columnIndexAtX(clientX) >= 0 && isOverLane(clientY)) {
        const index = columnIndexAtX(clientX);
        if (index < 0)
          return null;
        const column = columns[index];
        const resourceId = column.resource?.id ?? null;
        const policy = host.checkInteraction({
          action: "external",
          event: null,
          start: column.date,
          end: column.date.add({ days: 1 }),
          resourceId,
          allDay: true
        });
        if (!policy.ok) {
          return {
            kind: "lane",
            index,
            target: { date: column.date, time: null, resourceId, allDay: true },
            ok: false,
            reason: policy.reason
          };
        }
        const validity = externalTargetValidity(column.date, null, resourceId, true, column.resource?.droppable !== false);
        return {
          kind: "lane",
          index,
          target: { date: column.date, time: null, resourceId, allDay: true },
          ok: validity.ok,
          reason: validity.reason
        };
      }
      const hit = gridHit(clientX, clientY);
      if (!hit)
        return null;
      const rawDuration = meta.duration ?? options.defaultTimedEventDuration ?? { minutes: 30 };
      const duration = durationMinutes(typeof rawDuration === "number" ? { minutes: rawDuration } : rawDuration);
      if (duration > endMinutes - startMinutes)
        return null;
      const start = Math.max(startMinutes, Math.min(snapMinutes(hit.minutes, snapStep, "floor"), endMinutes - duration));
      if (start < startMinutes)
        return null;
      const end = start + duration;
      const column = columns[hit.column];
      const time = zonedDateTimeAt(column.date, start, timeZone);
      const resourceId = column.resource?.id ?? null;
      const policy = host.checkInteraction({
        action: "external",
        event: null,
        start: time,
        end: time.add({ minutes: duration }),
        resourceId
      });
      if (!policy.ok) {
        return {
          kind: "grid",
          index: hit.column,
          start,
          end,
          time,
          target: { date: column.date, time, resourceId, allDay: false },
          ok: false,
          reason: policy.reason
        };
      }
      const validity = externalTargetValidity(column.date, time, resourceId, false, column.resource?.droppable !== false);
      return {
        kind: "grid",
        index: hit.column,
        start,
        end,
        time,
        target: { date: column.date, time, resourceId, allDay: false },
        ok: validity.ok,
        reason: validity.reason
      };
    }
    function isOverLane(clientY) {
      const rect = lane.getBoundingClientRect();
      return rect.height > 0 && clientY >= rect.top && clientY <= rect.bottom;
    }
    function paintExternalGhost(placement) {
      removeExternalGhost();
      const external = host.getExternalDrag();
      if (!placement)
        return;
      let node;
      if (placement.kind === "grid") {
        node = document.createElement("div");
        node.className = "cv-external-ghost";
        node.setAttribute("aria-hidden", "true");
        node.style.top = `${(placement.start - startMinutes) * pxPerMinute}px`;
        node.style.height = `${(placement.end - placement.start) * pxPerMinute}px`;
        if (external?.meta.title) {
          const label = document.createElement("span");
          label.className = "cv-external-ghost-label";
          label.textContent = external.meta.title;
          node.append(label);
        }
        bodies[placement.index].body.append(node);
      } else {
        node = document.createElement("div");
        node.className = "cv-external-ghost cv-external-ghost-lane";
        node.setAttribute("aria-hidden", "true");
        node.style.gridColumn = `${placement.index + 2} / ${placement.index + 3}`;
        node.style.gridRow = "1 / -1";
        if (external?.meta.title)
          node.textContent = external.meta.title;
        lane.append(node);
      }
      if (!placement.ok) {
        node.classList.add("cv-invalid");
        if (placement.reason)
          node.dataset.reason = placement.reason;
      }
      externalGhost = { kind: placement.kind, node };
    }
    root.addEventListener("dragover", (event) => {
      if (!host.getExternalDrag())
        return;
      event.preventDefault();
      if (event.dataTransfer)
        event.dataTransfer.dropEffect = "copy";
      paintExternalGhost(resolveExternal(event.clientX, event.clientY));
    });
    root.addEventListener("dragleave", (event) => {
      if (!host.getExternalDrag())
        return;
      const related = event.relatedTarget;
      if (related instanceof Node && root.contains(related))
        return;
      removeExternalGhost();
    });
    root.addEventListener("drop", (event) => {
      const external = host.getExternalDrag();
      if (!external)
        return;
      event.preventDefault();
      const placement = resolveExternal(event.clientX, event.clientY);
      removeExternalGhost();
      if (!placement?.ok)
        return;
      const contextRange = placement.kind === "grid" ? {
        start: placement.time,
        end: placement.time.add({ minutes: placement.end - placement.start }),
        resourceId: placement.target.resourceId
      } : {
        start: placement.target.date,
        end: placement.target.date.add({ days: 1 }),
        resourceId: placement.target.resourceId
      };
      root.dispatchEvent(new CustomEvent("calendar:externaldrop", {
        bubbles: true,
        composed: true,
        cancelable: true,
        detail: {
          payload: external.payload,
          date: placement.target.date,
          ...placement.kind === "grid" ? { time: placement.target.time, resourceId: placement.target.resourceId } : { resourceId: placement.target.resourceId, allDay: true },
          context: host.getRangeContext(contextRange),
          nativeEvent: event
        }
      }));
    });
    fragment.append(root);
    return fragment;
  }

  // src/calendar-view.js
  var DEFAULTS = {
    view: "week",
    timeZone: "UTC",
    slotMin: "08:00",
    slotMax: "18:00",
    slotDuration: 20,
    slotLabelInterval: 60,
    pxPerMinute: 1.8,
    snapDuration: Temporal2.Duration.from({ minutes: 15 }),
    defaultTimedEventDuration: Temporal2.Duration.from({ minutes: 30 })
  };
  var MAX_TIMEOUT_MS = 2147483647;
  function targetDate(start, timeZone) {
    if (start instanceof Temporal2.PlainDate)
      return start;
    if (typeof start === "string" && /^\d{4}-\d{2}-\d{2}$/.test(start)) {
      return Temporal2.PlainDate.from(start);
    }
    return toZonedDateTime(start, timeZone).toPlainDate();
  }
  var dates = { getMonthWeeks, startOfWeek, toPlainDate };

  class CalendarViewElement extends HTMLElement {
    static observedAttributes = ["view", "date", "lang", "slot-min", "slot-max", "slot-duration"];
    static dates = dates;
    #events = [];
    #resources = [];
    #backgrounds = [];
    #externalDrops = new Map;
    #dragExternal = null;
    #config = {};
    #abortController = null;
    #requestVersion = 0;
    #batchDepth = 0;
    #renderQueued = false;
    #afterRenderQueue = [];
    #pendingAnnounce = null;
    #announceFrame = null;
    #agingTimer = null;
    #revealTimer = null;
    connectedCallback() {
      this.classList.add("calendar-view");
      if (!this.hasAttribute("date")) {
        const timeZone = this.#config.timeZone ?? DEFAULTS.timeZone;
        this.setAttribute("date", Temporal2.Now.plainDateISO(timeZone).toString());
      }
      this.#queueRender();
    }
    disconnectedCallback() {
      this.#abortController?.abort();
      this.#afterRenderQueue = [];
      this.#pendingAnnounce = null;
      if (this.#announceFrame !== null) {
        cancelAnimationFrame(this.#announceFrame);
        this.#announceFrame = null;
      }
      if (this.#agingTimer !== null) {
        clearTimeout(this.#agingTimer);
        this.#agingTimer = null;
      }
      if (this.#revealTimer !== null) {
        clearTimeout(this.#revealTimer);
        this.#revealTimer = null;
      }
    }
    attributeChangedCallback() {
      if (this.isConnected)
        this.#queueRender();
    }
    configure(options = {}) {
      this.#config = { ...this.#config, ...options };
      this.#queueRender();
      return this;
    }
    get view() {
      return this.getAttribute("view") || DEFAULTS.view;
    }
    set view(value) {
      this.setView(value);
    }
    get date() {
      return toPlainDate(this.getAttribute("date"));
    }
    set date(value) {
      this.gotoDate(value);
    }
    get events() {
      return [...this.#events];
    }
    set events(value) {
      this.#events = Array.from(value ?? [], normalizeEvent);
      this.#queueRender();
    }
    get resources() {
      return [...this.#resources];
    }
    set resources(value) {
      this.#resources = Array.from(value ?? [], normalizeResource);
      this.#queueRender();
    }
    get backgrounds() {
      return [...this.#backgrounds];
    }
    set backgrounds(value) {
      this.#backgrounds = Array.from(value ?? [], normalizeBackground);
      this.#queueRender();
    }
    setView(view) {
      const oldView = this.view;
      if (oldView === view)
        return;
      this.setAttribute("view", view);
      this.dispatchEvent(new CustomEvent("calendar:viewchange", { detail: { oldView, view } }));
      this.#announce(`${view}, ${this.getAttribute("date")}`);
      this.refetchEvents();
    }
    async gotoDate(value) {
      const next = toPlainDate(value).toString();
      const previous = this.getAttribute("date");
      if (previous === next)
        return;
      this.setAttribute("date", next);
      this.dispatchEvent(new CustomEvent("calendar:datechange", { detail: { date: toPlainDate(next) } }));
      this.#announce(`${this.view}, ${next}`);
      return this.refetchEvents();
    }
    getVisibleRange() {
      return getViewRange(this.date, this.view, this.#dateOptions());
    }
    prev() {
      this.gotoDate(stepAnchor(this.date, this.view, -1, this.#dateOptions()));
    }
    next() {
      this.gotoDate(stepAnchor(this.date, this.view, 1, this.#dateOptions()));
    }
    today() {
      const timeZone = this.#config.timeZone ?? DEFAULTS.timeZone;
      this.gotoDate(Temporal2.Now.plainDateISO(timeZone));
    }
    scrollToTime(value) {
      const scroller = this.querySelector(".cv-scroller");
      if (!scroller)
        return 0;
      const options = this.#options();
      const startMinutes = minutesFromMidnight(options.slotMin);
      const top = Math.max(0, (minutesFromMidnight(value) - startMinutes) * options.pxPerMinute);
      scroller.scrollTop = top;
      return top;
    }
    getEventById(id) {
      return this.#events.find((event) => event.id === String(id)) ?? null;
    }
    revealEvent(id, options = {}) {
      const key = String(id);
      if (this.#revealNode(key, options))
        return true;
      const event = this.getEventById(key);
      if (!event || !this.isConnected)
        return false;
      if (!this.#isDateRendered(targetDate(event.start, this.#config.timeZone ?? DEFAULTS.timeZone))) {
        return false;
      }
      this.#afterRender(() => {
        this.#revealNode(key, options);
      });
      return true;
    }
    async reveal(input) {
      const eventId = input?.eventId;
      if (eventId === undefined || eventId === null || String(eventId) === "") {
        throw new TypeError("reveal() requires an eventId; range-only navigation is gotoDate().");
      }
      const anchorInput = input?.date ?? input?.start;
      if (anchorInput === undefined || anchorInput === null) {
        throw new TypeError("reveal() requires a date or start anchor.");
      }
      const timeZone = this.#config.timeZone ?? DEFAULTS.timeZone;
      const requested = toPlainDate(anchorInput instanceof Temporal2.PlainDate || typeof anchorInput === "string" ? anchorInput : targetDate(anchorInput, timeZone)).toString();
      const key = String(eventId);
      const options = { focus: input?.focus ?? false, highlight: input?.highlight ?? true };
      if (this.date.toString() === requested && this.getEventById(key) && this.#revealNode(key, options)) {
        return true;
      }
      if (!this.isConnected)
        return false;
      if (this.date.toString() !== requested) {
        await this.gotoDate(requested);
      } else if (!this.getEventById(key)) {
        await this.refetchEvents();
      }
      if (!this.isConnected || this.date.toString() !== requested)
        return false;
      if (this.#revealNode(key, options))
        return true;
      return new Promise((resolve) => {
        this.#afterRender(() => {
          const zone = this.#config.timeZone ?? DEFAULTS.timeZone;
          const event = this.getEventById(key);
          if (!this.isConnected || !event) {
            resolve(false);
            return;
          }
          this.#announce(describeEvent(event, zone, this.#options().labels.untitledEvent));
          this.#afterRender(() => {
            if (!this.isConnected) {
              resolve(false);
              return;
            }
            const fresh = this.querySelector(`[data-event-id="${CSS.escape(key)}"]`);
            if (fresh instanceof HTMLElement)
              this.#applyRevealVisuals(event, fresh, options);
            resolve(true);
          });
        });
      });
    }
    #revealNode(id, options = {}) {
      if (!this.isConnected)
        return false;
      const event = this.getEventById(id);
      if (!event)
        return false;
      const node = this.querySelector(`[data-event-id="${CSS.escape(id)}"]`);
      if (!(node instanceof HTMLElement))
        return false;
      const timeZone = this.#config.timeZone ?? DEFAULTS.timeZone;
      this.#announce(describeEvent(event, timeZone, this.#options().labels.untitledEvent));
      this.#afterRender(() => {
        if (!this.isConnected)
          return;
        const fresh = this.querySelector(`[data-event-id="${CSS.escape(id)}"]`);
        if (!(fresh instanceof HTMLElement))
          return;
        this.#applyRevealVisuals(event, fresh, options);
      });
      return true;
    }
    #applyRevealVisuals(event, node, options = {}) {
      const { focus = false, highlight = true } = options;
      const timeZone = this.#config.timeZone ?? DEFAULTS.timeZone;
      if (this.view !== "month" && this.view !== "list" && event.allDay !== true) {
        this.scrollToTime(toZonedDateTime(event.start, timeZone).toPlainTime());
      }
      node.scrollIntoView({ block: "nearest", inline: "nearest" });
      if (highlight) {
        if (this.#revealTimer !== null) {
          clearTimeout(this.#revealTimer);
          this.#revealTimer = null;
        }
        node.classList.add("cv-reveal");
        node.dataset.revealed = "true";
        this.#revealTimer = window.setTimeout(() => {
          this.#revealTimer = null;
          if (!node.isConnected)
            return;
          node.classList.remove("cv-reveal");
          delete node.dataset.revealed;
        }, 2000);
      }
      if (focus)
        node.focus({ preventScroll: true });
    }
    #isDateRendered(date) {
      const wanted = date.toString();
      return getVisibleDates(this.date, this.view, this.#dateOptions()).some((rendered) => rendered.toString() === wanted);
    }
    getEventOverlaps(range, options = {}) {
      const timeZone = this.#config.timeZone ?? DEFAULTS.timeZone;
      return queryOverlaps({
        events: this.#events,
        backgrounds: this.#backgrounds,
        range,
        timeZone,
        resourceIds: options.resourceIds ?? [],
        includeBackgrounds: options.includeBackgrounds ?? false,
        filter: options.filter
      });
    }
    getRangeContext(range) {
      const timeZone = this.#config.timeZone ?? DEFAULTS.timeZone;
      return queryRangeContext({
        events: this.#events,
        backgrounds: this.#backgrounds,
        range,
        timeZone,
        resourceId: range?.resourceId ?? null
      });
    }
    checkInteraction({ action, event, start, end, resourceId, allDay = false }) {
      const timeZone = this.#config.timeZone ?? DEFAULTS.timeZone;
      const policy = this.#config.interactionPolicy;
      if (typeof policy !== "function")
        return { ok: true, reason: null };
      const context = this.getRangeContext({ start, end, resourceId });
      const target = {
        start,
        end,
        date: targetDate(start, timeZone),
        time: allDay ? null : toZonedDateTime(start, timeZone),
        resourceId: resourceId ?? null,
        allDay
      };
      const now = Temporal2.Now.zonedDateTimeISO(timeZone);
      return normalizePolicyDecision(policy({ action, event, target, context, now }));
    }
    #commitEventMutation({ event, previous, current, name, nativeEvent }) {
      const id = event.id;
      const before = this.getEventById(id);
      if (!before)
        return null;
      const allDay = before.allDay === true;
      const optimistic = {
        start: normalizeRangeBound(current.start, allDay),
        end: normalizeRangeBound(current.end, allDay),
        resourceId: current.resourceId
      };
      const restored = { start: before.start, end: before.end, resourceId: before.resourceId ?? null };
      const apply = (state) => {
        this.#events = this.#events.map((item) => item.id === id ? { ...item, ...state } : item);
        this.#queueRender();
      };
      apply(optimistic);
      let reverted = false;
      const revert = () => {
        if (reverted)
          return;
        reverted = true;
        const live = this.getEventById(id);
        if (!live || !sameRange(live, optimistic))
          return;
        apply(restored);
      };
      const accepted = this.dispatchEvent(new CustomEvent(name, {
        bubbles: true,
        composed: true,
        cancelable: true,
        detail: {
          event: this.getEventById(id),
          previous,
          current,
          context: this.getRangeContext(current),
          nativeEvent,
          revert
        }
      }));
      if (!accepted)
        revert();
      return reverted ? null : this.getEventById(id);
    }
    #commitEventMove({ event, previous, current, nativeEvent = null }) {
      return this.#commitEventMutation({ event, previous, current, name: "calendar:eventmove", nativeEvent });
    }
    #commitEventResize({ event, previous, current, nativeEvent = null }) {
      return this.#commitEventMutation({ event, previous, current, name: "calendar:eventresize", nativeEvent });
    }
    moveEvent(id, current) {
      const event = this.getEventById(id);
      if (!event || !isMovable(event, this.#config.editable))
        return null;
      return this.#commitEventMove({
        event,
        previous: { start: event.start, end: event.end, resourceId: event.resourceId ?? null },
        current: {
          start: current.start ?? event.start,
          end: current.end ?? event.end,
          resourceId: current.resourceId ?? event.resourceId ?? null
        }
      });
    }
    resizeEvent(id, current) {
      const event = this.getEventById(id);
      if (!event || !isResizable(event, this.#config.editable))
        return null;
      if (event.allDay)
        return null;
      return this.#commitEventResize({
        event,
        previous: { start: event.start, end: event.end, resourceId: event.resourceId ?? null },
        current: {
          start: current.start ?? event.start,
          end: current.end ?? event.end,
          resourceId: event.resourceId ?? null
        }
      });
    }
    addEvent(event) {
      const normalized = normalizeEvent(event);
      this.#events = [...this.#events, normalized];
      this.#queueRender();
      return normalized;
    }
    updateEvent(event) {
      const normalized = normalizeEvent(event);
      const index = this.#events.findIndex((item) => item.id === normalized.id);
      if (index < 0)
        return this.addEvent(normalized);
      this.#events = this.#events.map((item, i) => i === index ? { ...this.#events[index], ...normalized } : item);
      this.#queueRender();
      return this.#events[index];
    }
    removeEvent(id) {
      const key = String(id);
      const next = this.#events.filter((event) => event.id !== key);
      if (next.length === this.#events.length)
        return false;
      this.#events = next;
      this.#queueRender();
      return true;
    }
    addExternalDrop(element, payload, meta = {}) {
      if (this.#externalDrops.has(element))
        return this;
      element.draggable = true;
      const entry = { payload, meta };
      const onStart = (event) => {
        this.#dragExternal = entry;
        event.dataTransfer?.setData("text/plain", String(payload ?? ""));
        if (event.dataTransfer)
          event.dataTransfer.effectAllowed = "copy";
      };
      const onEnd = () => {
        this.#dragExternal = null;
      };
      element.addEventListener("dragstart", onStart);
      element.addEventListener("dragend", onEnd);
      this.#externalDrops.set(element, { ...entry, onStart, onEnd });
      return this;
    }
    removeExternalDrop(element) {
      const entry = this.#externalDrops.get(element);
      if (!entry)
        return false;
      element.removeEventListener("dragstart", entry.onStart);
      element.removeEventListener("dragend", entry.onEnd);
      element.draggable = false;
      this.#externalDrops.delete(element);
      if (this.#dragExternal?.payload === entry.payload)
        this.#dragExternal = null;
      return true;
    }
    batch(callback) {
      this.#batchDepth += 1;
      try {
        return callback();
      } finally {
        this.#batchDepth -= 1;
        if (this.#batchDepth === 0)
          this.#queueRender();
      }
    }
    async refetchEvents() {
      const eventSource = this.#config.eventSource;
      const backgroundSource = this.#config.backgroundSource;
      if (!eventSource && !backgroundSource)
        return;
      this.#abortController?.abort();
      const controller = new AbortController;
      this.#abortController = controller;
      const version = ++this.#requestVersion;
      const { start, end } = this.getVisibleRange();
      const resourceIds = this.#resources.map((resource) => resource.id);
      const context = { start, end, resourceIds, signal: controller.signal, calendar: this };
      this.setAttribute("aria-busy", "true");
      this.#announceLoading(true);
      try {
        const [events, backgrounds] = await Promise.all([
          eventSource ? eventSource(context) : null,
          backgroundSource ? backgroundSource(context) : null
        ]);
        if (controller.signal.aborted || version !== this.#requestVersion)
          return;
        if (eventSource) {
          this.#events = Array.from(events ?? [], normalizeEvent);
        }
        if (backgroundSource) {
          this.#backgrounds = Array.from(backgrounds ?? [], normalizeBackground);
        }
        this.#queueRender();
      } catch (error) {
        if (controller.signal.aborted)
          return;
        this.dispatchEvent(new CustomEvent("calendar:loaderror", { detail: { error } }));
      } finally {
        if (version === this.#requestVersion) {
          this.removeAttribute("aria-busy");
          this.#announceLoading(false);
        }
      }
    }
    #announceLoading(loading) {
      this.dispatchEvent(new CustomEvent("calendar:loading", {
        bubbles: true,
        composed: true,
        detail: { loading }
      }));
    }
    #queueRender() {
      if (this.#batchDepth || this.#renderQueued)
        return;
      this.#renderQueued = true;
      requestAnimationFrame(() => {
        this.#renderQueued = false;
        if (!this.isConnected)
          return;
        this.#render();
      });
    }
    #afterRender(callback) {
      this.#afterRenderQueue.push(callback);
      this.#queueRender();
    }
    #announce(message) {
      this.#pendingAnnounce = message;
      this.#afterRender(() => {
        if (this.#announceFrame !== null)
          cancelAnimationFrame(this.#announceFrame);
        this.#announceFrame = requestAnimationFrame(() => {
          this.#announceFrame = null;
          if (!this.isConnected)
            return;
          const pending = this.#pendingAnnounce;
          this.#pendingAnnounce = null;
          if (pending === null)
            return;
          const status = this.querySelector(".cv-status");
          if (status)
            status.textContent = pending;
        });
      });
    }
    #refocusEvent(id) {
      this.#afterRender(() => {
        if (!this.isConnected)
          return;
        this.querySelector(`[data-event-id="${CSS.escape(id)}"]`)?.focus();
      });
    }
    #dateOptions() {
      return {
        firstDay: this.#config.firstDay,
        hiddenDays: this.#config.hiddenDays,
        locale: resolveLocale(this.#config.locale)
      };
    }
    #resolveLocale() {
      const docLang = typeof document === "undefined" ? undefined : document.documentElement?.lang;
      return resolveLocale(this.#config.locale ?? this.getAttribute("lang") ?? docLang);
    }
    #options() {
      return {
        timeZone: this.#config.timeZone ?? DEFAULTS.timeZone,
        locale: this.#resolveLocale(),
        labels: resolveLabels(this.#config.labels),
        editable: this.#config.editable,
        slotMin: this.getAttribute("slot-min") || DEFAULTS.slotMin,
        slotMax: this.getAttribute("slot-max") || DEFAULTS.slotMax,
        slotDuration: Number(this.getAttribute("slot-duration") || DEFAULTS.slotDuration),
        slotLabelInterval: this.#config.slotLabelInterval ?? DEFAULTS.slotLabelInterval,
        pxPerMinute: this.#config.pxPerMinute ?? DEFAULTS.pxPerMinute,
        snapDuration: this.#config.snapDuration ?? DEFAULTS.snapDuration,
        defaultTimedEventDuration: this.#config.defaultTimedEventDuration ?? DEFAULTS.defaultTimedEventDuration,
        monthEventLimit: this.#config.monthEventLimit ?? 3,
        allDaySlot: this.#config.allDaySlot ?? true
      };
    }
    #render() {
      const options = this.#options();
      const dateOptions = this.#dateOptions();
      const dates2 = getVisibleDates(this.date, this.view, dateOptions);
      const resources = isResourceView(this.view) ? this.#resources : [];
      const now = Temporal2.Now.zonedDateTimeISO(options.timeZone);
      const scroll = this.querySelector(".cv-scroller");
      const scrollTop = scroll?.scrollTop ?? 0;
      const scrollLeft = scroll?.scrollLeft ?? 0;
      const status = this.querySelector(":scope > .cv-status") ?? document.createElement("p");
      status.className = "cv-status";
      status.setAttribute("role", "status");
      this.replaceChildren();
      this.dataset.view = this.view;
      const scroller = document.createElement("div");
      scroller.className = "cv-scroller";
      scroller.setAttribute("role", "region");
      scroller.setAttribute("aria-label", options.labels.calendarRegion);
      let visibleScope = null;
      if (this.view === "month") {
        const weeks = getMonthWeeks(this.date, dateOptions);
        scroller.append(renderMonthGrid({
          weeks,
          month: this.date.month,
          events: this.#events,
          options,
          now,
          eventContent: this.#config.eventContent,
          moreLinkContent: this.#config.moreLinkContent,
          getRangeContext: (range) => this.getRangeContext(range)
        }));
        visibleScope = {
          start: weeks[0][0],
          end: weeks[weeks.length - 1][weeks[weeks.length - 1].length - 1].add({ days: 1 })
        };
      } else if (this.view === "list") {
        if (dates2.length > 0) {
          visibleScope = { start: dates2[0], end: dates2[dates2.length - 1].add({ days: 1 }) };
        }
        scroller.append(renderList({
          dates: dates2,
          events: this.#events,
          options,
          now,
          eventContent: this.#config.eventContent,
          dayHeaderContent: this.#config.dayHeaderContent
        }));
      } else {
        if (dates2.length > 0) {
          visibleScope = { start: dates2[0], end: dates2[dates2.length - 1].add({ days: 1 }) };
        }
        scroller.append(renderTimeGrid({
          dates: dates2,
          resources,
          view: this.view,
          events: this.#events,
          backgrounds: this.#backgrounds,
          options,
          now,
          host: {
            editable: this.#config.editable,
            isConnected: () => this.isConnected,
            announce: (message) => this.#announce(message),
            refocusEvent: (id) => this.#refocusEvent(id),
            getRangeContext: (range) => this.getRangeContext(range),
            checkInteraction: (input) => this.checkInteraction(input),
            commitEventMove: (input) => this.#commitEventMove(input),
            commitEventResize: (input) => this.#commitEventResize(input),
            getExternalDrag: () => this.#dragExternal,
            clearExternalDrag: () => {
              this.#dragExternal = null;
            }
          },
          eventContent: this.#config.eventContent,
          dayHeaderContent: this.#config.dayHeaderContent,
          resourceHeaderContent: this.#config.resourceHeaderContent,
          slotLabelContent: this.#config.slotLabelContent
        }));
      }
      this.append(scroller);
      scroller.scrollTop = scrollTop;
      scroller.scrollLeft = scrollLeft;
      this.append(status);
      this.dispatchEvent(new CustomEvent("calendar:render", {
        bubbles: true,
        composed: true,
        detail: { view: this.view, dates: dates2, resources }
      }));
      const pending = this.#afterRenderQueue;
      this.#afterRenderQueue = [];
      for (const callback of pending)
        callback();
      if (this.#agingTimer !== null) {
        clearTimeout(this.#agingTimer);
        this.#agingTimer = null;
      }
      const nextBoundary = nextStateChangeMs(this.#events, now.epochMilliseconds, options.timeZone, visibleScope);
      if (nextBoundary !== null) {
        const delay = Math.min(Math.max(0, nextBoundary - now.epochMilliseconds), MAX_TIMEOUT_MS);
        if (delay > 0) {
          this.#agingTimer = window.setTimeout(() => {
            this.#agingTimer = null;
            if (!this.isConnected)
              return;
            this.#queueRender();
          }, delay);
        }
      }
    }
  }

  // src/index.js
  function defineCalendarView(name = "calendar-view") {
    if (!customElements.get(name)) {
      customElements.define(name, CalendarViewElement);
    }
  }

  // src/define.js
  defineCalendarView();
})();
