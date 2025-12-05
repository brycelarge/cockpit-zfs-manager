import React from 'react';

const SimpleLineChart = ({ data, title, color = '#0066cc', height = 150, yLabel = '%', subTitle, yMax = null }) => {
    // Ensure we have data, default to zeros if not
    const safeData = (data && data.length > 0) ? data : Array(60).fill(0);
    const currentValue = safeData[safeData.length - 1];

    // Determine max Y value for scaling
    let effectiveMax = yMax;
    if (effectiveMax === null) {
        const maxVal = Math.max(...safeData);
        // Auto-scale: at least 10, or 1.1x the max value for headroom
        effectiveMax = Math.max(maxVal * 1.1, 10);
    }

    const viewHeight = 100;
    const width = 100;

    // Construct SVG path
    const points = safeData.map((val, i) => {
        const x = (i / (safeData.length - 1)) * width;
        // Normalize value to viewHeight
        const normalizedVal = (val / effectiveMax) * viewHeight;
        const clampedVal = Math.max(0, Math.min(viewHeight, normalizedVal));
        const y = viewHeight - clampedVal;
        return `${x},${y}`;
    }).join(' ');

    // Area path (closed loop)
    const areaPath = `M0,${viewHeight} ${points} L${width},${viewHeight} Z`;

    // Helper for axis labels
    const formatAxisLabel = (val) => {
        if (val >= 1000) return (val / 1000).toFixed(1) + 'k';
        return val.toFixed(0);
    };

    return (
        <div className="chart-container" style={{ width: '100%', marginBottom: '1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '0.5rem' }}>
                <div>
                    <span style={{ fontWeight: 'bold', fontSize: 'var(--pf-t--global--font--size--md)' }}>{title}</span>
                    {subTitle && <span style={{ marginLeft: '0.5rem', fontSize: 'var(--pf-t--global--font--size--sm)', color: 'var(--pf-t--global--text--color--muted)' }}>{subTitle}</span>}
                </div>
                <span style={{ fontSize: 'var(--pf-t--global--font--size--lg)', fontWeight: 'bold' }}>
                    {currentValue.toFixed(1)}{yLabel}
                </span>
            </div>
            <div style={{
                height: `${height}px`,
                width: '100%',
                backgroundColor: 'transparent',
                position: 'relative',
                borderRadius: 'var(--pf-t--global--border--radius--small)'
            }}>
                <svg
                    viewBox={`0 0 ${width} ${viewHeight}`}
                    preserveAspectRatio="none"
                    style={{ width: '100%', height: '100%', display: 'block', overflow: 'visible' }}
                >
                    {/* Grid lines */}
                    <line x1="0" y1="0" x2="100" y2="0" stroke="var(--pf-t--global--border--color--default)" strokeWidth="0.5" vectorEffect="non-scaling-stroke" opacity="0.5" />
                    <line x1="0" y1="25" x2="100" y2="25" stroke="var(--pf-t--global--border--color--default)" strokeWidth="0.5" vectorEffect="non-scaling-stroke" opacity="0.5" />
                    <line x1="0" y1="50" x2="100" y2="50" stroke="var(--pf-t--global--border--color--default)" strokeWidth="0.5" vectorEffect="non-scaling-stroke" opacity="0.5" />
                    <line x1="0" y1="75" x2="100" y2="75" stroke="var(--pf-t--global--border--color--default)" strokeWidth="0.5" vectorEffect="non-scaling-stroke" opacity="0.5" />
                    <line x1="0" y1="100" x2="100" y2="100" stroke="var(--pf-t--global--border--color--default)" strokeWidth="0.5" vectorEffect="non-scaling-stroke" opacity="0.5" />

                    {/* Fill area */}
                    <path
                        d={areaPath}
                        fill={color}
                        fillOpacity="0.2"
                        stroke="none"
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

                {/* Y-Axis Labels Overlay */}
                <div style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    height: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    paddingLeft: '4px',
                    pointerEvents: 'none',
                    fontSize: '10px',
                    color: 'var(--pf-t--global--text--color--subtle)'
                }}>
                    <span>{formatAxisLabel(effectiveMax)}{yLabel.trim()}</span>
                    <span></span>
                    <span>{formatAxisLabel(effectiveMax / 2)}{yLabel.trim()}</span>
                    <span></span>
                    <span>0{yLabel.trim()}</span>
                </div>
            </div>
        </div>
    );
};

export default SimpleLineChart;
