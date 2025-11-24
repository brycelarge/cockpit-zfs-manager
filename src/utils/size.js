export function parseSizeToBytes(sizeStr) {
    if (sizeStr === null || sizeStr === undefined) {
        return 0;
    }

    const normalized = sizeStr.toString().trim().toUpperCase();

    if (!normalized || normalized === '-' || normalized === 'NONE') {
        return 0;
    }

    // Match patterns like "4.8T", "4.8TB", "4.8 TiB", "500G", "123456"
    const match = normalized.match(/^(-?[\d.,]+)\s*([KMGTPEZY]?)(I?B)?$/);
    if (match) {
        const value = parseFloat(match[1].replace(/,/g, ''));
        if (Number.isNaN(value)) {
            return 0;
        }

        const unit = match[2] || '';
        const multiplierMap = {
            '': 1,
            'B': 1,
            'K': 1024,
            'M': 1024 ** 2,
            'G': 1024 ** 3,
            'T': 1024 ** 4,
            'P': 1024 ** 5,
            'E': 1024 ** 6,
            'Z': 1024 ** 7,
            'Y': 1024 ** 8
        };

        return value * (multiplierMap[unit] || 1);
    }

    // Fallback: strip non-numeric characters and try to parse
    const fallbackValue = parseFloat(normalized.replace(/[^0-9.-]/g, ''));
    return Number.isNaN(fallbackValue) ? 0 : fallbackValue;
}

export function formatBytes(bytes, decimals = 1) {
    if (!bytes || Number.isNaN(bytes) || !Number.isFinite(bytes)) {
        return '0 B';
    }
    if (bytes < 1024) {
        return `${bytes} B`;
    }

    const units = ['B', 'KiB', 'MiB', 'GiB', 'TiB', 'PiB', 'EiB'];
    const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
    const value = bytes / (1024 ** exponent);
    return `${value.toFixed(decimals)} ${units[exponent]}`;
}

