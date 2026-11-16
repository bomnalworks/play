var toInt = function(num) {
    return ~~num;
};

var padLeft = function(str, length, char) {
    return str.length >= length ? str : new Array(length - str.length + 1).join(char) + str;
};

var LUN_TABLE = [ 50342582, 46534058, 50360036, 46403236, 46402890, 50222421, 46533271, 46400854, 50345309, 46533333, 50367442, 46401362, 46534309, 50223914, 46401099, 46533275, 50416294, 46400874, 46533465, 50342826, 46401362, 50359717, 46402341, 46402123, 50354523, 46533293, 46400874, 50341301, 46533545, 50363858, 46402962, 46402853, 50355501, 46401878, 46400181, 50481885, 46401236, 46534057, 50343626, 46403218, 50226854, 46400807, 46533207, 50420054, 46533338, 46401236, 50411345, 46401353, 50428691, 46402195, 46400811, 50423067, 46532973, 46533482, 50417060, 46402468, 46402377, 50343243, 46402197, 50363051, 46400813, 46533293, 50420394, 46534066, 46402980, 50413217, 46402890, 50367893, 46402198, 46400854, 50357621, 46533333, 46401234, 50349909, 46534309, 46403146, 50214478, 46533275, 50363094, 46400874, 46533465, 50355122, 46401362, 46401317, 50350891, 46402123, 50366891, 46400173, 46531947, 50423209, 46534057, 46402962, 50351509, 46402853, 50376269, 46402134, 46400182, 50490093, 46401236, 46534057, 50355922, 46403218, 46402854, 50214190, 46533207, 50366902, 46533466, 46401236, 50354025, 46401353, 46401171, 50350743, 46400811, 46533211, 50342574, 46400362, 50494933, 46402468, 46402377, 50355539, 46402197, 46400813, 50410797, 46533293, 50371498, 46400978, 46534053, 50355882, 46402890, 46402197, 50350749, 46400854, 46533301, 50342614, 46401234, 50358117, 46534309, 46403146, 50222678, 46533787, 46400858, 50345325, 46533481, 50380626, 46401362, 46402341, 50424587, 46402123, 46400683, 50352827, 46531949, 46533481, 50343338, 46402962, 50364069, 46402853, 46402125, 50420301, 46400182, 46532021, 79569 ];

var gan = [ "갑", "을", "병", "정", "무", "기", "경", "신", "임", "계" ];

var ji = [ "자", "축", "인", "묘", "진", "사", "오", "미", "신", "유", "술", "해" ];

var ganHanja = [ "甲", "乙", "丙", "丁", "戊", "己", "庚", "辛", "壬", "癸" ];

var jiHanja = [ "子", "丑", "寅", "卯", "辰", "巳", "午", "未", "申", "酉", "戌", "亥" ];

var BASE_YEAR$1 = 1890;

var BASE_MONTH$1 = 1;

var BASE_DAY$1 = 1;

var BASE_VALUE$1 = BASE_YEAR$1 * 1e4 + BASE_MONTH$1 * 100 + BASE_DAY$1;

var MAX_YEAR$1 = 2050;

var MAX_MONTH$1 = 11;

var MAX_DAY$1 = 18;

var MAX_VALUE$1 = MAX_YEAR$1 * 1e4 + MAX_MONTH$1 * 100 + MAX_DAY$1;

var SMALL_MONTH_DAY = 29;

var BIG_MONTH_DAY = 30;

var totalDaysBeforeYear$1 = [];

var getYearData = function(year) {
    year = toInt(year);
    return LUN_TABLE[year - BASE_YEAR$1];
};

var getMonthDays$1 = function(year, month) {
    month = toInt(month);
    var monthType = getYearData(year) >> month - 1 & 1;
    return monthType === 0 ? SMALL_MONTH_DAY : BIG_MONTH_DAY;
};

var getLeapMonth = function(year) {
    return getYearData(year) >> 12 & 15;
};

var hasLeapMonth = function(year) {
    return getLeapMonth(year) !== 0;
};

var isLeapMonth = function(year, month) {
    month = toInt(month);
    return month === getLeapMonth(year);
};

var getLeapMonthDays = function(year, month) {
    if (!isLeapMonth(year, month)) return 0;
    var monthType = getYearData(year) >> 16 & 1;
    return monthType === 0 ? SMALL_MONTH_DAY : BIG_MONTH_DAY;
};

var getYearDays$1 = function(year) {
    return getYearData(year) >> 17 & 511;
};

totalDaysBeforeYear$1[0] = 0;

for (var y$1 = BASE_YEAR$1 + 1; y$1 <= MAX_YEAR$1; y$1++) {
    var idx$1 = y$1 - BASE_YEAR$1;
    totalDaysBeforeYear$1[idx$1] = totalDaysBeforeYear$1[idx$1 - 1] + getYearDays$1(y$1 - 1);
}

var getTotalDaysBeforeYear$1 = function(year) {
    year = toInt(year);
    return totalDaysBeforeYear$1[year - BASE_YEAR$1];
};

var getTotalDaysBeforeMonth$1 = function(year, month, isLeapMonth) {
    month = toInt(month);
    var leapMonth = getLeapMonth(year);
    var days = 0;
    for (var m = 1; m < month; m++) {
        days += getMonthDays$1(year, m);
        if (m === leapMonth) {
            days += getLeapMonthDays(year, m);
        }
    }
    if (isLeapMonth && leapMonth === month) {
        days += getMonthDays$1(year, month);
    }
    return days;
};

var getTotalDays$1 = function(year, month, day, isLeapMonth) {
    day = toInt(day);
    var days = getTotalDaysBeforeYear$1(year) + getTotalDaysBeforeMonth$1(year, month, isLeapMonth) + day;
    return days;
};

var getMonthCount = function(year) {
    return hasLeapMonth(year) ? 13 : 12;
};

var monthsBeforeYear = [];

monthsBeforeYear[0] = 0;

for (var y$1 = BASE_YEAR$1 + 1; y$1 <= MAX_YEAR$1; y$1++) {
    var idx$1 = y$1 - BASE_YEAR$1;
    monthsBeforeYear[idx$1] = monthsBeforeYear[idx$1 - 1] + getMonthCount(y$1 - 1);
}

var getTotalMonthsBeforeYear = function(year) {
    year = toInt(year);
    return monthsBeforeYear[year - BASE_YEAR$1];
};

var getTotalMonths = function(year, month, isLeapMonth) {
    return getTotalMonthsBeforeYear(year) + getMonthIndex(year, month, isLeapMonth) + 1;
};

var fromTotalMonths = function(totalMonths) {
    totalMonths = toInt(totalMonths);
    var absIndex = totalMonths - 1;
    var lo = BASE_YEAR$1;
    var hi = MAX_YEAR$1;
    while (lo < hi) {
        var mid = lo + hi + 1 >>> 1;
        if (monthsBeforeYear[mid - BASE_YEAR$1] <= absIndex) {
            lo = mid;
        } else {
            hi = mid - 1;
        }
    }
    var year = lo;
    var monthIndex = absIndex - monthsBeforeYear[year - BASE_YEAR$1];
    var _a = getMonthFromIndex(year, monthIndex), month = _a.month, isLeapMonth = _a.isLeapMonth;
    return {
        year: year,
        month: month,
        isLeapMonth: isLeapMonth
    };
};

var BASE_JULIAN_DAY = 2411389;

var MAX_JULIAN_DAY = BASE_JULIAN_DAY + getTotalDays$1(MAX_YEAR$1, MAX_MONTH$1, MAX_DAY$1, false) - 1;

var sechaIndexes = function(year) {
    year = toInt(year);
    return [ (year + 6) % gan.length, (year + 8) % ji.length ];
};

var wolgeonIndexes = function(year, month) {
    year = toInt(year);
    month = toInt(month);
    return [ (year * 2 + month + 3) % gan.length, (month + 1) % ji.length ];
};

var iljinIndexes = function(julianDay) {
    julianDay = toInt(julianDay);
    return [ (julianDay - 1) % gan.length, (julianDay + 1) % ji.length ];
};

var getSecha = function(year) {
    var _a = sechaIndexes(year), g = _a[0], j = _a[1];
    return gan[g] + ji[j];
};

var getWolgeon = function(year, month) {
    var _a = wolgeonIndexes(year, month), g = _a[0], j = _a[1];
    return gan[g] + ji[j];
};

var getIljinByJulianDay = function(julianDay) {
    var _a = iljinIndexes(julianDay), g = _a[0], j = _a[1];
    return gan[g] + ji[j];
};

var getIljin = function(year, month, day, isLeapMonth) {
    var days = getTotalDays$1(year, month, day, isLeapMonth);
    return getIljinByJulianDay(BASE_JULIAN_DAY + days - 1);
};

var getSechaHanja = function(year) {
    var _a = sechaIndexes(year), g = _a[0], j = _a[1];
    return ganHanja[g] + jiHanja[j];
};

var getWolgeonHanja = function(year, month) {
    var _a = wolgeonIndexes(year, month), g = _a[0], j = _a[1];
    return ganHanja[g] + jiHanja[j];
};

var getIljinHanjaByJulianDay = function(julianDay) {
    var _a = iljinIndexes(julianDay), g = _a[0], j = _a[1];
    return ganHanja[g] + jiHanja[j];
};

var getIljinHanja = function(year, month, day, isLeapMonth) {
    var days = getTotalDays$1(year, month, day, isLeapMonth);
    return getIljinHanjaByJulianDay(BASE_JULIAN_DAY + days - 1);
};

var isDateInRange$1 = function(year, month, day) {
    year = toInt(year);
    month = toInt(month);
    day = toInt(day);
    var value = year * 1e4 + month * 100 + day;
    return value >= BASE_VALUE$1 && value <= MAX_VALUE$1;
};

var isValidDate$1 = function(year, month, day, isLeapMonth) {
    year = toInt(year);
    month = toInt(month);
    day = toInt(day);
    if (year < BASE_YEAR$1 || year > MAX_YEAR$1) return false;
    if (year === BASE_YEAR$1) {
        if (month < BASE_MONTH$1) return false;
        if (month === BASE_MONTH$1 && day < BASE_DAY$1) return false;
    }
    if (year === MAX_YEAR$1) {
        if (month > MAX_MONTH$1) return false;
        if (month === MAX_MONTH$1 && day > MAX_DAY$1) return false;
    }
    if (month < 1 || month > 12) return false;
    if (day < 1) return false;
    var endDay = isLeapMonth ? getLeapMonthDays(year, month) : getMonthDays$1(year, month);
    return day <= endDay;
};

var getMonthIndex = function(year, month, isLeapMonth) {
    month = toInt(month);
    var index = month;
    if (hasLeapMonth(year)) {
        var leapMonth = getLeapMonth(year);
        if (isLeapMonth && month === leapMonth || month > leapMonth) {
            index++;
        }
    }
    return index - 1;
};

var getMonthFromIndex = function(year, monthIndex) {
    monthIndex = toInt(monthIndex);
    var leapMonth = getLeapMonth(year);
    var isLeapMonth = false;
    var index = monthIndex;
    if (leapMonth > 0) {
        if (index === leapMonth) {
            isLeapMonth = true;
        }
        if (index >= leapMonth) {
            index--;
        }
    }
    return {
        month: index + 1,
        isLeapMonth: isLeapMonth
    };
};

var LunarTable = Object.freeze({
    __proto__: null,
    BASE_DAY: BASE_DAY$1,
    BASE_JULIAN_DAY: BASE_JULIAN_DAY,
    BASE_MONTH: BASE_MONTH$1,
    BASE_VALUE: BASE_VALUE$1,
    BASE_YEAR: BASE_YEAR$1,
    MAX_DAY: MAX_DAY$1,
    MAX_JULIAN_DAY: MAX_JULIAN_DAY,
    MAX_MONTH: MAX_MONTH$1,
    MAX_VALUE: MAX_VALUE$1,
    MAX_YEAR: MAX_YEAR$1,
    fromTotalMonths: fromTotalMonths,
    getIljin: getIljin,
    getIljinByJulianDay: getIljinByJulianDay,
    getIljinHanja: getIljinHanja,
    getIljinHanjaByJulianDay: getIljinHanjaByJulianDay,
    getLeapMonth: getLeapMonth,
    getLeapMonthDays: getLeapMonthDays,
    getMonthCount: getMonthCount,
    getMonthDays: getMonthDays$1,
    getMonthFromIndex: getMonthFromIndex,
    getMonthIndex: getMonthIndex,
    getSecha: getSecha,
    getSechaHanja: getSechaHanja,
    getTotalDays: getTotalDays$1,
    getTotalDaysBeforeMonth: getTotalDaysBeforeMonth$1,
    getTotalDaysBeforeYear: getTotalDaysBeforeYear$1,
    getTotalMonths: getTotalMonths,
    getTotalMonthsBeforeYear: getTotalMonthsBeforeYear,
    getWolgeon: getWolgeon,
    getWolgeonHanja: getWolgeonHanja,
    getYearDays: getYearDays$1,
    hasLeapMonth: hasLeapMonth,
    isDateInRange: isDateInRange$1,
    isLeapMonth: isLeapMonth,
    isValidDate: isValidDate$1
});

var MONTH_DAYS = [ 31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31 ];

var LEAP_FEBRUARY_DAY = 29;

var YEAR_DAY = 365;

var LEAP_YEAR_DAY = 366;

var BASE_YEAR = 1890;

var BASE_MONTH = 1;

var BASE_DAY = 21;

var BASE_VALUE = BASE_YEAR * 1e4 + BASE_MONTH * 100 + BASE_DAY;

var MAX_YEAR = 2050;

var MAX_MONTH = 12;

var MAX_DAY = 31;

var MAX_VALUE = MAX_YEAR * 1e4 + MAX_MONTH * 100 + MAX_DAY;

var totalDaysBeforeYear = [];

var isLeapYear = function(year) {
    year = toInt(year);
    return year % 4 === 0 && year % 100 !== 0 || year % 400 === 0;
};

var getMonthDays = function(year, month) {
    month = toInt(month);
    var day = month === 2 && isLeapYear(year) ? LEAP_FEBRUARY_DAY : MONTH_DAYS[month - 1];
    return day;
};

var getYearDays = function(year) {
    var day = isLeapYear(year) ? LEAP_YEAR_DAY : YEAR_DAY;
    return day;
};

totalDaysBeforeYear[0] = 0;

for (var y = BASE_YEAR + 1; y <= MAX_YEAR; y++) {
    var idx = y - BASE_YEAR;
    totalDaysBeforeYear[idx] = totalDaysBeforeYear[idx - 1] + getYearDays(y - 1);
}

var getTotalDaysBeforeYear = function(year) {
    year = toInt(year);
    return totalDaysBeforeYear[year - BASE_YEAR];
};

var getTotalDaysBeforeMonth = function(year, month) {
    var day = 0;
    for (var m = 1; m < month; m++) {
        day += getMonthDays(year, m);
    }
    return day;
};

var getTotalDays = function(year, month, day) {
    var days = getTotalDaysBeforeYear(year) + getTotalDaysBeforeMonth(year, month) + day;
    return days;
};

var isDateInRange = function(year, month, day) {
    year = toInt(year);
    month = toInt(month);
    day = toInt(day);
    var value = year * 1e4 + month * 100 + day;
    return value >= BASE_VALUE && value <= MAX_VALUE;
};

var isValidDate = function(year, month, day) {
    year = toInt(year);
    month = toInt(month);
    day = toInt(day);
    if (year < BASE_YEAR || year > MAX_YEAR) return false;
    if (year === BASE_YEAR) {
        if (month < BASE_MONTH) return false;
        if (month === BASE_MONTH && day < BASE_DAY) return false;
    }
    if (year === MAX_YEAR) {
        if (month > MAX_MONTH) return false;
        if (month === MAX_MONTH && day > MAX_DAY) return false;
    }
    if (month < 1 || month > 12) return false;
    if (day < 1) return false;
    var endDay = getMonthDays(year, month);
    return day <= endDay;
};

var SolarTable = Object.freeze({
    __proto__: null,
    BASE_DAY: BASE_DAY,
    BASE_MONTH: BASE_MONTH,
    BASE_VALUE: BASE_VALUE,
    BASE_YEAR: BASE_YEAR,
    MAX_DAY: MAX_DAY,
    MAX_MONTH: MAX_MONTH,
    MAX_VALUE: MAX_VALUE,
    MAX_YEAR: MAX_YEAR,
    getMonthDays: getMonthDays,
    getTotalDays: getTotalDays,
    getTotalDaysBeforeMonth: getTotalDaysBeforeMonth,
    getTotalDaysBeforeYear: getTotalDaysBeforeYear,
    getYearDays: getYearDays,
    isDateInRange: isDateInRange,
    isLeapYear: isLeapYear,
    isValidDate: isValidDate
});

var SOLAR_LUNAR_DAY_DIFF = 20;

var toLunar = function(solYear, solMonth, solDay) {
    solYear = toInt(solYear);
    solMonth = toInt(solMonth);
    solDay = toInt(solDay);
    if (!isDateInRange(solYear, solMonth, solDay)) {
        throw new RangeError("지원되지 않는 날짜입니다. 입력한 날짜: ".concat(solYear, "-").concat(solMonth, "-").concat(solDay));
    }
    var year = Math.min(solYear, MAX_YEAR$1);
    var month = solYear > MAX_YEAR$1 ? MAX_MONTH$1 : solMonth;
    var day = 1;
    var lunTotalDays = getTotalDays$1(year, month, day, true);
    var solTotalDays = getTotalDays(solYear, solMonth, solDay);
    var diffDays = solTotalDays - SOLAR_LUNAR_DAY_DIFF - lunTotalDays;
    day += diffDays;
    var day2 = solTotalDays - SOLAR_LUNAR_DAY_DIFF;
    var julianDay = BASE_JULIAN_DAY + day2 - 1;
    var dayOfWeek = (day2 + 1) % 7;
    var isLeapMonth = month === getLeapMonth(year);
    var monthDays;
    while (day < 1) {
        if (isLeapMonth) {
            isLeapMonth = false;
        } else {
            month--;
            if (month === 0) {
                month = 12;
                year--;
            }
            isLeapMonth = month === getLeapMonth(year);
        }
        monthDays = isLeapMonth ? getLeapMonthDays(year, month) : getMonthDays$1(year, month);
        day += monthDays;
    }
    return {
        year: year,
        month: month,
        day: day,
        isLeapMonth: isLeapMonth,
        secha: getSecha(year),
        sechaHanja: getSechaHanja(year),
        wolgeon: isLeapMonth ? "" : getWolgeon(year, month),
        wolgeonHanja: isLeapMonth ? "" : getWolgeonHanja(year, month),
        iljin: getIljinByJulianDay(julianDay),
        iljinHanja: getIljinHanjaByJulianDay(julianDay),
        julianDay: julianDay,
        dayOfWeek: dayOfWeek
    };
};

var toSolar = function(lunYear, lunMonth, lunDay, isLeapMonth) {
    if (isLeapMonth === void 0) {
        isLeapMonth = false;
    }
    lunYear = toInt(lunYear);
    lunMonth = toInt(lunMonth);
    lunDay = toInt(lunDay);
    if (!isDateInRange$1(lunYear, lunMonth, lunDay)) {
        throw new RangeError("지원되지 않는 날짜입니다. 입력한 날짜: ".concat(lunYear, "-").concat(lunMonth, "-").concat(lunDay));
    }
    var lunTotalDays = getTotalDays$1(lunYear, lunMonth, lunDay, isLeapMonth);
    var solTotalDays = getTotalDays(lunYear, lunMonth, lunDay);
    var diffDays = lunTotalDays - (solTotalDays - SOLAR_LUNAR_DAY_DIFF);
    var year = lunYear;
    var month = lunMonth;
    var day = lunDay + diffDays;
    var monthDays = getMonthDays(year, month);
    while (day > monthDays) {
        day -= monthDays;
        month++;
        if (month > 12) {
            month = 1;
            year++;
        }
        monthDays = getMonthDays(year, month);
    }
    return {
        year: year,
        month: month,
        day: day
    };
};

var fromJulianDay = function(julianDay) {
    julianDay = toInt(julianDay);
    if (julianDay < BASE_JULIAN_DAY || julianDay > MAX_JULIAN_DAY) {
        throw new RangeError("지원되지 않는 julianDay입니다. 입력한 값: ".concat(julianDay));
    }
    var lunCumDay = julianDay - BASE_JULIAN_DAY + 1;
    var lo = BASE_YEAR$1;
    var hi = MAX_YEAR$1;
    while (lo < hi) {
        var mid = lo + hi + 1 >>> 1;
        if (getTotalDaysBeforeYear$1(mid) < lunCumDay) {
            lo = mid;
        } else {
            hi = mid - 1;
        }
    }
    var year = lo;
    var day = lunCumDay - getTotalDaysBeforeYear$1(year);
    var leapMonth = getLeapMonth(year);
    var month = 0;
    var isLeapMonth = false;
    var monthDays;
    for (var m = 1; m <= 12; m++) {
        monthDays = getMonthDays$1(year, m);
        if (day <= monthDays) {
            month = m;
            isLeapMonth = false;
            break;
        }
        day -= monthDays;
        if (m === leapMonth) {
            monthDays = getLeapMonthDays(year, m);
            if (day <= monthDays) {
                month = m;
                isLeapMonth = true;
                break;
            }
            day -= monthDays;
        }
    }
    var day2 = julianDay - BASE_JULIAN_DAY + 1;
    var dayOfWeek = (day2 + 1) % 7;
    return {
        year: year,
        month: month,
        day: day,
        isLeapMonth: isLeapMonth,
        secha: getSecha(year),
        sechaHanja: getSechaHanja(year),
        wolgeon: isLeapMonth ? "" : getWolgeon(year, month),
        wolgeonHanja: isLeapMonth ? "" : getWolgeonHanja(year, month),
        iljin: getIljinByJulianDay(julianDay),
        iljinHanja: getIljinHanjaByJulianDay(julianDay),
        julianDay: julianDay,
        dayOfWeek: dayOfWeek
    };
};

var LunarData = LunarTable;

var SolarData = SolarTable;

var LunarCalendar = function() {
    function LunarCalendar(julianDay) {
        var jd = toInt(julianDay);
        if (jd < BASE_JULIAN_DAY || jd > MAX_JULIAN_DAY) {
            throw new RangeError("지원되지 않는 julianDay입니다. 입력한 값: ".concat(julianDay));
        }
        this._julianDay = jd;
    }
    LunarCalendar.isValid = function(year, month, day, isLeapMonth) {
        if (isLeapMonth === void 0) {
            isLeapMonth = false;
        }
        return isValidDate$1(year, month, day, isLeapMonth);
    };
    LunarCalendar.of = function(year, month, day, isLeapMonth) {
        if (isLeapMonth === void 0) {
            isLeapMonth = false;
        }
        if (!isValidDate$1(year, month, day, isLeapMonth)) {
            var leapStr = isLeapMonth ? "(윤)" : "";
            throw new RangeError("유효하지 않은 음력 날짜입니다: ".concat(year, "-").concat(month, "-").concat(day).concat(leapStr));
        }
        var totalDays = getTotalDays$1(year, month, day, isLeapMonth);
        var julianDay = BASE_JULIAN_DAY + totalDays - 1;
        return new LunarCalendar(julianDay);
    };
    LunarCalendar.fromLunarDate = function(lunarDate) {
        return new LunarCalendar(lunarDate.julianDay);
    };
    LunarCalendar.from = function(lunarDate) {
        return LunarCalendar.fromLunarDate(lunarDate);
    };
    LunarCalendar.fromSolar = function(year, month, day) {
        var lunar = toLunar(year, month, day);
        return new LunarCalendar(lunar.julianDay);
    };
    LunarCalendar.fromJulianDay = function(julianDay) {
        return new LunarCalendar(julianDay);
    };
    LunarCalendar.today = function() {
        var now = new Date;
        return LunarCalendar.fromSolar(now.getFullYear(), now.getMonth() + 1, now.getDate());
    };
    LunarCalendar.prototype._resolve = function() {
        if (!this._cache) {
            this._cache = fromJulianDay(this._julianDay);
        }
        return this._cache;
    };
    Object.defineProperty(LunarCalendar.prototype, "year", {
        get: function() {
            return this._resolve().year;
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(LunarCalendar.prototype, "month", {
        get: function() {
            return this._resolve().month;
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(LunarCalendar.prototype, "day", {
        get: function() {
            return this._resolve().day;
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(LunarCalendar.prototype, "isLeapMonth", {
        get: function() {
            return this._resolve().isLeapMonth;
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(LunarCalendar.prototype, "julianDay", {
        get: function() {
            return this._julianDay;
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(LunarCalendar.prototype, "dayOfWeek", {
        get: function() {
            return this._resolve().dayOfWeek;
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(LunarCalendar.prototype, "daysInMonth", {
        get: function() {
            var cur = this._resolve();
            return cur.isLeapMonth ? getLeapMonthDays(cur.year, cur.month) : getMonthDays$1(cur.year, cur.month);
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(LunarCalendar.prototype, "secha", {
        get: function() {
            return this._resolve().secha;
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(LunarCalendar.prototype, "sechaHanja", {
        get: function() {
            return this._resolve().sechaHanja;
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(LunarCalendar.prototype, "wolgeon", {
        get: function() {
            return this._resolve().wolgeon;
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(LunarCalendar.prototype, "wolgeonHanja", {
        get: function() {
            return this._resolve().wolgeonHanja;
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(LunarCalendar.prototype, "iljin", {
        get: function() {
            return this._resolve().iljin;
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(LunarCalendar.prototype, "iljinHanja", {
        get: function() {
            return this._resolve().iljinHanja;
        },
        enumerable: false,
        configurable: true
    });
    LunarCalendar.prototype.addDays = function(days) {
        return new LunarCalendar(this._julianDay + days);
    };
    LunarCalendar.prototype.addMonths = function(months) {
        var cur = this._resolve();
        var totalMonths = getTotalMonths(cur.year, cur.month, cur.isLeapMonth);
        var targetTotalMonths = totalMonths + months;
        var _a = fromTotalMonths(targetTotalMonths), year = _a.year, month = _a.month, isLeapMonth = _a.isLeapMonth;
        var maxDay = isLeapMonth ? getLeapMonthDays(year, month) : getMonthDays$1(year, month);
        var day = Math.min(cur.day, maxDay);
        return LunarCalendar.of(year, month, day, isLeapMonth);
    };
    LunarCalendar.prototype.addYears = function(years) {
        var cur = this._resolve();
        var targetYear = cur.year + years;
        var isLeapMonth = cur.isLeapMonth;
        if (isLeapMonth && getLeapMonth(targetYear) !== cur.month) {
            isLeapMonth = false;
        }
        var maxDay = isLeapMonth ? getLeapMonthDays(targetYear, cur.month) : getMonthDays$1(targetYear, cur.month);
        var day = Math.min(cur.day, maxDay);
        return LunarCalendar.of(targetYear, cur.month, day, isLeapMonth);
    };
    LunarCalendar.prototype.toSolar = function() {
        var cur = this._resolve();
        return toSolar(cur.year, cur.month, cur.day, cur.isLeapMonth);
    };
    LunarCalendar.prototype.toLunarDate = function() {
        var c = this._resolve();
        return {
            year: c.year,
            month: c.month,
            day: c.day,
            isLeapMonth: c.isLeapMonth,
            secha: c.secha,
            sechaHanja: c.sechaHanja,
            wolgeon: c.wolgeon,
            wolgeonHanja: c.wolgeonHanja,
            iljin: c.iljin,
            iljinHanja: c.iljinHanja,
            julianDay: c.julianDay,
            dayOfWeek: c.dayOfWeek
        };
    };
    LunarCalendar.prototype.equals = function(other) {
        return this._julianDay === other._julianDay;
    };
    LunarCalendar.prototype.isBefore = function(other) {
        return this._julianDay < other._julianDay;
    };
    LunarCalendar.prototype.isAfter = function(other) {
        return this._julianDay > other._julianDay;
    };
    LunarCalendar.prototype.diffDays = function(other) {
        return this._julianDay - other._julianDay;
    };
    LunarCalendar.prototype.diffMonths = function(other) {
        var a = this._resolve();
        var b = other._resolve();
        return getTotalMonths(a.year, a.month, a.isLeapMonth) - getTotalMonths(b.year, b.month, b.isLeapMonth);
    };
    LunarCalendar.prototype.diffFullMonths = function(other) {
        var n = this.diffMonths(other);
        if (n > 0 && other.addMonths(n).isAfter(this)) {
            n--;
        } else if (n < 0 && other.addMonths(n).isBefore(this)) {
            n++;
        }
        return n;
    };
    LunarCalendar.prototype.toString = function() {
        var cur = this._resolve();
        var mm = padLeft(cur.month.toString(), 2, "0");
        var dd = padLeft(cur.day.toString(), 2, "0");
        var monthStr = cur.isLeapMonth ? "윤".concat(mm) : mm;
        return "".concat(cur.year, "-").concat(monthStr, "-").concat(dd);
    };
    LunarCalendar.prototype.toTraditionalString = function() {
        var cur = this._resolve();
        var monthNames = [ "정월", "이월", "삼월", "사월", "오월", "유월", "칠월", "팔월", "구월", "시월", "동짓달", "섣달" ];
        var dayNames = [ "하루", "이틀", "사흘", "나흘", "닷새", "엿새", "이레", "여드레", "아흐레", "열흘" ];
        var monthPrefix = cur.isLeapMonth ? "윤" : "";
        var monthStr = monthPrefix + monthNames[cur.month - 1];
        var maxDay = this.daysInMonth;
        var dayStr;
        if (cur.day === maxDay) {
            dayStr = "그믐";
        } else if (cur.day <= 10) {
            dayStr = "초" + dayNames[cur.day - 1];
        } else if (cur.day === 15) {
            dayStr = "보름";
        } else if (cur.day < 20) {
            dayStr = "열" + dayNames[cur.day - 11];
        } else if (cur.day === 20) {
            dayStr = "스무날";
        } else {
            dayStr = "스무" + dayNames[cur.day - 21];
        }
        return "".concat(cur.secha, "년 ").concat(monthStr, " ").concat(dayStr);
    };
    LunarCalendar.MIN = new LunarCalendar(BASE_JULIAN_DAY);
    LunarCalendar.MAX = new LunarCalendar(MAX_JULIAN_DAY);
    return LunarCalendar;
}();

var korLunar = {
    toLunar: toLunar,
    toSolar: toSolar,
    fromJulianDay: fromJulianDay,
    LunarTable: LunarTable,
    SolarTable: SolarTable,
    LunarData: LunarData,
    SolarData: SolarData,
    LunarCalendar: LunarCalendar
};

export { LunarCalendar, LunarData, LunarTable, SolarData, SolarTable, korLunar as default, fromJulianDay, toLunar, toSolar };
