import React, { useState, useEffect } from 'react';

import { Button } from "@patternfly/react-core/dist/esm/components/Button";
import { Spinner } from "@patternfly/react-core/dist/esm/components/Spinner";
import { DescriptionList, DescriptionListGroup, DescriptionListTerm, DescriptionListDescription } from "@patternfly/react-core/dist/esm/components/DescriptionList";
import { Card, CardBody, CardTitle } from "@patternfly/react-core/dist/esm/components/Card";

import { ZfsApi } from '../../zfsApi/index.js';

function PerformanceStatsTab({ pool }) {
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);
    const [autoRefresh, setAutoRefresh] = useState(false);

    useEffect(() => {
        loadStats();
        
        let interval;
        if (autoRefresh) {
            interval = setInterval(() => {
                loadStats();
            }, 2000); // Refresh every 2 seconds
        }

        return () => {
            if (interval) {
                clearInterval(interval);
            }
        };
    }, [pool.name, autoRefresh]);

    const loadStats = async () => {
        try {
            const ioStats = await ZfsApi.getIOStats(pool.name);
            setStats(ioStats);
        } catch (error) {
            console.error('Failed to load I/O stats:', error);
        } finally {
            setLoading(false);
        }
    };

    if (loading && !stats) {
        return <Spinner size="lg" aria-label="Loading performance statistics" />;
    }

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--pf-t--global--spacer--md)' }}>
                <h3>Performance Statistics</h3>
                <div>
                    <Button
                        variant="secondary"
                        onClick={loadStats}
                        isDisabled={loading}
                    >
                        Refresh
                    </Button>
                    <Button
                        variant={autoRefresh ? 'primary' : 'secondary'}
                        onClick={() => setAutoRefresh(!autoRefresh)}
                        style={{ marginLeft: 'var(--pf-t--global--spacer--sm)' }}
                    >
                        {autoRefresh ? 'Stop Auto-Refresh' : 'Start Auto-Refresh'}
                    </Button>
                </div>
            </div>

            {stats && (
                <Card>
                    <CardTitle>I/O Statistics</CardTitle>
                    <CardBody>
                        <DescriptionList isHorizontal columnModifier={{ default: '2Col' }}>
                            <DescriptionListGroup>
                                <DescriptionListTerm>Read Operations</DescriptionListTerm>
                                <DescriptionListDescription>{stats.read.ops.toLocaleString()}/sec</DescriptionListDescription>
                            </DescriptionListGroup>
                            <DescriptionListGroup>
                                <DescriptionListTerm>Read Throughput</DescriptionListTerm>
                                <DescriptionListDescription>{stats.read.bytes}</DescriptionListDescription>
                            </DescriptionListGroup>
                            <DescriptionListGroup>
                                <DescriptionListTerm>Write Operations</DescriptionListTerm>
                                <DescriptionListDescription>{stats.write.ops.toLocaleString()}/sec</DescriptionListDescription>
                            </DescriptionListGroup>
                            <DescriptionListGroup>
                                <DescriptionListTerm>Write Throughput</DescriptionListTerm>
                                <DescriptionListDescription>{stats.write.bytes}</DescriptionListDescription>
                            </DescriptionListGroup>
                            <DescriptionListGroup>
                                <DescriptionListTerm>Total Operations</DescriptionListTerm>
                                <DescriptionListDescription>{stats.total.ops.toLocaleString()}/sec</DescriptionListDescription>
                            </DescriptionListGroup>
                        </DescriptionList>
                    </CardBody>
                </Card>
            )}

            <div style={{ marginTop: 'var(--pf-t--global--spacer--lg)' }}>
                <p style={{ color: 'var(--pf-t--global--text--color--muted)' }}>
                    Note: Performance statistics are collected from zpool iostat. Enable auto-refresh for real-time monitoring.
                </p>
            </div>
        </div>
    );
}

export default PerformanceStatsTab;

