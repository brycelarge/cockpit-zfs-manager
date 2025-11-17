import React, { useState, useEffect } from 'react';

import { Button } from "@patternfly/react-core/dist/esm/components/Button";
import { Spinner } from "@patternfly/react-core/dist/esm/components/Spinner";
import { ListingTable } from 'cockpit-components-table.jsx';

import { useDialogs } from 'dialogs.jsx';
import { ZfsApi } from '../../zfsApi/index.js';
import CreateFileSystemDialog from './createFileSystemDialog.jsx';
import FileSystemActions from './fileSystemActions.jsx';

function PoolFileSystemsTab({ pool, onRefresh }) {
    const Dialogs = useDialogs();
    const [filesystems, setFilesystems] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadFileSystems();
    }, [pool.name]);

    const loadFileSystems = async () => {
        setLoading(true);
        try {
            const fs = await ZfsApi.listFileSystems(pool.name);
            setFilesystems(fs);
        } catch (error) {
            console.error('Failed to load file systems:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleRefresh = () => {
        loadFileSystems();
        onRefresh();
    };

    if (loading) {
        return <Spinner size="lg" aria-label="Loading file systems" />;
    }

    return (
        <>
            <div style={{ marginBottom: 'var(--pf-t--global--spacer--md)' }}>
                <Button
                    variant="secondary"
                    onClick={() => Dialogs.show(<CreateFileSystemDialog pool={pool} onRefresh={handleRefresh} />)}
                >
                    Create File System
                </Button>
            </div>
            <ListingTable
                aria-label="File systems"
                variant="compact"
                columns={[
                    { title: "Name", header: true, props: { width: 30 } },
                    { title: "Used", props: { width: 15 } },
                    { title: "Available", props: { width: 15 } },
                    { title: "Referenced", props: { width: 15 } },
                    { title: "Mountpoint", props: { width: 15 } },
                    { title: "", props: { width: 10, "aria-label": "Actions" } },
                ]}
                emptyCaption="No file systems found"
                rows={filesystems.map(fs => ({
                    columns: [
                        { title: fs.name, header: true },
                        { title: fs.used },
                        { title: fs.available },
                        { title: fs.referenced },
                        { title: fs.mountpoint || '-' },
                        { title: <FileSystemActions filesystem={fs} pool={pool} onRefresh={handleRefresh} /> },
                    ],
                    props: { key: fs.name },
                }))}
            />
        </>
    );
}

export default PoolFileSystemsTab;

