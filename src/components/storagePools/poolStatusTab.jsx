import React, { useState, useEffect } from 'react';

import { DescriptionList, DescriptionListGroup, DescriptionListTerm, DescriptionListDescription } from "@patternfly/react-core/dist/esm/components/DescriptionList";
import { Spinner } from "@patternfly/react-core/dist/esm/components/Spinner";

import { ZfsApi } from '../../zfsApi/index.js';

function PoolStatusTab({ pool }) {
    const [status, setStatus] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadStatus();
    }, [pool.name]);

    const loadStatus = async () => {
        setLoading(true);
        try {
            // Get detailed pool status using zpool status
            const proc = window.cockpit.spawn(['zpool', 'status', pool.name]);
            let output = '';
            
            proc.stream((data) => {
                output += data;
            });

            proc.done((exitCode) => {
                if (exitCode === 0) {
                    setStatus(output);
                } else {
                    setStatus('Failed to get pool status');
                }
                setLoading(false);
            });

            proc.fail((error) => {
                setStatus(`Error: ${error}`);
                setLoading(false);
            });
        } catch (error) {
            setStatus(`Error: ${error.message}`);
            setLoading(false);
        }
    };

    if (loading) {
        return <Spinner size="lg" aria-label="Loading pool status" />;
    }

    return (
        <div>
            <DescriptionList isHorizontal>
                <DescriptionListGroup>
                    <DescriptionListTerm>Pool Name</DescriptionListTerm>
                    <DescriptionListDescription>{pool.name}</DescriptionListDescription>
                </DescriptionListGroup>
                <DescriptionListGroup>
                    <DescriptionListTerm>Health</DescriptionListTerm>
                    <DescriptionListDescription>{pool.health}</DescriptionListDescription>
                </DescriptionListGroup>
                <DescriptionListGroup>
                    <DescriptionListTerm>Size</DescriptionListTerm>
                    <DescriptionListDescription>{pool.size}</DescriptionListDescription>
                </DescriptionListGroup>
                <DescriptionListGroup>
                    <DescriptionListTerm>Allocated</DescriptionListTerm>
                    <DescriptionListDescription>{pool.allocated}</DescriptionListDescription>
                </DescriptionListGroup>
                <DescriptionListGroup>
                    <DescriptionListTerm>Free</DescriptionListTerm>
                    <DescriptionListDescription>{pool.free}</DescriptionListDescription>
                </DescriptionListGroup>
                <DescriptionListGroup>
                    <DescriptionListTerm>Fragmentation</DescriptionListTerm>
                    <DescriptionListDescription>{pool.fragmentation}</DescriptionListDescription>
                </DescriptionListGroup>
            </DescriptionList>
            {status && (
                <div style={{ marginTop: 'var(--pf-t--global--spacer--lg)' }}>
                    <h3>Detailed Status</h3>
                    <pre style={{ 
                        background: 'var(--pf-t--global--background--color--200)', 
                        padding: 'var(--pf-t--global--spacer--md)',
                        borderRadius: 'var(--pf-t--global--border--radius--small)',
                        overflow: 'auto',
                        maxHeight: '400px'
                    }}>
                        {status}
                    </pre>
                </div>
            )}
        </div>
    );
}

export default PoolStatusTab;

