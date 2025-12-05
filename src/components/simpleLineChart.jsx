import React from 'react';

const SimpleLineChart = ({ data, title, color = '#0066cc', height = 120, yLabel = '%' }) => {
    if (!data || data.length < 2) return null;

    const width = 100; // Use 100% viewbox width
    const maxY = 100;
    const points = data.map((val, i) => {
        const x = (i / (data.length - 1)) * width;
        // Clamp value between 0 and 100
        const clampedVal = Math.max(0, Math.min(100, val));
        const y = maxY - clampedVal; // Invert Y because SVG 0 is top
        return `${x},${y}`;
    }).join(' ');

    return (
        <div className="chart-container" style={{ width: '100%', marginBottom: '1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', fontSize: 'var(--pf-t--global--font--size--sm)' }}>
                <span style={{ fontWeight: 'bold' }}>{title}</span>
                <span style={{ color: 'var(--pf-t--global--text--color--muted)' }}>{data[data.length - 1].toFixed(1)}{yLabel}</span>
            </div>
            <div style={{ height: `${height}px`, width: '100%', border: '1px solid var(--pf-t--global--border--color--default)', padding: '10px', borderRadius: '4px', backgroundColor: 'var(--pf-t--global--background--color--100)' }}>
                <svg viewBox={`0 0 ${width} ${maxY}`} preserveAspectRatio="none" style={{ width: '100%', height: '100%', overflow: 'visible' }}>
                    {/* Grid lines */}
                    <line x1="0" y1="0" x2="100" y2="0" stroke="var(--pf-t--global--border--color--default)" strokeWidth="0.5" vectorEffect="non-scaling-stroke" />
                    <line x1="0" y1="25" x2="100" y2="25" stroke="var(--pf-t--global--border--color--default)" strokeWidth="0.5" vectorEffect="non-scaling-stroke" strokeDasharray="2" />
                    <line x1="0" y1="50" x2="100" y2="50" stroke="var(--pf-t--global--border--color--default)" strokeWidth="0.5" vectorEffect="non-scaling-stroke" />
                    <line x1="0" y1="75" x2="100" y2="75" stroke="var(--pf-t--global--border--color--default)" strokeWidth="0.5" vectorEffect="non-scaling-stroke" strokeDasharray="2" />
                    <line x1="0" y1="100" x2="100" y2="100" stroke="var(--pf-t--global--border--color--default)" strokeWidth="0.5" vectorEffect="non-scaling-stroke" />

                    {/* Fill area */}
                    <path
                        d={`M0,${maxY} ${points} L${width},${maxY} Z`}
                        fill={color}
                        fillOpacity="0.1"
                    />
                    {/* Line */}
                    <polyline
                        points={points}
                        fill="none"
                        stroke={color}
                        strokeWidth="2"
                        vectorEffect="non-scaling-stroke"
                    />
                </svg>
            </div>
        </div>
    );
};

export default SimpleLineChart;
