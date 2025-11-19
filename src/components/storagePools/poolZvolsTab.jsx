import React, { useState, useEffect } from 'react';

import { Button } from "@patternfly/react-core/dist/esm/components/Button";
import { Spinner } from "@patternfly/react-core/dist/esm/components/Spinner";
import { ListingTable } from 'cockpit-components-table.jsx';

import { useDialogs } from 'dialogs.jsx';
import { ZfsApi } from '../../zfsApi/index.js';
import CreateZvolDialog from './createZvolDialog.jsx';
import ZvolActions from './zvolActions.jsx';

function PoolZvolsTab({ pool, onRefresh }) {
    const Dialogs = useDialogs();
    const [zvols, setZvols] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadZvols();
    }, [pool.name]);

    const loadZvols = async () => {
        setLoading(true);
        try {
            const vols = await ZfsApi.listZvols(pool.name);
            setZvols(vols);
        } catch (error) {
            console.error('Failed to load ZVOLs:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleRefresh = () => {
        loadZvols();
        onRefresh();
    };

    const handleCreateZvol = () => {
        Dialogs.show(<CreateZvolDialog pool={pool} onRefresh={handleRefresh} />);
    };

    if (loading) {
        return <Spinner size="lg" aria-label="Loading ZVOLs" />;
    }

    return (
        <>
            <div style={{ marginBottom: 'var(--pf-t--global--spacer--md)' }}>
                <Button variant="secondary" onClick={handleCreateZvol}>
                    Create ZVOL
                </Button>
            </div>
            <ListingTable
                aria-label="ZVOLs"
                variant="compact"
                columns={[
                    { title: "Name", header: true, props: { width: 30 } },
                    { title: "Size", props: { width: 20 } },
                    { title: "Used", props: { width: 20 } },
                    { title: "Block Size", props: { width: 20 } },
                    { title: "", props: { width: 10, "aria-label": "Actions" } },
                ]}
                emptyCaption="No ZVOL volumes found"
                rows={zvols.map(zvol => ({
                    columns: [
                        { title: zvol.name, header: true },
                        { title: zvol.volsize || '-' },
                        { title: zvol.used },
                        { title: zvol.volblocksize || '-' },
                        { title: <ZvolActions zvol={zvol} pool={pool} onRefresh={handleRefresh} /> },
                    ],
                    key: zvol.name,
                }))}
            />
        </>
    );
}

export default PoolZvolsTab;

