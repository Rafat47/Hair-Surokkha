function toNumber(value) {
    if (typeof value === 'string') value = value.trim();
    if (value === '' || value == null) return NaN;
    return Number(value);
}

module.exports = { toNumber };